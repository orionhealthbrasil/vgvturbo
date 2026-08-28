-- Add quote/reply fields to messages table
ALTER TABLE public.messages 
ADD COLUMN quoted_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
ADD COLUMN quoted_content text,
ADD COLUMN quoted_type text;

-- Create index for better performance when fetching quoted messages
CREATE INDEX idx_messages_quoted_message_id ON public.messages(quoted_message_id) WHERE quoted_message_id IS NOT NULL;