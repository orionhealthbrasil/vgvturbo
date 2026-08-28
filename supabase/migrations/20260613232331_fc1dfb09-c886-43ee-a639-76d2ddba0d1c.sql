
-- 1) organization_members: prevent self privilege escalation
DROP POLICY IF EXISTS "Members can update their own availability" ON public.organization_members;

CREATE POLICY "Members can update their own availability"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND role = (SELECT role FROM public.organization_members om WHERE om.id = organization_members.id)
  AND member_role = (SELECT member_role FROM public.organization_members om WHERE om.id = organization_members.id)
  AND organization_id = (SELECT organization_id FROM public.organization_members om WHERE om.id = organization_members.id)
);

-- 2) internal_conversations: restrict UPDATE on non-group to participants
DROP POLICY IF EXISTS "Update conversations" ON public.internal_conversations;
DROP POLICY IF EXISTS "Users can update conversations" ON public.internal_conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON public.internal_conversations;

CREATE POLICY "Participants can update conversations"
ON public.internal_conversations
FOR UPDATE
TO authenticated
USING (
  CASE
    WHEN is_group THEN public.can_manage_internal_conversation_participants(id)
    ELSE public.is_internal_conversation_participant(id)
  END
)
WITH CHECK (
  CASE
    WHEN is_group THEN public.can_manage_internal_conversation_participants(id)
    ELSE public.is_internal_conversation_participant(id)
  END
);

-- 3) instagram_instances: revoke column-level access on page_access_token
REVOKE SELECT (page_access_token) ON public.instagram_instances FROM anon, authenticated;
