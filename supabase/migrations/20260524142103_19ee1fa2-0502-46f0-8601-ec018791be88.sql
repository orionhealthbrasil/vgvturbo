
-- 1) Restrict access to sensitive columns at the column level.
-- These columns either are read only through SECURITY DEFINER RPCs or are
-- not read by the client at all. We keep the row-level SELECT policies
-- intact so existing list/detail queries that select non-sensitive columns
-- (e.g. `select('id')`) continue to work.

-- ai_agent_config: openai_api_key (no client reads this column)
REVOKE SELECT (openai_api_key) ON public.ai_agent_config FROM anon, authenticated;

-- whatsapp_instances: api_key (client uses get_whatsapp_api_key RPC)
REVOKE SELECT (api_key) ON public.whatsapp_instances FROM anon, authenticated;

-- instagram_instances: page_access_token (only used server-side / edge functions)
REVOKE SELECT (page_access_token) ON public.instagram_instances FROM anon, authenticated;

-- whatsapp_meta_instances: access_token (already RLS-restricted; add column-level safety)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='whatsapp_meta_instances' AND column_name='access_token'
  ) THEN
    EXECUTE 'REVOKE SELECT (access_token) ON public.whatsapp_meta_instances FROM anon, authenticated';
  END IF;
END$$;

-- organizations: secrets accessed only via SECURITY DEFINER RPCs
-- (get_org_openai_api_key, get_org_email_settings)
REVOKE SELECT (openai_api_key, resend_api_key) ON public.organizations FROM anon, authenticated;

-- bookings: ip_address is PII that the UI does not need
REVOKE SELECT (ip_address) ON public.bookings FROM anon, authenticated;

-- 2) Fix mis-targeted SLA notifications INSERT policy.
-- Previous policy applied to authenticated role and let any org member insert
-- SLA notifications. The intent is for edge functions (service_role) only.
DROP POLICY IF EXISTS "Service role can insert SLA notifications" ON public.sla_notifications;

CREATE POLICY "Service role can insert SLA notifications"
ON public.sla_notifications
FOR INSERT
TO service_role
WITH CHECK (true);
