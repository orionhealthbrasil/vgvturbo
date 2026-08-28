-- Add RLS policy to allow owners and admins to delete messages
CREATE POLICY "Owners and admins can delete messages"
ON public.messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = messages.organization_id
      AND om.role IN ('owner', 'admin')
  )
);