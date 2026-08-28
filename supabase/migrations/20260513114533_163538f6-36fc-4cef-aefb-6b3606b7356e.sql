-- Prevent duplicate outbound messages with same whatsapp_message_id per organization
CREATE UNIQUE INDEX IF NOT EXISTS messages_org_whatsapp_msg_id_uniq
ON public.messages (organization_id, whatsapp_message_id)
WHERE whatsapp_message_id IS NOT NULL;