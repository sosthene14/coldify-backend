-- Migration: Make campaign_id and lead_id nullable in email_event table
-- This allows tracking of direct emails (sent without campaigns) and emails sent to non-lead recipients

-- Drop foreign key constraints
ALTER TABLE email_event 
  DROP CONSTRAINT IF EXISTS email_event_campaign_id_campaign_id_fk;

ALTER TABLE email_event 
  DROP CONSTRAINT IF EXISTS email_event_lead_id_lead_id_fk;

-- Make columns nullable
ALTER TABLE email_event 
  ALTER COLUMN campaign_id DROP NOT NULL;

ALTER TABLE email_event 
  ALTER COLUMN lead_id DROP NOT NULL;

-- Re-add foreign key constraints (now nullable)
ALTER TABLE email_event 
  ADD CONSTRAINT email_event_campaign_id_campaign_id_fk 
  FOREIGN KEY (campaign_id) REFERENCES campaign(id) ON DELETE CASCADE;

ALTER TABLE email_event 
  ADD CONSTRAINT email_event_lead_id_lead_id_fk 
  FOREIGN KEY (lead_id) REFERENCES lead(id) ON DELETE CASCADE;
