-- Add base_url column to whatsapp_instances
ALTER TABLE public.whatsapp_instances
ADD COLUMN base_url text NOT NULL DEFAULT 'https://smv2-1.stevo.chat';