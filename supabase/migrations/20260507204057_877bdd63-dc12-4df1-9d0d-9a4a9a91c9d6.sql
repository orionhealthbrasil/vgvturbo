-- Add canvas position columns and auto_close to funnel_stages
ALTER TABLE public.funnel_stages 
  ADD COLUMN IF NOT EXISTS canvas_x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS canvas_y DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS auto_close_conversation BOOLEAN NOT NULL DEFAULT false;

-- Create funnel stage transitions table
CREATE TABLE IF NOT EXISTS public.funnel_stage_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_stage_id UUID NOT NULL REFERENCES public.funnel_stages(id) ON DELETE CASCADE,
  to_stage_id UUID NOT NULL REFERENCES public.funnel_stages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, from_stage_id, to_stage_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_funnel_transitions_org ON public.funnel_stage_transitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_funnel_transitions_from ON public.funnel_stage_transitions(from_stage_id);

-- RLS
ALTER TABLE public.funnel_stage_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view transitions"
  ON public.funnel_stage_transitions FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Owners/admins manage transitions"
  ON public.funnel_stage_transitions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = funnel_stage_transitions.organization_id
      AND om.role IN ('owner','admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = funnel_stage_transitions.organization_id
      AND om.role IN ('owner','admin')
  ));