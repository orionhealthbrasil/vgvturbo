-- Fix ambiguous column reference in create_organization_with_owner function
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(p_name text)
 RETURNS TABLE(organization_id uuid, organization_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_existing_org_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has an organization (use table alias to avoid ambiguity)
  SELECT om.organization_id INTO v_existing_org_id
  FROM public.organization_members om
  WHERE om.user_id = v_user_id
  LIMIT 1;

  IF v_existing_org_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to an organization';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  IF length(trim(p_name)) > 120 THEN
    RAISE EXCEPTION 'Organization name too long';
  END IF;

  INSERT INTO public.organizations(name)
  VALUES (trim(p_name))
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members(organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner');

  RETURN QUERY
    SELECT v_org_id, trim(p_name);
END;
$function$;