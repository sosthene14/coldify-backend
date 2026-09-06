import { and, desc, eq, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { db } from "../../shared/db"
import { sendPushNotification } from "../../shared/lib/push-notifications"
import { emitEmailOpened } from "../../shared/lib/websocket"
import { emailHistory } from "../email-history/email-history.schema"
import { templateService } from "../template/template.service"
import { emailEvent } from "./reporting.schema"

export interface RecordOpenParams {
  organizationId: string
  userId: string
  emailHistoryId?: string
  campaignId?: string
  leadId?: string
  recipient: string
  userAgent?: string
  ipAddress?: string
}

export const emailTrackingService = {
  /**
   * Record email open event - tracks every open, even duplicates
   */
  async recordOpen(
    params: RecordOpenParams,
    trackingData: import("../../shared/lib/email-tracking").TrackingData,
  ): Promise<void> {
    try {
      const now = new Date()

      // Insert into email_event (detailed tracking)
     await db.insert(emailEvent).values({
  id: nanoid(),
  organizationId: params.organizationId,
  templateId: null,
  memberId: null,
  type: "opened",
  metadata: {
    mailId: params.campaignId || null,
    leadId: params.leadId || null,
    recipient: params.recipient,
    emailHistoryId: params.emailHistoryId,
    userAgent: params.userAgent,
    ipAddress: params.ipAddress,
    openedAt: now.toISOString(),
  },
  occurredAt: now,
})

 
      // Update email_history with denormalized stats (if emailHistoryId exists)
      if (params.emailHistoryId) {
        // Get current email history record
        const [emailHistoryRecord] = await db
          .select()
          .from(emailHistory)
          .where(eq(emailHistory.id, params.emailHistoryId))
          .limit(1)

        if (emailHistoryRecord) {
          // Calculate unique opens by counting distinct recipients in email_event
          const uniqueRecipientsResult = await db
            .select({ count: sql<number>`COUNT(DISTINCT ${emailEvent.metadata}->>'recipient')` })
            .from(emailEvent)
            .where(
              and(
                eq(emailEvent.type, "opened"),
                sql`${emailEvent.metadata}->>'emailHistoryId' = ${params.emailHistoryId}`,
              ),
            )

          const uniqueOpens = Number(uniqueRecipientsResult[0]?.count || 1)
          const totalOpens = emailHistoryRecord.totalOpens + 1
          const firstOpenedAt = emailHistoryRecord.firstOpenedAt || now

          // Update email_history with aggregated stats
          await db
            .update(emailHistory)
            .set({
              totalOpens,
              uniqueOpens,
              firstOpenedAt,
              lastOpenedAt: now,
            })
            .where(eq(emailHistory.id, params.emailHistoryId))

          // Emit real-time notification via WebSocket
          emitEmailOpened(trackingData.userId, {
            emailHistoryId: params.emailHistoryId,
            recipient: params.recipient,
            openedAt: now.toISOString(),
            userAgent: params.userAgent,
            totalOpens,
          })

          // Send push notification to user (works even if app is closed)
          if (trackingData.userId) {
            sendPushNotification(trackingData.userId, {
              title: "So-mails: Email ouvert",
              body: `${params.recipient} a ouvert votre email "${emailHistoryRecord.subject}" (${totalOpens}x)`,
              icon: "https://so-mails.com/logo.png",
              data: {
                emailHistoryId: params.emailHistoryId,
                recipient: params.recipient,
                url: "/dashboard/mails",
              },
            }).catch((err) => {
              console.error("[Email Tracking] Failed to send push notification:", err)
            })
          }

          // Update template statistics if this email was created from a template
          if (emailHistoryRecord.templateId) {
            // Update template stats asynchronously (don't await to avoid blocking)
            templateService.updateTemplateStats(emailHistoryRecord.templateId).catch((err) => {
              console.error("[Email Tracking] Failed to update template stats:", err)
            })
          }
        }
      }
    } catch (error) {
      console.error("[Email Tracking] Failed to record open:", error)
      // Don't throw - tracking failures shouldn't break anything
    }
  },

  /**
   * Get open statistics for an email
   */
  async getOpenStats(emailHistoryId: string): Promise<{
    totalOpens: number
    uniqueOpens: number
    firstOpenedAt?: Date
    lastOpenedAt?: Date
  }> {
    const opens = await db
      .select()
      .from(emailEvent)
      .where(and(eq(emailEvent.type, "opened"), sql`${emailEvent.metadata}->>'emailHistoryId' = ${emailHistoryId}`))

    if (opens.length === 0) {
      return {
        totalOpens: 0,
        uniqueOpens: 0,
      }
    }

    // Group by recipient to count unique opens
    const uniqueRecipients = new Set(opens.map((event: any) => event.metadata?.recipient).filter(Boolean))

    const sortedOpens = opens.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())

    return {
      totalOpens: opens.length,
      uniqueOpens: uniqueRecipients.size,
      firstOpenedAt: sortedOpens[0]?.occurredAt,
      lastOpenedAt: sortedOpens[sortedOpens.length - 1]?.occurredAt,
    }
  },

  /**
   * Get detailed open events for an email
   */
  async getOpenDetails(emailHistoryId: string): Promise<
    Array<{
      id: string
      recipient: string
      openedAt: Date
      userAgent?: string
    }>
  > {
    const opens = await db
      .select()
      .from(emailEvent)
      .where(and(eq(emailEvent.type, "opened"), sql`${emailEvent.metadata}->>'emailHistoryId' = ${emailHistoryId}`))
      .orderBy(desc(emailEvent.occurredAt))

    return opens.map((event: any) => ({
      id: event.id,
      recipient: event.metadata?.recipient || "Unknown",
      openedAt: event.occurredAt,
      userAgent: event.metadata?.userAgent,
    }))
  },
}
