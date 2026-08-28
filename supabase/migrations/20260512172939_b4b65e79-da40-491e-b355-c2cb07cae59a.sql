ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS split_long_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS split_target_chars integer NOT NULL DEFAULT 350,
  ADD COLUMN IF NOT EXISTS split_max_parts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS split_delay_ms integer NOT NULL DEFAULT 1200;