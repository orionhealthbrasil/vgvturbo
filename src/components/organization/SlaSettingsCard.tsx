import { useState, useEffect, useMemo } from 'react';
import { Clock, FileText, Save, Loader2, AlertTriangle, Info, Tag, X, MessageSquare, Phone, Users, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTags } from '@/hooks/useTags';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export type SlaAlertDestination = {
  type: 'phone' | 'group';
  value: string;
  label?: string;
};

interface SlaSettingsCardProps {
  organizationId: string;
  slaEnabled: boolean;
  slaThresholdMinutes: number;
  slaAlertTemplate: string;
  slaExcludedTagIds: string[];
  slaAlertWhatsappEnabled: boolean;
  slaAlertPhones: string[];
  slaAlertDestinations: SlaAlertDestination[];
  isOwner: boolean;
}

const DEFAULT_TEMPLATE = `🚨 *ALERTA DE SLA* 🚨
O cliente *{{customer_name}}* está aguardando há *{{wait_time}}* minutos.
Vendedor responsável: *{{agent_name}}*.`;

const destKey = (d: SlaAlertDestination) => `${d.type}:${d.value}`;

const getFunctionErrorMessage = async (error: unknown): Promise<string> => {
  const fallback = error instanceof Error ? error.message : 'Falha ao enviar teste';
  if (typeof error === 'object' && error !== null && 'context' in error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const json = await context.clone().json() as { error?: string; message?: string };
        if (json?.error) return json.error;
        if (json?.message) return json.message;
      } catch { /* noop */ }
      try {
        const text = await context.clone().text();
        if (text) {
          try {
            const parsed = JSON.parse(text) as { error?: string; message?: string };
            if (parsed?.error) return parsed.error;
            if (parsed?.message) return parsed.message;
          } catch { return text; }
        }
      } catch { /* noop */ }
    }
  }
  return fallback;
};

