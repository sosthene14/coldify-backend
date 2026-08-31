import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { lead } from "../lead/lead.schema";
import { member, organization } from "../../shared/db/schema/auth";
import { campaign } from "../campaign/campaign.schema";

export const sentiment = pgEnum("sentiment", [
  "interested",
  "not_interested",
  "question",
  "auto_reply",
  "ooo",
]);

export const messageSender = pgEnum("message_sender", ["member", "lead", "system"]);

// ── Conversation: le fil, avec un snapshot du dernier message ────
// (comme campaign_daily_stat: table "rollup" mise à jour à chaque insert
// de message, pour que la liste d'inbox n'ait jamais à scanner `message`)
export const conversation = pgTable(
  "conversation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => lead.id, { onDelete: "cascade" }),
    mailId: text("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),

    // rep assigné à ce fil ("l'inbox de qui") — hérite de lead.ownerId à la
    // création, mais peut être réassigné indépendamment (ex: transfert)
    ownerId: text("owner_id").references(() => member.id, { onDelete: "set null" }),

    // snapshot dénormalisé du dernier message, pour l'affichage liste
    lastMessagePreview: text("last_message_preview"),
    lastMessageAt: timestamp("last_message_at"),
    lastMessageFrom: messageSender("last_message_from"),

    unread: boolean("unread").default(true).notNull(),
    hasAttachment: boolean("has_attachment").default(false).notNull(),
    messageCount: integer("message_count").default(0).notNull(),

    sentiment: sentiment("sentiment"), // null tant que pas classé

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // un seul fil par lead et par campagne
    uniqueIndex("conversation_lead_campaign_uidx").on(table.leadId, table.mailId),
    index("conversation_organizationId_idx").on(table.organizationId),
    index("conversation_ownerId_idx").on(table.ownerId),
    // pour les filtres sidebar (Unread / Needs Reply / Replied)
    index("conversation_org_unread_idx").on(table.organizationId, table.unread),
  ],
);

// ── Message: chaque email individuel du thread, source de vérité ─
export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    // dénormalisé pour scoper/filtrer sans jointure vers conversation
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    senderType: messageSender("sender_type").notNull(),
    // rempli seulement si senderType = "member"
    senderMemberId: text("sender_member_id").references(() => member.id, {
      onDelete: "set null",
    }),

    subject: text("subject"),
    body: text("body").notNull(),
    hasAttachment: boolean("has_attachment").default(false).notNull(),

    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (table) => [
    index("message_conversationId_idx").on(table.conversationId),
    index("message_organizationId_idx").on(table.organizationId),
  ],
);

export const conversationRelations = relations(conversation, ({ one, many }) => ({
  organization: one(organization, {
    fields: [conversation.organizationId],
    references: [organization.id],
  }),
  lead: one(lead, { fields: [conversation.leadId], references: [lead.id] }),
  campaign: one(campaign, {
    fields: [conversation.mailId],
    references: [campaign.id],
  }),
  owner: one(member, { fields: [conversation.ownerId], references: [member.id] }),
  messages: many(message),
}));

export const messageRelations = relations(message, ({ one }) => ({
  conversation: one(conversation, {
    fields: [message.conversationId],
    references: [conversation.id],
  }),
  senderMember: one(member, {
    fields: [message.senderMemberId],
    references: [member.id],
  }),
}));