-- Add automation flow tracking fields to contacts table
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS active_flow_id uuid REFERENCES public.automations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS current_node_id text,
ADD COLUMN IF NOT EXISTS flow_context jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS flow_paused_until timestamp with time zone;

-- Create index for faster lookups of contacts in active flows
CREATE INDEX IF NOT EXISTS idx_contacts_active_flow ON public.contacts(active_flow_id) WHERE active_flow_id IS NOT NULL;

-- Create index for delay resumption queries
CREATE INDEX IF NOT EXISTS idx_contacts_flow_paused ON public.contacts(flow_paused_until) WHERE flow_paused_until IS NOT NULL;