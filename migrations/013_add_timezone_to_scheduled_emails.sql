-- Migration: Add timezone column to scheduled_emails table
-- This allows storing the user's timezone when scheduling emails
-- for better scheduling accuracy across different timezones

ALTER TABLE scheduled_emails 
ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN scheduled_emails.timezone IS 'User timezone when scheduling (e.g., America/New_York, Europe/Paris)';

-- Create index for better query performance when filtering by timezone
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_timezone ON scheduled_emails(timezone) WHERE timezone IS NOT NULL;