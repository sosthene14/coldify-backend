-- Migration: Add email_history table
-- Created: 2026-01-31
-- Ensure UTF-8 encoding

CREATE TABLE IF NOT EXISTS "email_history" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "member_id" text NOT NULL REFERENCES "member"("id") ON DELETE CASCADE,
  "mailbox_id" text NOT NULL REFERENCES "mailbox"("id") ON DELETE CASCADE,
  "from" text NOT NULL,
  "to" json NOT NULL,
  "cc" json,
  "bcc" json,
  "subject" text NOT NULL,
  "html_content" text NOT NULL,
  "has_attachments" boolean DEFAULT false NOT NULL,
  "attachment_count" integer DEFAULT 0 NOT NULL,
  "attachment_names" json,
  "gmail_message_id" text,
  "gmail_thread_id" text,
  "status" text DEFAULT 'sent' NOT NULL,
  "scheduled_at" timestamp,
  "sent_at" timestamp DEFAULT now() NOT NULL,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "email_history_organizationId_idx" ON "email_history" ("organization_id");
CREATE INDEX IF NOT EXISTS "email_history_memberId_idx" ON "email_history" ("member_id");
CREATE INDEX IF NOT EXISTS "email_history_mailboxId_idx" ON "email_history" ("mailbox_id");
CREATE INDEX IF NOT EXISTS "email_history_sentAt_idx" ON "email_history" ("sent_at");

-- Set database encoding to UTF-8 if not already set
ALTER DATABASE coldy SET client_encoding = 'UTF8';

-- Comments
COMMENT ON TABLE "email_history" IS 'Stores history of sent emails (without actual attachment files)';
COMMENT ON COLUMN "email_history"."status" IS 'Email status: sent, scheduled, failed';
COMMENT ON COLUMN "email_history"."has_attachments" IS 'Whether email had attachments';
COMMENT ON COLUMN "email_history"."attachment_names" IS 'Names of attachments (files not stored)';
