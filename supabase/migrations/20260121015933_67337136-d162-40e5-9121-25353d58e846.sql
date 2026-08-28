-- 1. Create organization_invites table for tracking invite links
CREATE TABLE public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies for invites
CREATE POLICY "Org members can view their org invites"
ON public.organization_invites FOR SELECT
USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Owners and admins can create invites"
ON public.organization_invites FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE user_id = auth.uid() 
    AND organization_id = organization_invites.organization_id 
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Owners and admins can update invites"
ON public.organization_invites FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE user_id = auth.uid() 
    AND organization_id = organization_invites.organization_id 
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Owners and admins can delete invites"
ON public.organization_invites FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE user_id = auth.uid() 
    AND organization_id = organization_invites.organization_id 
    AND role IN ('owner', 'admin')
  )
);

-- 4. Function to validate and use an invite (public access needed for signup)
CREATE OR REPLACE FUNCTION public.get_invite_organization(invite_code TEXT)
RETURNS TABLE(organization_id UUID, organization_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    i.organization_id,
    o.name as organization_name
  FROM public.organization_invites i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.invite_code = get_invite_organization.invite_code
    AND i.is_active = true
    AND (i.expires_at IS NULL OR i.expires_at > now())
    AND (i.max_uses IS NULL OR i.use_count < i.max_uses)
$$;

-- 5. Function to join organization via invite
CREATE OR REPLACE FUNCTION public.join_organization_via_invite(p_invite_code TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_already_member BOOLEAN;
BEGIN
  -- Get organization from invite
  SELECT organization_id INTO v_org_id
  FROM public.organization_invites
  WHERE invite_code = p_invite_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR use_count < max_uses);
  
  IF v_org_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if already a member
  SELECT EXISTS(
    SELECT 1 FROM public.organization_members 
    WHERE user_id = p_user_id AND organization_id = v_org_id
  ) INTO v_already_member;
  
  IF v_already_member THEN
    RETURN true; -- Already a member, consider it success
  END IF;
  
  -- Add user to organization
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'member');
  
  -- Increment use count
  UPDATE public.organization_invites
  SET use_count = use_count + 1
  WHERE invite_code = p_invite_code;
  
  RETURN true;
END;
$$;

-- 6. Policy for owners to delete members (except themselves)
CREATE POLICY "Owners can delete members"
ON public.organization_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.organization_id = organization_members.organization_id 
    AND om.role = 'owner'
  )
  AND organization_members.user_id != auth.uid()
);