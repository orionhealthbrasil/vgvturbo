-- Change default value of last_message_at from now() to NULL
-- This ensures imported contacts don't appear in the conversation list
ALTER TABLE public.contacts 
ALTER COLUMN last_message_at SET DEFAULT NULL;