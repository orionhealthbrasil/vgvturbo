import { useState, useMemo } from 'react';
import { Search, MessageSquare, Users, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useInternalConversations, useOrganizationMembers } from '@/hooks/useInternalChat';
import { useConversationContacts } from '@/hooks/useConversationContacts';
import { SelectedMessage } from '@/hooks/useMessageSelection';

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: SelectedMessage[];
  onForwardToWhatsApp: (contactId: string, contactPhone: string) => Promise<void>;
  onForwardToInternal: (conversationId: string) => Promise<void>;
  /** Hide the WhatsApp tab (when forwarding from internal-only context) */
  hideWhatsApp?: boolean;
  /** Hide the Internal tab */
  hideInternal?: boolean;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  messages,
  onForwardToWhatsApp,
  onForwardToInternal,
  hideWhatsApp = false,
  hideInternal = false,
}: ForwardMessageDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [isForwarding, setIsForwarding] = useState(false);
  const [activeTab, setActiveTab] = useState(hideWhatsApp ? 'internal' : 'whatsapp');

  // WhatsApp contacts
  const { data: contacts = [] } = useConversationContacts();

  // Internal conversations
  const { data: internalConversations = [] } = useInternalConversations();

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const filteredContacts = useMemo(() => {
    if (!search) return contacts.slice(0, 50);
    const lower = search.toLowerCase();
    return contacts
      .filter(c => c.name.toLowerCase().includes(lower) || c.phone.includes(search))
      .slice(0, 50);
  }, [contacts, search]);

  const filteredConversations = useMemo(() => {
    if (!search) return internalConversations;
    const lower = search.toLowerCase();
    return internalConversations.filter(conv => {
      if (conv.is_group) return conv.name?.toLowerCase().includes(lower);
      const other = conv.participants.find(p => p.user_id !== user?.id);
      return other?.profile?.full_name?.toLowerCase().includes(lower);
    });
  }, [internalConversations, search, user?.id]);

  const getConversationName = (conv: typeof internalConversations[0]) => {
    if (conv.is_group) return conv.name || 'Grupo';
    const other = conv.participants.find(p => p.user_id !== user?.id);
    return other?.profile?.full_name || 'Usuário';
  };

  const getConversationAvatar = (conv: typeof internalConversations[0]) => {
    if (conv.is_group) return null;
    const other = conv.participants.find(p => p.user_id !== user?.id);
    return other?.profile?.avatar_url;
  };

  const handleForwardWhatsApp = async (contactId: string, phone: string) => {
    setIsForwarding(true);
    try {
      await onForwardToWhatsApp(contactId, phone);
      onOpenChange(false);
    } finally {
      setIsForwarding(false);
    }
  };

  const handleForwardInternal = async (conversationId: string) => {
    setIsForwarding(true);
    try {
      await onForwardToInternal(conversationId);
      onOpenChange(false);
    } finally {
      setIsForwarding(false);
    }
  };

  const defaultTab = hideWhatsApp ? 'internal' : 'whatsapp';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Encaminhar {messages.length} {messages.length === 1 ? 'mensagem' : 'mensagens'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue={defaultTab}>
          {!hideWhatsApp && !hideInternal && (
            <TabsList className="w-full">
              <TabsTrigger value="whatsapp" className="flex-1 gap-2">
                <MessageSquare className="w-4 h-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="internal" className="flex-1 gap-2">
                <Users className="w-4 h-4" />
                Chat Interno
              </TabsTrigger>
            </TabsList>
          )}

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {!hideWhatsApp && (
            <TabsContent value="whatsapp" className="mt-3">
              <ScrollArea className="h-64">
                {filteredContacts.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    Nenhum contato encontrado
                  </div>
                ) : (
                  <div className="space-y-1 p-1">
                    {filteredContacts.map(contact => (
                      <button
                        key={contact.id}
                        disabled={isForwarding}
                        onClick={() => handleForwardWhatsApp(contact.id, contact.phone)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={contact.profile_picture_url || undefined} />
                          <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium truncate">{contact.name}</p>
                          <p className="text-sm text-muted-foreground">{contact.phone}</p>
                        </div>
                        {isForwarding && <Loader2 className="w-4 h-4 animate-spin" />}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          )}

          {!hideInternal && (
            <TabsContent value="internal" className="mt-3">
              <ScrollArea className="h-64">
                {filteredConversations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    Nenhuma conversa encontrada
                  </div>
                ) : (
                  <div className="space-y-1 p-1">
                    {filteredConversations.map(conv => (
                      <button
                        key={conv.id}
                        disabled={isForwarding}
                        onClick={() => handleForwardInternal(conv.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={getConversationAvatar(conv) || undefined} />
                          <AvatarFallback className={conv.is_group ? 'bg-primary/20' : ''}>
                            {conv.is_group ? <Users className="h-5 w-5" /> : getInitials(getConversationName(conv))}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium truncate">{getConversationName(conv)}</p>
                          {conv.is_group && (
                            <p className="text-sm text-muted-foreground">
                              {conv.participants.length} participantes
                            </p>
                          )}
                        </div>
                        {isForwarding && <Loader2 className="w-4 h-4 animate-spin" />}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
