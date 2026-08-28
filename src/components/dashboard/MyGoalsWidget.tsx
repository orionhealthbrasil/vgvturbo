import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, ArrowRight } from 'lucide-react';
import { useMyGoals } from '@/hooks/useGoals';
import { GoalProgressBar } from '@/components/goals/GoalProgressBar';
import { calcGoalPercent, formatGoalValue, GOAL_SCOPE_LABELS } from '@/types/goals';

export function MyGoalsWidget() {
  const navigate = useNavigate();
  const { data: goals = [], isLoading } = useMyGoals();
  const top = goals.slice(0, 3);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Minhas Metas</h3>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('/metas')}>
          Ver todas <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : top.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground">
          <Target className="w-8 h-8 mx-auto mb-1 opacity-30" />
          Nenhuma meta ativa.
        </div>
      ) : (
        <div className="space-y-3">
          {top.map((g) => {
            const cur = g.progress_total?.current_value ?? 0;
            const pct = calcGoalPercent(g.target_value, cur);
            return (
              <button
                key={g.id}
                onClick={() => navigate(`/metas?goal=${g.id}`)}
                className="w-full text-left p-2 rounded-md hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium truncate">{g.title}</span>
                  <Badge variant="outline" className="text-[10px] h-4 py-0 shrink-0">
                    {GOAL_SCOPE_LABELS[g.scope]}
                  </Badge>
                </div>
                <GoalProgressBar percent={pct} />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                  <span>{formatGoalValue(g.goal_type, cur)} / {formatGoalValue(g.goal_type, g.target_value)}</span>
                  <span className="font-medium tabular-nums">{pct.toFixed(0)}%</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
