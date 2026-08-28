-- Create internal conversation via SECURITY DEFINER to avoid client-side RLS pitfalls
-- This function enforces organization membership and (for 1:1) reuses existing conversations.

CREATE OR REPLACE FUNCTION public.create_internal_conversation(
  p_participant_ids uuid[],
  p_is_group boolean DEFAULT false,
  p_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_other_id uuid;
  v_existing_id uuid;
  v_conversation_id uuid;
  v_count int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_org_id := public.get_user_organization_id(v_user_id);
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'User has no organization';
  END IF;

  IF p_is_group IS NULL THEN
    p_is_group := false;
  END IF;

  IF p_participant_ids IS NULL OR array_length(p_participant_ids, 1) IS NULL OR array_length(p_participant_ids, 1) < 1 THEN
    RAISE EXCEPTION 'At least one participant is required';
  END IF;

  -- Validate group name
  IF p_is_group = true AND (p_name IS NULL OR length(trim(p_name)) = 0) THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  -- Validate 1:1 size
  IF p_is_group = false AND array_length(p_participant_ids, 1) <> 1 THEN
    RAISE EXCEPTION '1:1 conversation requires exactly one participant';
  END IF;

  -- Validate all participants belong to the same organization
  SELECT count(*) INTO v_count
  FROM public.organization_members om
  WHERE om.organization_id = v_org_id
    AND om.user_id = ANY(p_participant_ids);

  IF v_count <> array_length(p_participant_ids, 1) THEN
    RAISE EXCEPTION 'One or more participants are not in your organization';
  END IF;

  -- For 1:1, return existing conversation if present
  IF p_is_group = false THEN
    v_other_id := p_participant_ids[1];

    SELECT c.id INTO v_existing_id
    FROM public.internal_conversations c
    JOIN public.internal_conversation_participants p ON p.conversation_id = c.id
    WHERE c.organization_id = v_org_id
      AND c.is_group = false
      AND p.user_id IN (v_user_id, v_other_id)
    GROUP BY c.id
    HAVING count(*) = 2;

    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  -- Create conversation
  INSERT INTO public.internal_conversations (organization_id, is_group, name, created_by)
  VALUES (v_org_id, p_is_group, CASE WHEN p_is_group THEN trim(p_name) ELSE NULL END, v_user_id)
  RETURNING id INTO v_conversation_id;

  -- Insert participants (creator + selected)
  INSERT INTO public.internal_conversation_participants (conversation_id, user_id, is_admin)
  VALUES (v_conversation_id, v_user_id, true);

  INSERT INTO public.internal_conversation_participants (conversation_id, user_id, is_admin)
  SELECT v_conversation_id, unnest(p_participant_ids), false;

  RETURN v_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_internal_conversation(uuid[], boolean, text) TO authenticated;