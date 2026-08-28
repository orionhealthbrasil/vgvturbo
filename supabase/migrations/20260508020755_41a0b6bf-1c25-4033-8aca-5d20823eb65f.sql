ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS funnel_transitions_initialized BOOLEAN NOT NULL DEFAULT false;