export function SlaSettingsCard({
  organizationId,
  slaEnabled: initialEnabled,
  slaThresholdMinutes: initialThreshold,
  slaAlertTemplate: initialTemplate,
  slaExcludedTagIds: initialExcludedTagIds,
  slaAlertWhatsappEnabled: initialWhatsappEnabled,
  slaAlertPhones: initialPhones,
  slaAlertDestinations: initialDestinations,
  isOwner,
}: SlaSettingsCardProps) {
  const queryClient = useQueryClient();
  const { data: allTags = [] } = useTags();

  // Derive initial destinations: prefer explicit list, fallback to legacy phones array
  const computedInitialDestinations = useMemo<SlaAlertDestination[]>(() => {
    if (initialDestinations && initialDestinations.length > 0) return initialDestinations;
    return (initialPhones || []).filter(Boolean).map((p) => ({ type: 'phone' as const, value: p, label: p }));
  }, [initialDestinations, initialPhones]);

  const [enabled, setEnabled] = useState(initialEnabled);
  const [threshold, setThreshold] = useState(initialThreshold);
  const [template, setTemplate] = useState(initialTemplate || DEFAULT_TEMPLATE);
  const [excludedTagIds, setExcludedTagIds] = useState<string[]>(initialExcludedTagIds);
  const [whatsappEnabled, setWhatsappEnabled] = useState(!!initialWhatsappEnabled);
  const [destinations, setDestinations] = useState<SlaAlertDestination[]>(computedInitialDestinations);
  const [hasChanges, setHasChanges] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  // Add destination dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<'phone' | 'group'>('phone');
  const [newPhone, setNewPhone] = useState('');
  const [groups, setGroups] = useState<Array<{ id: string; subject: string; size?: number }>>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');

  useEffect(() => {
    const enabledChanged = enabled !== initialEnabled;
    const thresholdChanged = threshold !== initialThreshold;
    const templateChanged = template !== (initialTemplate || DEFAULT_TEMPLATE);
    const tagsChanged = JSON.stringify([...excludedTagIds].sort()) !== JSON.stringify([...initialExcludedTagIds].sort());
    const waChanged = whatsappEnabled !== !!initialWhatsappEnabled;
    const destChanged = JSON.stringify(destinations) !== JSON.stringify(computedInitialDestinations);
    setHasChanges(enabledChanged || thresholdChanged || templateChanged || tagsChanged || waChanged || destChanged);
  }, [enabled, threshold, template, excludedTagIds, whatsappEnabled, destinations, initialEnabled, initialThreshold, initialTemplate, initialExcludedTagIds, initialWhatsappEnabled, computedInitialDestinations]);

  const loadGroups = async () => {
    setGroupsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-list-groups', {
        body: { organization_id: organizationId },
      });
      if (error) throw error;
      setGroups(data?.groups ?? []);
    } catch (e) {
      const msg = await getFunctionErrorMessage(e);
      toast.error(msg || 'Não foi possível carregar os grupos');
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  };

  const openAddDialog = () => {
    setAddOpen(true);
    setNewPhone('');
    setGroupSearch('');
    if (addTab === 'group' && groups.length === 0) void loadGroups();
  };

  useEffect(() => {
    if (addOpen && addTab === 'group' && groups.length === 0 && !groupsLoading) {
      void loadGroups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addOpen, addTab]);

  const addDestination = (d: SlaAlertDestination) => {
    const key = destKey(d);
    if (destinations.some((x) => destKey(x) === key)) {
      toast.error('Destino já adicionado');
      return;
    }
    setDestinations((prev) => [...prev, d]);
    setAddOpen(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const phonesCompat = destinations.filter((d) => d.type === 'phone').map((d) => d.value);
      const { error } = await supabase
        .from('organizations')
        .update({
          sla_enabled: enabled,
          sla_threshold_minutes: threshold,
          sla_alert_template: template,
          sla_excluded_tag_ids: excludedTagIds,
          sla_alert_whatsapp_enabled: whatsappEnabled,
          sla_alert_destinations: whatsappEnabled ? destinations : [],
          sla_alert_phones: whatsappEnabled ? phonesCompat : [],
          sla_alert_phone: whatsappEnabled && phonesCompat.length > 0 ? phonesCompat[0] : null,
        } as any)
        .eq('id', organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organization'] });
      toast.success('Configurações de SLA salvas com sucesso!');
      setHasChanges(false);
    },
    onError: (error) => {
      console.error('Error saving SLA settings:', error);
      toast.error('Erro ao salvar configurações');
    },
  });

  const testMutation = useMutation({
    mutationFn: async (dest: SlaAlertDestination) => {
      const { error } = await supabase.functions.invoke('send-sla-test-alert', {
        body: {
          organization_id: organizationId,
          destination: { type: dest.type, value: dest.value },
          message: template
            .replace(/\{\{customer_name\}\}/g, 'Cliente Teste')
            .replace(/\{\{agent_name\}\}/g, 'Vendedor Teste')
            .replace(/\{\{wait_time\}\}/g, String(threshold)),
        },
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success('Alerta de teste enviado!'),
    onError: async (e) => toast.error(await getFunctionErrorMessage(e)),
  });

  const handleSave = () => {
    if (threshold < 1) { toast.error('O tempo limite deve ser pelo menos 1 minuto'); return; }
    if (threshold > 1440) { toast.error('O tempo limite não pode exceder 24 horas (1440 minutos)'); return; }
    saveMutation.mutate();
  };

  const toggleExcludedTag = (tagId: string) => {
    setExcludedTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
  };

  const availableVariables = [
    { name: '{{customer_name}}', description: 'Nome do cliente' },
    { name: '{{agent_name}}', description: 'Nome do vendedor responsável' },
    { name: '{{wait_time}}', description: 'Tempo de espera em minutos' },
  ];

  const excludedTags = allTags.filter(t => excludedTagIds.includes(t.id));
  const availableTagsForSelection = allTags.filter(t => !excludedTagIds.includes(t.id));

  const filteredGroups = groups.filter((g) =>
    g.subject.toLowerCase().includes(groupSearch.toLowerCase())
  );

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Monitoramento de Qualidade (SLA)
            </CardTitle>
            <CardDescription>
              Configure alertas automáticos para atrasos no atendimento
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!isOwner} />
            <Badge variant={enabled ? 'default' : 'secondary'} className={enabled ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : ''}>
              {enabled ? 'Ativo' : 'Desativado'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Clock className="w-4 h-4" />Tempo Máximo de Espera (minutos)</Label>
          <Input type="number" min={1} max={1440} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} disabled={!isOwner} className="max-w-[200px]" />
          <p className="text-xs text-muted-foreground">
            Alerta será disparado quando o cliente aguardar mais que este tempo sem resposta.
            Este é o valor <strong>padrão</strong>: cada etapa do funil pode definir seu próprio tempo no editor de etapas, e o cronômetro é zerado sempre que o contato muda de etapa.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Tag className="w-4 h-4" />Tags Excluídas da Análise</Label>
          <p className="text-xs text-muted-foreground">Contatos com essas tags não serão monitorados pelo SLA.</p>
          <div className="flex flex-wrap gap-2 min-h-[32px]">
            {excludedTags.map(tag => (
              <Badge key={tag.id} variant="secondary" className="flex items-center gap-1 pr-1" style={{ borderColor: tag.color, borderWidth: 1 }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
                {isOwner && (
                  <button onClick={() => toggleExcludedTag(tag.id)} className="ml-1 rounded-full p-0.5 hover:bg-muted">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            ))}
            {isOwner && (
              <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Tag className="w-3 h-3" />Adicionar tag</Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[220px]" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar tag..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
                      <CommandGroup>
                        {availableTagsForSelection.map(tag => (
                          <CommandItem key={tag.id} onSelect={() => { toggleExcludedTag(tag.id); setTagPopoverOpen(false); }}>
                            <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* WhatsApp destinations */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="flex items-center gap-2"><MessageSquare className="w-4 h-4" />Enviar alerta também para o WhatsApp</Label>
              <p className="text-xs text-muted-foreground mt-1">Quando desativado, alertas aparecem apenas no painel do CRM.</p>
            </div>
            <Switch checked={whatsappEnabled} onCheckedChange={setWhatsappEnabled} disabled={!isOwner} />
          </div>
          {whatsappEnabled && (
            <div className="space-y-2">
              <div className="flex flex-col gap-2">
                {destinations.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum destino cadastrado.</p>
                )}
                {destinations.map((d, idx) => (
                  <div key={destKey(d) + idx} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {d.type === 'group' ? <Users className="w-4 h-4 text-emerald-500 shrink-0" /> : <Phone className="w-4 h-4 text-blue-500 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.label || d.value}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {d.type === 'group' ? 'Grupo do WhatsApp' : 'Número pessoal'} · {d.value}
                        </p>
                      </div>
                    </div>
                    {isOwner && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          title="Enviar teste"
                          onClick={() => testMutation.mutate(d)}
                          disabled={testMutation.isPending}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setDestinations(prev => prev.filter((_, i) => i !== idx))}
                          aria-label="Remover destino"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {isOwner && (
                <Button type="button" variant="outline" size="sm" onClick={openAddDialog} className="gap-1">
                  <Plus className="w-3.5 h-3.5" />Adicionar destino
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Todos os destinos (números pessoais e grupos) cadastrados receberão os alertas de SLA.
              </p>
            </div>
          )}
        </div>

        {/* Template */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2"><FileText className="w-4 h-4" />Modelo da Mensagem de Alerta</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6"><Info className="w-4 h-4 text-muted-foreground" /></Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="font-medium mb-2">Variáveis disponíveis:</p>
                <ul className="space-y-1 text-sm">
                  {availableVariables.map((v) => (
                    <li key={v.name}>
                      <code className="bg-muted px-1 rounded">{v.name}</code>
                      <span className="text-muted-foreground ml-1">- {v.description}</span>
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </div>
          <Textarea value={template} onChange={(e) => setTemplate(e.target.value)} disabled={!isOwner} rows={5} placeholder="Digite o modelo da mensagem..." className="font-mono text-sm" />
          <div className="flex flex-wrap gap-2">
            {availableVariables.map((v) => (
              <Badge key={v.name} variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80" onClick={() => { if (isOwner) setTemplate((prev) => prev + ' ' + v.name); }}>
                {v.name}
              </Badge>
            ))}
          </div>
        </div>

        {isOwner && (
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Configurações
            </Button>
          </div>
        )}
        {!isOwner && (
          <p className="text-sm text-muted-foreground text-center py-2">Apenas o proprietário pode alterar estas configurações.</p>
        )}
      </CardContent>

      {/* Add destination dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar destino do alerta</DialogTitle>
            <DialogDescription>Envie o alerta para um número pessoal ou para um grupo do WhatsApp.</DialogDescription>
          </DialogHeader>
          <Tabs value={addTab} onValueChange={(v) => setAddTab(v as 'phone' | 'group')} className="w-full min-w-0">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="phone" className="gap-1"><Phone className="w-3.5 h-3.5" />Número</TabsTrigger>
              <TabsTrigger value="group" className="gap-1"><Users className="w-3.5 h-3.5" />Grupo</TabsTrigger>
            </TabsList>
            <TabsContent value="phone" className="space-y-3 pt-3">
              <Input
                type="tel"
                placeholder="55 11 99999-9999"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Digite o número com DDD. O código do país (55) é adicionado automaticamente se faltar.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
                <Button
                  onClick={() => {
                    const v = newPhone.trim();
                    if (!v) return;
                    addDestination({ type: 'phone', value: v, label: v });
                  }}
                >
                  Adicionar número
                </Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="group" className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <Input
                  placeholder="Buscar grupo..."
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                />
                <Button variant="ghost" size="sm" onClick={loadGroups} disabled={groupsLoading} className="ml-2">
                  {groupsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Atualizar'}
                </Button>
              </div>
              <div className="border rounded-md max-h-72 overflow-y-auto overflow-x-hidden w-full divide-y">
                {groupsLoading && (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />Carregando grupos...
                  </div>
                )}
                {!groupsLoading && filteredGroups.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum grupo encontrado.
                  </div>
                )}
                {!groupsLoading && filteredGroups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => addDestination({ type: 'group', value: g.id, label: g.subject })}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2"
                  >
                    <Users className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{g.subject}</p>
                      <p className="text-xs text-muted-foreground truncate">{g.id}{g.size ? ` · ${g.size} membros` : ''}</p>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Os grupos são carregados do WhatsApp conectado a esta organização.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
