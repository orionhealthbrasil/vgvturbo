
-- 1) Trigger function: when whatsapp_message_id is set on an outbound message,
-- relink any pending quoted messages that match by (contact, content, type).
CREATE OR REPLACE FUNCTION public.reconcile_quoted_message_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.whatsapp_message_id IS NOT NULL
     AND (OLD.whatsapp_message_id IS NULL OR OLD.whatsapp_message_id <> NEW.whatsapp_message_id)
     AND NEW.content IS NOT NULL THEN
    UPDATE public.messages m
    SET quoted_message_id = NEW.id
    WHERE m.quoted_message_id IS NULL
      AND m.quoted_content = NEW.content
      AND COALESCE(m.quoted_type, 'text') = COALESCE(NEW.message_type, 'text')
      AND m.contact_id = NEW.contact_id
      AND m.organization_id = NEW.organization_id
      AND m.created_at >= NEW.created_at
      AND m.created_at <= NEW.created_at + interval '30 minutes'
      AND m.id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_quoted_message_id ON public.messages;
CREATE TRIGGER trg_reconcile_quoted_message_id
AFTER UPDATE OF whatsapp_message_id ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.reconcile_quoted_message_id();

-- 2) One-time backfill: try to resolve existing rows with quoted_content but no quoted_message_id.
-- Match the most recent prior message in the same conversation with the same content+type.
WITH candidates AS (
  SELECT
    m.id AS reply_id,
    (
      SELECT q.id
      FROM public.messages q
      WHERE q.organization_id = m.organization_id
        AND q.contact_id = m.contact_id
        AND q.content = m.quoted_content
        AND COALESCE(q.message_type, 'text') = COALESCE(m.quoted_type, 'text')
        AND q.created_at <= m.created_at
        AND q.created_at >= m.created_at - interval '24 hours'
        AND q.id <> m.id
      ORDER BY q.created_at DESC
      LIMIT 1
    ) AS resolved_id
  FROM public.messages m
  WHERE m.quoted_message_id IS NULL
    AND m.quoted_content IS NOT NULL
)
UPDATE public.messages m
SET quoted_message_id = c.resolved_id
FROM candidates c
WHERE m.id = c.reply_id
  AND c.resolved_id IS NOT NULL;
