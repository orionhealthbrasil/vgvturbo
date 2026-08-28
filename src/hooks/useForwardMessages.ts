import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useSendInternalMessage } from '@/hooks/useInternalChat';
import { SelectedMessage } from '@/hooks/useMessageSelection';
import { toast } from 'sonner';

export function useForwardMessages() {
  const { user } = useAuth();
  const { data: orgData } = useUserOrganization();
  const queryClient = useQueryClient();
  const sendInternalMessage = useSendInternalMessage();

  /**
   * Forward messages to a WhatsApp contact.
   * Sends each message via the stevo-send-message or stevo-send-media edge functions.
   */
  const forwardToWhatsApp = useCallback(async (
    messages: SelectedMessage[],
    targetContactId: string,
    targetPhone: string,
  ) => {
    if (!user?.id || !orgData?.organization?.id) throw new Error('Not authenticated');
    const organizationId = orgData.organization.id;

    let successCount = 0;
    for (const msg of messages) {
      try {
        if (msg.media_url && msg.message_type !== 'text') {
          // Forward media message
          const { error } = await supabase.functions.invoke('stevo-send-media', {
            body: {
              organization_id: organizationId,
              contact_id: targetContactId,
              phone: targetPhone,
              media_url: msg.media_url,
              media_type: msg.message_type === 'sticker' ? 'image' : msg.message_type,
              caption: msg.content || undefined,
              is_forwarded: true,
              forwarded_from: msg.senderName || undefined,
            }
          });
          if (error) throw error;
        } else {
          // Forward text message
          const forwardedPrefix = '⤳ *Encaminhada*';
          const senderInfo = msg.senderName ? `\n_De: ${msg.senderName}_` : '';
          const content = `${forwardedPrefix}${senderInfo}\n\n${msg.content || ''}`;

          const { error } = await supabase.functions.invoke('stevo-send-message', {
            body: {
              organization_id: organizationId,
              contact_id: targetContactId,
              phone: targetPhone,
              message: content,
              is_forwarded: true,
              forwarded_from: msg.senderName || undefined,
            }
          });
          if (error) throw error;
        }
        successCount++;
      } catch (err) {
        console.error('Failed to forward message:', err);
      }
    }

    // Refresh messages
    queryClient.invalidateQueries({ queryKey: ['messages', targetContactId] });
    queryClient.invalidateQueries({ queryKey: ['conversation-contacts'] });

    if (successCount === messages.length) {
      toast.success(`${successCount} ${successCount === 1 ? 'mensagem encaminhada' : 'mensagens encaminhadas'}`);
    } else {
      toast.warning(`${successCount}/${messages.length} mensagens encaminhadas`);
    }
  }, [user?.id, orgData?.organization?.id, queryClient]);

  /**
   * Forward messages to an internal chat conversation.
   * Inserts each message into internal_messages.
   */
  const forwardToInternal = useCallback(async (
    messages: SelectedMessage[],
    targetConversationId: string,
  ) => {
    if (!user?.id) throw new Error('Not authenticated');

    let successCount = 0;
    for (const msg of messages) {
      try {
        const forwardedPrefix = '⤳ Encaminhada';
        const senderInfo = msg.senderName ? `\nDe: ${msg.senderName}` : '';

        if (msg.media_url && msg.message_type !== 'text') {
          // Forward media
          await sendInternalMessage.mutateAsync({
            conversationId: targetConversationId,
            content: `${forwardedPrefix}${senderInfo}\n${msg.content || msg.message_type}`,
            messageType: msg.message_type,
            mediaUrl: msg.media_url,
          });
        } else {
          // Forward text
          await sendInternalMessage.mutateAsync({
            conversationId: targetConversationId,
            content: `${forwardedPrefix}${senderInfo}\n\n${msg.content || ''}`,
          });
        }
        successCount++;
      } catch (err) {
        console.error('Failed to forward message to internal:', err);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['internal-messages', targetConversationId] });
    queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });

    if (successCount === messages.length) {
      toast.success(`${successCount} ${successCount === 1 ? 'mensagem encaminhada' : 'mensagens encaminhadas'}`);
    } else {
      toast.warning(`${successCount}/${messages.length} mensagens encaminhadas`);
    }
  }, [user?.id, queryClient, sendInternalMessage]);

  return { forwardToWhatsApp, forwardToInternal };
}
