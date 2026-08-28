import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, Lock, MoreVertical, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PollWithVotes, PollOptionStats } from '@/types/internal-poll';
import { useAuth } from '@/contexts/AuthContext';
import { useVotePoll, useRemoveVote, useClosePoll, useDeletePoll } from '@/hooks/useInternalPolls';
import { ParticipantWithProfile } from '@/types/internal-chat';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PollCardProps {
  poll: PollWithVotes;
  participants: ParticipantWithProfile[];
}

export function PollCard({ poll, participants }: PollCardProps) {
  const { user } = useAuth();
  const [isVoting, setIsVoting] = useState(false);

  const votePoll = useVotePoll();
  const removeVote = useRemoveVote();
  const closePoll = useClosePoll();
  const deletePoll = useDeletePoll();

  const isCreator = poll.created_by === user?.id;
  const totalVotes = poll.votes.length;
  const userVotes = poll.votes.filter(v => v.user_id === user?.id);
  const hasVoted = userVotes.length > 0;

  // Build option stats
  const optionStats: PollOptionStats[] = poll.options.map((optionText, index) => {
    const optionVotes = poll.votes.filter(v => v.option_index === index);
    const voteCount = optionVotes.length;
    const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
    
    // Get voter names
    const voterIds = optionVotes.map(v => v.user_id);
    const voters = participants
      .filter(p => voterIds.includes(p.user_id))
      .map(p => p.profile?.full_name || 'Usuário');

    return {
      optionIndex: index,
      optionText,
      voteCount,
      percentage,
      voters
    };
  });

  const handleVote = async (optionIndex: number) => {
    if (poll.is_closed || isVoting) return;

    setIsVoting(true);
    try {
      const alreadyVotedThis = userVotes.some(v => v.option_index === optionIndex);

      if (alreadyVotedThis) {
        // Remove vote
        await removeVote.mutateAsync({
          pollId: poll.id,
          optionIndex,
          conversationId: poll.conversation_id
        });
      } else {
        // If single choice and already voted, remove previous
        if (!poll.is_multiple_choice && hasVoted) {
          for (const vote of userVotes) {
            await removeVote.mutateAsync({
              pollId: poll.id,
              optionIndex: vote.option_index,
              conversationId: poll.conversation_id
            });
          }
        }
        // Add new vote
        await votePoll.mutateAsync({
          pollId: poll.id,
          optionIndex,
          conversationId: poll.conversation_id
        });
      }
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Erro ao registrar voto');
    } finally {
      setIsVoting(false);
    }
  };

  const handleClose = async () => {
    try {
      await closePoll.mutateAsync({
        pollId: poll.id,
        conversationId: poll.conversation_id
      });
      toast.success('Enquete encerrada');
    } catch (error) {
      console.error('Error closing poll:', error);
      toast.error('Erro ao encerrar enquete');
    }
  };

  const handleDelete = async () => {
    try {
      await deletePoll.mutateAsync({
        pollId: poll.id,
        conversationId: poll.conversation_id
      });
      toast.success('Enquete excluída');
    } catch (error) {
      console.error('Error deleting poll:', error);
      toast.error('Erro ao excluir enquete');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={poll.creator?.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(poll.creator?.full_name || 'U')}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{poll.creator?.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(poll.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {poll.is_closed && (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              Encerrada
            </Badge>
          )}
          {poll.is_anonymous && (
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              Anônima
            </Badge>
          )}
          {isCreator && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!poll.is_closed && (
                  <DropdownMenuItem onClick={handleClose}>
                    <Lock className="h-4 w-4 mr-2" />
                    Encerrar enquete
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir enquete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Question */}
      <p className="font-medium">{poll.question}</p>

      {/* Options */}
      <div className="space-y-2">
        {optionStats.map((stat) => {
          const isVotedByUser = userVotes.some(v => v.option_index === stat.optionIndex);

          return (
            <TooltipProvider key={stat.optionIndex}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleVote(stat.optionIndex)}
                    disabled={poll.is_closed || isVoting}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors relative overflow-hidden",
                      poll.is_closed
                        ? "cursor-default"
                        : "hover:border-primary cursor-pointer",
                      isVotedByUser && "border-primary bg-primary/5"
                    )}
                  >
                    {/* Progress bar background */}
                    <div
                      className="absolute inset-0 bg-primary/10 transition-all"
                      style={{ width: `${stat.percentage}%` }}
                    />
                    
                    {/* Content */}
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isVotedByUser && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                        <span className={cn(
                          "text-sm",
                          isVotedByUser && "font-medium"
                        )}>
                          {stat.optionText}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{stat.voteCount}</span>
                        <span>({stat.percentage}%)</span>
                      </div>
                    </div>
                  </button>
                </TooltipTrigger>
                {!poll.is_anonymous && stat.voters.length > 0 && (
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="font-medium mb-1">Votaram nesta opção:</p>
                    <p className="text-xs">{stat.voters.join(', ')}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
        <span>
          {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}
        </span>
        {poll.is_multiple_choice && (
          <span>Múltipla escolha</span>
        )}
      </div>
    </div>
  );
}
