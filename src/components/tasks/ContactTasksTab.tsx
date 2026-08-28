import { useMemo, useState } from 'react';
import { Plus, ListTodo, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTasks } from '@/hooks/useTasks';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { TaskStatusSelect } from '@/components/tasks/TaskStatusSelect';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
} from '@/types/tasks';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Props {
  contactId: string;
  /** When true, hides internal header (used when parent provides one) */
  headerless?: boolean;
}

export function ContactTasksTab({ contactId, headerless = false }: Props) {
  const { data: tasks = [], isLoading } = useTasks({ contactId });
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'done');
    const done = tasks.filter((t) => t.status === 'done');
    open.sort((a, b) => {
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });
    return [...open, ...done];
  }, [tasks]);

  const now = Date.now();

  return (
    <div>
      {!headerless && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Tarefas ({tasks.length})</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setFormOpen(true)}>
            <Plus className="w-3 h-3 mr-1" />
            Nova
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Nenhuma tarefa para este contato
        </p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {sorted.map((t) => {
            const due = t.due_at ? new Date(t.due_at) : null;
            const overdue = due && t.status !== 'done' && due.getTime() < now;
            const isDone = t.status === 'done';
            return (
              <button
                key={t.id}
                onClick={() => setDetailId(t.id)}
                className={cn(
                  'w-full text-left p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors',
                  isDone && 'opacity-60',
                )}
              >
                <div className="flex items-start gap-2">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
                  ) : overdue ? (
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-sm font-medium truncate', isDone && 'line-through')}>
                      {t.title}
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <Badge variant="outline" className={cn('text-[10px] py-0 h-4', TASK_PRIORITY_COLORS[t.priority])}>
                        {TASK_PRIORITY_LABELS[t.priority]}
                      </Badge>
                      <TaskStatusSelect taskId={t.id} currentStatus={t.status} />
                      {due && (
                        <span className={cn('text-[10px]', overdue ? 'text-destructive' : 'text-muted-foreground')}>
                          {format(due, "dd/MM", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultContactId={contactId}
      />
      <TaskDetailDialog
        taskId={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
      />
    </div>
  );
}
