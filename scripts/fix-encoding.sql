-- Fix PostgreSQL encoding issues
-- Run this to ensure UTF-8 encoding everywhere

-- Check current encoding
SHOW server_encoding;
SHOW client_encoding;

-- Set database encoding to UTF-8
ALTER DATABASE somails SET client_encoding = 'UTF8';

-- Reconnect and verify
\c somails

-- Show encoding again
SHOW client_encoding;

-- If you have corrupted data, you might need to update it
-- This is an example - adjust the WHERE clause to find your corrupted records
-- UPDATE email_history 
-- SET subject = convert_from(convert_to(subject, 'LATIN1'), 'UTF8')
-- WHERE subject LIKE '%ÃƒÂ©%';

-- Verify the fix worked
SELECT id, subject FROM email_history WHERE subject LIKE '%développement%' OR subject LIKE '%Ã%' LIMIT 5;
