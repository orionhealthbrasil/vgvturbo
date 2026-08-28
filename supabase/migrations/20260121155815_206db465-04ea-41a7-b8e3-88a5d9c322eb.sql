-- Allow owners and admins to update member roles
CREATE POLICY "Owners and admins can update member roles"
ON public.organization_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.organization_id = organization_members.organization_id 
    AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.organization_id = organization_members.organization_id 
    AND om.role IN ('owner', 'admin')
  )
  -- Prevent changing owner role or self-demotion
  AND organization_members.role = 'member'
);