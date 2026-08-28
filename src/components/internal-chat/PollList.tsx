import { useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PollCard } from './PollCard';
import { useConversationPolls } from '@/hooks/useInternalPolls';
import { ParticipantWithProfile } from '@/types/internal-chat';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface PollListProps {
  conversationId: string;
  participants: ParticipantWithProfile[];
}

export function PollList({ conversationId, participants }: PollListProps) {
  const queryClient = useQueryClient();
  const { data: polls = [], isLoading } = useConversationPolls(conversationId);

  // Realtime subscription for polls
  useEffect(() => {
    const pollsChannel = supabase
      .channel(`polls-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_polls',
          filter: `conversation_id=eq.${conversationId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['internal-polls', conversationId] });
        }
      )
      .subscribe();

    const votesChannel = supabase
      .channel(`poll-votes-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_poll_votes'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['internal-polls', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(pollsChannel);
      supabase.removeChannel(votesChannel);
    };
  }, [conversationId, queryClient]);

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Carregando enquetes...
      </div>
    );
  }

  if (polls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
        <p>Nenhuma enquete neste grupo</p>
        <p className="text-sm">Clique no ícone de enquete para criar uma</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {polls.map(poll => (
          <PollCard
            key={poll.id}
            poll={poll}
            participants={participants}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
