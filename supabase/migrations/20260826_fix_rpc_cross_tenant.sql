-- Fix cross-tenant data leaks in SECURITY DEFINER RPC functions
-- Pentest finding: unauthenticated callers could query any org's contacts and platform stats

-- 1. search_contacts_with_filters: add org membership check before querying contacts
CREATE OR REPLACE FUNCTION public.search_contacts_with_filters(
  p_organization_id uuid,
  p_tag_ids uuid[] DEFAULT NULL::uuid[],
  p_assignee_id uuid DEFAULT NULL::uuid,
  p_search text DEFAULT NULL::text,
  p_channel text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
  p_include_archived boolean DEFAULT false,
  p_viewer_user_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 200
)
 RETURNS SETOF contacts
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_search        text;
  v_pattern       text;
  v_digits_only   text;
  v_shared_tag_ids uuid[];
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid()
        AND organization_id = p_organization_id
    )
    OR public.is_super_admin()
  ) THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  v_search := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_pattern := CASE WHEN v_search IS NOT NULL THEN '%' || v_search || '%' ELSE NULL END;
  v_digits_only := CASE
    WHEN v_search IS NOT NULL THEN NULLIF(regexp_replace(v_search, '\D', '', 'g'), '')
    ELSE NULL
  END;

  IF p_viewer_user_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO v_shared_tag_ids
    FROM public.tags
    WHERE organization_id = p_organization_id
      AND (
        LOWER(TRIM(name)) LIKE 'fornecedor%'
        OR LOWER(TRIM(name)) LIKE 'colaborador%'
      );
  END IF;

  RETURN QUERY
  SELECT c.*
  FROM public.contacts c
  WHERE c.organization_id = p_organization_id
    AND (
      CASE
        WHEN p_include_archived THEN c.is_archived = true
        ELSE c.is_archived = false
      END
    )
    AND (p_status IS NULL OR c.status = p_status)
    AND (
      p_channel IS NULL
      OR (p_channel = 'instagram' AND c.channel = 'instagram')
      OR (p_channel = 'whatsapp' AND (c.channel IS NULL OR c.channel <> 'instagram'))
    )
    AND (p_assignee_id IS NULL OR c.assigned_to = p_assignee_id)
    AND (
      p_viewer_user_id IS NULL
      OR c.assigned_to = p_viewer_user_id
      OR EXISTS (
        SELECT 1 FROM public.contact_tags ct
        WHERE ct.contact_id = c.id
          AND ct.tag_id = ANY(v_shared_tag_ids)
      )
    )
    AND (
      p_tag_ids IS NULL
      OR array_length(p_tag_ids, 1) IS NULL
      OR EXISTS (
        SELECT 1 FROM public.contact_tags ct
        WHERE ct.contact_id = c.id
          AND ct.tag_id = ANY(p_tag_ids)
      )
    )
    AND (
      v_pattern IS NULL
      OR public.unaccent(c.name) ILIKE public.unaccent(v_pattern)
      OR COALESCE(c.email, '') ILIKE v_pattern
      OR c.phone ILIKE v_pattern
      OR (
        v_digits_only IS NOT NULL
        AND length(v_digits_only) >= 4
        AND regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g') LIKE '%' || v_digits_only || '%'
      )
    )
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
END;
$function$;

-- 2. super_admin_* functions: restrict to super_admin role only
CREATE OR REPLACE FUNCTION public.super_admin_recent_orgs(p_limit integer DEFAULT 10)
 RETURNS SETOF organization_stats_mv
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.organization_stats_mv ORDER BY created_at DESC LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.super_admin_top_orgs(p_limit integer DEFAULT 10)
 RETURNS SETOF organization_stats_mv
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.organization_stats_mv ORDER BY message_count DESC NULLS LAST LIMIT p_limit;
END;
$function$;

DROP FUNCTION IF EXISTS public.super_admin_totals();
CREATE FUNCTION public.super_admin_totals()
 RETURNS TABLE(total_organizations bigint, total_users bigint, total_contacts bigint, total_messages bigint, active_organizations bigint, organizations_with_whatsapp bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(member_count), 0)::bigint,
    COALESCE(SUM(contact_count), 0)::bigint,
    COALESCE(SUM(message_count), 0)::bigint,
    COUNT(*) FILTER (WHERE last_message_at > now() - interval '30 days')::bigint,
    COUNT(*) FILTER (WHERE has_whatsapp > 0)::bigint
  FROM public.organization_stats_mv;
END;
$function$;
