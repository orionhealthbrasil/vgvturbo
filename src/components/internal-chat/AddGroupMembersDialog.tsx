import { useState } from 'react';
import { Search, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useOrganizationMembers, useAddGroupParticipants } from '@/hooks/useInternalChat';
import { toast } from 'sonner';

interface AddGroupMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  existingParticipantIds: string[];
}

export function AddGroupMembersDialog({
  open,
  onOpenChange,
  conversationId,
  existingParticipantIds,
}: AddGroupMembersDialogProps) {
  const { data: members = [], isLoading } = useOrganizationMembers();
  const addParticipants = useAddGroupParticipants();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const availableMembers = members.filter(m => {
    if (existingParticipantIds.includes(m.user_id)) return false;
    if (!search) return true;
    return m.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
           m.profile?.email?.toLowerCase().includes(search.toLowerCase());
  });

  const toggleMember = (userId: string) => {
    setSelectedIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleAdd = async () => {
    if (selectedIds.length === 0) {
      toast.error('Selecione pelo menos um membro');
      return;
    }
    try {
      await addParticipants.mutateAsync({ conversationId, userIds: selectedIds });
      toast.success('Membro(s) adicionado(s) ao grupo');
      onOpenChange(false);
      setSelectedIds([]);
      setSearch('');
    } catch (error) {
      toast.error('Erro ao adicionar membros ao grupo');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar membros ao grupo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
            ) : availableMembers.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                Todos os membros da organização já estão no grupo
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {availableMembers.map(member => {
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
                        <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                      </div>
                      <Checkbox checked={isSelected} />
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {selectedIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedIds.length} membro(s) selecionado(s)
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAdd} disabled={selectedIds.length === 0 || addParticipants.isPending}>
            {addParticipants.isPending ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
