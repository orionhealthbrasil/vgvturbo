import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganization } from '@/hooks/useOrganization';
import { 
  InternalConversation, 
  InternalMessage, 
  ConversationWithDetails,
  MessageWithSender,
  ParticipantWithProfile
} from '@/types/internal-chat';

const PAGE_SIZE = 50;

export function useInternalConversations() {
  const { user } = useAuth();
  const { data: orgData } = useUserOrganization();

  return useQuery({
    queryKey: ['internal-conversations', user?.id],
    queryFn: async (): Promise<ConversationWithDetails[]> => {
      if (!user?.id) return [];

      // Get conversations where user is a participant
      const { data: participantRecords, error: partError } = await supabase
        .from('internal_conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (partError) throw partError;
      if (!participantRecords?.length) return [];

      const conversationIds = participantRecords.map(p => p.conversation_id);
      const lastReadMap = new Map(participantRecords.map(p => [p.conversation_id, p.last_read_at]));

      // Get conversations
      const { data: conversations, error: convError } = await supabase
        .from('internal_conversations')
        .select('*')
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (convError) throw convError;
      if (!conversations?.length) return [];

      // Get all participants for these conversations
      const { data: allParticipants, error: allPartError } = await supabase
        .from('internal_conversation_participants')
        .select('*')
        .in('conversation_id', conversationIds);

      if (allPartError) throw allPartError;

      // Get profiles for all participants
      const userIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Get last message for each conversation
      const lastMessagePromises = conversationIds.map(async (convId) => {
        const { data } = await supabase
          .from('internal_messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        return { convId, message: data };
      });

      const lastMessages = await Promise.all(lastMessagePromises);
      const lastMessageMap = new Map(lastMessages.map(lm => [lm.convId, lm.message]));

      // Get unread count for each conversation
      const unreadPromises = conversationIds.map(async (convId) => {
        const lastRead = lastReadMap.get(convId);
        let query = supabase
          .from('internal_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', convId)
          .neq('sender_id', user.id);
        
        if (lastRead) {
          query = query.gt('created_at', lastRead);
        }

        const { count } = await query;
        return { convId, count: count || 0 };
      });

      const unreadCounts = await Promise.all(unreadPromises);
      const unreadMap = new Map(unreadCounts.map(uc => [uc.convId, uc.count]));

      // Build result
      return conversations.map(conv => {
        const participants: ParticipantWithProfile[] = (allParticipants || [])
          .filter(p => p.conversation_id === conv.id)
          .map(p => ({
            ...p,
            profile: profileMap.get(p.user_id)
          }));

        return {
          ...conv,
          participants,
          lastMessage: lastMessageMap.get(conv.id) as InternalMessage | undefined,
          unreadCount: unreadMap.get(conv.id) || 0
        };
      });
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
}

export function useInternalMessages(conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: ['internal-messages', conversationId],
    queryFn: async ({ pageParam = null }) => {
      if (!conversationId) return { messages: [], nextCursor: null };

      let query = supabase
        .from('internal_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }

      const { data: messages, error } = await query;
      if (error) throw error;

      // Get sender profiles
      const senderIds = [...new Set(messages?.map(m => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Get quoted messages
      const quotedIds = messages?.filter(m => m.quoted_message_id).map(m => m.quoted_message_id) || [];
      let quotedMessages: InternalMessage[] = [];
      if (quotedIds.length > 0) {
        const { data } = await supabase
          .from('internal_messages')
          .select('*')
          .in('id', quotedIds);
        quotedMessages = (data as InternalMessage[]) || [];
      }
      const quotedMap = new Map(quotedMessages.map(m => [m.id, m]));

      const messagesWithSender: MessageWithSender[] = (messages || []).map(m => ({
        ...m,
        sender: profileMap.get(m.sender_id),
        quotedMessage: m.quoted_message_id ? quotedMap.get(m.quoted_message_id) : undefined
      }));

      const nextCursor = messages && messages.length === PAGE_SIZE 
        ? messages[messages.length - 1].created_at 
        : null;

      return { messages: messagesWithSender, nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    enabled: !!conversationId,
  });
}

export function useSendInternalMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      content, 
      messageType = 'text',
      mediaUrl,
      mentionedUserIds = [],
      quotedMessageId
    }: {
      conversationId: string;
      content?: string;
      messageType?: string;
      mediaUrl?: string;
      mentionedUserIds?: string[];
      quotedMessageId?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('internal_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content,
          message_type: messageType,
          media_url: mediaUrl,
          mentioned_user_ids: mentionedUserIds,
          quoted_message_id: quotedMessageId
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['internal-messages', variables.conversationId] });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData(['internal-messages', variables.conversationId]);

      // Create optimistic message
      const optimisticMessage: MessageWithSender = {
        id: `optimistic-${Date.now()}`,
        conversation_id: variables.conversationId,
        sender_id: user!.id,
        content: variables.content || null,
        message_type: variables.messageType || 'text',
        media_url: variables.mediaUrl || null,
        mentioned_user_ids: variables.mentionedUserIds || [],
        quoted_message_id: variables.quotedMessageId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender: {
          full_name: user!.user_metadata?.full_name || user!.email || null,
          avatar_url: null,
        },
      };

      // Optimistically add message to the first page (newest messages)
      queryClient.setQueryData(['internal-messages', variables.conversationId], (old: any) => {
        if (!old?.pages?.length) return old;
        const newPages = [...old.pages];
        // First page contains newest messages (desc order, then reversed for display)
        // Add to the beginning of the first page so it appears at the end when reversed
        newPages[0] = {
          ...newPages[0],
          messages: [optimisticMessage, ...newPages[0].messages],
        };
        return { ...old, pages: newPages };
      });

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(['internal-messages', variables.conversationId], context.previousMessages);
      }
      console.error('[InternalChat] Failed to send message:', err);
      import('sonner').then(({ toast }) => {
        toast.error('Erro ao enviar mensagem. Tente novamente.');
      });
    },
    onSettled: (_, _err, variables) => {
      // Always refetch to sync with server
      queryClient.invalidateQueries({ queryKey: ['internal-messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
    }
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      participantIds, 
      name,
      isGroup = false 
    }: {
      participantIds: string[];
      name?: string;
      isGroup?: boolean;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Use RPC function to create conversation (SECURITY DEFINER bypasses RLS safely)
      const { data, error } = await supabase.rpc('create_internal_conversation', {
        p_participant_ids: participantIds,
        p_is_group: isGroup,
        p_name: name || null
      });

      if (error) throw error;

      // Return object with id for compatibility
      return { id: data as string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
    }
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('internal_conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
    }
  });
}

export function useMarkConversationUnread() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Find the most recent message from someone else (so it counts as unread)
      const { data: lastOther } = await supabase
        .from('internal_messages')
        .select('created_at')
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Anchor before that message (or epoch if none exists)
      const anchor = lastOther?.created_at
        ? new Date(new Date(lastOther.created_at).getTime() - 1).toISOString()
        : new Date(0).toISOString();

      const { error } = await supabase
        .from('internal_conversation_participants')
        .update({ last_read_at: anchor })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['internal-unread-messages'] });
    }
  });
}

