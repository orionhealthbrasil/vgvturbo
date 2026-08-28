import { useState, useMemo } from 'react';
import { Search, MessageSquare, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useContactsServerSearch } from '@/hooks/useConversationContacts';
import { useDebounce } from '@/hooks/useDebounce';
import { ContactWithColumn } from '@/types/crm';
import { cn } from '@/lib/utils';


interface ContactSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectContact: (contact: ContactWithColumn) => void;
  excludeContactIds?: string[];
}

export function ContactSearchDialog({
  open,
  onOpenChange,
  onSelectContact,
  excludeContactIds = [],
}: ContactSearchDialogProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Server-side search — hits DB whenever debounced term has 2+ chars,
  // so results aren't limited to the first N contacts already loaded.
  const { data: searchResults = [], isFetching: isLoading } = useContactsServerSearch({
    searchTerm: debouncedSearch,
    includeArchived: false,
  });

  const filteredContacts = useMemo(() => {
    const excludeSet = new Set(excludeContactIds);
    return (searchResults as ContactWithColumn[]).filter((c) => !excludeSet.has(c.id));
  }, [searchResults, excludeContactIds]);


  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSelectContact = (contact: ContactWithColumn) => {
    onSelectContact(contact);
    onOpenChange(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Nova Conversa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex flex-col min-h-0 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contato por nome, telefone ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoComplete="off"
              autoFocus
            />
          </div>

          <ScrollArea className="h-72">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 animate-pulse"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <User className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">
                  {search
                    ? 'Nenhum contato encontrado'
                    : 'Digite para buscar um contato'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => handleSelectContact(contact)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg',
                      'hover:bg-muted/50 transition-colors text-left'
                    )}
                  >
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{contact.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {contact.phone}
                      </p>
                    </div>
                    {contact.kanban_columns && (
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0"
                        style={{
                          borderColor: contact.kanban_columns.color || undefined,
                          color: contact.kanban_columns.color || undefined,
                        }}
                      >
                        {contact.kanban_columns.name}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
