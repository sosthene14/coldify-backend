-- Drop all tables to start fresh
DROP TABLE IF EXISTS subscription_events CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS plans CASCADE;

-- Drop old tables from limits.ts if they exist
DROP TABLE IF EXISTS usage_counter CASCADE;
DROP TABLE IF EXISTS plan_limit CASCADE;
DROP TABLE IF EXISTS subscription CASCADE;
DROP TABLE IF EXISTS plan CASCADE;

-- Drop enums
DROP TYPE IF EXISTS subscription_status CASCADE;
DROP TYPE IF EXISTS plan_feature CASCADE;
DROP TYPE IF EXISTS limit_period CASCADE;

-- Keep other tables (users, organizations, etc.)
-- They will be cleaned but structure kept

-- Clean up test data
DELETE FROM scheduled_email;
DELETE FROM email_history;
DELETE FROM mailbox;
DELETE FROM member;
DELETE FROM organization;
DELETE FROM session;
DELETE FROM verification_token;
DELETE FROM account;
DELETE FROM user;

-- Status
SELECT 'Database reset completed' as status;
