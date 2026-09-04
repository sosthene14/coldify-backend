import { eq, sql } from "drizzle-orm"
import { db } from "../../shared"
import type { TenantContext } from "../../shared/plugins/tenant"
import { lead } from "../lead/lead.schema"
import { emailEvent, type emailEventType } from "./reporting.schema"

type EventType = (typeof emailEventType.enumValues)[number]

const dayKey = (d: Date) => d.toISOString().slice(0, 10)

export const reportingService = {
  async recordEvent(params: {
    organizationId: string
    mailId: string
    leadId: string
    type: EventType
    templateId?: string
    memberId?: string
    metadata?: Record<string, unknown>
  }) {
    await db.insert(emailEvent).values({
      id: crypto.randomUUID(),
      ...params,
      occurredAt: new Date(),
    })
  },

  /** Cartes KPI (Overview), avec % de variation vs période précédente */
  async getOverviewStats(tenant: TenantContext, from: string, to: string) {
    const current = await sumFromCagg(tenant.organizationId, from, to)

    const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000)
    const prevTo = dayKey(new Date(new Date(from).getTime() - 86_400_000))
    const prevFrom = dayKey(new Date(new Date(from).getTime() - (days + 1) * 86_400_000))
    const previous = await sumFromCagg(tenant.organizationId, prevFrom, prevTo)

    const rate = (n: number, d: number) => (d > 0 ? +(100 * (n / d)).toFixed(1) : 0)
    const change = (curr: number, prev: number) => (prev > 0 ? +(100 * ((curr - prev) / prev)).toFixed(1) : 0)

    return {
      emailsSent: current.sentCount,
      emailsSentChange: change(current.sentCount, previous.sentCount),
      openRate: rate(current.openedCount, current.sentCount),
      openRateChange: change(
        rate(current.openedCount, current.sentCount),
        rate(previous.openedCount, previous.sentCount),
      ),
      replyRate: rate(current.repliedCount, current.sentCount),
      replyRateChange: change(
        rate(current.repliedCount, current.sentCount),
        rate(previous.repliedCount, previous.sentCount),
      ),
      clickRate: rate(current.clickedCount, current.sentCount),
      clickRateChange: change(
        rate(current.clickedCount, current.sentCount),
        rate(previous.clickedCount, previous.sentCount),
      ),
      meetingsBooked: current.meetingsBookedCount,
      meetingsBookedChange: change(current.meetingsBookedCount, previous.meetingsBookedCount),
    }
  },

  /** Courbe "Engagement over time" — un point par jour, sommé toutes campagnes */
  async getEngagementOverTime(tenant: TenantContext, from: string, to: string) {
    const result = await db.execute(sql`
      SELECT
        day,
        SUM(sent_count)::int AS sent,
        SUM(opened_count)::int AS opened,
        SUM(replied_count)::int AS replied
      FROM campaign_daily_stat_cagg
      WHERE organization_id = ${tenant.organizationId}
        AND day >= ${from}
        AND day <= ${to}
      GROUP BY day
      ORDER BY day
    `)

    return result as unknown as { day: string; sent: number; opened: number; replied: number }[]
  },

  /** Tab "Team" — breakdown par membre */
  async getTeamStats(tenant: TenantContext, from: string, to: string) {
    const result = await db.execute(sql`
      SELECT
        member_id,
        SUM(sent_count)::int AS sent,
        SUM(opened_count)::int AS opened,
        SUM(replied_count)::int AS replied,
        SUM(meetings_booked_count)::int AS meetings_booked
      FROM member_daily_stat_cagg
      WHERE organization_id = ${tenant.organizationId}
        AND day >= ${from}
        AND day <= ${to}
      GROUP BY member_id
    `)

    return result as unknown as {
      member_id: string
      sent: number
      opened: number
      replied: number
      meetings_booked: number
    }[]
  },

  /** Tab "Leads Funnel" — direct sur lead.status, pas de cagg nécessaire */
  async getLeadsFunnel(tenant: TenantContext) {
    return db
      .select({ status: lead.status, count: sql<number>`count(*)` })
      .from(lead)
      .where(eq(lead.organizationId, tenant.organizationId))
      .groupBy(lead.status)
  },
}

async function sumFromCagg(organizationId: string, from: string, to: string) {
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(sent_count), 0)::int AS sent_count,
      COALESCE(SUM(opened_count), 0)::int AS opened_count,
      COALESCE(SUM(clicked_count), 0)::int AS clicked_count,
      COALESCE(SUM(replied_count), 0)::int AS replied_count,
      COALESCE(SUM(meetings_booked_count), 0)::int AS meetings_booked_count
    FROM campaign_daily_stat_cagg
    WHERE organization_id = ${organizationId}
      AND day >= ${from}
      AND day <= ${to}
  `)

  const rows = result as unknown as {
    sent_count: number
    opened_count: number
    clicked_count: number
    replied_count: number
    meetings_booked_count: number
  }[]

  const row = rows[0]

  return {
    sentCount: row?.sent_count ?? 0,
    openedCount: row?.opened_count ?? 0,
    clickedCount: row?.clicked_count ?? 0,
    repliedCount: row?.replied_count ?? 0,
    meetingsBookedCount: row?.meetings_booked_count ?? 0,
  }
}
