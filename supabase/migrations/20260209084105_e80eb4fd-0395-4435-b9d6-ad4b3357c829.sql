
-- Add forwarding support columns to messages (WhatsApp)
ALTER TABLE public.messages 
ADD COLUMN is_forwarded boolean NOT NULL DEFAULT false,
ADD COLUMN forwarded_from text NULL;

-- Add forwarding support columns to internal_messages (Chat Interno)
ALTER TABLE public.internal_messages 
ADD COLUMN is_forwarded boolean NOT NULL DEFAULT false,
ADD COLUMN forwarded_from text NULL;
