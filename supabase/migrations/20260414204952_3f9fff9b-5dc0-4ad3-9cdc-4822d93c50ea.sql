
CREATE TABLE public.conversation_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_name TEXT NOT NULL,
  phone TEXT,
  lead_source TEXT,
  sale_status TEXT,
  product_line TEXT,
  part_searched TEXT,
  quantity INTEGER,
  sale_value NUMERIC(12,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT
);

ALTER TABLE public.conversation_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org analyses"
ON public.conversation_analyses FOR SELECT
TO authenticated
USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Members can insert org analyses"
ON public.conversation_analyses FOR INSERT
TO authenticated
WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Service role full access"
ON public.conversation_analyses FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_conversation_analyses_org ON public.conversation_analyses(organization_id);
CREATE INDEX idx_conversation_analyses_date ON public.conversation_analyses(analysis_date);
