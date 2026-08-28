
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag_contact
  ON public.contact_tags (tag_id, contact_id);

CREATE OR REPLACE FUNCTION public.search_contacts_with_filters(
  p_organization_id uuid,
  p_tag_ids uuid[] DEFAULT NULL,
  p_assignee_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_channel text DEFAULT NULL,          -- 'whatsapp' | 'instagram' | NULL
  p_status text DEFAULT NULL,           -- 'open' | 'closed' | 'snoozed' | NULL
  p_include_archived boolean DEFAULT false,
  p_viewer_user_id uuid DEFAULT NULL,   -- if set, restricts to assigned OR shared-tagged
  p_limit integer DEFAULT 200
)
RETURNS SETOF public.contacts
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_search text;
  v_pattern text;
  v_shared_tag_ids uuid[];
BEGIN
  v_search := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_pattern := CASE WHEN v_search IS NOT NULL THEN '%' || v_search || '%' ELSE NULL END;

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
    AND (p_include_archived OR c.is_archived = false)
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
      OR c.name ILIKE v_pattern
      OR c.phone ILIKE v_pattern
      OR COALESCE(c.email, '') ILIKE v_pattern
    )
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_contacts_with_filters(
  uuid, uuid[], uuid, text, text, text, boolean, uuid, integer
) TO authenticated, anon;
