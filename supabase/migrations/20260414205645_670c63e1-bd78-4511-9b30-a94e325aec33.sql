
CREATE POLICY "Owners can delete org analyses"
ON public.conversation_analyses FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM organization_members om
  WHERE om.user_id = auth.uid()
    AND om.organization_id = conversation_analyses.organization_id
    AND om.role = 'owner'::org_role
));
