import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTodo, AlertTriangle, ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTasks, useUpdateTask } from '@/hooks/useTasks';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
} from '@/types/tasks';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function MyTasksWidget() {
  const navigate = useNavigate();
  const { data: tasks = [], isLoading } = useTasks({ onlyMine: true });
  const updateTask = useUpdateTask();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  const handleComplete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    setCompletingIds((prev) => new Set(prev).add(taskId));
    try {
      await updateTask.mutateAsync({ id: taskId, patch: { status: 'done' } });
      toast.success('Tarefa concluída');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao concluir tarefa');
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const myTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'done')
      .sort((a, b) => {
        const aDue = a.due_at ? new Date(a.due_at).getTime() : null;
        const bDue = b.due_at ? new Date(b.due_at).getTime() : null;
        if (aDue !== null && bDue !== null) return aDue - bDue;
        if (aDue !== null) return -1;
        if (bDue !== null) return 1;
        return 0;
      });
  }, [tasks]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Minhas Tarefas</h3>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('/tarefas')}>
          Ver todas <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : myTasks.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-1 text-status-success/50" />
          Nenhuma tarefa pendente. 🎉
        </div>
      ) : (
        <ScrollArea className="h-[280px] pr-3">
        <div className="space-y-1.5">
          {myTasks.map((t) => {
            const due = t.due_at ? new Date(t.due_at) : null;
            const overdue = !!due && due.getTime() < Date.now();
            const dueLabel = due
              ? isToday(due)
                ? format(due, 'HH:mm', { locale: ptBR })
                : format(due, "dd/MM 'às' HH:mm", { locale: ptBR })
              : null;
            const isCompleting = completingIds.has(t.id);
            return (
              <div
                key={t.id}
                className={cn(
                  'group w-full p-2 rounded-md hover:bg-accent/50 transition-all flex items-center gap-2',
                  isCompleting && 'opacity-0 scale-95 pointer-events-none'
                )}
              >
                <button
                  type="button"
                  onClick={(e) => handleComplete(e, t.id)}
                  className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Marcar como concluída"
                  title="Marcar como concluída"
                >
                  <Circle className="w-5 h-5 text-muted-foreground/70 hover:text-status-success transition-colors group-hover:opacity-100" />
                </button>
                <button
                  type="button"
                  onClick={() => setDetailId(t.id)}
                  className="flex-1 min-w-0 text-left flex items-center gap-2"
                >
                  {overdue ? (
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  ) : (
                    <ListTodo className="w-4 h-4 text-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className={cn('text-[10px] py-0 h-4', TASK_PRIORITY_COLORS[t.priority])}>
                        {TASK_PRIORITY_LABELS[t.priority]}
                      </Badge>
                      {t.project && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.project.color }} />
                          {t.project.name}
                        </span>
                      )}
                      {dueLabel && (
                        <span className={cn('text-[10px] ml-auto', overdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                          {dueLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
        </ScrollArea>
      )}

      <TaskDetailDialog taskId={detailId} onOpenChange={(o) => !o && setDetailId(null)} />
    </Card>
  );
}
