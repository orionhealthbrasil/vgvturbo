
-- Add ai_enabled column to contacts
ALTER TABLE public.contacts ADD COLUMN ai_enabled boolean NOT NULL DEFAULT false;

-- Create ai_agent_config table
CREATE TABLE public.ai_agent_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  openai_api_key text,
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  system_prompt text NOT NULL DEFAULT 'Você é um assistente virtual prestativo. Responda de forma clara e objetiva.',
  faq_content text,
  about_company text,
  max_context_messages integer NOT NULL DEFAULT 10,
  pause_on_human_reply boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_agent_config ENABLE ROW LEVEL SECURITY;

-- Owners can do everything
CREATE POLICY "Owners can manage ai agent config"
  ON public.ai_agent_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = ai_agent_config.organization_id
        AND om.role = 'owner'::org_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = ai_agent_config.organization_id
        AND om.role = 'owner'::org_role
    )
  );

-- Members can view (needed for edge function logic checks via client)
CREATE POLICY "Members can view ai agent config"
  ON public.ai_agent_config
  FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id));

-- Trigger for updated_at
CREATE TRIGGER update_ai_agent_config_updated_at
  BEFORE UPDATE ON public.ai_agent_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
