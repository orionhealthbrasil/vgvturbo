-- Fix organization creation by making it atomic and avoiding SELECT-RLS issues on INSERT ... RETURNING

-- 1) Remove permissive INSERT policy on organizations (will also fix linter warning)
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- (Optional explicit deny for INSERT to make intent clear)
CREATE POLICY "No direct organization inserts"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (false);

-- 2) Create a SECURITY DEFINER function to create organization + first owner membership atomically
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(p_name TEXT)
RETURNS TABLE(organization_id UUID, organization_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  VALUES (v_org_id, v_user_id, 'owner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN QUERY
    SELECT v_org_id, trim(p_name);
END;
$$;

-- 3) Allow authenticated users to call the function
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(TEXT) TO authenticated;