export function useDeleteInternalMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
      const { error } = await supabase
        .from('internal_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      return { messageId, conversationId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['internal-messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
    }
  });
}

export function useEditInternalMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, content, conversationId }: { messageId: string; content: string; conversationId: string }) => {
      const { error } = await supabase
        .from('internal_messages')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) throw error;
      return { messageId, conversationId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['internal-messages', variables.conversationId] });
    }
  });
}

export function useAddGroupParticipants() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, userIds }: { conversationId: string; userIds: string[] }) => {
      const { error } = await supabase
        .from('internal_conversation_participants')
        .insert(userIds.map(userId => ({ conversation_id: conversationId, user_id: userId })));

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
    }
  });
}

export function useRemoveGroupParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      const { error } = await supabase
        .from('internal_conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
    }
  });
}

export function useOrganizationMembers() {
  const { data: orgData } = useUserOrganization();

  return useQuery({
    queryKey: ['org-members-with-profiles', orgData?.organization.id],
    queryFn: async () => {
      if (!orgData?.organization.id) return [];

      const { data: members, error } = await supabase
        .from('organization_members')
        .select('user_id, role, member_role')
        .eq('organization_id', orgData.organization.id);

      if (error) throw error;

      const userIds = members?.map(m => m.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, email')
        .in('user_id', userIds);

      return members?.map(m => ({
        ...m,
        profile: profiles?.find(p => p.user_id === m.user_id)
      })) || [];
    },
    enabled: !!orgData?.organization.id
  });
}
