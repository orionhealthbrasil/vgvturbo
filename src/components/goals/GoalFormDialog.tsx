import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useCreateGoal, useUpdateGoal } from '@/hooks/useGoals';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import {
  GOAL_PERIOD_LABELS,
  GOAL_SCOPE_LABELS,
  GOAL_TYPE_LABELS,
  type Goal,
  type GoalPeriodType,
  type GoalScope,
  type GoalType,
} from '@/types/goals';
import { GoalParticipantsList } from './GoalParticipantsList';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  format,
} from 'date-fns';

interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: Goal | null;
}

function periodToDates(type: GoalPeriodType): { start: string; end: string } | null {
  const now = new Date();
  switch (type) {
    case 'daily':
      return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
    case 'weekly':
      return {
        start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    case 'monthly':
      return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
    case 'quarterly':
      return { start: format(startOfQuarter(now), 'yyyy-MM-dd'), end: format(endOfQuarter(now), 'yyyy-MM-dd') };
    case 'yearly':
      return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(endOfYear(now), 'yyyy-MM-dd') };
    default:
      return null;
  }
}

export function GoalFormDialog({ open, onOpenChange, goal }: GoalFormDialogProps) {
  const isEdit = !!goal;
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  const { data: pipelines = [] } = useQuery({
    queryKey: ['kanban-pipelines-list', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('kanban_pipelines')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('revenue');
  const [scope, setScope] = useState<GoalScope>('team');
  const [target, setTarget] = useState('');
  const [periodType, setPeriodType] = useState<GoalPeriodType>('monthly');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [pipelineId, setPipelineId] = useState<string>('all');
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      if (goal) {
        setTitle(goal.title);
        setDescription(goal.description ?? '');
        setGoalType(goal.goal_type);
        setScope(goal.scope);
        setTarget(String(goal.target_value));
        setPeriodType(goal.period_type);
        setPeriodStart(goal.period_start);
        setPeriodEnd(goal.period_end);
        setPipelineId(goal.pipeline_id ?? 'all');
        setParticipantIds((goal.participants ?? []).map((p) => p.user_id));
      } else {
        setTitle('');
        setDescription('');
        setGoalType('revenue');
        setScope('team');
        setTarget('');
        setPeriodType('monthly');
        const r = periodToDates('monthly');
        setPeriodStart(r?.start ?? '');
        setPeriodEnd(r?.end ?? '');
        setPipelineId('all');
        setParticipantIds([]);
      }
    }
  }, [open, goal]);

  useEffect(() => {
    if (periodType !== 'custom') {
      const r = periodToDates(periodType);
      if (r) {
        setPeriodStart(r.start);
        setPeriodEnd(r.end);
      }
    }
  }, [periodType]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Defina um título para a meta');
      return;
    }
    const targetNum = Number(target.replace(',', '.'));
    if (isNaN(targetNum) || targetNum <= 0) {
      toast.error('Valor-alvo inválido');
      return;
    }
    if (!periodStart || !periodEnd) {
      toast.error('Defina o período');
      return;
    }
    if (periodEnd < periodStart) {
      toast.error('Data final anterior à inicial');
      return;
    }
    if (scope !== 'team' && participantIds.length === 0) {
      toast.error('Selecione ao menos 1 participante');
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      goal_type: goalType,
      scope,
      target_value: targetNum,
      period_type: periodType,
      period_start: periodStart,
      period_end: periodEnd,
      pipeline_id: pipelineId === 'all' ? null : pipelineId,
      participant_user_ids: scope === 'team' ? [] : participantIds,
    };

    try {
      if (isEdit && goal) {
        await updateGoal.mutateAsync({ id: goal.id, ...payload });
        toast.success('Meta atualizada');
      } else {
        await createGoal.mutateAsync(payload);
        toast.success('Meta criada');
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar meta');
    }
  };

  const isPending = createGoal.isPending || updateGoal.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar meta' : 'Nova meta'}</DialogTitle>
          <DialogDescription>
            Defina objetivos para sua equipe e acompanhe o progresso em tempo real.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="goal-title">Título</Label>
            <Input
              id="goal-title"
              placeholder="Ex.: Faturamento Janeiro 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-desc">Descrição (opcional)</Label>
            <Textarea
              id="goal-desc"
              rows={2}
              placeholder="Contexto, premissas, observações..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={goalType} onValueChange={(v) => setGoalType(v as GoalType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(GOAL_TYPE_LABELS) as GoalType[]).map((t) => (
                    <SelectItem key={t} value={t}>{GOAL_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor-alvo</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder={goalType === 'revenue' ? '50000' : goalType === 'conversion_rate' ? '40' : '20'}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Escopo</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as GoalScope)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(GOAL_SCOPE_LABELS) as GoalScope[]).map((s) => (
                    <SelectItem key={s} value={s}>{GOAL_SCOPE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={periodType} onValueChange={(v) => setPeriodType(v as GoalPeriodType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(GOAL_PERIOD_LABELS) as GoalPeriodType[]).map((p) => (
                    <SelectItem key={p} value={p}>{GOAL_PERIOD_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                disabled={periodType !== 'custom'}
              />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                disabled={periodType !== 'custom'}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Pipeline (opcional)</Label>
            <Select value={pipelineId} onValueChange={setPipelineId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os pipelines</SelectItem>
                {pipelines.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {scope !== 'team' && (
            <div className="space-y-2">
              <Label>Participantes</Label>
              <GoalParticipantsList
                selectedUserIds={participantIds}
                onChange={setParticipantIds}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? 'Salvar' : 'Criar meta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
