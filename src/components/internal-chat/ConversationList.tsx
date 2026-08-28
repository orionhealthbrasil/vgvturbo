import { useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Users, MessageCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ConversationWithDetails } from '@/types/internal-chat';
import { useAuth } from '@/contexts/AuthContext';
import { useMarkConversationUnread } from '@/hooks/useInternalChat';
import { toast } from 'sonner';

interface ConversationListProps {
  conversations: ConversationWithDetails[];
  selectedId: string | null;
  onSelect: (conversation: ConversationWithDetails) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  isLoading?: boolean;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onNewChat,
  onNewGroup,
  isLoading
}: ConversationListProps) {
  const { user } = useAuth();
  const markUnread = useMarkConversationUnread();
  const [search, setSearch] = useState('');

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Ontem';
    return format(date, 'dd/MM', { locale: ptBR });
  };

  const getConversationName = (conv: ConversationWithDetails) => {
    if (conv.is_group) return conv.name || 'Grupo';
    const other = conv.participants.find(p => p.user_id !== user?.id);
    return other?.profile?.full_name || 'Usuário';
  };

  const getConversationAvatar = (conv: ConversationWithDetails) => {
    if (conv.is_group) return null;
    const other = conv.participants.find(p => p.user_id !== user?.id);
    return other?.profile?.avatar_url;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const truncateText = (text: string, maxChars: number) => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxChars) return normalized;
    return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
  };

  const filteredConversations = conversations.filter(conv => {
    const name = getConversationName(conv).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full border-r w-96 shrink-0 bg-card">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Chat Interno</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Novo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onNewChat} className="cursor-pointer">
                <MessageCircle className="h-4 w-4 mr-2" />
                Nova conversa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onNewGroup} className="cursor-pointer">
                <Users className="h-4 w-4 mr-2" />
                Novo grupo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">Carregando...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {search ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
          </div>
        ) : (
          <div className="p-2">
            {filteredConversations.map(conv => {
              const name = getConversationName(conv);
              const avatar = getConversationAvatar(conv);
              const isSelected = conv.id === selectedId;

              return (
                <ContextMenu key={conv.id}>
                  <ContextMenuTrigger asChild>
                    <button
                      onClick={() => onSelect(conv)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-primary/10'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={avatar || undefined} />
                        <AvatarFallback className={conv.is_group ? 'bg-primary/20' : ''}>
                          {conv.is_group ? <Users className="h-5 w-5" /> : getInitials(name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{truncateText(name, 20)}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-sm truncate text-muted-foreground">
                            {truncateText(conv.lastMessage?.content || 'Sem mensagens', 15)}
                          </p>
                          {conv.unreadCount > 0 && (
                            <Badge
                              variant="default"
                              className="h-5 min-w-[20px] px-1.5 text-xs bg-primary ml-2"
                            >
                              {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => {
                        if (conv.id === selectedId) {
                          toast.info('Feche a conversa antes de marcá-la como não lida');
                          return;
                        }
                        markUnread.mutate(conv.id, {
                          onSuccess: () => toast.success('Conversa marcada como não lida'),
                          onError: () => toast.error('Erro ao marcar como não lida'),
                        });
                      }}
                    >
                      Marcar como não lida
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
