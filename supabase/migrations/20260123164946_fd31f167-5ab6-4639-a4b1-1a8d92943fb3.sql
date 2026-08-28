-- Fix infinite recursion in RLS policies for internal_conversation_participants

-- Helper: is user participant of a conversation
CREATE OR REPLACE FUNCTION public.is_internal_conversation_participant(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.internal_conversation_participants p
    WHERE p.conversation_id = _conversation_id
      AND p.user_id = auth.uid()
  );
$$;

-- Helper: can user manage participants in a conversation (creator or admin)
CREATE OR REPLACE FUNCTION public.can_manage_internal_conversation_participants(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS(
      SELECT 1
      FROM public.internal_conversations c
      WHERE c.id = _conversation_id
        AND c.created_by = auth.uid()
    )
    OR
    EXISTS(
      SELECT 1
      FROM public.internal_conversation_participants p
      WHERE p.conversation_id = _conversation_id
        AND p.user_id = auth.uid()
        AND p.is_admin = true
    )
  );
$$;

-- Replace SELECT policy to avoid recursion
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.internal_conversation_participants;
DROP POLICY IF EXISTS "Users can view participants of conversations they are in" ON public.internal_conversation_participants;

CREATE POLICY "Users can view participants of conversations they are in"
ON public.internal_conversation_participants
FOR SELECT
USING (public.is_internal_conversation_participant(conversation_id));

-- Replace INSERT policy to avoid recursion
DROP POLICY IF EXISTS "Users can add participants to conversations they created or adm" ON public.internal_conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to conversations they manage" ON public.internal_conversation_participants;

CREATE POLICY "Users can add participants to conversations they manage"
ON public.internal_conversation_participants
FOR INSERT
WITH CHECK (public.can_manage_internal_conversation_participants(conversation_id));

-- Replace DELETE policy to avoid recursion
DROP POLICY IF EXISTS "Admins can remove participants from groups" ON public.internal_conversation_participants;

CREATE POLICY "Admins can remove participants from groups"
ON public.internal_conversation_participants
FOR DELETE
USING (
  user_id = auth.uid()
  OR public.can_manage_internal_conversation_participants(conversation_id)
);

-- Address linter WARN: Extension in Public
-- pg_net does not support ALTER EXTENSION ... SET SCHEMA, so we recreate it in the extensions schema.
CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;