import { useState } from 'react';
import { Search, Users, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizationMembers, useCreateConversation } from '@/hooks/useInternalChat';
import { toast } from 'sonner';

function getErrorMessage(error: unknown) {
  if (!error) return 'Erro desconhecido';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;

  // PostgrestError-like
  const anyErr = error as any;
  const parts = [
    anyErr?.code ? `code=${anyErr.code}` : null,
    anyErr?.message ? `message=${anyErr.message}` : null,
    anyErr?.details ? `details=${anyErr.details}` : null,
    anyErr?.hint ? `hint=${anyErr.hint}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(' | ') : 'Erro desconhecido';
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isGroup?: boolean;
  onConversationCreated: (conversationId: string) => void;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  isGroup = false,
  onConversationCreated
}: NewConversationDialogProps) {
  const { user } = useAuth();
  const { data: members = [], isLoading } = useOrganizationMembers();
  const createConversation = useCreateConversation();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const filteredMembers = members.filter(m => {
    if (m.user_id === user?.id) return false;
    if (!search) return true;
    return m.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
           m.profile?.email?.toLowerCase().includes(search.toLowerCase());
  });

  const toggleMember = (userId: string) => {
    if (isGroup) {
      setSelectedIds(prev => 
        prev.includes(userId) 
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      );
    } else {
      setSelectedIds([userId]);
    }
  };

  const handleCreate = async () => {
    if (selectedIds.length === 0) {
      toast.error('Selecione pelo menos um membro');
      return;
    }

    if (isGroup && !groupName.trim()) {
      toast.error('Digite um nome para o grupo');
      return;
    }

    try {
      const conv = await createConversation.mutateAsync({
        participantIds: selectedIds,
        name: isGroup ? groupName : undefined,
        isGroup
      });
      onConversationCreated(conv.id);
      onOpenChange(false);
      setSelectedIds([]);
      setGroupName('');
      setSearch('');
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error(`Erro ao criar conversa: ${getErrorMessage(error)}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isGroup ? 'Novo Grupo' : 'Nova Conversa'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isGroup && (
            <div>
              <Label htmlFor="groupName">Nome do Grupo</Label>
              <Input
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Digite o nome do grupo..."
              />
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar membros..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-64 border rounded-lg">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">Carregando...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                Nenhum membro encontrado
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredMembers.map(member => {
                  const isSelected = selectedIds.includes(member.user_id);
                  const name = member.profile?.full_name || 'Usuário';

                  return (
                    <button
                      key={member.user_id}
                      onClick={() => toggleMember(member.user_id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                      }`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.profile?.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left">
                        <p className="font-medium">{name}</p>
                        <p className="text-sm text-muted-foreground">
                          {member.profile?.email}
                        </p>
                      </div>
                      {isGroup ? (
                        <Checkbox checked={isSelected} />
                      ) : (
                        isSelected && <Check className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {isGroup && selectedIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedIds.length} membro(s) selecionado(s)
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={selectedIds.length === 0 || createConversation.isPending}
            >
              {createConversation.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
