-- Create scheduled_emails table
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  mailbox_id TEXT NOT NULL,
  
  -- Recipients
  "to" JSONB NOT NULL,
  cc JSONB,
  bcc JSONB,
  
  -- Content
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  reply_to TEXT,
  
  -- Attachments
  has_attachments BOOLEAN DEFAULT false,
  attachment_count INTEGER DEFAULT 0,
  attachments JSONB,
  
  -- Scheduling
  scheduled_at TIMESTAMP NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  job_id TEXT,
  
  -- Execution tracking
  sent_at TIMESTAMP,
  failed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_org ON scheduled_emails(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_mailbox ON scheduled_emails(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON scheduled_emails(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled_at ON scheduled_emails(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_job_id ON scheduled_emails(job_id);

-- Create index for finding due emails
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_due ON scheduled_emails(status, scheduled_at) 
WHERE status = 'pending';
