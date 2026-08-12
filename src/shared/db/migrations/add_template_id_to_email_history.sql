-- Migration: Add templateId to email_history table
-- Description: Links email history records to templates for tracking statistics

-- Add templateId column (nullable for existing records)
ALTER TABLE email_history 
ADD COLUMN template_id TEXT;

-- Add foreign key constraint
ALTER TABLE email_history 
ADD CONSTRAINT email_history_template_id_fkey 
FOREIGN KEY (template_id) 
REFERENCES template(id) 
ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX email_history_templateId_idx ON email_history(template_id);

-- Add comment for documentation
COMMENT ON COLUMN email_history.template_id IS 'Reference to the template used for this email (nullable if email was not created from a template)';
