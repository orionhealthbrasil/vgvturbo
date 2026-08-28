
-- Create ai_agents table
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'conversational',
  is_active BOOLEAN NOT NULL DEFAULT true,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  system_prompt TEXT NOT NULL DEFAULT 'Você é um assistente virtual prestativo. Responda de forma clara e objetiva.',
  faq_content TEXT,
  about_company TEXT,
  max_context_messages INTEGER NOT NULL DEFAULT 10,
  pause_on_human_reply BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add shared OpenAI API key to organizations
ALTER TABLE public.organizations ADD COLUMN openai_api_key TEXT;

-- Add ai_agent_id to contacts
ALTER TABLE public.contacts ADD COLUMN ai_agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

-- RLS: Members can view
CREATE POLICY "Members can view ai agents"
ON public.ai_agents FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

-- RLS: Owners can manage
CREATE POLICY "Owners can manage ai agents"
ON public.ai_agents FOR ALL
USING (EXISTS (
  SELECT 1 FROM organization_members om
  WHERE om.user_id = auth.uid()
    AND om.organization_id = ai_agents.organization_id
    AND om.role = 'owner'::org_role
))
WITH CHECK (EXISTS (
  SELECT 1 FROM organization_members om
  WHERE om.user_id = auth.uid()
    AND om.organization_id = ai_agents.organization_id
    AND om.role = 'owner'::org_role
));

-- Trigger for updated_at
CREATE TRIGGER update_ai_agents_updated_at
BEFORE UPDATE ON public.ai_agents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing data from ai_agent_config
INSERT INTO public.ai_agents (organization_id, name, category, is_active, model, system_prompt, faq_content, about_company, max_context_messages, pause_on_human_reply)
SELECT organization_id, 'Atendente Principal', 'conversational', is_active, model, system_prompt, faq_content, about_company, max_context_messages, pause_on_human_reply
FROM public.ai_agent_config;

-- Copy API keys to organizations table
UPDATE public.organizations o
SET openai_api_key = c.openai_api_key
FROM public.ai_agent_config c
WHERE c.organization_id = o.id AND c.openai_api_key IS NOT NULL;

-- Index for quick lookups
CREATE INDEX idx_ai_agents_org_category ON public.ai_agents(organization_id, category);
