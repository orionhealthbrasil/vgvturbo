-- 1) Novos campos em contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS deal_value numeric(14,2),
  ADD COLUMN IF NOT EXISTS loss_reason text,
  ADD COLUMN IF NOT EXISTS deal_notes text;

CREATE INDEX IF NOT EXISTS idx_contacts_org_status_funnel
  ON public.contacts (organization_id, status, funnel_stage);

-- 2) Tabela de acesso adicional à Pipeline
CREATE TABLE IF NOT EXISTS public.pipeline_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.pipeline_access ENABLE ROW LEVEL SECURITY;

-- Owners e admins podem gerenciar (insert/update/delete/select) os acessos da sua org
CREATE POLICY "Owners and admins manage pipeline access"
ON public.pipeline_access
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = pipeline_access.organization_id
      AND om.role IN ('owner','admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = pipeline_access.organization_id
      AND om.role IN ('owner','admin')
  )
);

-- Usuários podem ver o próprio registro de acesso (para checar permissão no app)
CREATE POLICY "Users can view their own pipeline access"
ON public.pipeline_access
FOR SELECT
USING (user_id = auth.uid());

-- 3) Função utilitária: verifica se o usuário pode ver a Pipeline
CREATE OR REPLACE FUNCTION public.can_view_pipeline(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = _user_id
      AND om.organization_id = _org_id
      AND om.role IN ('owner','admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.pipeline_access pa
    WHERE pa.user_id = _user_id
      AND pa.organization_id = _org_id
  );
$$;