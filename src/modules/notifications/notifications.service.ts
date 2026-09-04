import { and, desc, eq, sql } from "drizzle-orm"
import { db, type TenantContext } from "../../shared"
import { member } from "../../shared/db/schema"
import { notification, type notificationType } from "./notifications.schema"

type NotificationType = (typeof notificationType.enumValues)[number]

async function getMemberId(tenant: TenantContext) {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, tenant.userId), eq(member.organizationId, tenant.organizationId)))
    .limit(1)

  return row?.id ?? null
}

export const notificationService = {
  async list(tenant: TenantContext, unreadOnly = false) {
    const memberId = await getMemberId(tenant)
    if (!memberId) return []

    const where = unreadOnly
      ? and(eq(notification.recipientId, memberId), eq(notification.isRead, false))
      : eq(notification.recipientId, memberId)

    return db.select().from(notification).where(where).orderBy(desc(notification.createdAt))
  },

  async getUnreadCount(tenant: TenantContext) {
    const memberId = await getMemberId(tenant)
    if (!memberId) return 0

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notification)
      .where(and(eq(notification.recipientId, memberId), eq(notification.isRead, false)))

    return row?.count ?? 0
  },

  async create(
    organizationId: string,
    data: {
      recipientId: string
      type: NotificationType
      title: string
      body?: string
      link?: string
      entityType?: string
      entityId?: string
    },
  ) {
    const [row] = await db
      .insert(notification)
      .values({ id: crypto.randomUUID(), organizationId, ...data })
      .returning()

    return row
  },

  async markAsRead(tenant: TenantContext, id: string) {
    const memberId = await getMemberId(tenant)
    if (!memberId) return null

    const [row] = await db
      .update(notification)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notification.id, id), eq(notification.recipientId, memberId)))
      .returning()

    return row ?? null
  },

  async markAllAsRead(tenant: TenantContext) {
    const memberId = await getMemberId(tenant)
    if (!memberId) return { updated: 0 }

    const rows = await db
      .update(notification)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notification.recipientId, memberId), eq(notification.isRead, false)))
      .returning({ id: notification.id })

    return { updated: rows.length }
  },
}
