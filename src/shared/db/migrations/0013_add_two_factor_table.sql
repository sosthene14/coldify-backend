-- Migration: Add two_factor table for 2FA authentication
-- Created: 2026-08-02

-- Drop table if it exists with incomplete schema (safe re-run)
DROP TABLE IF EXISTS "two_factor";

-- Create the two_factor table with all fields required by better-auth
CREATE TABLE "two_factor" (
  "id" text PRIMARY KEY NOT NULL,
  "secret" text NOT NULL,
  "backup_codes" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "verified" boolean NOT NULL DEFAULT true,
  "failed_verification_count" integer DEFAULT 0,
  "locked_until" timestamp
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "two_factor_secret_idx" ON "two_factor" ("secret");
CREATE INDEX IF NOT EXISTS "two_factor_userId_idx" ON "two_factor" ("user_id");

-- Add two_factor_enabled column to user table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user' AND column_name = 'two_factor_enabled'
  ) THEN
    ALTER TABLE "user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false;
  END IF;
END $$;

-- Comments
COMMENT ON TABLE "two_factor" IS 'Stores two-factor authentication secrets and backup codes';
COMMENT ON COLUMN "two_factor"."secret" IS 'TOTP secret key for generating verification codes';
COMMENT ON COLUMN "two_factor"."backup_codes" IS 'JSON string of backup recovery codes';
COMMENT ON COLUMN "two_factor"."verified" IS 'Whether the 2FA setup has been verified by the user';
COMMENT ON COLUMN "two_factor"."failed_verification_count" IS 'Number of failed verification attempts (brute-force protection)';
COMMENT ON COLUMN "two_factor"."locked_until" IS 'Timestamp until which 2FA verification is locked after too many failures';
