
-- 1) Trigger function: mark unread sla_notifications as read when conditions met
CREATE OR REPLACE FUNCTION public.auto_close_sla_notifications_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Outbound by a human salesperson resolves the SLA
  IF NEW.direction = 'outbound'
     AND NEW.sent_by_user_id IS NOT NULL
     AND NEW.ai_agent_id IS NULL THEN
    UPDATE public.sla_notifications
       SET is_read = true
     WHERE contact_id = NEW.contact_id
       AND is_read = false;
  END IF;

  -- New inbound from customer starts a fresh SLA cycle; previous alerts are stale
  IF NEW.direction = 'inbound' THEN
    UPDATE public.sla_notifications
       SET is_read = true
     WHERE contact_id = NEW.contact_id
       AND is_read = false
       AND created_at < NEW.created_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_close_sla_notifications_on_message ON public.messages;
CREATE TRIGGER trg_auto_close_sla_notifications_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.auto_close_sla_notifications_on_message();

-- 2) Trigger function: when contact is closed, dismiss its SLA alerts
CREATE OR REPLACE FUNCTION public.auto_close_sla_notifications_on_contact_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'closed' AND COALESCE(OLD.status, '') <> 'closed' THEN
    UPDATE public.sla_notifications
       SET is_read = true
     WHERE contact_id = NEW.id
       AND is_read = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_close_sla_notifications_on_contact_close ON public.contacts;
CREATE TRIGGER trg_auto_close_sla_notifications_on_contact_close
AFTER UPDATE OF status ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.auto_close_sla_notifications_on_contact_close();

-- 3) Backfill: clean up stale notifications
-- 3a) Contact is closed
UPDATE public.sla_notifications n
   SET is_read = true
  FROM public.contacts c
 WHERE c.id = n.contact_id
   AND n.is_read = false
   AND c.status = 'closed';

-- 3b) Any newer message exists for the contact after notification creation
UPDATE public.sla_notifications n
   SET is_read = true
 WHERE n.is_read = false
   AND EXISTS (
     SELECT 1 FROM public.messages m
      WHERE m.contact_id = n.contact_id
        AND m.created_at > n.created_at
        AND (
          (m.direction = 'outbound' AND m.sent_by_user_id IS NOT NULL AND m.ai_agent_id IS NULL)
          OR m.direction = 'inbound'
        )
   );
