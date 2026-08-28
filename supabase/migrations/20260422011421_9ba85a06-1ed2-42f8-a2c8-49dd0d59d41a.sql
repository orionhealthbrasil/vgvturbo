ALTER TABLE public.funnel_stages
  ADD COLUMN IF NOT EXISTS stage_type TEXT NOT NULL DEFAULT 'in_progress';

ALTER TABLE public.funnel_stages
  DROP CONSTRAINT IF EXISTS funnel_stages_stage_type_check;

ALTER TABLE public.funnel_stages
  ADD CONSTRAINT funnel_stages_stage_type_check
  CHECK (stage_type IN ('in_progress','won','lost'));

-- Marcar etapas finais existentes como 'won' (compatibilidade)
UPDATE public.funnel_stages
SET stage_type = 'won'
WHERE is_final = true AND stage_type = 'in_progress';