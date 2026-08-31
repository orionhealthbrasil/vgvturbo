import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, ArrowRight, CheckCircle2, XCircle, ChevronDown, Smile } from 'lucide-react';
import { useUpdateContact } from '@/hooks/useCRM';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { ContactWithColumn } from '@/types/crm';
import { toast } from 'sonner';
import { triggerConfetti } from '@/lib/confetti';
import { supabase } from '@/integrations/supabase/client';
import { SaleOutcomeReasonDialog } from '@/components/pipeline/SaleOutcomeReasonDialog';
import {
  triggerFunnelStageAutomation,
  triggerDealResultAutomation,
} from '@/hooks/usePipeline';
import { showGoalProgressToast } from '@/lib/goal-toast';
import { useAuth } from '@/contexts/AuthContext';

interface FunnelStageActionsProps {
  contact: ContactWithColumn;
  messagesCount: number;
}

export function FunnelStageActions({ contact, messagesCount }: FunnelStageActionsProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [outcomeDialog, setOutcomeDialog] = useState<{ kind: 'won' | 'lost' } | null>(null);
  const [isClosingOther, setIsClosingOther] = useState(false);
  const updateContact = useUpdateContact();
  const { data: stages = [] } = useFunnelStages(contact.pipeline_id ?? null);
  const { user } = useAuth();
  
  const sortedStages = [...stages].sort((a, b) => a.position - b.position);
  const currentStage = sortedStages.find(s => s.slug === contact.funnel_stage) || sortedStages[0];

  // Quando contact.pipeline_id é null (contatos legados), ancora ao pipeline do estágio atual
  const effectivePipelineId = contact.pipeline_id ?? currentStage?.pipeline_id ?? null;
  const pipelineStages = effectivePipelineId
    ? sortedStages.filter(s => s.pipeline_id === effectivePipelineId)
    : sortedStages;

  const currentIndex = pipelineStages.findIndex(s => s.slug === contact.funnel_stage);
  // Next stage = next in-progress stage (skip won/lost terminal stages from CTA flow),
  // sempre dentro do mesmo pipeline do estágio atual
  const nextStage = currentIndex >= 0
    ? pipelineStages.slice(currentIndex + 1).find(s => (s.stage_type || 'in_progress') === 'in_progress') || null
    : null;

  const isDisabled = messagesCount === 0;
  // "Final stage" UX (Finalizar Venda dropdown) shows when there's no further in-progress stage ahead
  const isFinalStage = !nextStage;

  const handleAdvanceToNextStage = async () => {
    if (!nextStage) return;
    const previousStage = currentStage;

    try {
      await updateContact.mutateAsync({
        id: contact.id,
        funnel_stage: nextStage.slug as any,
        pipeline_id: nextStage.pipeline_id,
      });
      toast.success(`${nextStage.cta_text || nextStage.name}! Cliente movido para ${nextStage.name}.`);

      // Fire EXIT (previous) + ENTRY (new) automations
      triggerFunnelStageAutomation({
        contactId: contact.id,
        organizationId: contact.organization_id,
        newStageName: nextStage.name,
        previousStageName: previousStage?.name || null,
        pipelineId: contact.pipeline_id ?? null,
      });
    } catch (error: any) {
      console.error('[FunnelStageActions] advance error:', error);
      toast.error(error?.message || 'Erro ao atualizar etapa');
    }
  };

  const handleCloseWithResult = async (result: 'won' | 'lost', outcomeReason?: string) => {
    setIsClosing(true);

    if (result === 'won') {
      triggerConfetti();
    }

    try {
      const finalStage = pipelineStages.find(s => s.is_final);
      const finalStageName = finalStage?.name || 'Fechamento';
      const previousStage = currentStage;

      await updateContact.mutateAsync({
        id: contact.id,
        funnel_stage: (finalStage?.slug || 'closed') as any,
        ...(finalStage ? { pipeline_id: finalStage.pipeline_id } : {}),
        sale_result: result,
        status: 'closed',
        closed_at: new Date().toISOString(),
        ...(result === 'lost' && outcomeReason ? { loss_reason: outcomeReason } : {}),
        ...(result === 'won' && outcomeReason ? { win_reason: outcomeReason } : {}),
      } as any);

      // Stage exit/entry automations — fire and forget
      triggerFunnelStageAutomation({
        contactId: contact.id,
        organizationId: contact.organization_id,
        newStageName: finalStageName,
        previousStageName: previousStage?.name || null,
        pipelineId: contact.pipeline_id ?? null,
      });
      // Deal won/lost automations — fire and forget
      triggerDealResultAutomation({
        contactId: contact.id,
        organizationId: contact.organization_id,
        result,
      });
      // conversation_closed automations — fire and forget
      supabase.functions.invoke('audit-conversation', {
        body: { contact_id: contact.id, organization_id: contact.organization_id },
      }).catch(() => {});
      supabase.functions.invoke('automation-engine', {
        body: { contact_id: contact.id, organization_id: contact.organization_id, event_type: 'conversation_closed' },
      }).catch(() => {});

      if (result === 'won' && user?.id) {
        showGoalProgressToast({
          userId: user.id,
          organizationId: contact.organization_id,
        });
      }

      toast.success(
        result === 'won'
          ? '🎉 Venda realizada!'
          : 'Venda perdida registrada.'
      );
    } catch (error: any) {
      console.error('[FunnelStageActions] close error:', error);
      toast.error(error?.message || 'Erro ao finalizar atendimento');
    } finally {
      setIsClosing(false);
      setOutcomeDialog(null);
    }
  };

  const handleCloseAsOther = async () => {
    setIsClosingOther(true);
    try {
      const finalStage = pipelineStages.find(s => s.is_final);
      const previousStage = currentStage;

      await updateContact.mutateAsync({
        id: contact.id,
        funnel_stage: (finalStage?.slug || 'closed') as any,
        ...(finalStage ? { pipeline_id: finalStage.pipeline_id } : {}),
        sale_result: 'other',
        status: 'closed',
        closed_at: new Date().toISOString(),
      } as any);

      triggerFunnelStageAutomation({
        contactId: contact.id,
        organizationId: contact.organization_id,
        newStageName: finalStage?.name || 'Fechamento',
        previousStageName: previousStage?.name || null,
        pipelineId: contact.pipeline_id ?? null,
      });
      // conversation_closed automations — fire and forget
      supabase.functions.invoke('audit-conversation', {
        body: { contact_id: contact.id, organization_id: contact.organization_id },
      }).catch(() => {});
      supabase.functions.invoke('automation-engine', {
        body: { contact_id: contact.id, organization_id: contact.organization_id, event_type: 'conversation_closed' },
      }).catch(() => {});

      toast.success('Conversa finalizada como curioso/outro.');
    } catch (error: any) {
      console.error('[FunnelStageActions] close other error:', error);
      toast.error(error?.message || 'Erro ao finalizar atendimento');
    } finally {
      setIsClosingOther(false);
    }
  };

  // If contact is closed, show nothing (reopen is handled by parent)
  if (contact.status === 'closed') {
    return null;
  }

  // If no stages configured, show nothing
  if (sortedStages.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      {/* Stage Badge */}
      {currentStage && (
        <Badge 
          variant="outline" 
          className="text-xs font-medium max-w-[140px] truncate hidden lg:inline-flex"
          style={{ 
            backgroundColor: `${currentStage.color}15`,
            color: currentStage.color,
            borderColor: `${currentStage.color}50`
          }}
        >
          {currentStage.name}
        </Badge>
      )}

      {/* Advance to next stage button (if not final) */}
      {nextStage && nextStage.cta_text && !isFinalStage && (
        <Button
          size="sm"
          onClick={handleAdvanceToNextStage}
          disabled={isDisabled || updateContact.isPending}
          title={nextStage.cta_text}
          className="shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-200 rounded-full px-3 lg:px-5 font-medium border-0 shrink-0"
          style={{
            background: `linear-gradient(135deg, ${nextStage.color}, ${nextStage.color}dd)`,
            boxShadow: `0 4px 14px ${nextStage.color}40`
          }}
        >
          {updateContact.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span className="hidden lg:inline truncate max-w-[180px]">{nextStage.cta_text}</span>
              <ArrowRight className="w-4 h-4 lg:ml-1.5" />
            </>
          )}
        </Button>
      )}

      {/* Close sale dropdown (only visible in final stage) */}
      {isFinalStage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="default"
              disabled={isDisabled || isClosing || isClosingOther}
              className="bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 rounded-full px-5 font-medium border-0"
            >
              {isClosing || isClosingOther ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Finalizar Venda
                  <ChevronDown className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl shadow-xl border-border/50">
            <DropdownMenuItem
              onClick={() => setOutcomeDialog({ kind: 'won' })}
              className="text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50 dark:focus:bg-emerald-950/30 rounded-lg py-2.5 px-3 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 mr-2.5" />
              Venda Realizada
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setOutcomeDialog({ kind: 'lost' })}
              className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30 rounded-lg py-2.5 px-3 cursor-pointer"
            >
              <XCircle className="w-4 h-4 mr-2.5" />
              Venda Perdida
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleCloseAsOther}
              className="text-amber-600 focus:text-amber-600 focus:bg-amber-50 dark:focus:bg-amber-950/30 rounded-lg py-2.5 px-3 cursor-pointer"
            >
              <Smile className="w-4 h-4 mr-2.5" />
              Curiosos e outros
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <SaleOutcomeReasonDialog
        open={!!outcomeDialog}
        onOpenChange={(o) => !o && !isClosing && setOutcomeDialog(null)}
        loading={isClosing}
        kind={outcomeDialog?.kind ?? 'lost'}
        onConfirm={(reason) => handleCloseWithResult(outcomeDialog?.kind ?? 'lost', reason)}
      />
    </div>
  );
}
