import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, GripVertical, Pencil, Trash2, Trophy, XCircle, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { toast } from 'sonner';
import {
  useFunnelStages,
  useCreateFunnelStage,
  useUpdateFunnelStage,
  useDeleteFunnelStage,
  useReorderFunnelStages,
  FunnelStage,
  FunnelStageType,
} from '@/hooks/useFunnelStages';
import { useUserOrganization } from '@/hooks/useOrganization';

import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const STAGE_TYPE_META: Record<FunnelStageType, { label: string; icon: any; color: string }> = {
  in_progress: { label: 'Em andamento', icon: null, color: 'text-muted-foreground' },
  won: { label: 'Ganho', icon: Trophy, color: 'text-emerald-600 dark:text-emerald-400' },
  lost: { label: 'Perda', icon: XCircle, color: 'text-rose-600 dark:text-rose-400' },
};

interface StagesEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string | null;
  pipelineName?: string | null;
}

export function StagesEditorSheet({ open, onOpenChange, pipelineId, pipelineName }: StagesEditorSheetProps) {
  const { data: stages = [], isLoading } = useFunnelStages(pipelineId);
  const createStage = useCreateFunnelStage();
  const updateStage = useUpdateFunnelStage();
  const deleteStage = useDeleteFunnelStage();
  const reorderStages = useReorderFunnelStages();
  const { data: orgData } = useUserOrganization();
  const orgSlaDefault = (orgData?.organization as any)?.sla_threshold_minutes as number | null | undefined;
  

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortedStages = [...stages].sort((a, b) => a.position - b.position);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<FunnelStage | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FunnelStage | null>(null);

  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#6366f1');
  const [formCtaText, setFormCtaText] = useState('');
  const [formStageType, setFormStageType] = useState<FunnelStageType>('in_progress');
  const [formSlaMinutes, setFormSlaMinutes] = useState<string>('');

  const resetForm = () => {
    setFormName('');
    setFormColor('#6366f1');
    setFormCtaText('');
    setFormStageType('in_progress');
    setFormSlaMinutes('');
  };

  const openAdd = () => {
    resetForm();
    setEditingStage(null);
    setFormOpen(true);
  };

  const openEdit = (stage: FunnelStage) => {
    setFormName(stage.name);
    setFormColor(stage.color);
    setFormCtaText(stage.cta_text || '');
    setFormStageType(stage.stage_type || 'in_progress');
    setFormSlaMinutes(
      stage.sla_threshold_minutes != null ? String(stage.sla_threshold_minutes) : '',
    );
    setEditingStage(stage);
    setFormOpen(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedStages.findIndex((s) => s.id === active.id);
    const newIndex = sortedStages.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sortedStages, oldIndex, newIndex);
    const updates = reordered.map((stage, index) => ({ id: stage.id, position: index }));

    try {
      await reorderStages.mutateAsync(updates);
      toast.success('Ordem atualizada');
    } catch {
      toast.error('Erro ao reordenar etapas');
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Nome da etapa é obrigatório');
      return;
    }

    try {
      const parsedSla = formSlaMinutes.trim() === '' ? null : Math.max(1, parseInt(formSlaMinutes, 10));
      if (formSlaMinutes.trim() !== '' && (!Number.isFinite(parsedSla as number) || (parsedSla as number) < 1)) {
        toast.error('Tempo de SLA inválido');
        return;
      }

      if (editingStage) {
        await updateStage.mutateAsync({
          id: editingStage.id,
          name: formName.trim(),
          color: formColor,
          cta_text: formCtaText.trim() || null,
          stage_type: formStageType,
          is_final: formStageType !== 'in_progress',
          sla_threshold_minutes: parsedSla,
        } as any);
        toast.success('Etapa atualizada');
      } else {
        const baseSlug = generateSlug(formName) || `stage_${Date.now()}`;
        const existingSlugs = new Set(stages.map((s) => s.slug));
        let slug = baseSlug;
        if (existingSlugs.has(slug)) {
          slug = `${baseSlug}_${Date.now()}`;
        }
        const nextPosition = stages.length
          ? Math.max(...stages.map((s) => s.position ?? 0)) + 1
          : 0;

        await createStage.mutateAsync({
          name: formName.trim(),
          slug,
          color: formColor,
          cta_text: formCtaText.trim() || null,
          position: nextPosition,
          is_final: formStageType !== 'in_progress',
          stage_type: formStageType,
          pipeline_id: pipelineId!,
          sla_threshold_minutes: parsedSla,
        } as any);
        toast.success('Etapa criada');
      }
      setFormOpen(false);
      setEditingStage(null);
      resetForm();
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('funnel_stages_organization_id_slug_key')) {
        toast.error('Já existe uma etapa com esse identificador. Tente outro nome.');
      } else if (msg.includes('funnel_stages_organization_id_position_key')) {
        toast.error('Conflito de posição. Recarregue a página e tente novamente.');
      } else if (msg.includes('duplicate key')) {
        toast.error('Já existe uma etapa com esse nome');
      } else {
        toast.error('Erro ao salvar etapa');
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteStage.mutateAsync(deleteConfirm.id);
      toast.success('Etapa removida');
      setDeleteConfirm(null);
    } catch {
      toast.error('Erro ao remover etapa');
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Configurar Funil{pipelineName ? ` — ${pipelineName}` : ''}
            </SheetTitle>
            <SheetDescription>
              Reordene arrastando. Defina o tipo: <strong>Em andamento</strong>,{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">Ganho</strong> ou{' '}
              <strong className="text-rose-600 dark:text-rose-400">Perda</strong>. Etapas de
              Ganho/Perda marcam o resultado automaticamente quando o cartão entra nelas.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4">
            <Button onClick={openAdd} size="sm" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Nova etapa
            </Button>
          </div>

          <div className="mt-6">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : sortedStages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Plus className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Nenhuma etapa configurada
                </p>
                <p className="text-xs text-muted-foreground max-w-[240px]">
                  Clique em "Nova etapa" acima para criar as etapas deste funil.
                  Comece com ao menos uma etapa de entrada (ex: Triagem).
                </p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={sortedStages.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {sortedStages.map((stage) => (
                      <SortableRow
                        key={stage.id}
                        stage={stage}
                        onEdit={openEdit}
                        onDelete={setDeleteConfirm}
                        canDelete={sortedStages.length > 1}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Form Dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          if (!o) {
            setFormOpen(false);
            setEditingStage(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStage ? 'Editar etapa' : 'Nova etapa'}</DialogTitle>
            <DialogDescription>Configure os detalhes da etapa do funil.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="stage-name">Nome *</Label>
              <Input
                id="stage-name"
                placeholder="Ex.: Qualificação, Cliente, Perdido..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo da etapa</Label>
              <Select value={formStageType} onValueChange={(v) => setFormStageType(v as FunnelStageType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="won">
                    <span className="inline-flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Ganho (marca venda concluída)
                    </span>
                  </SelectItem>
                  <SelectItem value="lost">
                    <span className="inline-flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      Perda (pede motivo)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ao mover um lead para etapas de Ganho ou Perda, o sistema marca o resultado e
                fecha o atendimento automaticamente.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Cor ${color}`}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-all',
                      formColor === color
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:scale-105',
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormColor(color)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage-cta">Texto do botão (CTA)</Label>
              <Input
                id="stage-cta"
                placeholder="Ex.: Orçamento Enviado, Proposta Aceita..."
                value={formCtaText}
                onChange={(e) => setFormCtaText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Texto do botão para avançar até esta etapa no chat. Deixe em branco se for a entrada.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage-sla">Tempo de alerta SLA (minutos)</Label>
              <Input
                id="stage-sla"
                type="number"
                min={1}
                placeholder={
                  orgSlaDefault
                    ? `Padrão da organização: ${orgSlaDefault} min`
                    : 'Usa o padrão da organização'
                }
                value={formSlaMinutes}
                onChange={(e) => setFormSlaMinutes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Tempo (em minutos úteis) para disparar o alerta de SLA enquanto o contato
                estiver nesta etapa. Deixe em branco para usar o padrão da organização.
                O cronômetro é zerado sempre que o contato muda de etapa.
              </p>
            </div>
          </div>


          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFormOpen(false);
                setEditingStage(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={createStage.isPending || updateStage.isPending}>
              {(createStage.isPending || updateStage.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingStage ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover etapa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a etapa "{deleteConfirm?.name}"? Contatos nela ficarão
              sem etapa definida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SortableRow({
  stage,
  onEdit,
  onDelete,
  canDelete,
}: {
  stage: FunnelStage;
  onEdit: (s: FunnelStage) => void;
  onDelete: (s: FunnelStage) => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const meta = STAGE_TYPE_META[stage.stage_type || 'in_progress'];
  const Icon = meta.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-background group',
        isDragging && 'opacity-50 shadow-lg z-50',
      )}
      {...attributes}
    >
      <button
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground"
        aria-label="Arrastar"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{stage.name}</span>
          {Icon && (
            <Badge variant="outline" className={cn('text-[10px] gap-1 h-5', meta.color)}>
              <Icon className="w-3 h-3" />
              {meta.label}
            </Badge>
          )}
        </div>
        {stage.cta_text && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">CTA: "{stage.cta_text}"</p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(stage)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(stage)}
          disabled={!canDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
