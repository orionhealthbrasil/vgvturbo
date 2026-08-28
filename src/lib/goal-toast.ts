import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calcGoalPercent, formatGoalValue, type GoalType } from '@/types/goals';

const sb = supabase as any;

interface GoalProgressToastParams {
  userId: string;
  organizationId: string;
}

/**
 * Após marcar um deal como ganho, busca metas ativas onde o vendedor participa
 * (ou metas de equipe) e mostra um toast informando o progresso da meta mais
 * próxima de ser concluída.
 *
 * Roda com pequeno delay para esperar a trigger `recalculate_goal_progress`
 * atualizar a tabela `goal_progress`.
 */
export function showGoalProgressToast({ userId, organizationId }: GoalProgressToastParams) {
  // Espera ~1.5s para a trigger no banco recalcular o progresso
  setTimeout(async () => {
    try {
      // 1. Busca metas ativas da org
      const { data: goals } = await sb
        .from('goals')
        .select('id, title, goal_type, target_value, scope, period_end')
        .eq('organization_id', organizationId)
        .eq('status', 'active');

      const activeGoals = (goals ?? []) as Array<{
        id: string;
        title: string;
        goal_type: GoalType;
        target_value: number;
        scope: 'individual' | 'team' | 'group';
        period_end: string;
      }>;

      if (activeGoals.length === 0) return;

      // 2. Filtra: metas de equipe OU metas onde o user é participante
      const goalIds = activeGoals.map((g) => g.id);
      const { data: parts } = await sb
        .from('goal_participants')
        .select('goal_id')
        .in('goal_id', goalIds)
        .eq('user_id', userId);
      const myParticipantGoals = new Set(((parts ?? []) as any[]).map((p) => p.goal_id));

      const relevant = activeGoals.filter(
        (g) => g.scope === 'team' || myParticipantGoals.has(g.id),
      );
      if (relevant.length === 0) return;

      // 3. Busca progresso total (user_id IS NULL) das metas relevantes
      const relevantIds = relevant.map((g) => g.id);
      const { data: progress } = await sb
        .from('goal_progress')
        .select('goal_id, current_value, user_id')
        .in('goal_id', relevantIds)
        .is('user_id', null);

      const progressMap = new Map<string, number>();
      ((progress ?? []) as any[]).forEach((p) => {
        progressMap.set(p.goal_id, Number(p.current_value) || 0);
      });

      // 4. Calcula percentual de cada meta e escolhe a mais próxima de 100%
      // (mas que ainda não atingiu — quem atingiu 100% já vira "completed")
      const ranked = relevant
        .map((g) => {
          const cur = progressMap.get(g.id) ?? 0;
          const pct = calcGoalPercent(g.target_value, cur);
          return { goal: g, current: cur, percent: pct };
        })
        .filter((r) => r.percent > 0) // ignora metas que ainda não tiveram contribuição
        .sort((a, b) => b.percent - a.percent);

      const top = ranked[0];
      if (!top) return;

      const { goal, current, percent } = top;
      const remaining = Math.max(0, goal.target_value - current);
      const pctRounded = Math.round(percent);

      if (percent >= 100) {
        toast.success(`🏆 Meta "${goal.title}" atingida!`, {
          description: `Você bateu ${formatGoalValue(goal.goal_type, current)} de ${formatGoalValue(goal.goal_type, goal.target_value)}.`,
          duration: 6000,
        });
      } else {
        toast(`🎯 ${pctRounded}% da meta "${goal.title}"`, {
          description: `Faltam ${formatGoalValue(goal.goal_type, remaining)} para atingir ${formatGoalValue(goal.goal_type, goal.target_value)}.`,
          duration: 5000,
        });
      }
    } catch (err) {
      // Silencioso — toast de meta é informativo, não pode quebrar o fluxo
      console.warn('[goal-toast] erro ao calcular progresso:', err);
    }
  }, 1500);
}
