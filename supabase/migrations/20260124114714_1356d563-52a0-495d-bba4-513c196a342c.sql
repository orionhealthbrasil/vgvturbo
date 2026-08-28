-- Update SELECT policy to allow all organization members (already exists, but let's verify it works)
-- The current policy uses user_belongs_to_org which should work for all members

-- The issue is that Analysts need to be able to read the instance data to generate QR codes
-- Let's check the current SELECT policy and ensure it includes member_role = 'analyst'

-- First, drop the old update policy that only checks org_role
DROP POLICY IF EXISTS "Owners and admins can update WhatsApp settings" ON public.whatsapp_instances;

-- Create a new update policy that also allows analysts (member_role based)
CREATE POLICY "Owners admins and analysts can update WhatsApp settings" 
ON public.whatsapp_instances
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = whatsapp_instances.organization_id
    AND (
      om.role = 'owner'::org_role
      OR om.role = 'admin'::org_role  
      OR om.member_role = 'admin'
      OR om.member_role = 'analyst'
    )
  )
);

-- Also update INSERT policy to allow analysts
DROP POLICY IF EXISTS "Owners and admins can create WhatsApp settings" ON public.whatsapp_instances;

CREATE POLICY "Owners admins and analysts can create WhatsApp settings"
ON public.whatsapp_instances
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = whatsapp_instances.organization_id
    AND (
      om.role = 'owner'::org_role
      OR om.role = 'admin'::org_role
      OR om.member_role = 'admin'
      OR om.member_role = 'analyst'
    )
  )
);