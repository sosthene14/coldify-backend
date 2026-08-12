-- Migration: Add tracking statistics columns to email_history table
-- This denormalizes tracking data for performance (avoid N+1 queries)

ALTER TABLE email_history 
  ADD COLUMN total_opens INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN unique_opens INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN first_opened_at TIMESTAMP,
  ADD COLUMN last_opened_at TIMESTAMP;

-- Create index for efficient tracking queries
CREATE INDEX email_history_total_opens_idx ON email_history(total_opens) WHERE total_opens > 0;
CREATE INDEX email_history_last_opened_at_idx ON email_history(last_opened_at) WHERE last_opened_at IS NOT NULL;

-- Optional: Migrate existing data from email_event table
-- This will populate the new columns with current tracking data
WITH email_stats AS (
  SELECT 
    metadata->>'emailHistoryId' as email_history_id,
    COUNT(*) as total_opens,
    COUNT(DISTINCT metadata->>'recipient') as unique_opens,
    MIN(occurred_at) as first_opened_at,
    MAX(occurred_at) as last_opened_at
  FROM email_event
  WHERE type = 'opened' 
    AND metadata->>'emailHistoryId' IS NOT NULL
  GROUP BY metadata->>'emailHistoryId'
)
UPDATE email_history
SET 
  total_opens = COALESCE(email_stats.total_opens::INTEGER, 0),
  unique_opens = COALESCE(email_stats.unique_opens::INTEGER, 0),
  first_opened_at = email_stats.first_opened_at,
  last_opened_at = email_stats.last_opened_at
FROM email_stats
WHERE email_history.id = email_stats.email_history_id;
