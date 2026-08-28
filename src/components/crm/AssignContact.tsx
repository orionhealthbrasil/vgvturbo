import { useState, useMemo } from 'react';
import { UserPlus, Check, X, User, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useOrganizationMembers, useUserOrganization } from '@/hooks/useOrganization';
import { useUpdateContact } from '@/hooks/useCRM';
import { useMembersAvailability } from '@/hooks/useMemberAvailability';
import { supabase } from '@/integrations/supabase/client';

import { ContactWithColumn } from '@/types/crm';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AssignContactProps {
  contact: ContactWithColumn;
}

export function AssignContact({ contact }: AssignContactProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: members = [], isLoading: membersLoading } = useOrganizationMembers();
  const { data: availabilityMap = {} } = useMembersAvailability();
  const { data: orgData } = useUserOrganization();
  const updateContact = useUpdateContact();

  const isAdminOrAnalyst =
    orgData?.membership.role === 'owner' ||
    orgData?.membership.role === 'admin' ||
    orgData?.membership.member_role === 'admin' ||
    orgData?.membership.member_role === 'analyst';
  const allowVendorAssignment = (orgData?.organization as any)?.allow_vendor_assignment ?? true;
  const canAssign = isAdminOrAnalyst || allowVendorAssignment;

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const searchLower = search.toLowerCase();
    return members.filter(
      (m) =>
        m.full_name?.toLowerCase().includes(searchLower) ||
        m.email?.toLowerCase().includes(searchLower)
    );
  }, [members, search]);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Tag ID for "Atendimento Humano" — used to protect manually-assigned contacts
  // from being reassigned by the Triagem automation (which skips contacts with this tag).
  const ATENDIMENTO_HUMANO_TAG_ID = '1592d1ca-37eb-4c88-ac0e-dd2926b0d513';

  const syncAtendimentoHumanoTag = async (contactId: string, assigning: boolean) => {
    if (assigning) {
      await supabase
        .from('contact_tags')
        .upsert({ contact_id: contactId, tag_id: ATENDIMENTO_HUMANO_TAG_ID }, { onConflict: 'contact_id,tag_id', ignoreDuplicates: true });
    } else {
      await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', ATENDIMENTO_HUMANO_TAG_ID);
    }
  };

  const handleAssign = async (userId: string | null) => {
    try {
      if (userId) {
        const isAvail = availabilityMap[userId] ?? true;
        if (!isAvail) {
          const ok = window.confirm('Este atendente está como Off (indisponível). Atribuir mesmo assim?');
          if (!ok) return;
        }
      }
      await updateContact.mutateAsync({
        id: contact.id,
        assigned_to: userId,
      });
      // Keep "Atendimento Humano" tag in sync so the Triagem automation
      // doesn't override this manual assignment when the contact next replies.
      await syncAtendimentoHumanoTag(contact.id, !!userId);
      toast.success(userId ? 'Conversa atribuída com sucesso!' : 'Atribuição removida');
      setOpen(false);
      setSearch('');
    } catch (error) {
      toast.error('Erro ao atribuir conversa');
    }
  };

  const assignedMember = members.find((m) => m.user_id === contact.assigned_to);

  // Se não pode atribuir, mostra apenas informação (sem interação)
  if (!canAssign) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm px-2">
        {assignedMember ? (
          <>
            <Avatar className="w-5 h-5">
              <AvatarImage src={assignedMember.avatar_url || undefined} />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {getInitials(assignedMember.full_name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs max-w-24 truncate">
              {assignedMember.full_name || 'Sem nome'}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Não atribuído</span>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setSearch('');
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground gap-2"
        >
          {assignedMember ? (
            <>
              <Avatar className="w-5 h-5">
                <AvatarImage src={assignedMember.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {getInitials(assignedMember.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs max-w-24 truncate hidden lg:inline">
                {assignedMember.full_name || 'Sem nome'}
              </span>
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              <span className="text-xs hidden lg:inline">Atribuir</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
          Atribuir conversa para:
        </div>
        
        {/* Search input */}
        <div className="px-1 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar membro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        <ScrollArea className="h-52">
          {membersLoading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2 animate-pulse">
                  <div className="w-6 h-6 rounded-full bg-muted" />
                  <div className="h-4 bg-muted rounded flex-1" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {/* Option to unassign */}
              {contact.assigned_to && !search && (
                <button
                  onClick={() => handleAssign(null)}
                  className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">Remover atribuição</span>
                </button>
              )}

              {filteredMembers.map((member) => {
                const memberAvail = availabilityMap[member.user_id] ?? true;
                return (
                  <button
                    key={member.id}
                    onClick={() => handleAssign(member.user_id)}
                    className={cn(
                      'w-full flex items-center gap-2 p-2 rounded hover:bg-muted transition-colors text-left',
                      contact.assigned_to === member.user_id && 'bg-primary/10'
                    )}
                  >
                    <div className="relative">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {getInitials(member.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background',
                          memberAvail ? 'bg-emerald-500' : 'bg-muted-foreground'
                        )}
                        aria-hidden
                      />
                    </div>
                    <span className="text-sm flex-1 truncate">
                      {member.full_name || 'Sem nome'}
                    </span>
                    {!memberAvail && (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                        Off
                      </span>
                    )}
                    {contact.assigned_to === member.user_id && (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}

              {filteredMembers.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  {search ? 'Nenhum membro encontrado' : 'Nenhum membro na equipe'}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
