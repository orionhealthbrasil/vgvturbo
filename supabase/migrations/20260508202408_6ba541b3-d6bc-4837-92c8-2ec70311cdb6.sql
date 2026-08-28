-- =========================================================
-- 1. Column-level privilege restrictions for sensitive cols
-- =========================================================
REVOKE SELECT (api_key) ON public.whatsapp_instances FROM anon, authenticated;
REVOKE SELECT (page_access_token) ON public.instagram_instances FROM anon, authenticated;
REVOKE SELECT (openai_api_key) ON public.ai_agent_config FROM anon, authenticated;
REVOKE SELECT (openai_api_key, resend_api_key) ON public.organizations FROM anon, authenticated;
REVOKE SELECT (cancel_token, ip_address) ON public.bookings FROM anon, authenticated;

-- =========================================================
-- 2. Helper + secured RPCs for owners/admins to read secrets
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_org_admin_or_owner(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = p_org
      AND (
        om.role IN ('owner'::org_role, 'admin'::org_role)
        OR om.member_role = 'admin'::member_role
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_org_email_settings(p_org uuid)
RETURNS TABLE (
  resend_api_key text,
  resend_from_email text,
  resend_from_name text,
  resend_reply_to text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_admin_or_owner(p_org) THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT o.resend_api_key, o.resend_from_email, o.resend_from_name, o.resend_reply_to
    FROM public.organizations o WHERE o.id = p_org;
END
$$;

CREATE OR REPLACE FUNCTION public.get_org_openai_api_key(p_org uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE k text;
BEGIN
  IF NOT public.is_org_admin_or_owner(p_org) THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  SELECT openai_api_key INTO k FROM public.organizations WHERE id = p_org;
  RETURN k;
END
$$;

CREATE OR REPLACE FUNCTION public.get_whatsapp_api_key(p_instance_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE k text; org uuid;
BEGIN
  SELECT api_key, organization_id INTO k, org FROM public.whatsapp_instances WHERE id = p_instance_id;
  IF org IS NULL THEN RETURN NULL; END IF;
  IF NOT public.is_org_admin_or_owner(org) THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  RETURN k;
END
$$;

GRANT EXECUTE ON FUNCTION public.is_org_admin_or_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_email_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_openai_api_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_api_key(uuid) TO authenticated;

-- =========================================================
-- 3. Tighten satisfaction_responses public insert policy
-- (Submissions go through SECURITY DEFINER RPC submit_public_satisfaction_survey;
--  no client should INSERT directly.)
-- =========================================================
DROP POLICY IF EXISTS "Anyone can submit responses" ON public.satisfaction_responses;

-- =========================================================
-- 4. Storage: evidence bucket - require auth on upload
-- =========================================================
DROP POLICY IF EXISTS "Anyone can upload evidence" ON storage.objects;
CREATE POLICY "Authenticated users can upload evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'evidence');

-- =========================================================
-- 5. Storage: chat-media - fix broken c.name -> objects.name
-- =========================================================
DROP POLICY IF EXISTS "Users can view chat media from their org" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload chat media to their org" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete chat media from their org" ON storage.objects;

CREATE POLICY "Users can view chat media from their org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media'
  AND EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE (c.id)::text = (storage.foldername(storage.objects.name))[1]
      AND public.user_belongs_to_org(auth.uid(), c.organization_id)
  )
);

CREATE POLICY "Users can upload chat media to their org"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE (c.id)::text = (storage.foldername(storage.objects.name))[1]
      AND public.user_belongs_to_org(auth.uid(), c.organization_id)
  )
);

CREATE POLICY "Users can delete chat media from their org"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE (c.id)::text = (storage.foldername(storage.objects.name))[1]
      AND public.user_belongs_to_org(auth.uid(), c.organization_id)
  )
);

-- =========================================================
-- 6. Storage: support-media - add DELETE & UPDATE policies
-- =========================================================
DROP POLICY IF EXISTS "Uploaders can delete their support media" ON storage.objects;
CREATE POLICY "Uploaders can delete their support media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'support-media'
  AND owner = auth.uid()
);

DROP POLICY IF EXISTS "Uploaders can update their support media" ON storage.objects;
CREATE POLICY "Uploaders can update their support media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'support-media'
  AND owner = auth.uid()
);

-- =========================================================
-- 7. booking_reminders - explicit deny for client writes (managed server-side)
-- =========================================================
DROP POLICY IF EXISTS "No client inserts on booking_reminders" ON public.booking_reminders;
CREATE POLICY "No client inserts on booking_reminders"
ON public.booking_reminders FOR INSERT TO authenticated, anon
WITH CHECK (false);

DROP POLICY IF EXISTS "No client deletes on booking_reminders" ON public.booking_reminders;
CREATE POLICY "No client deletes on booking_reminders"
ON public.booking_reminders FOR DELETE TO authenticated, anon
USING (false);
