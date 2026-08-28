-- Add DELETE policy for reviews - only owners and admins can delete
CREATE POLICY "Owners and admins can delete reviews"
ON public.reviews
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = reviews.organization_id
      AND om.role IN ('owner', 'admin')
  )
);