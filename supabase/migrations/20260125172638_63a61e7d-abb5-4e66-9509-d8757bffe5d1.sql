-- Drop existing constraint on message_type
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- Re-add constraint including 'sticker' as a valid type
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check 
  CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'sticker'));