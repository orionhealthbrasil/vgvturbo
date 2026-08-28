-- Trigger function para disparar automation-engine em mudanças de booking
CREATE OR REPLACE FUNCTION public.trigger_automation_on_booking_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type TEXT;
  v_supabase_url TEXT := 'https://xcpqftfprwllkmziesvo.supabase.co';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcHFmdGZwcndsbGttemllc3ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzY2NDQsImV4cCI6MjA4NDUxMjY0NH0.air0PVEzT54SuiEb8fe1kI2a4sRfqYXuuLQ-r0_5Qmo';
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'booking_created';
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> 'cancelled' THEN
    v_event_type := 'booking_cancelled';
  ELSE
    RETURN NEW;
  END IF;

  -- Só dispara se houver contact_id vinculado (engine precisa de contact)
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/automation-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object(
      'contact_id', NEW.contact_id::text,
      'organization_id', NEW.organization_id::text,
      'event_type', v_event_type,
      'booking_id', NEW.id::text,
      'calendar_id', NEW.calendar_id::text
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_automation_trigger ON public.bookings;
CREATE TRIGGER bookings_automation_trigger
AFTER INSERT OR UPDATE OF status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.trigger_automation_on_booking_change();