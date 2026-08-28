import { useState, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOrganizationMembers } from '@/hooks/useGoals';
import { Search, Users } from 'lucide-react';

interface GoalParticipantsListProps {
  selectedUserIds: string[];
  onChange: (ids: string[]) => void;
}

export function GoalParticipantsList({ selectedUserIds, onChange }: GoalParticipantsListProps) {
  const { data: members = [], isLoading } = useOrganizationMembers();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      (m.full_name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q),
    );
  }, [members, search]);

  const toggle = (uid: string) => {
    if (selectedUserIds.includes(uid)) {
      onChange(selectedUserIds.filter((id) => id !== uid));
    } else {
      onChange([...selectedUserIds, uid]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar membros..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9"
        />
      </div>
      <ScrollArea className="h-48 border rounded-md">
        <div className="p-1">
          {isLoading ? (
            <div className="text-xs text-muted-foreground text-center py-4">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4 flex flex-col items-center gap-2">
              <Users className="w-6 h-6 opacity-40" />
              Nenhum membro encontrado
            </div>
          ) : (
            filtered.map((m) => {
              const checked = selectedUserIds.includes(m.user_id);
              const initials = (m.full_name || m.email || '?').slice(0, 2).toUpperCase();
              return (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => toggle(m.user_id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-left"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(m.user_id)} />
                  <Avatar className="h-7 w-7">
                    {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{m.full_name || 'Sem nome'}</div>
                    {m.email && <div className="text-[10px] text-muted-foreground truncate">{m.email}</div>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
      <div className="text-[11px] text-muted-foreground">
        {selectedUserIds.length} selecionado{selectedUserIds.length === 1 ? '' : 's'}
      </div>
    </div>
  );
}
