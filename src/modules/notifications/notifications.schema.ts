import { pgTable, text, timestamp, boolean, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { member, organization } from "../../shared/db/schema";

export const notificationType = pgEnum("notification_type", [
  "new_reply",
  "meeting_reminder",
  "lead_assigned",
  "campaign_limit_reached",
  "mention",
  "system",
]);

export const notification = pgTable(
  "notification",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // toujours personnelle, pas de notion de partagé comme template/calendar
    recipientId: text("recipient_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),

    type: notificationType("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"), // ex: "/conversations/123" pour la redirection au clic

    // référence polymorphe vers l'entité source, plutôt qu'une FK par type
    // (une notif peut pointer vers un lead, une conversation, une campagne...)
    entityType: text("entity_type"), // ex: "conversation" | "lead" | "campaign"
    entityId: text("entity_id"),

    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notification_recipient_read_idx").on(table.recipientId, table.isRead),
    index("notification_recipient_createdAt_idx").on(table.recipientId, table.createdAt),
    index("notification_organizationId_idx").on(table.organizationId),
  ],
);

export const notificationRelations = relations(notification, ({ one }) => ({
  organization: one(organization, {
    fields: [notification.organizationId],
    references: [organization.id],
  }),
  recipient: one(member, {
    fields: [notification.recipientId],
    references: [member.id],
  }),
}));