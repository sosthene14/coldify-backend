-- Add push subscription column to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "push_subscription" TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_push_subscription ON "user"(id) WHERE "push_subscription" IS NOT NULL;
