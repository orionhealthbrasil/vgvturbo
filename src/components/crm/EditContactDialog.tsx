import { useState, useEffect } from 'react';
import { Pencil, User, TextCursorInput, Building2, Bot, Loader2, Info, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUpdateContact } from '@/hooks/useCRM';
import { useConversationalAgents } from '@/hooks/useAiAgents';
import { useAutomations } from '@/hooks/useAutomations';
import { useOrganizationMembers } from '@/hooks/useGoals';
import { useUserPermissions } from '@/hooks/usePermissions';
import { ContactCustomFields } from './ContactCustomFields';
import { ContactTagsEditor } from './ContactTagsEditor';
import { StageSelectInline } from './StageSelectInline';
import { useCustomFieldDefinitions } from '@/hooks/useCustomFieldDefinitions';
import { useContactHiddenFrom, useSetContactHiddenFrom } from '@/hooks/useContactVisibility';
import { normalizePhone } from '@/lib/phone-link';
import { toast } from 'sonner';
import type { Contact } from '@/types/crm';

// Slugify field name to match the variable format used in automation-engine
function slugifyFieldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact;
  onManageCustomFields?: () => void;
}

export function EditContactDialog({
  open,
  onOpenChange,
  contact,
  onManageCustomFields,
}: EditContactDialogProps) {
  const updateContact = useUpdateContact();
  const { data: agents = [] } = useConversationalAgents();
  const { data: automations = [] } = useAutomations();
  const { data: members = [] } = useOrganizationMembers();
  const { data: definitions = [] } = useCustomFieldDefinitions();
  const { isOwner, role: memberRole } = useUserPermissions();
  const canManageVisibility = isOwner || memberRole === 'admin';
  const { data: hiddenFromEntries = [] } = useContactHiddenFrom(canManageVisibility ? contact.id : null);
  const setHiddenFrom = useSetContactHiddenFrom();
  const [hiddenFromIds, setHiddenFromIds] = useState<Set<string>>(new Set());

  // System fields state
  const [name, setName] = useState(contact.name || '');
  const [phone, setPhone] = useState(contact.phone || '');
  const [email, setEmail] = useState(contact.email || '');
  const [birthDate, setBirthDate] = useState(contact.birth_date || '');
  const [notes, setNotes] = useState(contact.notes || '');

  // Organization tab
  const [assignedTo, setAssignedTo] = useState<string>(contact.assigned_to || 'none');

  // Automation tab
  const [aiEnabled, setAiEnabled] = useState(!!contact.ai_enabled);
  const [aiAgentId, setAiAgentId] = useState<string>(contact.ai_agent_id || 'none');
  const [automationsActive, setAutomationsActive] = useState(!contact.automations_paused);

  // Sync hidden-from state when entries load
  useEffect(() => {
    setHiddenFromIds(new Set(hiddenFromEntries.map((e) => e.user_id)));
  }, [hiddenFromEntries]);

  // Reset whenever opens with a new contact
  useEffect(() => {
    if (open) {
      setName(contact.name || '');
      setPhone(contact.phone || '');
      setEmail(contact.email || '');
      setBirthDate(contact.birth_date || '');
      setNotes(contact.notes || '');
      setAssignedTo(contact.assigned_to || 'none');
      setAiEnabled(!!contact.ai_enabled);
      setAiAgentId(contact.ai_agent_id || 'none');
      setAutomationsActive(!contact.automations_paused);
    }
  }, [open, contact.id]);

  const activeFlow = automations.find((a) => a.id === contact.active_flow_id);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('O nome é obrigatório');
      return;
    }

    let normalizedPhone = phone.trim();
    if (normalizedPhone && normalizedPhone !== contact.phone) {
      normalizedPhone = normalizePhone(normalizedPhone);
      if (!normalizedPhone || normalizedPhone.length < 12) {
        toast.error('Telefone inválido. Digite o número completo com DDD.');
        return;
      }
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Email inválido');
      return;
    }

    try {
      await updateContact.mutateAsync({
        id: contact.id,
        name: name.trim(),
        phone: normalizedPhone || contact.phone,
        email: email.trim() || null,
        birth_date: birthDate || null,
        notes: notes.trim() || null,
        assigned_to: assignedTo === 'none' ? null : assignedTo,
        ai_enabled: aiEnabled,
        ai_agent_id: aiAgentId === 'none' ? null : aiAgentId,
        automations_paused: !automationsActive,
      });
      if (canManageVisibility) {
        await setHiddenFrom.mutateAsync({ contactId: contact.id, userIds: [...hiddenFromIds] });
      }
      toast.success('Contato atualizado!');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating contact:', error);
      toast.error('Erro ao salvar contato');
    }
  };

  const handleRemoveFlow = async () => {
    try {
      await updateContact.mutateAsync({
        id: contact.id,
        active_flow_id: null,
        current_node_id: null,
        waiting_response: false,
      });
      toast.success('Contato removido do fluxo');
    } catch {
      toast.error('Erro ao remover do fluxo');
    }
  };

  const statusBadge = {
    open: { label: 'Aberta', variant: 'default' as const },
    closed: { label: 'Fechada', variant: 'secondary' as const },
    snoozed: { label: 'Pausada', variant: 'outline' as const },
  }[contact.status] || { label: contact.status, variant: 'secondary' as const };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4" />
            Editar Contato
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 shrink-0">
            <TabsList className={`grid w-full ${canManageVisibility ? 'grid-cols-5' : 'grid-cols-4'}`}>
              <TabsTrigger value="info" className="gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Informações</span>
              </TabsTrigger>
              <TabsTrigger value="custom" className="gap-1.5">
                <TextCursorInput className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Personalizados</span>
              </TabsTrigger>
              <TabsTrigger value="org" className="gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Organização</span>
              </TabsTrigger>
              <TabsTrigger value="auto" className="gap-1.5">
                <Bot className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Automação</span>
              </TabsTrigger>
              {canManageVisibility && (
                <TabsTrigger value="visibility" className="gap-1.5">
                  <EyeOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Visibilidade</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <ScrollArea className="flex-1 px-6 py-4">
            {/* INFORMAÇÕES */}
            <TabsContent value="info" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="ec-name">Nome *</Label>
                <Input
                  id="ec-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ec-phone">Telefone (WhatsApp)</Label>
                  <Input
                    id="ec-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+55 11 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ec-email">Email</Label>
                  <Input
                    id="ec-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ec-birth">Data de nascimento</Label>
                <Input
                  id="ec-birth"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full sm:w-[240px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ec-notes">Notas</Label>
                <Textarea
                  id="ec-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anotações sobre o contato..."
                  rows={4}
                />
              </div>
            </TabsContent>

            {/* CAMPOS PERSONALIZADOS */}
            <TabsContent value="custom" className="space-y-4 mt-0">
              {definitions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TextCursorInput className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm mb-4">Nenhum campo personalizado criado ainda.</p>
                  {onManageCustomFields && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        onManageCustomFields();
                      }}
                    >
                      Criar primeiro campo
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <ContactCustomFields contactId={contact.id} />

                  <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <Info className="w-3.5 h-3.5 text-primary" />
                      Use em automações
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Insira estas variáveis em mensagens, e-mails e condições de fluxos:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {definitions.map((d) => (
                        <code
                          key={d.id}
                          className="text-[11px] px-1.5 py-0.5 rounded bg-background border font-mono"
                          title={d.name}
                        >
                          {`{${slugifyFieldName(d.name)}}`}
                        </code>
                      ))}
                    </div>
                  </div>

                  {onManageCustomFields && (
                    <div className="pt-2">
                      <Button
                        variant="link"
                        size="sm"
                        className="px-0 h-auto"
                        onClick={() => {
                          onOpenChange(false);
                          onManageCustomFields();
                        }}
                      >
                        Gerenciar campos personalizados →
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* ORGANIZAÇÃO */}
            <TabsContent value="org" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label>Tags</Label>
                <ContactTagsEditor contactId={contact.id} />
              </div>

              <div className="space-y-2">
                <Label>Etapa do Funil</Label>
                <StageSelectInline contact={contact} />
                <p className="text-xs text-muted-foreground">
                  A etapa pode ser usada como gatilho em automações.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Atribuído a</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ninguém" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguém</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.full_name || m.email || 'Sem nome'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Label className="text-xs text-muted-foreground">Status da conversa:</Label>
                <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              </div>
            </TabsContent>

            {/* AUTOMAÇÃO & IA */}
            <TabsContent value="auto" className="space-y-5 mt-0">
              <div className="space-y-3 p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">IA respondendo</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Quando ativa, o agente de IA responde automaticamente este contato.
                    </p>
                  </div>
                  <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                </div>
                {aiEnabled && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs">Agente de IA</Label>
                    <Select value={aiAgentId} onValueChange={setAiAgentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Agente padrão" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Agente padrão</SelectItem>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} — {a.department}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div>
                  <Label className="text-sm font-medium">Automações ativas</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permite que fluxos automatizados sejam executados para este contato.
                  </p>
                </div>
                <Switch
                  checked={automationsActive}
                  onCheckedChange={setAutomationsActive}
                />
              </div>

              <div className="p-4 rounded-lg border bg-card space-y-2">
                <Label className="text-sm font-medium">Fluxo ativo</Label>
                {activeFlow ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{activeFlow.name}</p>
                      {contact.current_node_id && (
                        <p className="text-xs text-muted-foreground truncate">
                          Nó atual: {contact.current_node_id}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveFlow}
                      disabled={updateContact.isPending}
                    >
                      Remover do fluxo
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Este contato não está em nenhum fluxo no momento.
                  </p>
                )}
              </div>
            </TabsContent>

            {/* VISIBILIDADE */}
            {canManageVisibility && (
              <TabsContent value="visibility" className="space-y-4 mt-0">
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Ocultar de colaboradores</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Colaboradores marcados não conseguirão ver este contato na lista de conversas.
                      Donos e administradores sempre visualizam todos os contatos.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {members
                      .filter((m) => m.role !== 'owner' && m.member_role !== 'admin')
                      .map((member) => {
                        const checked = hiddenFromIds.has(member.user_id);
                        return (
                          <label
                            key={member.user_id}
                            className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setHiddenFromIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(member.user_id)) {
                                    next.delete(member.user_id);
                                  } else {
                                    next.add(member.user_id);
                                  }
                                  return next;
                                });
                              }}
                              className="h-4 w-4 rounded border-input accent-primary"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {member.full_name || member.email || 'Sem nome'}
                              </p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {member.member_role || member.role}
                              </p>
                            </div>
                            {checked && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                                Oculto
                              </span>
                            )}
                          </label>
                        );
                      })}
                    {members.filter((m) => m.role !== 'owner' && m.member_role !== 'admin').length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Nenhum colaborador cadastrado nesta organização.
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateContact.isPending}>
            {updateContact.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
