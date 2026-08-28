import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGoal } from '@/hooks/useGoals';
import {
  GOAL_PERIOD_LABELS,
  GOAL_SCOPE_LABELS,
  GOAL_STATUS_LABELS,
  GOAL_TYPE_LABELS,
  calcGoalPercent,
  formatGoalValue,
} from '@/types/goals';
import { GoalProgressBar } from './GoalProgressBar';
import { GoalEvolutionChart } from './GoalEvolutionChart';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface GoalDetailDialogProps {
  goalId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function GoalDetailDialog({ goalId, onOpenChange }: GoalDetailDialogProps) {
  const { data: goal, isLoading } = useGoal(goalId);

  return (
    <Dialog open={!!goalId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {isLoading || !goal ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {goal.title}
                <Badge variant="outline">{GOAL_STATUS_LABELS[goal.status]}</Badge>
              </DialogTitle>
              {goal.description && (
                <DialogDescription>{goal.description}</DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase">Tipo</div>
                  <div className="font-medium">{GOAL_TYPE_LABELS[goal.goal_type]}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase">Escopo</div>
                  <div className="font-medium">{GOAL_SCOPE_LABELS[goal.scope]}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase">Período</div>
                  <div className="font-medium">{GOAL_PERIOD_LABELS[goal.period_type]}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase">Datas</div>
                  <div className="font-medium text-xs">
                    {format(parseISO(goal.period_start), 'dd/MM/yy', { locale: ptBR })} – {format(parseISO(goal.period_end), 'dd/MM/yy', { locale: ptBR })}
                  </div>
                </div>
              </div>

              {/* Progresso */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-2xl font-bold tabular-nums">
                      {formatGoalValue(goal.goal_type, goal.progress_total?.current_value ?? 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      de {formatGoalValue(goal.goal_type, goal.target_value)} •{' '}
                      {(goal.progress_total?.deals_count ?? 0)} negócios ganhos
                    </div>
                  </div>
                  <div className="text-3xl font-bold tabular-nums text-primary">
                    {calcGoalPercent(goal.target_value, goal.progress_total?.current_value ?? 0).toFixed(0)}%
                  </div>
                </div>
                <GoalProgressBar percent={calcGoalPercent(goal.target_value, goal.progress_total?.current_value ?? 0)} />
              </div>

              {/* Evolução */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Evolução no período</h4>
                <GoalEvolutionChart goal={goal} />
              </div>

              {/* Participantes */}
              {goal.scope !== 'team' && (goal.progress_by_user?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Contribuição individual</h4>
                  <div className="space-y-2">
                    {goal.progress_by_user!.map((p) => {
                      const part = goal.participants?.find((pp) => pp.user_id === p.user_id);
                      const pct = calcGoalPercent(goal.target_value, p.current_value);
                      const initials = (part?.full_name ?? '?').slice(0, 2).toUpperCase();
                      return (
                        <div key={p.id} className="flex items-center gap-3 p-2 rounded-md border">
                          <Avatar className="h-8 w-8">
                            {part?.avatar_url && <AvatarImage src={part.avatar_url} />}
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{part?.full_name ?? 'Sem nome'}</div>
                            <GoalProgressBar percent={pct} className="mt-1" />
                          </div>
                          <div className="text-right text-xs tabular-nums">
                            <div className="font-semibold">{formatGoalValue(goal.goal_type, p.current_value)}</div>
                            <div className="text-muted-foreground">{pct.toFixed(0)}% • {p.deals_count} ganhos</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
