import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, X, Send, Loader2, MessageCircle, Phone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  useTaskDetail,
  useTaskComments,
  useCreateSubtask,
  useToggleSubtask,
  useDeleteSubtask,
  useCreateComment,
} from '@/hooks/useTasks';
import { TaskFormDialog } from './TaskFormDialog';
import { TaskAttachmentsList } from './TaskAttachmentsList';
import { MentionAutocomplete, renderMentions } from './MentionAutocomplete';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskAttachment,
} from '@/types/tasks';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  taskId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailDialog({ taskId, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { data: task, isLoading } = useTaskDetail(taskId);
  const { data: comments = [] } = useTaskComments(taskId);
  const createSubtask = useCreateSubtask();
  const toggleSubtask = useToggleSubtask();
  const deleteSubtask = useDeleteSubtask();
  const createComment = useCreateComment();

  const [editOpen, setEditOpen] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [newComment, setNewComment] = useState('');
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);

  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || !taskId) return;
    try {
      await createSubtask.mutateAsync({ task_id: taskId, title: newSubtask.trim() });
      setNewSubtask('');
    } catch {
      toast.error('Erro ao adicionar subtarefa');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !taskId) return;
    try {
      await createComment.mutateAsync({
        task_id: taskId,
        content: newComment.trim(),
        mentioned_user_ids: mentionedIds,
      });
      setNewComment('');
      setMentionedIds([]);
    } catch {
      toast.error('Erro ao comentar');
    }
  };

  const attachments = ((task as any)?.attachments ?? []) as TaskAttachment[];

  return (
    <>
      <Dialog open={!!taskId} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {isLoading || !task ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <DialogTitle className="text-xl">{task.title}</DialogTitle>
                    <DialogDescription className="mt-1">
                      Criada em {format(new Date(task.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </DialogDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                    Editar
                  </Button>
                </div>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={cn(TASK_PRIORITY_COLORS[task.priority])}>
                  {TASK_PRIORITY_LABELS[task.priority]}
                </Badge>
                <Badge variant="outline">{TASK_STATUS_LABELS[task.status]}</Badge>
                {task.project && (
                  <Badge variant="outline" className="gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: task.project.color }} />
                    {task.project.name}
                  </Badge>
                )}
                {task.due_at && (
                  <Badge variant="outline">
                    Prazo: {format(new Date(task.due_at), "dd/MM/yyyy", { locale: ptBR })}
                  </Badge>
                )}
              </div>

              {task.description && (
                <div>
                  <h4 className="text-sm font-medium mb-1.5">Descrição</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

              {task.assignees && task.assignees.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-1.5">Responsáveis</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {task.assignees.map((a) => (
                      <div key={a.user_id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted text-xs">
                        <Avatar className="w-4 h-4">
                          <AvatarImage src={a.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[8px]">
                            {(a.full_name ?? '?').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{a.full_name ?? 'Sem nome'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {task.contact && (
                <div>
                  <h4 className="text-sm font-medium mb-1.5">Contato vinculado</h4>
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarFallback className="text-xs">
                          {task.contact.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{task.contact.name}</p>
                        {task.contact.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {task.contact.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => {
                        onOpenChange(false);
                        navigate(`/chat?contact=${task.contact!.id}`);
                      }}
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                      Abrir conversa
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* Subtasks */}
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Checklist ({task.subtasks?.filter((s) => s.completed).length ?? 0}/{task.subtasks?.length ?? 0})
                </h4>
                <div className="space-y-1.5">
                  {task.subtasks?.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 group">
                      <Checkbox
                        checked={s.completed}
                        onCheckedChange={(checked) =>
                          toggleSubtask.mutate({ id: s.id, completed: !!checked, task_id: task.id })
                        }
                      />
                      <span className={cn('text-sm flex-1', s.completed && 'line-through text-muted-foreground')}>
                        {s.title}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteSubtask.mutate({ id: s.id, task_id: task.id })}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}
                    placeholder="Nova subtarefa..."
                    className="h-8"
                  />
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleAddSubtask}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Attachments */}
              <TaskAttachmentsList taskId={task.id} attachments={attachments} />

              <Separator />

              {/* Comments */}
              <div>
                <h4 className="text-sm font-medium mb-2">Comentários ({comments.length})</h4>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <Avatar className="w-7 h-7 shrink-0">
                        <AvatarImage src={c.user_avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {(c.user_full_name ?? '?').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-muted/50 rounded-lg p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{c.user_full_name ?? 'Usuário'}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(c.created_at), "dd/MM HH:mm")}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap mt-0.5">{renderMentions(c.content)}</p>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Sem comentários ainda
                    </p>
                  )}
                </div>
                <div className="flex items-end gap-2 mt-3">
                  <MentionAutocomplete
                    value={newComment}
                    onChange={(text, mentions) => {
                      setNewComment(text);
                      setMentionedIds(mentions);
                    }}
                    placeholder="Comentário... use @ para mencionar"
                    rows={2}
                    onSubmit={handleAddComment}
                  />
                  <Button size="icon" onClick={handleAddComment} disabled={createComment.isPending}>
                    {createComment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                {mentionedIds.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {mentionedIds.length} pessoa{mentionedIds.length > 1 ? 's' : ''} será notificada no Chat Interno
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {task && (
        <TaskFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          task={task}
        />
      )}
    </>
  );
}
