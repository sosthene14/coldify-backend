import { relations } from "drizzle-orm"
import { boolean, index, integer, json, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { member, organization } from "../../shared/db/schema/auth"

export const mailbox = pgTable(
  "mailbox",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),

    // Email info
    email: text("email").notNull(),
    provider: text("provider").notNull(), // 'gmail', 'outlook', 'smtp'

    // OAuth tokens (for Gmail/Outlook)
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at"),

    // SMTP credentials (for custom SMTP)
    smtpHost: text("smtp_host"),
    smtpPort: integer("smtp_port"),
    smtpUsername: text("smtp_username"),
    smtpPassword: text("smtp_password"),
    smtpSecure: boolean("smtp_secure").default(true),

    // Status
    status: text("status").notNull().default("pending"), // 'connected', 'error', 'pending', 'disconnected'
    lastError: text("last_error"),
    lastSyncAt: timestamp("last_sync_at"),

    // Sending limits
    dailyLimit: integer("daily_limit").default(10).notNull(),
    dailySent: integer("daily_sent").default(0).notNull(),
    lastResetAt: timestamp("last_reset_at").defaultNow().notNull(),

    // Warmup
    warmupEnabled: boolean("warmup_enabled").default(false).notNull(),
    warmupProgress: integer("warmup_progress").default(0).notNull(), // 0-100
    warmupStartDate: timestamp("warmup_start_date"),

    // Signature
    signature: text("signature"),

    // Metadata
    metadata: json("metadata").$type<Record<string, any>>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("mailbox_organizationId_idx").on(table.organizationId),
    index("mailbox_memberId_idx").on(table.memberId),
    index("mailbox_email_idx").on(table.email),
  ],
)

export const mailboxRelations = relations(mailbox, ({ one }) => ({
  organization: one(organization, {
    fields: [mailbox.organizationId],
    references: [organization.id],
  }),
  member: one(member, {
    fields: [mailbox.memberId],
    references: [member.id],
  }),
}))

export type Mailbox = typeof mailbox.$inferSelect
export type InsertMailbox = typeof mailbox.$inferInsert
