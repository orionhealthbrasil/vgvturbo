import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Target,
  Users,
  User,
  UserCheck,
  CalendarDays,
  MoreVertical,
  Pencil,
  Trash2,
  Archive,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  GOAL_SCOPE_LABELS,
  GOAL_TYPE_LABELS,
  calcGoalPercent,
  formatGoalValue,
  type Goal,
} from '@/types/goals';
import { GoalProgressBar } from './GoalProgressBar';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GoalCardProps {
  goal: Goal;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onOpen: () => void;
}

export function GoalCard({ goal, canManage, onEdit, onDelete, onArchive, onOpen }: GoalCardProps) {
  const [confirmDelOpen, setConfirmDelOpen] = useState(false);
  const total = goal.progress_total;
  const current = total?.current_value ?? 0;
  const percent = calcGoalPercent(goal.target_value, current);

  const periodEnd = useMemo(() => parseISO(goal.period_end), [goal.period_end]);
  const periodStart = useMemo(() => parseISO(goal.period_start), [goal.period_start]);
  const daysLeft = differenceInCalendarDays(periodEnd, new Date());
  const isCompleted = goal.status === 'completed' || percent >= 100;

  const scopeIcon = goal.scope === 'team' ? Users : goal.scope === 'group' ? UserCheck : User;
  const ScopeIcon = scopeIcon;

  return (
    <Card
      className={cn(
        'p-4 hover:shadow-md transition-shadow cursor-pointer',
        isCompleted && 'border-status-success/40 bg-status-success/5',
      )}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div
            className={cn(
              'p-2 rounded-md shrink-0',
              isCompleted ? 'bg-status-success/15 text-status-success' : 'bg-primary/10 text-primary',
            )}
          >
            {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Target className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm leading-tight truncate">{goal.title}</h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge variant="outline" className="text-[10px] py-0 h-4">
                {GOAL_TYPE_LABELS[goal.goal_type]}
              </Badge>
              <Badge variant="outline" className="text-[10px] py-0 h-4 flex items-center gap-1">
                <ScopeIcon className="w-2.5 h-2.5" />
                {GOAL_SCOPE_LABELS[goal.scope]}
              </Badge>
            </div>
          </div>
        </div>

        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={onOpen}>
                <Eye className="w-4 h-4 mr-2" />
                Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="w-4 h-4 mr-2" />
                {goal.status === 'archived' ? 'Reativar' : 'Arquivar'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmDelOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AlertDialog open={confirmDelOpen} onOpenChange={setConfirmDelOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir meta?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir "{goal.title}" e todo o progresso registrado. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-2 mb-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-bold tabular-nums">
            {formatGoalValue(goal.goal_type, current)}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            / {formatGoalValue(goal.goal_type, goal.target_value)}
          </span>
        </div>
        <GoalProgressBar percent={percent} />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-medium tabular-nums">{percent.toFixed(0)}%</span>
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {format(periodStart, 'dd/MM', { locale: ptBR })} – {format(periodEnd, 'dd/MM/yy', { locale: ptBR })}
            {goal.status === 'active' && (
              <span className={cn('ml-1', daysLeft < 0 ? 'text-destructive' : daysLeft <= 3 ? 'text-warning' : '')}>
                {daysLeft < 0 ? `Vencida há ${Math.abs(daysLeft)}d` : daysLeft === 0 ? 'Último dia' : `${daysLeft}d restantes`}
              </span>
            )}
          </span>
        </div>
      </div>

      {goal.scope !== 'team' && (goal.progress_by_user?.length ?? 0) > 0 && (
        <div className="pt-2 border-t space-y-1.5">
          {goal.progress_by_user!.slice(0, 3).map((p) => {
            const participant = goal.participants?.find((pp) => pp.user_id === p.user_id);
            const userPercent = calcGoalPercent(goal.target_value, p.current_value);
            const initials = (participant?.full_name ?? '?').slice(0, 2).toUpperCase();
            return (
              <div key={p.id} className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  {participant?.avatar_url && <AvatarImage src={participant.avatar_url} />}
                  <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                </Avatar>
                <span className="text-xs truncate flex-1 min-w-0">
                  {participant?.full_name ?? 'Sem nome'}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {formatGoalValue(goal.goal_type, p.current_value)} ({userPercent.toFixed(0)}%)
                </span>
              </div>
            );
          })}
          {(goal.progress_by_user?.length ?? 0) > 3 && (
            <div className="text-[10px] text-muted-foreground">
              +{goal.progress_by_user!.length - 3} participantes
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
