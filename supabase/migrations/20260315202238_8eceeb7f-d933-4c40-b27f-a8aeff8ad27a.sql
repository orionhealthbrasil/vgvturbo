
-- Satisfaction survey configuration per organization
CREATE TABLE public.satisfaction_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Pesquisa de Satisfação',
  description TEXT DEFAULT 'Queremos saber como foi seu atendimento!',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#6366f1',
  thank_you_message TEXT NOT NULL DEFAULT 'Obrigado pela sua avaliação! 🎉',
  questions JSONB NOT NULL DEFAULT '[{"id": "rating", "type": "stars", "label": "Como você avalia o atendimento?", "required": true}, {"id": "comment", "type": "text", "label": "Deixe um comentário (opcional)", "required": false}]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Satisfaction responses from clients
CREATE TABLE public.satisfaction_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  survey_id UUID NOT NULL REFERENCES public.satisfaction_surveys(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_to UUID,
  token TEXT NOT NULL UNIQUE,
  rating INTEGER,
  answers JSONB DEFAULT '{}',
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.satisfaction_responses ENABLE ROW LEVEL SECURITY;

-- Survey config: org members can view, owners can manage
CREATE POLICY "Users can view surveys in their organization"
  ON public.satisfaction_surveys FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Owners can create surveys"
  ON public.satisfaction_surveys FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.organization_id = satisfaction_surveys.organization_id AND om.role = 'owner'::org_role
  ));

CREATE POLICY "Owners can update surveys"
  ON public.satisfaction_surveys FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.organization_id = satisfaction_surveys.organization_id AND om.role = 'owner'::org_role
  ));

-- Responses: org members can view, anonymous can insert (public form)
CREATE POLICY "Users can view responses in their organization"
  ON public.satisfaction_responses FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Anyone can insert responses via token"
  ON public.satisfaction_responses FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update responses via token"
  ON public.satisfaction_responses FOR UPDATE
  TO anon, authenticated
  USING (true);
