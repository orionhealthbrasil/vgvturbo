import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { InternalPoll, InternalPollVote, PollWithVotes } from '@/types/internal-poll';

export function useConversationPolls(conversationId: string | null) {
  return useQuery({
    queryKey: ['internal-polls', conversationId],
    queryFn: async (): Promise<PollWithVotes[]> => {
      if (!conversationId) return [];

      // Fetch polls
      const { data: polls, error: pollsError } = await supabase
        .from('internal_polls')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      if (pollsError) throw pollsError;
      if (!polls?.length) return [];

      // Fetch votes for all polls
      const pollIds = polls.map(p => p.id);
      const { data: votes, error: votesError } = await supabase
        .from('internal_poll_votes')
        .select('*')
        .in('poll_id', pollIds);

      if (votesError) throw votesError;

      // Fetch creator profiles
      const creatorIds = [...new Set(polls.map(p => p.created_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Build result with parsed options
      return polls.map(poll => ({
        ...poll,
        options: poll.options as string[],
        votes: (votes || []).filter(v => v.poll_id === poll.id) as InternalPollVote[],
        creator: profileMap.get(poll.created_by)
      }));
    },
    enabled: !!conversationId,
    staleTime: 30000,
  });
}

export function useCreatePoll() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      conversationId,
      question,
      options,
      isAnonymous = false,
      isMultipleChoice = false,
      closesAt
    }: {
      conversationId: string;
      question: string;
      options: string[];
      isAnonymous?: boolean;
      isMultipleChoice?: boolean;
      closesAt?: Date;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('internal_polls')
        .insert({
          conversation_id: conversationId,
          created_by: user.id,
          question,
          options,
          is_anonymous: isAnonymous,
          is_multiple_choice: isMultipleChoice,
          closes_at: closesAt?.toISOString() || null
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['internal-polls', variables.conversationId] });
    }
  });
}

export function useVotePoll() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      pollId,
      optionIndex,
      conversationId
    }: {
      pollId: string;
      optionIndex: number;
      conversationId: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('internal_poll_votes')
        .insert({
          poll_id: pollId,
          user_id: user.id,
          option_index: optionIndex
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['internal-polls', variables.conversationId] });
    }
  });
}

export function useRemoveVote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      pollId,
      optionIndex,
      conversationId
    }: {
      pollId: string;
      optionIndex: number;
      conversationId: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('internal_poll_votes')
        .delete()
        .eq('poll_id', pollId)
        .eq('user_id', user.id)
        .eq('option_index', optionIndex);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['internal-polls', variables.conversationId] });
    }
  });
}

export function useClosePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pollId,
      conversationId
    }: {
      pollId: string;
      conversationId: string;
    }) => {
      const { error } = await supabase
        .from('internal_polls')
        .update({ is_closed: true })
        .eq('id', pollId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['internal-polls', variables.conversationId] });
    }
  });
}

export function useDeletePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pollId,
      conversationId
    }: {
      pollId: string;
      conversationId: string;
    }) => {
      const { error } = await supabase
        .from('internal_polls')
        .delete()
        .eq('id', pollId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['internal-polls', variables.conversationId] });
    }
  });
}
