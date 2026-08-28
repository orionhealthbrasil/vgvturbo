-- Add DELETE policy for internal messages
-- Users can only delete their own messages
CREATE POLICY "Users can delete their own messages" 
ON public.internal_messages 
FOR DELETE 
USING (sender_id = auth.uid());