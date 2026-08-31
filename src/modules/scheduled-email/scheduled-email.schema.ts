import { pgTable, text, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const scheduledEmails = pgTable("scheduled_emails", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id").notNull(),
  memberId: text("member_id").notNull(),
  mailboxId: text("mailbox_id").notNull(),
  
  // Recipients
  to: jsonb("to").$type<string[]>().notNull(),
  cc: jsonb("cc").$type<string[]>(),
  bcc: jsonb("bcc").$type<string[]>(),
  
  // Content
  subject: text("subject").notNull(),
  snippet: text("snippet").notNull(),
  textContent: text("text_content"),
  replyTo: text("reply_to"),
  
  // Template tracking
  templateId: text("template_id"),
  
  // Attachments
  hasAttachments: boolean("has_attachments").default(false),
  attachmentCount: integer("attachment_count").default(0),
  attachments: jsonb("attachments").$type<Array<{
    filename: string;
    mimeType: string;
    objectKey: string;
    size: number;
  }>>(),
  
  // Scheduling
  scheduledAt: timestamp("scheduled_at").notNull(),
  timezone: text("timezone"), // User's timezone when scheduling (e.g., 'America/New_York')
  
  // Status tracking
  status: text("status").notNull().default("pending"), // pending, processing, sent, failed, cancelled
  jobId: text("job_id"), // BullMQ job ID
  
  // Execution tracking
  sentAt: timestamp("sent_at"),
  failedAt: timestamp("failed_at"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ScheduledEmail = typeof scheduledEmails.$inferSelect;
export type NewScheduledEmail = typeof scheduledEmails.$inferInsert;
