
-- Add unique constraint on (organization_id, phone) to prevent duplicate contacts
ALTER TABLE public.contacts ADD CONSTRAINT contacts_org_phone_unique UNIQUE (organization_id, phone);
