-- Create trigger to auto-create salesperson when a viewer (vendedor) joins the organization
CREATE OR REPLACE FUNCTION public.auto_create_salesperson_on_viewer_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_name TEXT;
  v_existing_salesperson_id UUID;
BEGIN
  -- Only execute for members with 'viewer' role (vendedores)
  IF NEW.member_role != 'viewer' THEN
    RETURN NEW;
  END IF;

  -- Get user name from profile
  SELECT full_name INTO v_user_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  -- Skip if no name
  IF v_user_name IS NULL OR v_user_name = '' THEN
    RETURN NEW;
  END IF;

  -- Check if salesperson already exists for this user
  SELECT id INTO v_existing_salesperson_id
  FROM public.salespeople
  WHERE user_id = NEW.user_id
  LIMIT 1;

  -- If already linked to a salesperson, skip
  IF v_existing_salesperson_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Try to find an unlinked salesperson with the same name
  SELECT id INTO v_existing_salesperson_id
  FROM public.salespeople
  WHERE organization_id = NEW.organization_id
    AND LOWER(TRIM(name)) = LOWER(TRIM(v_user_name))
    AND user_id IS NULL
  LIMIT 1;

  IF v_existing_salesperson_id IS NOT NULL THEN
    -- Link existing salesperson to user
    UPDATE public.salespeople
    SET user_id = NEW.user_id
    WHERE id = v_existing_salesperson_id;
  ELSE
    -- Create new salesperson record
    INSERT INTO public.salespeople (name, organization_id, user_id)
    VALUES (v_user_name, NEW.organization_id, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger on organization_members table
DROP TRIGGER IF EXISTS on_viewer_join_create_salesperson ON public.organization_members;
CREATE TRIGGER on_viewer_join_create_salesperson
  AFTER INSERT ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_salesperson_on_viewer_join();