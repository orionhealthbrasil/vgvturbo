-- Create function to ensure status and funnel_stage consistency
CREATE OR REPLACE FUNCTION public.ensure_ticket_status_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When status changes to 'closed', ensure funnel_stage is also 'closed'
  IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
    NEW.funnel_stage := 'closed';
    IF NEW.closed_at IS NULL THEN
      NEW.closed_at := NOW();
    END IF;
  END IF;
  
  -- When funnel_stage changes to 'closed', ensure status is also 'closed'
  IF NEW.funnel_stage = 'closed' AND OLD.funnel_stage != 'closed' THEN
    NEW.status := 'closed';
    IF NEW.closed_at IS NULL THEN
      NEW.closed_at := NOW();
    END IF;
  END IF;
  
  -- When reopening (status changes from 'closed' to 'open'), reset funnel_stage to 'lead'
  IF NEW.status = 'open' AND OLD.status = 'closed' THEN
    NEW.funnel_stage := 'lead';
    NEW.sale_result := NULL;
    NEW.closed_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on contacts table
DROP TRIGGER IF EXISTS trigger_ensure_ticket_consistency ON public.contacts;
CREATE TRIGGER trigger_ensure_ticket_consistency
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_ticket_status_consistency();