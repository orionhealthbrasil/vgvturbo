CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
  ON public.contacts USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm
  ON public.contacts USING GIN (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm
  ON public.contacts USING GIN (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_org_status_lastmsg
  ON public.contacts (organization_id, status, last_message_at DESC NULLS LAST)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_messages_content_trgm
  ON public.messages USING GIN (content gin_trgm_ops);
