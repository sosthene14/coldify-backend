import { and, eq, or, sql } from "drizzle-orm"
import sanitizeHtml from "sanitize-html"
import { db } from "../../shared"
import { member } from "../../shared/db/schema"
import type { TenantContext } from "../../shared/plugins/tenant"
import { emailHistory } from "../email-history/email-history.schema"
import { memberStarredTemplate, template } from "./template.schema"

const emailBodyConfig: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "a",
    "img",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "blockquote",
    "span",
    "div",
    "table",
    "tr",
    "td",
    "th",
    "tbody",
    "thead",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height", "style", "wrapperstyle"],
    "*": ["style"],
  },
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-fA-F]{3,6}$/, /^rgb/],
      "font-size": [/^\d+(px|em|%)$/],
      "font-weight": [/^(normal|bold|\d+)$/],
      "text-align": [/^(left|right|center)$/],
      display: [/^(block|inline|flex|inline-block)$/],
      margin: [/.*/],
    },
  },
  allowedSchemes: ["http", "https", "mailto", "minio"], // Ajouter 'minio' pour les références MinIO
  allowedSchemesByTag: {
    img: ["http", "https", "data", "minio"], // Autoriser http, https, data: et minio: pour les images
  },
  disallowedTagsMode: "discard",
}

// subject/preview : texte brut uniquement, aucune balise tolérée
const plainTextConfig: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
}

function sanitizeTemplateData<T extends { body?: string; subject?: string; preview?: string }>(data: T): T {
  return {
    ...data,
    ...(data.body !== undefined && { body: sanitizeHtml(data.body, emailBodyConfig) }),
    ...(data.subject !== undefined && { subject: sanitizeHtml(data.subject, plainTextConfig) }),
    ...(data.preview !== undefined && { preview: sanitizeHtml(data.preview, plainTextConfig) }),
  }
}

async function getMemberId(tenant: TenantContext) {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, tenant.userId), eq(member.organizationId, tenant.organizationId)))
    .limit(1)

  return row?.id ?? null
}

function canEdit(tenant: TenantContext, row: { ownerId: string }, memberId: string | null) {
  return tenant.isSuperAdmin || tenant.role === "admin" || row.ownerId === memberId
}

