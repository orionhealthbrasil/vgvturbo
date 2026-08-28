-- Drop existing problematic RLS policies on internal_conversation_participants
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.internal_conversation_participants;

-- Create a fixed policy that doesn't cause recursion
-- Use a direct check on the user_id column instead of a subquery that references the same table
CREATE POLICY "Users can view participants of conversations they are in"
ON public.internal_conversation_participants
FOR SELECT
USING (
  conversation_id IN (
    SELECT p.conversation_id 
    FROM public.internal_conversation_participants p 
    WHERE p.user_id = auth.uid()
  )
);

-- Also fix the internal_conversations SELECT policy which has a bug (p.id instead of internal_conversations.id)
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.internal_conversations;

CREATE POLICY "Users can view conversations they participate in"
ON public.internal_conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.internal_conversation_participants p
    WHERE p.conversation_id = internal_conversations.id 
    AND p.user_id = auth.uid()
  )
);

-- Fix the update policy on internal_conversations as well
DROP POLICY IF EXISTS "Admins can update group conversations" ON public.internal_conversations;

CREATE POLICY "Admins can update group conversations"
ON public.internal_conversations
FOR UPDATE
USING (
  (NOT is_group) OR (
    EXISTS (
      SELECT 1 FROM public.internal_conversation_participants p
      WHERE p.conversation_id = internal_conversations.id 
      AND p.user_id = auth.uid() 
      AND p.is_admin = true
    )
  )
);