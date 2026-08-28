-- 1. Add INSERT policy for organizations (any authenticated user can create their own organization)
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Fix the INSERT policy for organization_members to allow the first member (owner) to be added
-- Drop the problematic policy first
DROP POLICY IF EXISTS "Owners and admins can manage members" ON public.organization_members;

-- Create a new policy that allows:
-- a) Adding yourself as owner to a new org (when no members exist yet)
-- b) Owners/admins can add other members
CREATE POLICY "Users can add themselves as first member or admins can add members"
ON public.organization_members FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow adding yourself as owner to a new organization (no existing members)
  (
    user_id = auth.uid() 
    AND role = 'owner'
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_members om 
      WHERE om.organization_id = organization_members.organization_id
    )
  )
  OR
  -- Allow owners/admins to add new members to existing organizations
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.organization_id = organization_members.organization_id 
    AND om.role IN ('owner', 'admin')
  )
);