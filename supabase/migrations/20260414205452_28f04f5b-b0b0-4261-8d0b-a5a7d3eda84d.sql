
-- Table for share tokens
CREATE TABLE public.shared_analysis_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

ALTER TABLE public.shared_analysis_views ENABLE ROW LEVEL SECURITY;

-- Owners can manage share tokens
CREATE POLICY "Owners can manage share tokens"
ON public.shared_analysis_views FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM organization_members om
  WHERE om.user_id = auth.uid()
    AND om.organization_id = shared_analysis_views.organization_id
    AND om.role = 'owner'::org_role
))
WITH CHECK (EXISTS (
  SELECT 1 FROM organization_members om
  WHERE om.user_id = auth.uid()
    AND om.organization_id = shared_analysis_views.organization_id
    AND om.role = 'owner'::org_role
));

-- Service role full access
CREATE POLICY "Service role full access shared_analysis_views"
ON public.shared_analysis_views FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RPC: get shared analyses by token (public access via security definer)
CREATE OR REPLACE FUNCTION public.get_shared_analyses(p_token UUID)
RETURNS TABLE(
  id UUID,
  analysis_date DATE,
  customer_name TEXT,
  phone TEXT,
  lead_source TEXT,
  sale_status TEXT,
  product_line TEXT,
  part_searched TEXT,
  quantity INTEGER,
  sale_value NUMERIC,
  created_at TIMESTAMPTZ,
  created_by TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ca.id,
    ca.analysis_date,
    ca.customer_name,
    ca.phone,
    ca.lead_source,
    ca.sale_status,
    ca.product_line,
    ca.part_searched,
    ca.quantity,
    ca.sale_value,
    ca.created_at,
    ca.created_by
  FROM public.conversation_analyses ca
  WHERE ca.organization_id = (
    SELECT sav.organization_id
    FROM public.shared_analysis_views sav
    WHERE sav.share_token = p_token
      AND sav.is_active = true
    LIMIT 1
  )
  ORDER BY ca.analysis_date DESC, ca.created_at DESC;
$$;

-- Enable realtime on conversation_analyses
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_analyses;
