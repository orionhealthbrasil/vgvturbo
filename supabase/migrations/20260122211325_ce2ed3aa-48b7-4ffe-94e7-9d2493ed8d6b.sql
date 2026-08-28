-- Add unique constraint on organization_id + phone to prevent race condition duplicates
-- First, let's clean up duplicates keeping the oldest contact per phone/org

-- Identify and merge duplicates - keep oldest, delete newer ones
WITH duplicates AS (
  SELECT id, phone, organization_id, created_at,
    ROW_NUMBER() OVER (PARTITION BY organization_id, phone ORDER BY created_at ASC) as rn
  FROM contacts
)
DELETE FROM contacts 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Now add the unique constraint
ALTER TABLE contacts 
ADD CONSTRAINT contacts_organization_phone_unique 
UNIQUE (organization_id, phone);