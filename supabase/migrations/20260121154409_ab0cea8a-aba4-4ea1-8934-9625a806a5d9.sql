-- Create member role enum with new roles
CREATE TYPE public.member_role AS ENUM ('admin', 'analyst', 'viewer');

-- Add role column to organization_invites to specify role when creating invite
ALTER TABLE public.organization_invites 
ADD COLUMN member_role member_role NOT NULL DEFAULT 'viewer';

-- Create permissions table to store what each role can access
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role member_role NOT NULL,
  permission TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(role, permission)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Everyone can read role permissions (public config)
CREATE POLICY "Anyone can view role permissions"
ON public.role_permissions FOR SELECT
USING (true);

-- Insert default permissions for each role
-- Admin: full access to everything
INSERT INTO public.role_permissions (role, permission, can_view, can_edit) VALUES
  ('admin', 'new_review', true, true),
  ('admin', 'analytics', true, true),
  ('admin', 'salespeople', true, true),
  ('admin', 'settings', true, true);

-- Analyst: can create reviews and view analytics, manage salespeople
INSERT INTO public.role_permissions (role, permission, can_view, can_edit) VALUES
  ('analyst', 'new_review', true, true),
  ('analyst', 'analytics', true, false),
  ('analyst', 'salespeople', true, true),
  ('analyst', 'settings', false, false);

-- Viewer: can only view analytics
INSERT INTO public.role_permissions (role, permission, can_view, can_edit) VALUES
  ('viewer', 'new_review', false, false),
  ('viewer', 'analytics', true, false),
  ('viewer', 'salespeople', true, false),
  ('viewer', 'settings', false, false);

-- Add member_role to organization_members table
ALTER TABLE public.organization_members 
ADD COLUMN member_role member_role;

-- Update join function to use the role from invite
CREATE OR REPLACE FUNCTION public.join_organization_via_invite(p_invite_code text, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_member_role member_role;
  v_already_member BOOLEAN;
BEGIN
  -- Get organization and role from invite
  SELECT organization_id, organization_invites.member_role INTO v_org_id, v_member_role
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
  
  -- Add user to organization with the role from invite
  INSERT INTO public.organization_members (organization_id, user_id, role, member_role)
  VALUES (v_org_id, p_user_id, 'member', v_member_role);
  
  -- Increment use count
  UPDATE public.organization_invites
  SET use_count = use_count + 1
  WHERE invite_code = p_invite_code;
  
  RETURN true;
END;
$function$;