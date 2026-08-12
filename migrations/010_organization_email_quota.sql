-- Create organization_email_quota table
CREATE TABLE IF NOT EXISTS organization_email_quota (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  
  -- Daily limits
  daily_limit INTEGER NOT NULL DEFAULT 100,
  daily_sent INTEGER NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Total counters (historical)
  total_sent INTEGER NOT NULL DEFAULT 0,
  
  -- Monthly counters (for billing)
  monthly_limit INTEGER DEFAULT NULL, -- NULL = unlimited
  monthly_sent INTEGER NOT NULL DEFAULT 0,
  monthly_reset_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(organization_id)
);

-- Create index for organization_id
CREATE INDEX organization_email_quota_org_id_idx ON organization_email_quota(organization_id);

-- Insert default quota for existing organizations
INSERT INTO organization_email_quota (id, organization_id, daily_limit, monthly_limit)
SELECT 
  'quota_' || organization.id,
  organization.id,
  500, -- Default daily limit
  NULL -- Unlimited monthly
FROM organization
ON CONFLICT (organization_id) DO NOTHING;
