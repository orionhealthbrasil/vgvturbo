-- 1. Adicionar coluna invite_type
ALTER TABLE public.organization_invites 
ADD COLUMN IF NOT EXISTS invite_type text NOT NULL DEFAULT 'member' 
CHECK (invite_type IN ('member', 'owner'));

-- 2. Permitir organization_id nulo (para convites de owner)
ALTER TABLE public.organization_invites 
ALTER COLUMN organization_id DROP NOT NULL;

-- 3. RLS: super admin pode gerenciar convites de owner
DROP POLICY IF EXISTS "Super admin can manage owner invites" ON public.organization_invites;
CREATE POLICY "Super admin can manage owner invites"
ON public.organization_invites
FOR ALL
TO authenticated
USING (invite_type = 'owner' AND public.is_super_admin())
WITH CHECK (invite_type = 'owner' AND public.is_super_admin());

-- 4. Drop e recria função get_invite_organization para incluir invite_type
DROP FUNCTION IF EXISTS public.get_invite_organization(text);

CREATE OR REPLACE FUNCTION public.get_invite_organization(invite_code text)
RETURNS TABLE(organization_id uuid, organization_name text, invite_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    oi.organization_id,
    COALESCE(o.name, 'Nova Empresa') AS organization_name,
    oi.invite_type
  FROM public.organization_invites oi
  LEFT JOIN public.organizations o ON o.id = oi.organization_id
  WHERE oi.invite_code = get_invite_organization.invite_code
    AND oi.is_active = true
    AND (oi.expires_at IS NULL OR oi.expires_at > now())
    AND (oi.max_uses IS NULL OR oi.use_count < oi.max_uses)
  LIMIT 1;
$$;

-- 5. RPC consume_owner_invite
CREATE OR REPLACE FUNCTION public.consume_owner_invite(p_invite_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_id uuid;
  v_current_uses integer;
  v_max_uses integer;
BEGIN
  SELECT id, use_count, max_uses INTO v_invite_id, v_current_uses, v_max_uses
  FROM public.organization_invites
  WHERE invite_code = p_invite_code
    AND invite_type = 'owner'
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR use_count < max_uses)
  LIMIT 1;

  IF v_invite_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.organization_invites
  SET use_count = v_current_uses + 1,
      is_active = CASE 
        WHEN v_max_uses IS NOT NULL AND v_current_uses + 1 >= v_max_uses THEN false 
        ELSE is_active 
      END
  WHERE id = v_invite_id;

  RETURN true;
END;
$$;