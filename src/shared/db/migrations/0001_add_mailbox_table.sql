-- Migration: Add mailbox table
-- Created: 2026-01-31

CREATE TABLE IF NOT EXISTS "mailbox" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "member_id" text NOT NULL REFERENCES "member"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "provider" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "token_expires_at" timestamp,
  "smtp_host" text,
  "smtp_port" integer,
  "smtp_username" text,
  "smtp_password" text,
  "smtp_secure" boolean DEFAULT true,
  "status" text DEFAULT 'pending' NOT NULL,
  "last_error" text,
  "last_sync_at" timestamp,
  "daily_limit" integer DEFAULT 50 NOT NULL,
  "daily_sent" integer DEFAULT 0 NOT NULL,
  "last_reset_at" timestamp DEFAULT now() NOT NULL,
  "warmup_enabled" boolean DEFAULT false NOT NULL,
  "warmup_progress" integer DEFAULT 0 NOT NULL,
  "warmup_start_date" timestamp,
  "signature" text,
  "metadata" json,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "mailbox_organizationId_idx" ON "mailbox" ("organization_id");
CREATE INDEX IF NOT EXISTS "mailbox_memberId_idx" ON "mailbox" ("member_id");
CREATE INDEX IF NOT EXISTS "mailbox_email_idx" ON "mailbox" ("email");

-- Comments
COMMENT ON TABLE "mailbox" IS 'Stores email provider connections (Gmail, Outlook, SMTP)';
COMMENT ON COLUMN "mailbox"."provider" IS 'Email provider type: gmail, outlook, smtp';
COMMENT ON COLUMN "mailbox"."status" IS 'Connection status: connected, error, pending, disconnected';
COMMENT ON COLUMN "mailbox"."daily_limit" IS 'Maximum emails allowed to send per day';
COMMENT ON COLUMN "mailbox"."daily_sent" IS 'Number of emails sent today';
COMMENT ON COLUMN "mailbox"."warmup_progress" IS 'Email warmup progress percentage (0-100)';
