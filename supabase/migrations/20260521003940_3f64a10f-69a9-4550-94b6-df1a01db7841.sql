
ALTER TABLE public.funnel_stages
  ADD COLUMN IF NOT EXISTS sla_threshold_minutes INTEGER;

CREATE OR REPLACE FUNCTION public.reset_sla_on_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.funnel_stage IS DISTINCT FROM OLD.funnel_stage
     AND NEW.status = 'open'
     AND COALESCE(NEW.is_group, false) = false THEN
    NEW.sla_clock_started_at := now();
    NEW.sla_alert_sent := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_sla_on_stage_change ON public.contacts;
CREATE TRIGGER trg_reset_sla_on_stage_change
BEFORE UPDATE OF funnel_stage ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.reset_sla_on_stage_change();
