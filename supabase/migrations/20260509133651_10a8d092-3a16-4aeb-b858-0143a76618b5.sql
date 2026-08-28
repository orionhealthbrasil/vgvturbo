CREATE OR REPLACE FUNCTION public.sla_is_human_response(
  m_direction text,
  m_sent_by_user_id uuid,
  m_ai_agent_id uuid,
  m_whatsapp_message_id text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT m_direction = 'outbound'
     AND m_ai_agent_id IS NULL
     AND (
       m_sent_by_user_id IS NOT NULL
       OR NULLIF(m_whatsapp_message_id, '') IS NOT NULL
     );
$$;

CREATE OR REPLACE FUNCTION public.auto_close_sla_notifications_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.sla_is_human_response(
    NEW.direction,
    NEW.sent_by_user_id,
    NEW.ai_agent_id,
    NEW.whatsapp_message_id
  ) THEN
    UPDATE public.sla_notifications
       SET is_read = true
     WHERE contact_id = NEW.contact_id
       AND is_read = false;

    UPDATE public.contacts
       SET sla_alert_sent = true
     WHERE id = NEW.contact_id
       AND status = 'open';
  END IF;

  IF NEW.direction = 'inbound' THEN
    UPDATE public.sla_notifications
       SET is_read = true
     WHERE contact_id = NEW.contact_id
       AND is_read = false
       AND created_at < NEW.created_at;

    UPDATE public.contacts
       SET sla_alert_sent = false
     WHERE id = NEW.contact_id
       AND status = 'open';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_close_sla_notifications_on_message ON public.messages;
CREATE TRIGGER trg_auto_close_sla_notifications_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.auto_close_sla_notifications_on_message();

UPDATE public.sla_notifications n
   SET is_read = true
  FROM public.contacts c
 WHERE c.id = n.contact_id
   AND n.is_read = false
   AND c.status = 'closed';

WITH notification_state AS (
  SELECT
    n.id,
    n.contact_id,
    n.created_at AS notification_created_at,
    last_inbound.created_at AS last_inbound_at,
    last_human_outbound.created_at AS last_human_outbound_at
  FROM public.sla_notifications n
  LEFT JOIN LATERAL (
    SELECT max(m.created_at) AS created_at
    FROM public.messages m
    WHERE m.contact_id = n.contact_id
      AND m.direction = 'inbound'
  ) last_inbound ON true
  LEFT JOIN LATERAL (
    SELECT max(m.created_at) AS created_at
    FROM public.messages m
    WHERE m.contact_id = n.contact_id
      AND public.sla_is_human_response(
        m.direction,
        m.sent_by_user_id,
        m.ai_agent_id,
        m.whatsapp_message_id
      )
  ) last_human_outbound ON true
  WHERE n.is_read = false
)
UPDATE public.sla_notifications n
   SET is_read = true
  FROM notification_state s
 WHERE n.id = s.id
   AND (
     s.last_inbound_at IS NULL
     OR s.last_human_outbound_at > s.last_inbound_at
     OR s.last_inbound_at > s.notification_created_at
   );

WITH current_contact_state AS (
  SELECT
    c.id,
    last_inbound.created_at AS last_inbound_at,
    last_human_outbound.created_at AS last_human_outbound_at
  FROM public.contacts c
  LEFT JOIN LATERAL (
    SELECT max(m.created_at) AS created_at
    FROM public.messages m
    WHERE m.contact_id = c.id
      AND m.direction = 'inbound'
  ) last_inbound ON true
  LEFT JOIN LATERAL (
    SELECT max(m.created_at) AS created_at
    FROM public.messages m
    WHERE m.contact_id = c.id
      AND public.sla_is_human_response(
        m.direction,
        m.sent_by_user_id,
        m.ai_agent_id,
        m.whatsapp_message_id
      )
  ) last_human_outbound ON true
  WHERE c.status = 'open'
)
UPDATE public.contacts c
   SET sla_alert_sent = true
  FROM current_contact_state s
 WHERE c.id = s.id
   AND (
     s.last_inbound_at IS NULL
     OR s.last_human_outbound_at > s.last_inbound_at
   );