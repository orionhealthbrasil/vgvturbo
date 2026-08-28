-- Create funnel_stages table for customizable sales funnel
CREATE TABLE public.funnel_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL, -- internal identifier (e.g., 'lead', 'negotiation', 'closed')
  color text NOT NULL DEFAULT '#6366f1', -- color for contact photo border
  cta_text text, -- button text to advance to this stage (null for first stage)
  position integer NOT NULL DEFAULT 0, -- order in the funnel
  is_final boolean NOT NULL DEFAULT false, -- if true, this is the final stage (where sale is closed)
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, slug),
  UNIQUE(organization_id, position)
);

-- Enable RLS
ALTER TABLE public.funnel_stages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view funnel stages in their organization"
ON public.funnel_stages FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Owners can create funnel stages"
ON public.funnel_stages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = funnel_stages.organization_id
    AND om.role = 'owner'
  )
);

CREATE POLICY "Owners can update funnel stages"
ON public.funnel_stages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = funnel_stages.organization_id
    AND om.role = 'owner'
  )
);

CREATE POLICY "Owners can delete funnel stages"
ON public.funnel_stages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = funnel_stages.organization_id
    AND om.role = 'owner'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_funnel_stages_updated_at
BEFORE UPDATE ON public.funnel_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to initialize default funnel stages for new organizations
CREATE OR REPLACE FUNCTION public.initialize_default_funnel_stages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert default funnel stages
  INSERT INTO public.funnel_stages (organization_id, name, slug, color, cta_text, position, is_final)
  VALUES 
    (NEW.id, 'Triagem', 'lead', '#6366f1', NULL, 0, false),
    (NEW.id, 'Negociação', 'negotiation', '#f59e0b', 'Orçamento Enviado', 1, false),
    (NEW.id, 'Fechamento', 'closed', '#22c55e', 'Finalizar Venda', 2, true);
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create funnel stages for new organizations
CREATE TRIGGER on_organization_created_add_funnel_stages
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.initialize_default_funnel_stages();

-- Insert default funnel stages for existing organizations
INSERT INTO public.funnel_stages (organization_id, name, slug, color, cta_text, position, is_final)
SELECT 
  o.id,
  'Triagem',
  'lead',
  '#6366f1',
  NULL,
  0,
  false
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.funnel_stages fs 
  WHERE fs.organization_id = o.id AND fs.slug = 'lead'
);

INSERT INTO public.funnel_stages (organization_id, name, slug, color, cta_text, position, is_final)
SELECT 
  o.id,
  'Negociação',
  'negotiation',
  '#f59e0b',
  'Orçamento Enviado',
  1,
  false
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.funnel_stages fs 
  WHERE fs.organization_id = o.id AND fs.slug = 'negotiation'
);

INSERT INTO public.funnel_stages (organization_id, name, slug, color, cta_text, position, is_final)
SELECT 
  o.id,
  'Fechamento',
  'closed',
  '#22c55e',
  'Finalizar Venda',
  2,
  true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.funnel_stages fs 
  WHERE fs.organization_id = o.id AND fs.slug = 'closed'
);