-- Add column to store the original WhatsApp message ID (stanzaId)
ALTER TABLE public.messages 
ADD COLUMN whatsapp_message_id text;

-- Create index for faster lookups when finding quoted messages
CREATE INDEX idx_messages_whatsapp_message_id ON public.messages(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;