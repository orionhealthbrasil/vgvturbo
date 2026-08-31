-- Base para novos contatos nascerem no pipeline correto em vez de pipeline_id = null.
ALTER TABLE public.kanban_pipelines ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

UPDATE public.kanban_pipelines kp SET is_default = true
WHERE id = (
  SELECT id FROM public.kanban_pipelines
  WHERE organization_id = kp.organization_id
  ORDER BY created_at ASC LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM public.kanban_pipelines
  WHERE organization_id = kp.organization_id AND is_default = true
);
