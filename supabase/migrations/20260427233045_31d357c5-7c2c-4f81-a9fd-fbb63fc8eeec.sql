ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS is_sdr boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ai_agents_is_sdr
  ON public.ai_agents (organization_id, is_sdr)
  WHERE is_sdr = true;