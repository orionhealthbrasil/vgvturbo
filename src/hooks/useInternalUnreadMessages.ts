import { useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useInternalConversations } from '@/hooks/useInternalChat';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';

export function useInternalUnreadMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: conversations, refetch } = useInternalConversations();
  const { playNotificationSound } = useNotificationSound();
  const { showNotification } = useBrowserNotifications();

  const totalUnread = useMemo(() => {
    if (!conversations) return 0;
    return conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
  }, [conversations]);

  // Global realtime subscription for internal messages
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('internal-messages-badge')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages'
        },
        (payload) => {
          // Only play sound and refetch if the message is not from the current user
          const newMsg = payload.new as any;
          if (newMsg && newMsg.sender_id !== user.id) {
            playNotificationSound('internal');
            // Notificação de navegador (chat interno)
            const conv = conversations?.find(c => c.id === newMsg.conversation_id);
            let title = conv?.name || 'Nova mensagem interna';
            if (!conv?.name && conv?.participants) {
              const other = conv.participants.find((p: any) => p.user_id !== user.id);
              title = other?.profile?.full_name || title;
            }
            showNotification({
              contactId: `internal-${newMsg.conversation_id}`,
              title,
              body: newMsg.content,
              messageType: newMsg.message_type,
              url: '/chat-interno',
            });
            // Immediate refetch for up-to-date badge
            refetch();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch, playNotificationSound, showNotification, conversations]);

  return { totalUnread };
}
