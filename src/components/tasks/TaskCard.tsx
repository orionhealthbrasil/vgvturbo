import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, MessageSquare, ListChecks, Pencil, Trash2, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  type Task,
} from '@/types/tasks';
import { useUpdateTask, useDeleteTask } from '@/hooks/useTasks';
import { toast } from 'sonner';

interface Props {
  task: Task;
  onClick?: () => void;
  onEdit?: () => void;
  compact?: boolean;
}

export function TaskCard({ task, onClick, onEdit, compact }: Props) {
  const navigate = useNavigate();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const [hovering, setHovering] = useState(false);

  const overdue = task.due_at && task.status !== 'done' && isPast(new Date(task.due_at));
  const isDone = task.status === 'done';

  const handleToggleDone = async (e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    try {
      await update.mutateAsync({
        id: task.id,
        patch: { status: isDone ? 'todo' : 'done' },
      });
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Excluir "${task.title}"?`)) return;
    try {
      await del.mutateAsync(task.id);
      toast.success('Tarefa excluída');
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  return (
    <Card
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={cn(
        'p-3 cursor-pointer hover:shadow-md transition-all border bg-card group',
        isDone && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={isDone}
          onCheckedChange={() => handleToggleDone({ stopPropagation: () => {} } as any)}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-sm font-medium leading-snug', isDone && 'line-through')}>
              {task.title}
            </p>
            {hovering && (
              <div className="flex items-center gap-1 shrink-0">
                {onEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          {task.description && !compact && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
          )}

          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            <Badge variant="outline" className={cn('text-[10px] py-0 h-4', TASK_PRIORITY_COLORS[task.priority])}>
              {TASK_PRIORITY_LABELS[task.priority]}
            </Badge>

            {task.project && (
              <Badge variant="outline" className="text-[10px] py-0 h-4 gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.project.color }} />
                {task.project.name}
              </Badge>
            )}

            {task.area && (
              <Badge variant="outline" className="text-[10px] py-0 h-4 gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.area.color }} />
                {task.area.name}
              </Badge>
            )}

            {task.contact && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/chat?contact=${task.contact!.id}`);
                }}
                className="inline-flex items-center gap-1 rounded border border-border bg-background hover:bg-accent text-[10px] py-0 h-4 px-1.5 transition-colors max-w-[140px]"
                title={`Abrir conversa com ${task.contact.name}`}
              >
                <User className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                <span className="truncate">{task.contact.name}</span>
              </button>
            )}

            {task.due_at && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] py-0 h-4 gap-1',
                  overdue && 'border-destructive text-destructive',
                )}
              >
                <CalendarIcon className="w-2.5 h-2.5" />
                {format(new Date(task.due_at), "dd 'de' MMM", { locale: ptBR })}
              </Badge>
            )}

            {task.subtask_count && task.subtask_count.total > 0 && (
              <Badge variant="outline" className="text-[10px] py-0 h-4 gap-1">
                <ListChecks className="w-2.5 h-2.5" />
                {task.subtask_count.completed}/{task.subtask_count.total}
              </Badge>
            )}

            {task.comment_count && task.comment_count > 0 && (
              <Badge variant="outline" className="text-[10px] py-0 h-4 gap-1">
                <MessageSquare className="w-2.5 h-2.5" />
                {task.comment_count}
              </Badge>
            )}
          </div>

          {task.assignees && task.assignees.length > 0 && (
            <div className="flex items-center -space-x-2 mt-2">
              {task.assignees.slice(0, 4).map((a) => (
                <Avatar key={a.user_id} className="w-6 h-6 ring-2 ring-card">
                  <AvatarImage src={a.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {(a.full_name ?? '?').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {task.assignees.length > 4 && (
                <div className="w-6 h-6 rounded-full bg-muted text-[10px] flex items-center justify-center ring-2 ring-card">
                  +{task.assignees.length - 4}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
