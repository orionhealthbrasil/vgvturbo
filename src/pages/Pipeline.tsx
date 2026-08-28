import { useEffect, useMemo, useState } from 'react';
import { normalizeForSearch, digitsOnly } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Loader2, KanbanSquare, Table2, Pencil, ShieldX, GripVertical, Settings2, Trophy, XCircle, Filter as FilterIcon, ChevronDown, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ContactWithColumn } from '@/types/crm';
import {
  usePipelineContacts,
  triggerFunnelStageAutomation,
  triggerDealResultAutomation,
} from '@/hooks/usePipeline';
import { useCanAccess, useUserPermissions } from '@/hooks/usePermissions';
import { useFunnelStages, FunnelStage } from '@/hooks/useFunnelStages';
import {
  useKanbanPipelines,
  useCreatePipeline,
  useUpdatePipeline,
  useDeletePipeline,
  useSetDefaultPipeline,
  useUserDefaultPipelinePreference,
  useSetUserDefaultPipelinePreference,
} from '@/hooks/useKanbanPipelines';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useUserOrganization } from '@/hooks/useOrganization';
import { useUpdateContact } from '@/hooks/useCRM';
import { PipelineDealDialog } from '@/components/pipeline/PipelineDealDialog';
import { PipelineFiltersBar } from '@/components/pipeline/PipelineFiltersBar';
import { SavedViewsMenu } from '@/components/pipeline/SavedViewsMenu';
import { StagesEditorSheet } from '@/components/pipeline/StagesEditorSheet';
import { SaleOutcomeReasonDialog } from '@/components/pipeline/SaleOutcomeReasonDialog';
import { NewPipelineContactDialog } from '@/components/pipeline/NewPipelineContactDialog';
import {
  PipelineFilters,
  defaultPipelineFilters,
  usePipelineSavedViews,
} from '@/hooks/usePipelineSavedViews';
import { cn } from '@/lib/utils';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCorners,
} from '@dnd-kit/core';
import { triggerConfetti } from '@/lib/confetti';
import { toast } from 'sonner';

const formatBRL = (n: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0);

const LS_KEY = 'pipeline:lastFilters';

function periodToRange(filters: PipelineFilters): { from: Date | null; to: Date | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (filters.period) {
    case '7d':
      return { from: new Date(today.getTime() - 6 * 86400000), to: null };
    case '30d':
      return { from: new Date(today.getTime() - 29 * 86400000), to: null };
    case '90d':
      return { from: new Date(today.getTime() - 89 * 86400000), to: null };
    case 'custom':
      return {
        from: filters.date_from ? new Date(filters.date_from + 'T00:00:00') : null,
        to: filters.date_to ? new Date(filters.date_to + 'T23:59:59') : null,
      };
    case 'all':
    default:
      return { from: null, to: null };
  }
}

const ACTIVE_PIPELINE_LS = 'pipeline:activePipelineId';

