ALTER TABLE "email_history"
ADD COLUMN IF NOT EXISTS "encrypted_content" text;