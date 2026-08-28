import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface GoalProgressBarProps {
  percent: number;
  className?: string;
  showLabel?: boolean;
}

export function GoalProgressBar({ percent, className, showLabel = false }: GoalProgressBarProps) {
  const pct = Math.min(100, Math.max(0, percent || 0));
  const tone =
    pct >= 100
      ? 'bg-status-success'
      : pct >= 80
      ? 'bg-primary'
      : pct >= 50
      ? 'bg-amber-500'
      : 'bg-muted-foreground/40';

  return (
    <div className={cn('w-full', className)}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full transition-all', tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-xs text-muted-foreground tabular-nums">{pct.toFixed(0)}%</div>
      )}
    </div>
  );
}
