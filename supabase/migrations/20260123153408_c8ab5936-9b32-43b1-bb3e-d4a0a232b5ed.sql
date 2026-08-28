-- Drop existing select policy
DROP POLICY IF EXISTS "Owners and admins can view WhatsApp settings" ON public.whatsapp_instances;

-- Create new select policy that allows organization members to view (respects role_permissions)
CREATE POLICY "Organization members can view WhatsApp settings"
  ON public.whatsapp_instances
  FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id));

-- Note: INSERT and UPDATE policies remain restricted to owners/admins only