export const templateService = {
  /**
   * Calculate and update template statistics based on email history
   */
  async updateTemplateStats(templateId: string) {
    const emails = await db
      .select({
        totalOpens: emailHistory.totalOpens,
        uniqueOpens: emailHistory.uniqueOpens,
      })
      .from(emailHistory)
      .where(eq(emailHistory.templateId, templateId))

    if (emails.length === 0) {
      await db
        .update(template)
        .set({
          usageCount: 0, // Reset usage count if no emails found
          openRate: null,
          replyRate: null,
        })
        .where(eq(template.id, templateId))
      return
    }

    const totalEmails = emails.length
    const openedEmails = emails.filter((e) => (e.uniqueOpens || 0) > 0).length
    const openRate = totalEmails > 0 ? (openedEmails / totalEmails) * 100 : 0

    const replyRate = 0

    await db
      .update(template)
      .set({
        usageCount: totalEmails, // Set usage count to actual email count from history
        openRate: Math.round(openRate * 100) / 100, // Round to 2 decimals
        replyRate: Math.round(replyRate * 100) / 100,
        lastUsedAt: totalEmails > 0 ? new Date() : undefined,
      })
      .where(eq(template.id, templateId))
  },

  /**
   * Recalculate statistics for all templates in an organization
   */
  async recalculateAllStats(organizationId: string) {
    const templates = await db
      .select({ id: template.id })
      .from(template)
      .where(eq(template.organizationId, organizationId))

    // Update stats for each template
    await Promise.all(templates.map((t) => this.updateTemplateStats(t.id)))

    console.log(`[Template] Recalculated stats for ${templates.length} templates in org: ${organizationId}`)
  },

  /**
   * Get detailed statistics for a template
   */
  async getTemplateStats(tenant: TenantContext, templateId: string) {
    const templateData = await this.getById(tenant, templateId)
    if (!templateData) return null

    // Get time series data - emails sent per day for the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const emailsByDay = await db
      .select({
        date: sql<string>`DATE(${emailHistory.sentAt})`,
        totalSent: sql<number>`COUNT(*)`,
        totalOpened: sql<number>`COUNT(CASE WHEN ${emailHistory.uniqueOpens} > 0 THEN 1 END)`,
      })
      .from(emailHistory)
      .where(
        and(eq(emailHistory.templateId, templateId), sql`${emailHistory.sentAt} >= ${thirtyDaysAgo.toISOString()}`),
      )
      .groupBy(sql`DATE(${emailHistory.sentAt})`)
      .orderBy(sql`DATE(${emailHistory.sentAt})`)

    // Get overall stats
    const [overallStats] = await db
      .select({
        totalSent: sql<number>`COUNT(*)`,
        totalOpened: sql<number>`COUNT(CASE WHEN ${emailHistory.uniqueOpens} > 0 THEN 1 END)`,
        totalOpens: sql<number>`SUM(${emailHistory.totalOpens})`,
        avgOpensPerEmail: sql<number>`AVG(${emailHistory.totalOpens})`,
      })
      .from(emailHistory)
      .where(eq(emailHistory.templateId, templateId))

    // Get list of all emails sent with this template (with recipient details)
    const emailsList = await db
      .select({
        id: emailHistory.id,
        recipient: sql<string>`${emailHistory.to}->0`, // Get first recipient from JSON array
        subject: emailHistory.subject,
        sentAt: emailHistory.sentAt,
        uniqueOpens: emailHistory.uniqueOpens,
        totalOpens: emailHistory.totalOpens,
        firstOpenedAt: emailHistory.firstOpenedAt,
        lastOpenedAt: emailHistory.lastOpenedAt,
      })
      .from(emailHistory)
      .where(eq(emailHistory.templateId, templateId))
      .orderBy(sql`${emailHistory.sentAt} DESC`)
      .limit(50) // Limit to last 50 emails

    return {
      template: templateData,
      overall: {
        totalSent: Number(overallStats?.totalSent || 0),
        totalOpened: Number(overallStats?.totalOpened || 0),
        totalOpens: Number(overallStats?.totalOpens || 0),
        avgOpensPerEmail: Number(overallStats?.avgOpensPerEmail || 0),
        openRate: templateData.openRate || 0,
      },
      timeSeries: emailsByDay.map((day) => ({
        date: day.date,
        sent: Number(day.totalSent),
        opened: Number(day.totalOpened),
        openRate: day.totalSent > 0 ? (Number(day.totalOpened) / Number(day.totalSent)) * 100 : 0,
      })),
      emails: emailsList.map((email) => ({
        id: email.id,
        recipient: email.recipient,
        subject: email.subject,
        sentAt: email.sentAt,
        uniqueOpens: email.uniqueOpens,
        totalOpens: email.totalOpens,
        firstOpenedAt: email.firstOpenedAt,
        lastOpenedAt: email.lastOpenedAt,
      })),
    }
  },

  /**
   * - superadmin/admin : tous les templates de l'org (privés inclus)
   * - member/viewer    : templates partagés (isPrivate=false) + les siens en privé
   * Retourne les templates avec le flag 'starred' selon l'utilisateur courant
   */
  async list(tenant: TenantContext) {
    const memberId = await getMemberId(tenant)

    let templates

    if (tenant.isSuperAdmin) {
      templates = await db.select().from(template)
    } else if (tenant.role === "admin") {
      templates = await db.select().from(template).where(eq(template.organizationId, tenant.organizationId))
    } else {
      templates = await db
        .select()
        .from(template)
        .where(
          and(
            eq(template.organizationId, tenant.organizationId),
            or(eq(template.isPrivate, false), eq(template.ownerId, memberId ?? "")),
          ),
        )
    }

    // Récupérer les templates starred par ce membre
    if (!memberId) return templates.map((t) => ({ ...t, starred: false }))

    const starredTemplates = await db
      .select({ templateId: memberStarredTemplate.templateId })
      .from(memberStarredTemplate)
      .where(eq(memberStarredTemplate.memberId, memberId))

    const starredIds = new Set(starredTemplates.map((s) => s.templateId))

    // Ajouter le flag starred à chaque template
    return templates.map((t) => ({
      ...t,
      starred: starredIds.has(t.id),
    }))
  },

  async getById(tenant: TenantContext, id: string) {
    const [row] = await db.select().from(template).where(eq(template.id, id)).limit(1)
    if (!row) return null
    if (tenant.isSuperAdmin) return row
    if (row.organizationId !== tenant.organizationId) return null
    if (tenant.role === "admin") return row

    const memberId = await getMemberId(tenant)
    if (row.isPrivate && row.ownerId !== memberId) return null // privé et pas le sien

    return row
  },

  async create(
    tenant: TenantContext,
    data: {
      id: string
      name: string
      subject: string
      body: string
      category?: string
      language?: string
      preview?: string
      isPrivate?: boolean
    },
  ) {
    const memberId = await getMemberId(tenant)
    if (!memberId) throw new Error("Aucun membership trouvé pour cet utilisateur")

    const cleanData = sanitizeTemplateData(data)

    const [row] = await db
      .insert(template)
      .values({ ...cleanData, organizationId: tenant.organizationId, ownerId: memberId })
      .returning()

    return row
  },

  async update(
    tenant: TenantContext,
    id: string,
    data: Partial<{
      name: string
      subject: string
      body: string
      category: string
      language: string
      preview: string
      isPrivate: boolean
    }>,
  ) {
    const existing = await this.getById(tenant, id)
    if (!existing) return null

    const memberId = await getMemberId(tenant)
    if (!canEdit(tenant, existing, memberId)) return "forbidden" as const

    const cleanData = sanitizeTemplateData(data)

    const [row] = await db.update(template).set(cleanData).where(eq(template.id, id)).returning()
    return row
  },

  async remove(tenant: TenantContext, id: string) {
    const existing = await this.getById(tenant, id)
    if (!existing) return null

    const memberId = await getMemberId(tenant)
    if (!canEdit(tenant, existing, memberId)) return "forbidden" as const

    await db.delete(template).where(eq(template.id, id))
    return existing
  },

  /** Fork un template partagé en copie privée éditable par l'appelant */
  async duplicate(tenant: TenantContext, id: string) {
    const source = await this.getById(tenant, id)
    if (!source) return null

    const memberId = await getMemberId(tenant)
    if (!memberId) throw new Error("Aucun membership trouvé pour cet utilisateur")

    const [row] = await db
      .insert(template)
      .values({
        id: crypto.randomUUID(),
        organizationId: tenant.organizationId,
        ownerId: memberId,
        name: `${source.name} (copie)`,
        subject: source.subject,
        body: source.body,
        category: source.category,
        language: source.language,
        preview: source.preview,
        isPrivate: true, // toujours privé au moment du fork
      })
      .returning()

    return row
  },

  /** N'importe qui ayant accès au template peut l'utiliser -> incrémente les stats */
  async recordUsage(tenant: TenantContext, id: string) {
    const existing = await this.getById(tenant, id)
    if (!existing) return null

    const [row] = await db
      .update(template)
      .set({
        usageCount: existing.usageCount + 1,
        lastUsedAt: new Date(),
      })
      .where(eq(template.id, id))
      .returning()

    return row
  },

  // ── Favoris (personnels, indépendants des droits d'édition) ─────
  async star(tenant: TenantContext, templateId: string) {
    const existing = await this.getById(tenant, templateId)
    if (!existing) return null

    const memberId = await getMemberId(tenant)
    if (!memberId) throw new Error("Aucun membership trouvé pour cet utilisateur")

    await db
      .insert(memberStarredTemplate)
      .values({ id: crypto.randomUUID(), memberId, templateId })
      .onConflictDoNothing()

    return { starred: true }
  },

  async unstar(tenant: TenantContext, templateId: string) {
    const memberId = await getMemberId(tenant)
    if (!memberId) return { starred: false }

    await db
      .delete(memberStarredTemplate)
      .where(and(eq(memberStarredTemplate.memberId, memberId), eq(memberStarredTemplate.templateId, templateId)))

    return { starred: false }
  },
}
