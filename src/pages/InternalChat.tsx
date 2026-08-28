import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQueryClient } from '@tanstack/react-query';
import { ConversationList } from '@/components/internal-chat/ConversationList';
import { InternalChatWindow } from '@/components/internal-chat/InternalChatWindow';
import { NewConversationDialog } from '@/components/internal-chat/NewConversationDialog';
import { useInternalConversations } from '@/hooks/useInternalChat';
import { ConversationWithDetails } from '@/types/internal-chat';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function InternalChat() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: conversations = [], isLoading } = useInternalConversations();
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  // Update selected conversation when data changes
  useEffect(() => {
    if (selectedConversation) {
      const updated = conversations.find(c => c.id === selectedConversation.id);
      if (updated) {
        setSelectedConversation(updated);
      }
    }
  }, [conversations]);

  // Realtime subscription for conversation list updates only
  // Messages are handled by InternalChatWindow's own subscription with proper conversation_id filter
  useEffect(() => {
    if (!user?.id) return;

    // Get the conversation IDs the user is part of
    const conversationIds = conversations.map(c => c.id);

    // Only subscribe to messages for conversations the user is part of
    // This prevents cross-conversation message leaks
    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Create a single channel for conversation metadata updates
    const conversationsChannel = supabase
      .channel('internal-chat-conversations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_conversations'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
        }
      )
      .subscribe();
    channels.push(conversationsChannel);

    // Subscribe to message inserts for each conversation separately
    // This ensures we only update the conversation list when messages arrive
    // in conversations the user is actually part of
    conversationIds.forEach(convId => {
      const channel = supabase
        .channel(`internal-messages-list-${convId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'internal_messages',
            filter: `conversation_id=eq.${convId}`
          },
          () => {
            // Only update the conversations list (for last message preview)
            queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
          }
        )
        .subscribe();
      channels.push(channel);
    });

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [user?.id, queryClient, conversations]);

  const handleSelectConversation = (conversation: ConversationWithDetails) => {
    setSelectedConversation(conversation);
  };

  const handleConversationCreated = (conversationId: string) => {
    // Refetch conversations and select the new one
    queryClient.invalidateQueries({ queryKey: ['internal-conversations'] }).then(() => {
      const newConv = conversations.find(c => c.id === conversationId);
      if (newConv) {
        setSelectedConversation(newConv);
      }
    });
  };

  return (
    <div className="h-full flex overflow-hidden bg-chat-bg">
      {/* Conversation list - on mobile, hide when a conversation is selected */}
      <div className={`${isMobile ? (selectedConversation ? 'hidden' : 'w-full') : 'w-96'} shrink-0 relative z-10 h-full overflow-hidden`}>
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation?.id || null}
          onSelect={handleSelectConversation}
          onNewChat={() => setNewChatOpen(true)}
          onNewGroup={() => setNewGroupOpen(true)}
          isLoading={isLoading}
        />
      </div>
      {/* Chat window - on mobile, hide when no conversation is selected */}
      <div className={`${isMobile ? (selectedConversation ? 'w-full' : 'hidden') : 'flex-1'} min-w-0 relative z-0 h-full overflow-hidden`}>
        <InternalChatWindow 
          conversation={selectedConversation}
          onBack={isMobile ? () => setSelectedConversation(null) : undefined}
        />
      </div>

      <NewConversationDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        isGroup={false}
        onConversationCreated={handleConversationCreated}
      />

      <NewConversationDialog
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        isGroup={true}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}
