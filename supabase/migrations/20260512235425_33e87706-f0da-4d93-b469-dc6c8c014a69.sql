ALTER TABLE public.whatsapp_meta_instances
  ADD COLUMN IF NOT EXISTS access_token TEXT;