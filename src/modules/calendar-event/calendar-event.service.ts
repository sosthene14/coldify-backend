import { and, eq, gte, lte } from "drizzle-orm"
import { db, type TenantContext } from "../../shared"
import { member } from "../../shared/db/schema"
import { calendarEvent, type calendarEventType } from "./calendar-event.schema"

type CalendarEventType = (typeof calendarEventType.enumValues)[number]

async function getMemberId(tenant: TenantContext) {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, tenant.userId), eq(member.organizationId, tenant.organizationId)))
    .limit(1)

  return row?.id ?? null
}

function canEdit(
  tenant: TenantContext,
  row: { createdBy: string; assigneeId: string | null },
  memberId: string | null,
) {
  return tenant.isSuperAdmin || tenant.role === "admin" || row.createdBy === memberId || row.assigneeId === memberId
}

export const calendarEventService = {
  /**
   * Calendrier public en lecture: tout membre de l'org (admin/member/viewer)
   * voit tous les events, quel que soit l'assignee. L'édition reste
   * restreinte (cf. update/remove).
   */
  async list(tenant: TenantContext, from?: string, to?: string) {
    const scope = tenant.isSuperAdmin ? undefined : eq(calendarEvent.organizationId, tenant.organizationId)

    const range = from && to ? and(gte(calendarEvent.eventDate, from), lte(calendarEvent.eventDate, to)) : undefined

    const where = scope && range ? and(scope, range) : (scope ?? range)

    return db.select().from(calendarEvent).where(where)
  },

  async getById(tenant: TenantContext, id: string) {
    const [row] = await db.select().from(calendarEvent).where(eq(calendarEvent.id, id)).limit(1)

    if (!row) return null
    if (tenant.isSuperAdmin) return row
    if (row.organizationId !== tenant.organizationId) return null

    // lecture publique dans l'org: pas de check assigneeId ici
    return row
  },

  async create(
    tenant: TenantContext,
    data: {
      id: string
      type: CalendarEventType
      title: string
      eventDate: string
      eventTime?: string
      meta?: string
      assigneeId?: string
      mailId?: string
      leadId?: string
    },
  ) {
    const memberId = await getMemberId(tenant)
    if (!memberId) throw new Error("Aucun membership trouvé pour cet utilisateur")

    const [row] = await db
      .insert(calendarEvent)
      .values({
        ...data,
        organizationId: tenant.organizationId,
        // par défaut assigné au créateur, sauf si explicitement précisé
        assigneeId: data.assigneeId ?? memberId,
        createdBy: memberId,
      })
      .returning()

    return row
  },

  async update(
    tenant: TenantContext,
    id: string,
    data: Partial<{
      title: string
      eventDate: string
      eventTime: string
      meta: string
      assigneeId: string
      type: CalendarEventType
    }>,
  ) {
    const existing = await this.getById(tenant, id)
    if (!existing) return null

    const memberId = await getMemberId(tenant)
    if (!canEdit(tenant, existing, memberId)) return "forbidden" as const

    const [row] = await db.update(calendarEvent).set(data).where(eq(calendarEvent.id, id)).returning()

    return row
  },

  async remove(tenant: TenantContext, id: string) {
    const existing = await this.getById(tenant, id)
    if (!existing) return null

    const memberId = await getMemberId(tenant)
    if (!canEdit(tenant, existing, memberId)) return "forbidden" as const

    await db.delete(calendarEvent).where(eq(calendarEvent.id, id))
    return existing
  },
}
