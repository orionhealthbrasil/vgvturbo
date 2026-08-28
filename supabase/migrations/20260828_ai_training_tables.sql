CREATE TABLE IF NOT EXISTS public.ai_training_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  title text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_training_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_training_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('inbound', 'outbound')),
  content text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_training_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_training_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_members_training_conversations ON public.ai_training_conversations
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY org_members_training_messages ON public.ai_training_messages
  FOR ALL USING (conversation_id IN (
    SELECT id FROM public.ai_training_conversations WHERE organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  ));
