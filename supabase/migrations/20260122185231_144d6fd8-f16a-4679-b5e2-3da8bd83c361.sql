-- Corrigir a política de UPDATE da tabela organizations
-- A política anterior tinha um bug: comparava organization_id com id da mesma tabela

DROP POLICY IF EXISTS "Owners can update their organization" ON public.organizations;

CREATE POLICY "Owners can update their organization" 
  ON public.organizations 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid() 
        AND om.organization_id = organizations.id 
        AND om.role = 'owner'::org_role
    )
  );