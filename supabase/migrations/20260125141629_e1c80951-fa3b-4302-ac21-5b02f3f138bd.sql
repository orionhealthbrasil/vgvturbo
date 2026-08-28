-- Add priority column to automations table
-- Higher priority number = executes first (e.g., 10 executes before 1)
ALTER TABLE public.automations 
ADD COLUMN priority integer NOT NULL DEFAULT 0;

-- Add index for efficient ordering by priority
CREATE INDEX idx_automations_priority ON public.automations(organization_id, is_active, priority DESC);

-- Add comment explaining the field
COMMENT ON COLUMN public.automations.priority IS 'Higher values execute first when multiple automations match the same trigger';