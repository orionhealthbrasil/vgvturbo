-- Drop the existing status check constraint
ALTER TABLE public.contacts DROP CONSTRAINT contacts_status_check;

-- Add the new constraint that includes 'snoozed' status
ALTER TABLE public.contacts 
ADD CONSTRAINT contacts_status_check 
CHECK (status = ANY (ARRAY['open'::text, 'closed'::text, 'snoozed'::text]));