-- Default email-open notifications for new and existing users
UPDATE "user"
SET "notification_preferences" = '{"emailOpened":true}'
WHERE "notification_preferences" IS NULL;

ALTER TABLE "user"
ALTER COLUMN "notification_preferences" SET DEFAULT '{"emailOpened":true}';