import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCreateContact, useUpdateContact } from '@/hooks/useCRM';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { triggerFunnelStageAutomation } from '@/hooks/usePipeline';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { Loader2, Search, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ContactWithColumn } from '@/types/crm';

interface NewPipelineContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string | null;
  /** Slug da etapa pré-selecionada. Se null, usa a primeira etapa. */
  initialStageSlug?: string | null;
}

function normalizePhone(rawPhone: string): string {
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits.startsWith('55')) digits = `55${digits}`;
  const withoutCountry = digits.slice(2);
  if (withoutCountry.length === 10) {
    const ddd = withoutCountry.slice(0, 2);
    const number = withoutCountry.slice(2);
    if (['6', '7', '8', '9'].includes(number[0])) {
      return `55${ddd}9${number}`;
    }
  }
  return digits;
}

function getInitials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function NewPipelineContactDialog({
  open,
  onOpenChange,
  pipelineId,
  initialStageSlug,
}: NewPipelineContactDialogProps) {
  const { data: orgData } = useUserOrganization();
  const { data: stages = [] } = useFunnelStages(pipelineId);
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'new' | 'existing'>('new');

  // --- New contact fields ---
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dealValue, setDealValue] = useState('');
  const [notes, setNotes] = useState('');
  const [stageSlug, setStageSlug] = useState<string>('');

  // --- Existing contact search ---
  const [searchTerm, setSearchTerm] = useState('');
  const [existingStageSlug, setExistingStageSlug] = useState<string>('');
  const [selectedContacts, setSelectedContacts] = useState<Map<string, ContactWithColumn>>(new Map());
  const debouncedSearch = useDebounce(searchTerm, 300);

  const orgId = orgData?.organization.id;
  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['pipeline-contact-search', orgId, debouncedSearch],
    enabled: !!orgId && debouncedSearch.length >= 2,
    staleTime: 15000,
    queryFn: async (): Promise<ContactWithColumn[]> => {
      const term = debouncedSearch.trim();
      const { data, error } = await supabase.rpc('search_contacts_with_filters' as any, {
        p_organization_id: orgId!,
        p_search: term,
        p_include_archived: false,
        p_limit: 50,
      } as any);
      if (error) throw error;
      return (data || []).map((c: any) => ({ ...c, kanban_columns: null, profiles: null })) as ContactWithColumn[];
    },
  });

  const sortedStages = [...stages].sort((a, b) => a.position - b.position);

  useEffect(() => {
    if (!open) return;
    const fallback = sortedStages[0]?.slug ?? '';
    setStageSlug(initialStageSlug || fallback);
    setExistingStageSlug(initialStageSlug || fallback);
  }, [open, initialStageSlug, stages.length]);

  const resetAll = () => {
    setTab('new');
    setName(''); setPhone(''); setEmail(''); setDealValue(''); setNotes(''); setStageSlug('');
    setSearchTerm(''); setExistingStageSlug(''); setSelectedContacts(new Map());
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) { toast.error('Nome e telefone são obrigatórios'); return; }
    if (!pipelineId) { toast.error('Selecione um funil válido'); return; }
    const normalizedPhone = normalizePhone(phone.trim());
    if (normalizedPhone.length < 12) { toast.error('Telefone inválido. Digite o número completo com DDD.'); return; }

    const parsedValue = dealValue.trim() ? Number(dealValue.replace(',', '.')) : null;

    try {
      const created = await createContact.mutateAsync({
        name: name.trim(),
        phone: normalizedPhone,
        email: email.trim() || null,
        notes: notes.trim() || null,
        kanban_column_id: null,
        pipeline_id: pipelineId,
        assigned_to: null,
        funnel_stage: (stageSlug || 'lead') as any,
        sale_result: null,
        profile_picture_url: null,
        deal_value: Number.isFinite(parsedValue as number) ? (parsedValue as number) : null,
      });

      if (orgData?.organization.id && stageSlug) {
        const stage = sortedStages.find((s) => s.slug === stageSlug);
        if (stage) {
          triggerFunnelStageAutomation({
            contactId: created.id,
            organizationId: orgData.organization.id,
            newStageName: stage.name,
            previousStageName: null,
            pipelineId,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['pipeline-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contato criado e adicionado ao funil!');
      resetAll();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar contato');
    }
  };

  const handleAddExisting = async () => {
    if (selectedContacts.size === 0 || !pipelineId || !existingStageSlug) {
      toast.error('Selecione ao menos um contato e uma etapa');
      return;
    }

    const stage = sortedStages.find((s) => s.slug === existingStageSlug);
    const contacts = Array.from(selectedContacts.values());

    try {
      await Promise.all(
        contacts.map((c) =>
          updateContact.mutateAsync({
            id: c.id,
            pipeline_id: pipelineId,
            funnel_stage: existingStageSlug as any,
          })
        )
      );

      if (orgData?.organization.id && stage) {
        contacts.forEach((c) => {
          triggerFunnelStageAutomation({
            contactId: c.id,
            organizationId: orgData.organization.id,
            newStageName: stage.name,
            previousStageName: null,
            pipelineId,
          });
        });
      }

      queryClient.invalidateQueries({ queryKey: ['pipeline-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(
        contacts.length === 1
          ? `${contacts[0].name} adicionado ao funil!`
          : `${contacts.length} contatos adicionados ao funil!`
      );
      resetAll();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao adicionar contatos ao funil');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAll(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar ao funil</DialogTitle>
          <DialogDescription>
            Crie um novo contato ou selecione um existente para adicionar ao funil.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'new' | 'existing')}>
          <TabsList className="w-full">
            <TabsTrigger value="new" className="flex-1">Novo contato</TabsTrigger>
            <TabsTrigger value="existing" className="flex-1">Contato existente</TabsTrigger>
          </TabsList>

          {/* ── Tab: Novo contato ── */}
          <TabsContent value="new">
            <form onSubmit={handleCreateNew} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="np-name">Nome *</Label>
                <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do contato" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="np-phone">Telefone (WhatsApp) *</Label>
                <Input id="np-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11 99999-9999" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="np-email">Email</Label>
                  <Input id="np-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="np-value">Valor potencial (R$)</Label>
                  <Input id="np-value" inputMode="decimal" value={dealValue} onChange={(e) => setDealValue(e.target.value)} placeholder="0,00" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="np-stage">Etapa do funil</Label>
                <Select value={stageSlug} onValueChange={setStageSlug}>
                  <SelectTrigger id="np-stage">
                    <SelectValue placeholder="Selecione uma etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedStages.map((s) => (
                      <SelectItem key={s.id} value={s.slug}>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="np-notes">Notas</Label>
                <Textarea id="np-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anotações sobre o contato..." rows={3} />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={createContact.isPending}>
                  {createContact.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Criar contato
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* ── Tab: Contato existente ── */}
          <TabsContent value="existing">
            <div className="space-y-4 mt-2">
              {/* Search */}
              <div className="space-y-2">
                <Label>Buscar contato</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setSelectedContact(null); }}
                    placeholder="Nome, telefone ou e-mail..."
                    className="pl-9"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Results */}
              {debouncedSearch.length >= 2 && (
                <ScrollArea className="h-48 rounded-md border">
                  {searchResults.length === 0 && !isSearching ? (
                    <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground py-6">
                      <Search className="w-8 h-8 mb-2 opacity-40" />
                      Nenhum contato encontrado
                    </div>
                  ) : (
                    <div className="divide-y">
                      {searchResults.map((contact) => {
                        const isSelected = selectedContacts.has(contact.id);
                        return (
                          <button
                            key={contact.id}
                            onClick={() => {
                              setSelectedContacts(prev => {
                                const next = new Map(prev);
                                isSelected ? next.delete(contact.id) : next.set(contact.id, contact);
                                return next;
                              });
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors',
                              isSelected && 'bg-primary/10'
                            )}
                          >
                            <div className={cn(
                              'w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors',
                              isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                            )}>
                              {isSelected && <UserCheck className="w-2.5 h-2.5 text-primary-foreground" />}
                            </div>
                            <Avatar className="w-8 h-8 shrink-0">
                              {contact.profile_picture_url && <img src={contact.profile_picture_url} className="object-cover w-full h-full rounded-full" />}
                              <AvatarFallback className="text-xs">{getInitials(contact.name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{contact.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              )}

              {/* Selected contacts summary */}
              {selectedContacts.size > 0 && (
                <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-primary">
                      {selectedContacts.size} contato{selectedContacts.size !== 1 ? 's' : ''} selecionado{selectedContacts.size !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => setSelectedContacts(new Map())}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(selectedContacts.values()).map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 text-xs bg-background border rounded-full px-2 py-0.5"
                      >
                        {c.name}
                        <button
                          onClick={() => setSelectedContacts(prev => { const next = new Map(prev); next.delete(c.id); return next; })}
                          className="text-muted-foreground hover:text-foreground leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stage selector */}
              <div className="space-y-2">
                <Label>Etapa do funil</Label>
                <Select value={existingStageSlug} onValueChange={setExistingStageSlug}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedStages.map((s) => (
                      <SelectItem key={s.id} value={s.slug}>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button
                  onClick={handleAddExisting}
                  disabled={selectedContacts.size === 0 || !existingStageSlug || updateContact.isPending}
                >
                  {updateContact.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {selectedContacts.size > 1 ? `Adicionar ${selectedContacts.size} ao funil` : 'Adicionar ao funil'}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
