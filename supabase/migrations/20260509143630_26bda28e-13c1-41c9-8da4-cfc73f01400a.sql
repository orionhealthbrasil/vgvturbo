
-- Add curation tracking columns to conversation_analyses
ALTER TABLE public.conversation_analyses
  ADD COLUMN IF NOT EXISTS is_corrected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_values jsonb,
  ADD COLUMN IF NOT EXISTS correction_note text,
  ADD COLUMN IF NOT EXISTS corrected_by uuid,
  ADD COLUMN IF NOT EXISTS corrected_at timestamptz;

-- Curation examples (few-shot learning per organization)
CREATE TABLE IF NOT EXISTS public.analysis_curation_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  analysis_id uuid REFERENCES public.conversation_analyses(id) ON DELETE SET NULL,
  contact_id uuid,
  conversation_excerpt text,
  wrong_values jsonb,
  correct_values jsonb NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_curation_examples_org_created
  ON public.analysis_curation_examples (organization_id, created_at DESC);

ALTER TABLE public.analysis_curation_examples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view curation examples" ON public.analysis_curation_examples;
CREATE POLICY "Org members can view curation examples"
  ON public.analysis_curation_examples FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Admins can insert curation examples" ON public.analysis_curation_examples;
CREATE POLICY "Admins can insert curation examples"
  ON public.analysis_curation_examples FOR INSERT
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

DROP POLICY IF EXISTS "Admins can update curation examples" ON public.analysis_curation_examples;
CREATE POLICY "Admins can update curation examples"
  ON public.analysis_curation_examples FOR UPDATE
  USING (public.is_org_admin_or_owner(organization_id));

DROP POLICY IF EXISTS "Admins can delete curation examples" ON public.analysis_curation_examples;
CREATE POLICY "Admins can delete curation examples"
  ON public.analysis_curation_examples FOR DELETE
  USING (public.is_org_admin_or_owner(organization_id));

-- Curation rules (one row per organization, free text)
CREATE TABLE IF NOT EXISTS public.analysis_curation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  rules_text text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_curation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view curation rules" ON public.analysis_curation_rules;
CREATE POLICY "Org members can view curation rules"
  ON public.analysis_curation_rules FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Admins can insert curation rules" ON public.analysis_curation_rules;
CREATE POLICY "Admins can insert curation rules"
  ON public.analysis_curation_rules FOR INSERT
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

DROP POLICY IF EXISTS "Admins can update curation rules" ON public.analysis_curation_rules;
CREATE POLICY "Admins can update curation rules"
  ON public.analysis_curation_rules FOR UPDATE
  USING (public.is_org_admin_or_owner(organization_id));

CREATE TRIGGER trg_analysis_curation_rules_updated
  BEFORE UPDATE ON public.analysis_curation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allow admin/owner to update conversation_analyses (for inline edits)
DROP POLICY IF EXISTS "Admins can update conversation_analyses" ON public.conversation_analyses;
CREATE POLICY "Admins can update conversation_analyses"
  ON public.conversation_analyses FOR UPDATE
  USING (public.is_org_admin_or_owner(organization_id));
