
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_org_members_org_available
  ON public.organization_members (organization_id, is_available);

DROP POLICY IF EXISTS "Members can update their own availability" ON public.organization_members;
CREATE POLICY "Members can update their own availability"
  ON public.organization_members
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
