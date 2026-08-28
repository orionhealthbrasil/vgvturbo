CREATE OR REPLACE FUNCTION public.trigger_goal_recalc_on_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE g_id UUID;
BEGIN
  IF (TG_OP='UPDATE' AND
      (OLD.sale_result IS DISTINCT FROM NEW.sale_result
       OR OLD.deal_value IS DISTINCT FROM NEW.deal_value
       OR OLD.closed_at IS DISTINCT FROM NEW.closed_at
       OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to))
     OR TG_OP='INSERT' THEN
    FOR g_id IN
      SELECT id FROM goals
      WHERE organization_id=NEW.organization_id
        AND status='active'
        AND COALESCE(NEW.closed_at::date, CURRENT_DATE) BETWEEN period_start AND period_end
    LOOP
      PERFORM recalculate_goal_progress(g_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;