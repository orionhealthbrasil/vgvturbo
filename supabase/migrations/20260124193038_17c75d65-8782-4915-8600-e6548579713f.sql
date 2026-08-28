-- Add column to cache the instance owner JID
ALTER TABLE public.whatsapp_instances
ADD COLUMN IF NOT EXISTS owner_jid TEXT;