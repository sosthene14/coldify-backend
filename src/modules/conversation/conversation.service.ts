import { eq, and, or, desc, sql } from "drizzle-orm";
import type { TenantContext } from "../../shared/plugins/tenant";
import { conversation, message, messageSender, sentiment } from "./conversation.schema";
import { lead } from "../lead/lead.schema";
import { db } from "../../shared";
import { member } from "../../shared/db/schema";
import { campaign } from "../campaign";

type Sentiment = (typeof sentiment.enumValues)[number];
type SenderType = (typeof messageSender.enumValues)[number];
export type InboxFilter = "all" | "unread" | "needs_reply" | "replied";

async function getMemberId(tenant: TenantContext) {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.userId, tenant.userId),
        eq(member.organizationId, tenant.organizationId),
      ),
    )
    .limit(1);

  return row?.id ?? null;
}

function scopeCondition(tenant: TenantContext, memberId: string | null) {
  const orgCond = eq(conversation.organizationId, tenant.organizationId);
  if (tenant.isSuperAdmin) return undefined; // pas de scope du tout
  if (tenant.role === "admin") return orgCond;
  return and(orgCond, eq(conversation.ownerId, memberId ?? ""));
}

export const conversationService = {
  /**
   * "Unified Inbox" avec les mêmes filtres que la sidebar:
   * - unread        -> conversation.unread = true
   * - needs_reply   -> dernier message vient du lead (on attend une réponse)
   * - replied       -> dernier message vient de nous
   */
  async list(tenant: TenantContext, filter: InboxFilter = "all") {
    const memberId = await getMemberId(tenant);
    const base = scopeCondition(tenant, memberId);

    const filterCond =
      filter === "unread"
        ? eq(conversation.unread, true)
        : filter === "needs_reply"
          ? eq(conversation.lastMessageFrom, "lead")
          : filter === "replied"
            ? eq(conversation.lastMessageFrom, "member")
            : undefined;

    const where = base && filterCond ? and(base, filterCond) : (base ?? filterCond);

    return db
      .select({
        id: conversation.id,
        leadId: conversation.leadId,
        leadName: sql<string>`${lead.firstName} || ' ' || ${lead.lastName}`,
        company: lead.companyName,
        jobTitle: lead.jobTitle,
        leadScore: lead.leadScore,
        campaign: campaign.name,
        lastMessagePreview: conversation.lastMessagePreview,
        lastMessageAt: conversation.lastMessageAt,
        unread: conversation.unread,
        sentiment: conversation.sentiment,
        hasAttachment: conversation.hasAttachment,
      })
      .from(conversation)
      .innerJoin(lead, eq(lead.id, conversation.leadId))
      .innerJoin(campaign, eq(campaign.id, conversation.mailId))
      .where(where)
      .orderBy(desc(conversation.lastMessageAt));
  },

  /** Compteurs pour la sidebar (Unified Inbox / Unread / Needs Reply / Replied) */
  async getSidebarCounts(tenant: TenantContext) {
    const memberId = await getMemberId(tenant);
    const base = scopeCondition(tenant, memberId);

    const [row] = await db
      .select({
        total: sql<number>`count(*)`,
        unread: sql<number>`count(*) filter (where ${conversation.unread} = true)`,
        needsReply: sql<number>`count(*) filter (where ${conversation.lastMessageFrom} = 'lead')`,
        replied: sql<number>`count(*) filter (where ${conversation.lastMessageFrom} = 'member')`,
      })
      .from(conversation)
      .where(base);

    return row;
  },

  async getById(tenant: TenantContext, id: string) {
    const [row] = await db.select().from(conversation).where(eq(conversation.id, id)).limit(1);
    if (!row) return null;
    if (tenant.isSuperAdmin) return row;
    if (row.organizationId !== tenant.organizationId) return null;
    if (tenant.role === "admin") return row;

    const memberId = await getMemberId(tenant);
    if (row.ownerId !== memberId) return null;

    return row;
  },

  async getMessages(tenant: TenantContext, conversationId: string) {
    const convo = await this.getById(tenant, conversationId);
    if (!convo) return null;

    return db
      .select()
      .from(message)
      .where(eq(message.conversationId, conversationId))
      .orderBy(message.sentAt);
  },

  /**
   * Crée un fil (généralement déclenché automatiquement au premier email
   * d'une séquence de campagne, pas manuellement par un member)
   */
  async createConversation(
    tenant: TenantContext,
    data: { id: string; leadId: string; mailId: string; ownerId?: string },
  ) {
    const [row] = await db
      .insert(conversation)
      .values({
        ...data,
        organizationId: tenant.organizationId,
        ownerId: data.ownerId ?? (await getMemberId(tenant)),
      })
      .returning();

    return row;
  },

  /** Envoie un message et met à jour le snapshot de la conversation */
  async sendMessage(
    tenant: TenantContext,
    conversationId: string,
    data: { body: string; subject?: string; hasAttachment?: boolean; senderType?: SenderType },
  ) {
    const convo = await this.getById(tenant, conversationId);
    if (!convo) return null;

    const memberId = await getMemberId(tenant);
    const senderType: SenderType = data.senderType ?? "member";

    const [msg] = await db
      .insert(message)
      .values({
        id: crypto.randomUUID(),
        conversationId,
        organizationId: tenant.organizationId,
        senderType,
        senderMemberId: senderType === "member" ? memberId : null,
        subject: data.subject,
        body: data.body,
        hasAttachment: data.hasAttachment ?? false,
      })
      .returning();

    await db
      .update(conversation)
      .set({
        lastMessagePreview: data.body.slice(0, 200),
        lastMessageAt: msg.sentAt,
        lastMessageFrom: senderType,
        unread: senderType === "lead", // un message reçu du lead = non lu
        hasAttachment: data.hasAttachment ?? convo.hasAttachment,
        messageCount: convo.messageCount + 1,
      })
      .where(eq(conversation.id, conversationId));

    return msg;
  },

  async markAsRead(tenant: TenantContext, id: string) {
    const convo = await this.getById(tenant, id);
    if (!convo) return null;

    const [row] = await db
      .update(conversation)
      .set({ unread: false })
      .where(eq(conversation.id, id))
      .returning();

    return row;
  },

  async updateSentiment(tenant: TenantContext, id: string, value: Sentiment | null) {
    const convo = await this.getById(tenant, id);
    if (!convo) return null;

    const [row] = await db
      .update(conversation)
      .set({ sentiment: value })
      .where(eq(conversation.id, id))
      .returning();

    return row;
  },
};