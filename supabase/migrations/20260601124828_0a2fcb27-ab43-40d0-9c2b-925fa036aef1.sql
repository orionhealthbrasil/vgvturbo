ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS recurrence_rule text,
  ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS parent_schedule_id uuid REFERENCES public.scheduled_messages(id) ON DELETE SET NULL;

ALTER TABLE public.scheduled_messages
  DROP CONSTRAINT IF EXISTS scheduled_messages_recurrence_rule_check;

ALTER TABLE public.scheduled_messages
  ADD CONSTRAINT scheduled_messages_recurrence_rule_check
  CHECK (recurrence_rule IS NULL OR recurrence_rule IN ('daily','weekly','monthly','yearly'));

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_parent ON public.scheduled_messages(parent_schedule_id);