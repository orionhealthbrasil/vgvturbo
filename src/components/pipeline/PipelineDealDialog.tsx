import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ContactWithColumn } from '@/types/crm';
import { useUpdateDealFields } from '@/hooks/usePipeline';
import { useTasks } from '@/hooks/useTasks';
import { ContactCustomFields } from '@/components/crm/ContactCustomFields';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from '@/types/tasks';
import { toast } from 'sonner';
import { Loader2, Plus, ListTodo, AlertTriangle, CheckCircle2, Clock, NotebookPen, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PipelineDealDialogProps {
  contact: ContactWithColumn | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}

export function PipelineDealDialog({ contact, open, onOpenChange, canEdit }: PipelineDealDialogProps) {
  const [dealValue, setDealValue] = useState<string>('');
  const [dealNotes, setDealNotes] = useState<string>('');
  const [lossReason, setLossReason] = useState<string>('');
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null);
  const updateDeal = useUpdateDealFields();
  const { data: contactTasks = [] } = useTasks({ contactId: contact?.id });

  useEffect(() => {
    if (contact) {
      setDealValue(contact.deal_value != null ? String(contact.deal_value) : '');
      setDealNotes(contact.deal_notes ?? '');
      setLossReason(contact.loss_reason ?? '');
    }
  }, [contact]);

  const recentTasks = useMemo(() => {
    const open = contactTasks.filter((t) => t.status !== 'done');
    const done = contactTasks.filter((t) => t.status === 'done');
    open.sort((a, b) => {
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });
    return [...open, ...done].slice(0, 3);
  }, [contactTasks]);

  if (!contact) return null;

  const isLost = contact.sale_result === 'lost';
  const now = Date.now();

  const handleSave = async () => {
    const parsedValue = dealValue.trim() === '' ? null : Number(dealValue.replace(',', '.'));
    if (parsedValue !== null && (isNaN(parsedValue) || parsedValue < 0)) {
      toast.error('Valor potencial inválido');
      return;
    }

    try {
      await updateDeal.mutateAsync({
        id: contact.id,
        deal_value: parsedValue,
        deal_notes: dealNotes.trim() === '' ? null : dealNotes.trim(),
        loss_reason: isLost ? (lossReason.trim() === '' ? null : lossReason.trim()) : contact.loss_reason ?? null,
      });
      toast.success('Negócio atualizado');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao atualizar negócio');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{canEdit ? 'Editar negócio' : 'Detalhes do negócio'}</DialogTitle>
            <DialogDescription>{contact.name}</DialogDescription>
          </DialogHeader>

          {!canEdit && (
            <p className="text-xs text-muted-foreground -mt-2">
              Você não tem permissão para editar negócios neste funil.
            </p>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="deal-value">Valor potencial (R$)</Label>
              <Input
                id="deal-value"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0,00"
                value={dealValue}
                onChange={(e) => setDealValue(e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deal-notes">Anotações do negócio</Label>
              <Textarea
                id="deal-notes"
                rows={4}
                placeholder="Detalhes da negociação, próximos passos, observações..."
                value={dealNotes}
                onChange={(e) => setDealNotes(e.target.value)}
                maxLength={2000}
                disabled={!canEdit}
              />
            </div>

            {isLost && (
              <div className="space-y-2">
                <Label htmlFor="loss-reason">Motivo da perda</Label>
                <Textarea
                  id="loss-reason"
                  rows={3}
                  placeholder="Ex.: preço, prazo, escolheu concorrente, sumiu..."
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  maxLength={500}
                  disabled={!canEdit}
                />
              </div>
            )}

            {/* Contact notes (read-only) */}
            {contact.notes && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="flex items-center gap-1.5">
                  <NotebookPen className="w-3.5 h-3.5 text-muted-foreground" />
                  Observações do contato
                </Label>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/40 rounded-md p-2.5">
                  {contact.notes}
                </p>
              </div>
            )}

            {/* Custom fields */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                Campos personalizados
              </Label>
              <ContactCustomFields contactId={contact.id} />
            </div>

            {/* Tasks section */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <ListTodo className="w-3.5 h-3.5 text-muted-foreground" />
                  Tarefas ({contactTasks.length})
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setTaskFormOpen(true)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Criar tarefa
                </Button>
              </div>

              {recentTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhuma tarefa para este contato
                </p>
              ) : (
                <div className="space-y-1">
                  {recentTasks.map((t) => {
                    const due = t.due_at ? new Date(t.due_at) : null;
                    const overdue = due && t.status !== 'done' && due.getTime() < now;
                    const isDone = t.status === 'done';
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTaskDetailId(t.id)}
                        className={cn(
                          'w-full text-left p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors',
                          isDone && 'opacity-60',
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {isDone ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-status-success shrink-0 mt-0.5" />
                          ) : overdue ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className={cn('text-xs font-medium truncate', isDone && 'line-through')}>
                              {t.title}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              <Badge variant="outline" className={cn('text-[10px] py-0 h-4', TASK_PRIORITY_COLORS[t.priority])}>
                                {TASK_PRIORITY_LABELS[t.priority]}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] py-0 h-4">
                                {TASK_STATUS_LABELS[t.status]}
                              </Badge>
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
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {canEdit ? 'Cancelar' : 'Fechar'}
            </Button>
            {canEdit && (
              <Button onClick={handleSave} disabled={updateDeal.isPending}>
                {updateDeal.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Salvar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskFormDialog
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        defaultContactId={contact.id}
      />
      <TaskDetailDialog
        taskId={taskDetailId}
        onOpenChange={(o) => !o && setTaskDetailId(null)}
      />
    </>
  );
}
