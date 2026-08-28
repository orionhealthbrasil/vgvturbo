
-- Win reasons table (mirrors loss_reasons)
CREATE TABLE IF NOT EXISTS public.win_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text NOT NULL,
  color text,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS win_reasons_org_idx ON public.win_reasons (organization_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS win_reasons_org_label_unique ON public.win_reasons (organization_id, lower(label));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.win_reasons TO authenticated;
GRANT ALL ON public.win_reasons TO service_role;

ALTER TABLE public.win_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view win reasons"
  ON public.win_reasons FOR SELECT TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Org admins can insert win reasons"
  ON public.win_reasons FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "Org admins can update win reasons"
  ON public.win_reasons FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id))
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "Org admins can delete win reasons"
  ON public.win_reasons FOR DELETE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id));

CREATE TRIGGER update_win_reasons_updated_at
  BEFORE UPDATE ON public.win_reasons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Contact win_reason column
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS win_reason text;

-- Organization configurable questions
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS win_reason_question text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS loss_reason_question text;
