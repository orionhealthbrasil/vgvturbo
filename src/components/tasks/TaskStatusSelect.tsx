import { ChevronDown, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_STATUS_ORDER,
  type TaskStatus,
} from '@/types/tasks';
import { useUpdateTask } from '@/hooks/useTasks';
import { toast } from 'sonner';

interface Props {
  taskId: string;
  currentStatus: TaskStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export function TaskStatusSelect({ taskId, currentStatus, size = 'sm', className }: Props) {
  const update = useUpdateTask();

  const handleChange = async (status: TaskStatus) => {
    if (status === currentStatus) return;
    try {
      await update.mutateAsync({ id: taskId, patch: { status } });
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const isPending = update.isPending && update.variables?.id === taskId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border font-medium transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring',
          size === 'sm' ? 'text-[10px] px-1.5 h-5' : 'text-xs px-2 h-6',
          TASK_STATUS_COLORS[currentStatus],
          className,
        )}
      >
        {isPending ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        ) : (
          <>
            <span>{TASK_STATUS_LABELS[currentStatus]}</span>
            <ChevronDown className="w-2.5 h-2.5 opacity-70" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onClick={(e) => e.stopPropagation()}
        className="min-w-[140px]"
      >
        {TASK_STATUS_ORDER.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={(e) => {
              e.stopPropagation();
              handleChange(status);
            }}
            className={cn(
              'text-xs cursor-pointer',
              status === currentStatus && 'bg-accent font-medium',
            )}
          >
            <span
              className={cn(
                'inline-block w-2 h-2 rounded-full mr-2',
                TASK_STATUS_COLORS[status].split(' ').find((c) => c.startsWith('bg-')),
              )}
            />
            {TASK_STATUS_LABELS[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
