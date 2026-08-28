-- Add automations_paused field to contacts table
ALTER TABLE public.contacts 
ADD COLUMN automations_paused BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.contacts.automations_paused IS 'When true, this contact is immune to all automations';