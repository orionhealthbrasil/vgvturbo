-- Harden and fix org creation RPC: ensure RLS is bypassed inside function

REVOKE ALL ON FUNCTION public.create_organization_with_owner(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(p_name TEXT)
RETURNS TABLE(organization_id UUID, organization_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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
$$;