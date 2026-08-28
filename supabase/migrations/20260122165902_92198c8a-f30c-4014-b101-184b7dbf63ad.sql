-- Add sent_by_user_id column to track who sent each message
ALTER TABLE public.messages 
ADD COLUMN sent_by_user_id uuid REFERENCES auth.users(id);

-- Create an index for performance
CREATE INDEX idx_messages_sent_by_user_id ON public.messages(sent_by_user_id);