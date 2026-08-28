import { useMemo, useState } from 'react';
import { ChevronDown, Loader2, ArrowRightLeft } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useKanbanPipelines } from '@/hooks/useKanbanPipelines';
import { useUpdateContact } from '@/hooks/useCRM';
import { triggerFunnelStageAutomation, triggerDealResultAutomation } from '@/hooks/usePipeline';
import { SaleOutcomeReasonDialog } from '@/components/pipeline/SaleOutcomeReasonDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/crm';

interface Props {
  contact: Contact;
}

export function StageSelectInline({ contact }: Props) {
  const { data: pipelines = [] } = useKanbanPipelines();
  // All stages of the org so we can resolve cross-funnel moves and
  // gracefully fall back when contact.pipeline_id is empty.
  const { data: allStages = [] } = useFunnelStages();
  const update = useUpdateContact();
  const [busy, setBusy] = useState(false);
  const [pendingOutcome, setPendingOutcome] = useState<{
    stage: typeof allStages[number];
    kind: 'won' | 'lost';
  } | null>(null);
  const [submittingOutcome, setSubmittingOutcome] = useState(false);

  const contactPipelineId = contact.pipeline_id
    || pipelines.find((p) => p.is_default)?.id
    || pipelines[0]?.id
    || null;

  const stagesByPipeline = useMemo(() => {
    const map = new Map<string, typeof allStages>();
    for (const s of allStages) {
      const arr = map.get(s.pipeline_id) || [];
      arr.push(s);
      map.set(s.pipeline_id, arr);
    }
    for (const [, arr] of map) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [allStages]);

  const sorted = useMemo(
    () => (contactPipelineId ? stagesByPipeline.get(contactPipelineId) || [] : []),
    [stagesByPipeline, contactPipelineId],
  );
  const current = useMemo(
    () => sorted.find((s) => s.slug === contact.funnel_stage) || sorted[0],
    [sorted, contact.funnel_stage],
  );
  const allowedStages = useMemo(
    () => sorted.filter((s) => s.id !== current?.id),
    [sorted, current],
  );

  const otherPipelines = useMemo(
    () => pipelines.filter((p) => p.id !== contactPipelineId),
    [pipelines, contactPipelineId],
  );

  const moveToStage = async (stage: typeof allStages[number], outcomeReason?: string) => {
    // For won/lost stages, prompt for reason via dialog instead of immediate move
    if (!outcomeReason && (stage.stage_type === 'won' || stage.stage_type === 'lost')) {
      setPendingOutcome({ stage, kind: stage.stage_type === 'won' ? 'won' : 'lost' });
      return;
    }
    setBusy(true);
    try {
      const updates: any = {
        id: contact.id,
        funnel_stage: stage.slug,
        pipeline_id: stage.pipeline_id,
      };
      if (stage.stage_type === 'won') {
        updates.sale_result = 'won';
        updates.win_reason = outcomeReason ?? null;
        updates.status = 'closed';
        updates.closed_at = new Date().toISOString();
      } else if (stage.stage_type === 'lost') {
        updates.sale_result = 'lost';
        updates.loss_reason = outcomeReason ?? null;
        updates.status = 'closed';
        updates.closed_at = new Date().toISOString();
      } else if (stage.auto_close_conversation) {
        updates.status = 'closed';
        updates.closed_at = new Date().toISOString();
      }

      await update.mutateAsync(updates);
      triggerFunnelStageAutomation({
        contactId: contact.id,
        organizationId: contact.organization_id,
        newStageName: stage.name,
        previousStageName: current?.name || null,
        pipelineId: stage.pipeline_id,
        previousPipelineId: contactPipelineId,
      });

      if (stage.stage_type === 'won' || stage.stage_type === 'lost') {
        triggerDealResultAutomation({
          contactId: contact.id,
          organizationId: contact.organization_id,
          result: stage.stage_type,
        });
      }

      const crossFunnel = stage.pipeline_id !== contactPipelineId;
      toast.success(
        crossFunnel
          ? `Movido para "${stage.name}" em outro funil`
          : `Movido para "${stage.name}"`,
      );
    } catch (e: any) {
      console.error('[StageSelectInline] update error:', e);
      toast.error(e?.message || 'Erro ao mudar etapa');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmOutcome = async (reason: string) => {
    if (!pendingOutcome) return;
    setSubmittingOutcome(true);
    try {
      await moveToStage(pendingOutcome.stage, reason);
      setPendingOutcome(null);
    } finally {
      setSubmittingOutcome(false);
    }
  };

  if (sorted.length === 0 || !current) return null;

  const isPending = update.isPending || busy;

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-all hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring w-full justify-between',
        )}
        style={{
          backgroundColor: `${current.color}15`,
          color: current.color,
          borderColor: `${current.color}40`,
        }}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: current.color }}
          />
          <span className="truncate">{current.name}</span>
        </span>
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin opacity-70 shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        {allowedStages.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
            Nenhuma outra etapa disponível.
          </div>
        ) : (
          allowedStages.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onClick={() => moveToStage(s)}
              className="text-xs cursor-pointer gap-2"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
              {s.stage_type === 'won' && (
                <span className="ml-auto text-[10px] text-emerald-600 dark:text-emerald-400">
                  ganho
                </span>
              )}
              {s.stage_type === 'lost' && (
                <span className="ml-auto text-[10px] text-rose-600 dark:text-rose-400">
                  perdido
                </span>
              )}
            </DropdownMenuItem>
          ))
        )}

        {otherPipelines.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs gap-2">
                <ArrowRightLeft className="w-3 h-3" />
                Mover para outro funil
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[220px] max-h-[320px] overflow-y-auto">
                {otherPipelines.map((p) => {
                  const stages = stagesByPipeline.get(p.id) || [];
                  return (
                    <DropdownMenuSub key={p.id}>
                      <DropdownMenuSubTrigger className="text-xs">
                        {p.name}
                        {p.is_default && (
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            padrão
                          </span>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="min-w-[200px]">
                        {stages.length === 0 ? (
                          <div className="px-2 py-2 text-xs text-muted-foreground">
                            Funil vazio
                          </div>
                        ) : (
                          stages.map((s) => (
                            <DropdownMenuItem
                              key={s.id}
                              onClick={() => moveToStage(s)}
                              className="text-xs cursor-pointer gap-2"
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: s.color }}
                              />
                              {s.name}
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
