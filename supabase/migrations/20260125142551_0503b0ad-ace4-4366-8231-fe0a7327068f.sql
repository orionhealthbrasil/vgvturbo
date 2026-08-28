-- Fix security definer view warning by using security_invoker
DROP VIEW IF EXISTS public.organization_stats;

CREATE VIEW public.organization_stats
WITH (security_invoker = on) AS
SELECT 
    o.id,
    o.name,
    o.created_at,
    (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id) as member_count,
    (SELECT COUNT(*) FROM contacts c WHERE c.organization_id = o.id) as contact_count,
    (SELECT COUNT(*) FROM messages m WHERE m.organization_id = o.id) as message_count,
    (SELECT COUNT(*) FROM automations a WHERE a.organization_id = o.id) as automation_count,
    (SELECT COUNT(*) FROM whatsapp_instances wi WHERE wi.organization_id = o.id) as has_whatsapp,
    (SELECT MAX(m.created_at) FROM messages m WHERE m.organization_id = o.id) as last_message_at
FROM organizations o;

-- Add policy to allow super admins to view all organizations
CREATE POLICY "Super admins can view all organizations"
ON public.organizations FOR SELECT
USING (public.is_super_admin());

-- Add policy to allow super admins to view all organization members
CREATE POLICY "Super admins can view all members"
ON public.organization_members FOR SELECT
USING (public.is_super_admin());

-- Add policy to allow super admins to view all contacts
CREATE POLICY "Super admins can view all contacts"
ON public.contacts FOR SELECT
USING (public.is_super_admin());

-- Add policy to allow super admins to view all messages
CREATE POLICY "Super admins can view all messages"
ON public.messages FOR SELECT
USING (public.is_super_admin());