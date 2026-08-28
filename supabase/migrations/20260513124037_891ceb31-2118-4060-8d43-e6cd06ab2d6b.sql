
-- 1) Add pipeline_id column to funnel_stages (nullable for now)
ALTER TABLE public.funnel_stages
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES public.kanban_pipelines(id) ON DELETE CASCADE;

-- 2) For each org that has funnel_stages but no kanban_pipelines, create a default pipeline
INSERT INTO public.kanban_pipelines (organization_id, name, is_default)
SELECT DISTINCT fs.organization_id, 'Funil de Vendas', true
FROM public.funnel_stages fs
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_pipelines kp WHERE kp.organization_id = fs.organization_id
);

-- 3) Ensure every org with pipelines has at least one is_default = true
WITH need_default AS (
  SELECT organization_id
  FROM public.kanban_pipelines
  GROUP BY organization_id
  HAVING bool_or(is_default) = false
)
UPDATE public.kanban_pipelines kp
SET is_default = true
WHERE kp.id IN (
  SELECT DISTINCT ON (organization_id) id
  FROM public.kanban_pipelines
  WHERE organization_id IN (SELECT organization_id FROM need_default)
  ORDER BY organization_id, created_at ASC
);

-- 4) Backfill funnel_stages.pipeline_id with each org's default pipeline
UPDATE public.funnel_stages fs
SET pipeline_id = kp.id
FROM public.kanban_pipelines kp
WHERE fs.pipeline_id IS NULL
  AND kp.organization_id = fs.organization_id
  AND kp.is_default = true;

-- 5) Backfill contacts.pipeline_id where missing (use default of org)
UPDATE public.contacts c
SET pipeline_id = kp.id
FROM public.kanban_pipelines kp
WHERE c.pipeline_id IS NULL
  AND kp.organization_id = c.organization_id
  AND kp.is_default = true;

-- 6) Make pipeline_id NOT NULL
ALTER TABLE public.funnel_stages
  ALTER COLUMN pipeline_id SET NOT NULL;

-- 7) Drop old unique constraints scoped to organization, recreate scoped to pipeline
ALTER TABLE public.funnel_stages
  DROP CONSTRAINT IF EXISTS funnel_stages_organization_id_position_key;
ALTER TABLE public.funnel_stages
  DROP CONSTRAINT IF EXISTS funnel_stages_organization_id_slug_key;

ALTER TABLE public.funnel_stages
  ADD CONSTRAINT funnel_stages_pipeline_id_position_key UNIQUE (pipeline_id, position);
ALTER TABLE public.funnel_stages
  ADD CONSTRAINT funnel_stages_pipeline_id_slug_key UNIQUE (pipeline_id, slug);

CREATE INDEX IF NOT EXISTS idx_funnel_stages_pipeline_id ON public.funnel_stages(pipeline_id);

-- 8) Update initialize_default_funnel_stages to also create a default pipeline
CREATE OR REPLACE FUNCTION public.initialize_default_funnel_stages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pipeline_id uuid;
BEGIN
  -- Create default pipeline for the new organization
  INSERT INTO public.kanban_pipelines (organization_id, name, is_default)
  VALUES (NEW.id, 'Funil de Vendas', true)
  RETURNING id INTO v_pipeline_id;

  -- Insert default funnel stages tied to that pipeline
  INSERT INTO public.funnel_stages (organization_id, pipeline_id, name, slug, color, cta_text, position, is_final, stage_type)
  VALUES 
    (NEW.id, v_pipeline_id, 'Triagem', 'lead', '#6366f1', NULL, 0, false, 'in_progress'),
    (NEW.id, v_pipeline_id, 'Negociação', 'negotiation', '#f59e0b', 'Orçamento Enviado', 1, false, 'in_progress'),
    (NEW.id, v_pipeline_id, 'Fechamento', 'closed', '#22c55e', 'Finalizar Venda', 2, true, 'won');
  
  RETURN NEW;
END;
$function$;

-- 9) Ensure only one default pipeline per organization
CREATE UNIQUE INDEX IF NOT EXISTS uniq_kanban_pipelines_one_default_per_org
  ON public.kanban_pipelines(organization_id)
  WHERE is_default = true;
