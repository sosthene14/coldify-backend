-- Add template_id column to scheduled_emails table for template tracking
ALTER TABLE scheduled_emails 
ADD COLUMN template_id TEXT;

-- Create index for template_id queries
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_template ON scheduled_emails(template_id)
WHERE template_id IS NOT NULL;