export default function Pipeline() {
  const navigate = useNavigate();
  const { data: orgData } = useUserOrganization();
  const role = orgData?.membership.role;
  const canManageAccess = role === 'owner' || role === 'admin';

  const { canView } = useCanAccess('pipeline');
  const { canEdit: canEditDeals } = useCanAccess('pipeline_edit');
  const { isLoading: checkingAccess } = useUserPermissions();
  const { data: pipelines = [] } = useKanbanPipelines();
  const { data: userDefaultPref } = useUserDefaultPipelinePreference();
  const setUserDefaultPref = useSetUserDefaultPipelinePreference();

  // Active pipeline selection (persisted via user preference + localStorage fallback)
  const [activePipelineId, setActivePipelineId] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_PIPELINE_LS); } catch { return null; }
  });

  // When pipelines + user preference load, resolve the active pipeline
  useEffect(() => {
    if (!pipelines.length) return;

    // Priority: 1) user preference from DB, 2) localStorage, 3) org default, 4) first pipeline
    const preferredFromDb = userDefaultPref;
    const fromLocal = activePipelineId;

    let nextId: string | null = null;
    if (preferredFromDb && pipelines.some((p) => p.id === preferredFromDb)) {
      nextId = preferredFromDb;
    } else if (fromLocal && pipelines.some((p) => p.id === fromLocal)) {
      nextId = fromLocal;
    } else {
      nextId = pipelines.find((p) => p.is_default)?.id ?? pipelines[0].id;
    }

    if (nextId && nextId !== activePipelineId) {
      setActivePipelineId(nextId);
    }
  }, [pipelines, userDefaultPref]);

  // Persist to localStorage and sync user preference when active changes
  useEffect(() => {
    if (!activePipelineId) return;
    try { localStorage.setItem(ACTIVE_PIPELINE_LS, activePipelineId); } catch { /* ignore */ }
  }, [activePipelineId]);

  // Helper to change active pipeline and persist preference
  const handleSetActivePipeline = (id: string) => {
    setActivePipelineId(id);
    // Always persist as user preference so next visit opens this funnel
    setUserDefaultPref.mutate(id);
  };

  const activePipeline = useMemo(
    () => pipelines.find((p) => p.id === activePipelineId) ?? null,
    [pipelines, activePipelineId]
  );

  const { data: contacts = [], isLoading } = usePipelineContacts(activePipelineId);
  const { data: stages = [] } = useFunnelStages(activePipelineId);
  const { data: savedViews = [] } = usePipelineSavedViews();

  const [filters, setFilters] = useState<PipelineFilters>(defaultPipelineFilters);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ContactWithColumn | null>(null);
  const [stagesEditorOpen, setStagesEditorOpen] = useState(false);
  const [didInitFromViews, setDidInitFromViews] = useState(false);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [newContactStageSlug, setNewContactStageSlug] = useState<string | null>(null);

  const openNewContact = (stageSlug: string | null = null) => {
    setNewContactStageSlug(stageSlug);
    setNewContactOpen(true);
  };

  // Pipeline CRUD dialogs
  const [pipelineDialog, setPipelineDialog] = useState<{ mode: 'create' | 'rename'; id?: string; name: string; description: string } | null>(null);
  const [pipelineDelete, setPipelineDelete] = useState<string | null>(null);
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const deletePipeline = useDeletePipeline();
  const setDefaultPipeline = useSetDefaultPipeline();

  // On first views load, apply default view OR localStorage fallback
  useEffect(() => {
    if (didInitFromViews) return;
    if (savedViews.length === 0 && !localStorage.getItem(LS_KEY)) {
      setDidInitFromViews(true);
      return;
    }
    const def = savedViews.find((v) => v.is_default);
    if (def) {
      setFilters({ ...defaultPipelineFilters, ...def.filters });
      setActiveViewId(def.id);
    } else {
      try {
        const saved = localStorage.getItem(LS_KEY);
        if (saved) setFilters({ ...defaultPipelineFilters, ...JSON.parse(saved) });
      } catch {
        /* ignore */
      }
    }
    setDidInitFromViews(true);
  }, [savedViews, didInitFromViews]);

  // Persist last filters to localStorage
  useEffect(() => {
    if (!didInitFromViews) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(filters));
    } catch {
      /* ignore */
    }
  }, [filters, didInitFromViews]);

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages]
  );

  const stageOptions = useMemo(
    () => sortedStages.map((s) => ({ slug: s.slug, name: s.name, color: s.color })),
    [sortedStages]
  );

  const filtered = useMemo(() => {
    const term = normalizeForSearch(filters.search.trim());
    const termDigits = digitsOnly(filters.search.trim());
    const { from, to } = periodToRange(filters);
    return contacts.filter((c) => {
      // search: accent-insensitive name + flexible phone format
      if (term) {
        const phoneDigits = digitsOnly(c.phone || '');
        const hit =
          normalizeForSearch(c.name).includes(term) ||
          normalizeForSearch(c.email || '').includes(term) ||
          normalizeForSearch(c.phone || '').includes(term) ||
          (termDigits.length >= 4 && phoneDigits.includes(termDigits));
        if (!hit) return false;
      }
      // status
      if (filters.status === 'open' && c.status !== 'open') return false;
      if (filters.status === 'won' && c.sale_result !== 'won') return false;
      if (filters.status === 'lost' && c.sale_result !== 'lost') return false;
      // stages
      if (filters.stages.length > 0 && !filters.stages.includes(c.funnel_stage || 'lead')) return false;
      // period (uses updated_at as activity proxy; closed → closed_at)
      if (from || to) {
        const ref = new Date(c.updated_at || c.created_at || 0);
        if (from && ref < from) return false;
        if (to && ref > to) return false;
      }
      return true;
    });
  }, [contacts, filters, activePipelineId]);

  const openContacts = useMemo(() => filtered.filter((c) => c.status === 'open'), [filtered]);
  const openTotal = useMemo(
    () => openContacts.reduce((acc, c) => acc + Number(c.deal_value || 0), 0),
    [openContacts]
  );
  const wonTotal = useMemo(
    () =>
      filtered
        .filter((c) => c.sale_result === 'won')
        .reduce((acc, c) => acc + Number(c.deal_value || 0), 0),
    [filtered]
  );

  const contactsByStage = useMemo(() => {
    const map = new Map<string, ContactWithColumn[]>();
    for (const stage of sortedStages) map.set(stage.slug, []);
    for (const c of filtered) {
      const slug = c.funnel_stage || 'lead';
      if (!map.has(slug)) map.set(slug, []);
      map.get(slug)!.push(c);
    }
    return map;
  }, [filtered, sortedStages]);

  if (checkingAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <ShieldX className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Funil restrito</h2>
        <p className="text-muted-foreground max-w-md">
          Você não tem permissão para ver o Funil. Peça a um administrador da organização para liberar
          seu acesso em Configurações &gt; Permissões.
        </p>
      </div>
    );
  }

  return (
    <div className="container max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <FilterIcon className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
              {activePipeline?.name || 'Funil'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Visão completa dos negócios em andamento, com valor potencial e motivos de fechamento.
            </p>
          </div>

          {/* Pipeline switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-2">
                Trocar funil
                <ChevronDown className="w-4 h-4 ml-1.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[260px]">
              <DropdownMenuLabel>Funis disponíveis</DropdownMenuLabel>
                {pipelines.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => handleSetActivePipeline(p.id)}
                    className={cn('cursor-pointer flex items-center gap-2', p.id === activePipelineId && 'bg-accent font-medium')}
                >
                  <FilterIcon className="w-3.5 h-3.5 opacity-70" />
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.is_default && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                </DropdownMenuItem>
              ))}
              {canManageAccess && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setPipelineDialog({ mode: 'create', name: '', description: '' })}
                    className="cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 mr-2" /> Criar novo funil
                  </DropdownMenuItem>
                  {activePipeline && (
                    <>
                      <DropdownMenuItem
                        onClick={() =>
                          setPipelineDialog({
                            mode: 'rename',
                            id: activePipeline.id,
                            name: activePipeline.name,
                            description: activePipeline.description ?? '',
                          })
                        }
                        className="cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5 mr-2" /> Renomear funil atual
                      </DropdownMenuItem>
                      {!activePipeline.is_default && (
                        <DropdownMenuItem
                          onClick={() => setDefaultPipeline.mutate(activePipeline.id, {
                            onSuccess: () => toast.success('Funil padrão atualizado'),
                            onError: (e: any) => toast.error(e?.message || 'Erro'),
                          })}
                          className="cursor-pointer"
                        >
                          <Star className="w-3.5 h-3.5 mr-2" /> Definir como padrão
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setPipelineDelete(activePipeline.id)}
                        className="cursor-pointer text-destructive focus:text-destructive"
                        disabled={pipelines.length <= 1}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir funil
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEditDeals && (
            <Button
              size="sm"
              onClick={() => openNewContact(null)}
              disabled={!activePipelineId || sortedStages.length === 0}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo contato
            </Button>
          )}
          {canManageAccess && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStagesEditorOpen(true)}
                disabled={!activePipelineId}
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Configurar Funil
              </Button>
            </>
          )}

          <SavedViewsMenu
            views={savedViews}
            currentFilters={filters}
            activeViewId={activeViewId}
            onApply={(f, id) => {
              setFilters({ ...defaultPipelineFilters, ...f });
              setActiveViewId(id);
            }}
          />
          <ToggleGroup
            type="single"
            value={filters.view}
            onValueChange={(v) => v && setFilters({ ...filters, view: v as PipelineFilters['view'] })}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="kanban" aria-label="Visão Kanban">
              <KanbanSquare className="w-4 h-4 mr-1.5" />
              Kanban
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Visão Tabela">
              <Table2 className="w-4 h-4 mr-1.5" />
              Tabela
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Potencial em aberto
            </p>
            <p className="text-2xl font-semibold mt-1 text-emerald-600 dark:text-emerald-400">
              {formatBRL(openTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {openContacts.length} negócio{openContacts.length === 1 ? '' : 's'} em andamento
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Ganhos no filtro</p>
            <p className="text-2xl font-semibold mt-1">{formatBRL(wonTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">somatório de vendas concluídas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total exibido</p>
            <p className="text-2xl font-semibold mt-1">{filtered.length}</p>
            <p className="text-xs text-muted-foreground mt-1">contatos no funil</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters bar */}
      <PipelineFiltersBar filters={filters} onChange={setFilters} stages={stageOptions} />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : sortedStages.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <FilterIcon className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Nenhuma etapa do funil configurada
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
              Use o botão <strong>Configurar Funil</strong> no topo para criar as etapas deste funil.
              Comece com uma etapa de entrada (ex: Triagem).
            </p>
          </CardContent>
        </Card>
      ) : filters.view === 'kanban' ? (
        <KanbanView
          stages={sortedStages}
          contactsByStage={contactsByStage}
          onEdit={setEditing}
          onAddContact={(slug) => openNewContact(slug)}
          canEditDeals={canEditDeals}
        />
      ) : (
        <TableView
          contacts={filtered}
          stages={sortedStages}
          onEdit={setEditing}
          onCreateContact={
            canEditDeals && activePipelineId && sortedStages.length > 0 ? () => openNewContact(null) : undefined
          }
          canEditDeals={canEditDeals}
        />
      )}

      <PipelineDealDialog
        contact={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        canEdit={canEditDeals}
      />
      <StagesEditorSheet
        open={stagesEditorOpen}
        onOpenChange={setStagesEditorOpen}
        pipelineId={activePipelineId}
        pipelineName={activePipeline?.name ?? null}
      />
      <NewPipelineContactDialog
        open={newContactOpen}
        onOpenChange={setNewContactOpen}
        pipelineId={activePipelineId}
        initialStageSlug={newContactStageSlug}
      />


      {/* Pipeline create / rename dialog */}
      <Dialog open={!!pipelineDialog} onOpenChange={(o) => !o && setPipelineDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pipelineDialog?.mode === 'create' ? 'Novo funil' : 'Renomear funil'}
            </DialogTitle>
            <DialogDescription>
              {pipelineDialog?.mode === 'create'
                ? 'Será criado com 3 etapas iniciais (Triagem, Negociação, Fechamento).'
                : 'Atualize o nome e a descrição do funil.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={pipelineDialog?.name ?? ''}
                onChange={(e) => setPipelineDialog((p) => p && { ...p, name: e.target.value })}
                placeholder="Ex.: Vendas B2B, Pós-venda, Recuperação..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                value={pipelineDialog?.description ?? ''}
                onChange={(e) => setPipelineDialog((p) => p && { ...p, description: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPipelineDialog(null)}>Cancelar</Button>
            <Button
              disabled={!pipelineDialog?.name?.trim() || createPipeline.isPending || updatePipeline.isPending}
              onClick={async () => {
                if (!pipelineDialog) return;
                try {
                  if (pipelineDialog.mode === 'create') {
                    const created = await createPipeline.mutateAsync({
                      name: pipelineDialog.name,
                      description: pipelineDialog.description,
                    });
                    handleSetActivePipeline(created.id);
                    toast.success('Funil criado');
                  } else if (pipelineDialog.id) {
                    await updatePipeline.mutateAsync({
                      id: pipelineDialog.id,
                      name: pipelineDialog.name.trim(),
                      description: pipelineDialog.description.trim() || null,
                    });
                    toast.success('Funil atualizado');
                  }
                  setPipelineDialog(null);
                } catch (e: any) {
                  toast.error(e?.message || 'Erro ao salvar funil');
                }
              }}
            >
              {(createPipeline.isPending || updatePipeline.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pipeline delete confirm */}
      <AlertDialog open={!!pipelineDelete} onOpenChange={(o) => !o && setPipelineDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funil</AlertDialogTitle>
            <AlertDialogDescription>
              Os contatos deste funil serão movidos para outro funil disponível (preferencialmente o
              padrão), na primeira etapa. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pipelineDelete) return;
                try {
                  const newActive = await deletePipeline.mutateAsync(pipelineDelete);
                  handleSetActivePipeline(newActive);
                  toast.success('Funil excluído');
                } catch (e: any) {
                  toast.error(e?.message || 'Erro ao excluir');
                } finally {
                  setPipelineDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KanbanView({
  stages,
  contactsByStage,
  onEdit,
  onAddContact,
  canEditDeals,
}: {
  stages: FunnelStage[];
  contactsByStage: Map<string, ContactWithColumn[]>;
  onEdit: (c: ContactWithColumn) => void;
  onAddContact?: (stageSlug: string) => void;
  canEditDeals: boolean;
}) {
  const updateContact = useUpdateContact();
  
  const [activeContact, setActiveContact] = useState<ContactWithColumn | null>(null);

  // Pending move awaiting outcome reason (won or lost)
  const [pendingOutcome, setPendingOutcome] = useState<{
    contact: ContactWithColumn;
    targetStage: FunnelStage;
    previousStageName: string | null;
    kind: 'won' | 'lost';
  } | null>(null);
  const [submittingOutcome, setSubmittingOutcome] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const stageBySlug = useMemo(
    () => new Map(stages.map((s) => [s.slug, s])),
    [stages],
  );

  // Build flat lookup for cards being dragged
  const cardLookup = useMemo(() => {
    const m = new Map<string, ContactWithColumn>();
    for (const list of contactsByStage.values()) {
      for (const c of list) m.set(c.id, c);
    }
    return m;
  }, [contactsByStage]);

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveContact(cardLookup.get(id) || null);
  };

  /**
   * Move contact to target stage applying side effects based on stage_type:
   * - won: marks sale_result='won', closed_at=now, status='closed'
   * - lost: marks sale_result='lost', loss_reason, closed_at=now, status='closed'
   * - in_progress (from a final stage): reopens deal (clears sale_result, closed_at, status='open')
   */
  const performMove = async (
    contact: ContactWithColumn,
    targetStage: FunnelStage,
    previousStageName: string | null,
    outcomeReason?: string,
  ) => {
    const updates: any = {
      id: contact.id,
      funnel_stage: targetStage.slug as any,
      pipeline_id: targetStage.pipeline_id,
    };

    const wasFinal = contact.sale_result === 'won' || contact.sale_result === 'lost';

    if (targetStage.stage_type === 'won') {
      updates.sale_result = 'won';
      updates.win_reason = outcomeReason ?? null;
      updates.closed_at = new Date().toISOString();
      updates.status = 'closed';
    } else if (targetStage.stage_type === 'lost') {
      updates.sale_result = 'lost';
      updates.loss_reason = outcomeReason ?? null;
      updates.closed_at = new Date().toISOString();
      updates.status = 'closed';
    } else if (wasFinal) {
      // Reopen deal: moving back from a final stage to in-progress
      updates.sale_result = null;
      updates.closed_at = null;
      updates.status = 'open';
      updates.loss_reason = null;
      updates.win_reason = null;
    } else if (targetStage.auto_close_conversation) {
      // Custom stage configured to close the conversation
      updates.status = 'closed';
      updates.closed_at = new Date().toISOString();
    }

    await updateContact.mutateAsync(updates);

    // Stage exit/entry automations
    triggerFunnelStageAutomation({
      contactId: contact.id,
      organizationId: contact.organization_id,
      newStageName: targetStage.name,
      previousStageName,
      pipelineId: targetStage.pipeline_id ?? contact.pipeline_id ?? null,
    });

    // Deal won/lost automations + UX feedback
    if (targetStage.stage_type === 'won') {
      triggerDealResultAutomation({
        contactId: contact.id,
        organizationId: contact.organization_id,
        result: 'won',
      });
      triggerConfetti();
      toast.success(`🎉 Venda ganha! Movido para "${targetStage.name}"`);
    } else if (targetStage.stage_type === 'lost') {
      triggerDealResultAutomation({
        contactId: contact.id,
        organizationId: contact.organization_id,
        result: 'lost',
      });
      toast.success(`Negócio marcado como perdido em "${targetStage.name}"`);
    } else if (wasFinal) {
      toast.success(`Negócio reaberto em "${targetStage.name}"`);
    } else {
      toast.success(`Movido para "${targetStage.name}"`);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveContact(null);
    const { active, over } = event;
    if (!over) return;

    const contact = cardLookup.get(String(active.id));
    if (!contact) return;

    const targetSlug = String(over.id).replace(/^stage:/, '');
    const targetStage = stageBySlug.get(targetSlug);
    if (!targetStage) return;
    if (contact.funnel_stage === targetStage.slug) return;


    const previousStageName = stageBySlug.get(contact.funnel_stage)?.name || null;

    // Won/Lost stages: ask reason first, then perform move
    if (targetStage.stage_type === 'lost' || targetStage.stage_type === 'won') {
      setPendingOutcome({
        contact,
        targetStage,
        previousStageName,
        kind: targetStage.stage_type === 'won' ? 'won' : 'lost',
      });
      return;
    }

    try {
      await performMove(contact, targetStage, previousStageName);
    } catch (e: any) {
      console.error('[Pipeline] drag move error:', e);
      toast.error(e?.message || 'Erro ao mover negócio');
    }
  };

  const handleConfirmOutcome = async (reason: string) => {
    if (!pendingOutcome) return;
    setSubmittingOutcome(true);
    try {
      await performMove(
        pendingOutcome.contact,
        pendingOutcome.targetStage,
        pendingOutcome.previousStageName,
        reason,
      );
      setPendingOutcome(null);
    } catch (e: any) {
      console.error('[Pipeline] outcome move error:', e);
      toast.error(e?.message || 'Erro ao registrar resultado');
    } finally {
      setSubmittingOutcome(false);
    }
  };

  if (stages.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <FilterIcon className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            Nenhuma etapa do funil configurada
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
            Use o botão <strong>Configurar Funil</strong> no topo para criar as etapas deste funil.
            Comece com uma etapa de entrada (ex: Triagem).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {stages.map((stage) => {
              const list = contactsByStage.get(stage.slug) || [];
              return (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  contacts={list}
                  onEdit={onEdit}
                  onAddContact={canEditDeals && onAddContact ? () => onAddContact(stage.slug) : undefined}
                  canEditDeals={canEditDeals}
                />
              );
            })}
          </div>
        </div>
        <DragOverlay>
          {activeContact ? (
            <KanbanCard contact={activeContact} onEdit={() => {}} dragging canEditDeals={canEditDeals} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <SaleOutcomeReasonDialog
        open={!!pendingOutcome}
        onOpenChange={(o) => !o && !submittingOutcome && setPendingOutcome(null)}
        loading={submittingOutcome}
        onConfirm={handleConfirmOutcome}
        kind={pendingOutcome?.kind ?? 'lost'}
      />
    </>
  );
}

function KanbanColumn({
  stage,
  contacts,
  onEdit,
  onAddContact,
  canEditDeals,
}: {
  stage: FunnelStage;
  contacts: ContactWithColumn[];
  onEdit: (c: ContactWithColumn) => void;
  onAddContact?: () => void;
  canEditDeals: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage.slug}` });
  const stageTotal = contacts.reduce((acc, c) => acc + Number(c.deal_value || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'w-[300px] flex-shrink-0 bg-muted/30 rounded-xl border flex flex-col max-h-[calc(100vh-360px)] transition-colors',
        isOver ? 'border-primary border-2 bg-primary/5' : 'border-border',
      )}
    >
      <div
        className="p-3 border-b border-border rounded-t-xl"
        style={{ backgroundColor: `${stage.color}10` }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <h3 className="font-semibold text-sm truncate">{stage.name}</h3>
            {stage.stage_type === 'won' && (
              <Trophy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            )}
            {stage.stage_type === 'lost' && (
              <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Badge variant="secondary" className="text-xs">
              {contacts.length}
            </Badge>
            {onAddContact && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onAddContact}
                title="Adicionar contato nesta etapa"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{formatBRL(stageTotal)}</p>
      </div>
      <div className="p-2 space-y-2 overflow-y-auto flex-1 min-h-[80px]">
        {contacts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Solte um negócio aqui</p>
        ) : (
          contacts.map((c) => (
            <KanbanCard key={c.id} contact={c} onEdit={onEdit} canEditDeals={canEditDeals} />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  contact,
  onEdit,
  dragging = false,
  canEditDeals,
}: {
  contact: ContactWithColumn;
  onEdit: (c: ContactWithColumn) => void;
  dragging?: boolean;
  canEditDeals: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: contact.id,
    disabled: dragging || !canEditDeals,
  });

  const isWon = contact.sale_result === 'won';
  const isLost = contact.sale_result === 'lost';

  return (
    <div
      ref={dragging ? undefined : setNodeRef}
      className={cn(
        'group bg-card hover:bg-accent/50 rounded-lg border border-border p-3 transition-colors',
        isDragging && !dragging && 'opacity-30',
        dragging && 'shadow-2xl rotate-2 cursor-grabbing',
      )}
    >
      <div className="flex items-start gap-2">
        {!dragging && canEditDeals && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing -ml-1 p-0.5 opacity-50 group-hover:opacity-100 transition-opacity"
            aria-label="Arrastar"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(contact)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm truncate">{contact.name}</p>
            {canEditDeals && (
              <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            )}
          </div>
          {contact.phone && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{contact.phone}</p>
          )}
          <div className="flex items-center justify-between mt-2 gap-2">
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {formatBRL(contact.deal_value)}
            </span>
            {isWon && (
              <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                Ganho
              </Badge>
            )}
            {isLost && (
              <Badge className="text-[10px] bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                Perdido
              </Badge>
            )}
          </div>
          {isLost && contact.loss_reason && (
            <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">
              <span className="font-medium">Motivo:</span> {contact.loss_reason}
            </p>
          )}
        </button>
      </div>
    </div>
  );
}


function TableView({
  contacts,
  stages,
  onEdit,
  onCreateContact,
  canEditDeals,
}: {
  contacts: ContactWithColumn[];
  stages: { slug: string; name: string; color: string }[];
  onEdit: (c: ContactWithColumn) => void;
  onCreateContact?: () => void;
  canEditDeals: boolean;
}) {
  const stageMap = useMemo(() => new Map(stages.map((s) => [s.slug, s])), [stages]);

  if (contacts.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Table2 className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-base font-medium text-foreground mb-1">
            Nenhum contato neste funil ainda
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
            Adicione o primeiro contato para começar a acompanhar negócios aqui, ou ajuste os filtros caso já existam dados.
          </p>
          {onCreateContact && (
            <Button onClick={onCreateContact}>
              <Plus className="w-4 h-4 mr-1.5" />
              Novo contato
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }


  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor potencial</TableHead>
              <TableHead>Motivo da perda</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => {
              const stage = stageMap.get(c.funnel_stage);
              return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => onEdit(c)}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                  </TableCell>
                  <TableCell>
                    {stage ? (
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: `${stage.color}15`,
                          color: stage.color,
                          borderColor: `${stage.color}50`,
                        }}
                      >
                        {stage.name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">{c.funnel_stage}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.sale_result === 'won' ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        Ganho
                      </Badge>
                    ) : c.sale_result === 'lost' ? (
                      <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                        Perdido
                      </Badge>
                    ) : c.status === 'open' ? (
                      <Badge variant="secondary">Em aberto</Badge>
                    ) : (
                      <Badge variant="outline">{c.status}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatBRL(c.deal_value)}
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <span className="text-sm text-muted-foreground line-clamp-2">
                      {c.loss_reason || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {canEditDeals && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(c);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
