-- Drop the overly permissive profiles SELECT policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a new scoped policy: users can see their own profile
-- OR profiles of users who share at least one organization
CREATE POLICY "Users can view same-org profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM organization_members my_orgs
    JOIN organization_members their_orgs ON their_orgs.organization_id = my_orgs.organization_id
    WHERE my_orgs.user_id = auth.uid()
      AND their_orgs.user_id = profiles.user_id
  )
  OR is_super_admin()
);