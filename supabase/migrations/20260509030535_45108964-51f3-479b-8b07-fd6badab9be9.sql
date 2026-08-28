DROP POLICY IF EXISTS "Owners can update their organization" ON public.organizations;

CREATE POLICY "Admins and owners can update their organization"
ON public.organizations
FOR UPDATE
USING (public.is_org_admin_or_owner(id))
WITH CHECK (public.is_org_admin_or_owner(id));