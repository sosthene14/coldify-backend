import { relations } from "drizzle-orm"
import { boolean, index, integer, json, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { member, organization } from "../../shared/db/schema/auth"
import { mailbox } from "../mailbox/mailbox.schema"
import { template } from "../template/template.schema"

export const emailHistory = pgTable(
  "email_history",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    mailboxId: text("mailbox_id")
      .notNull()
      .references(() => mailbox.id, { onDelete: "cascade" }),
    templateId: text("template_id").references(() => template.id, { onDelete: "set null" }),

    // Email details
    from: text("from").notNull(),
    to: json("to").$type<string[]>().notNull(),
    cc: json("cc").$type<string[]>(),
    bcc: json("bcc").$type<string[]>(),
    subject: text("subject").notNull(),
    snippet: text("snippet").notNull(),
    encryptedContent: text("encrypted_content"),

    // Attachments info (just metadata, not actual files)
    hasAttachments: boolean("has_attachments").default(false).notNull(),
    attachmentCount: integer("attachment_count").default(0).notNull(),
    attachmentNames: json("attachment_names").$type<string[]>(),

    // Gmail info
    gmailMessageId: text("gmail_message_id"),
    gmailThreadId: text("gmail_thread_id"),

    // Status
    status: text("status").default("sent").notNull(), // 'sent', 'scheduled', 'failed'
    scheduledAt: timestamp("scheduled_at"),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
    error: text("error"),

    // Tracking stats (dénormalisées pour performance)
    totalOpens: integer("total_opens").default(0).notNull(),
    uniqueOpens: integer("unique_opens").default(0).notNull(),
    firstOpenedAt: timestamp("first_opened_at"),
    lastOpenedAt: timestamp("last_opened_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("email_history_organizationId_idx").on(table.organizationId),
    index("email_history_memberId_idx").on(table.memberId),
    index("email_history_mailboxId_idx").on(table.mailboxId),
    index("email_history_templateId_idx").on(table.templateId),
    index("email_history_sentAt_idx").on(table.sentAt),
  ],
)

export const emailHistoryRelations = relations(emailHistory, ({ one }) => ({
  organization: one(organization, {
    fields: [emailHistory.organizationId],
    references: [organization.id],
  }),
  member: one(member, {
    fields: [emailHistory.memberId],
    references: [member.id],
  }),
  mailbox: one(mailbox, {
    fields: [emailHistory.mailboxId],
    references: [mailbox.id],
  }),
  template: one(template, {
    fields: [emailHistory.templateId],
    references: [template.id],
  }),
}))

export type EmailHistory = typeof emailHistory.$inferSelect
export type InsertEmailHistory = typeof emailHistory.$inferInsert
