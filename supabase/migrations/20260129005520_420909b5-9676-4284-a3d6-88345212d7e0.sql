-- Add a sequential column to guarantee message ordering
ALTER TABLE public.messages 
ADD COLUMN sequence_id BIGSERIAL;

-- Create index for efficient ordering
CREATE INDEX idx_messages_contact_sequence ON public.messages(contact_id, sequence_id DESC);