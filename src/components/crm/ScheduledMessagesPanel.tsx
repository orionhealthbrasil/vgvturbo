import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, Pencil, Trash2, Repeat, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useScheduledMessagesForContact,
  useCancelScheduledMessage,
  recurrenceLabel,
  ScheduledMessage,
} from '@/hooks/useScheduledMessages';
import { DeferScheduleDialog } from './DeferScheduleDialog';

interface ScheduledMessagesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  organizationId: string;
}

export function ScheduledMessagesPanel({
  open,
  onOpenChange,
  contactId,
  contactName,
  organizationId,
}: ScheduledMessagesPanelProps) {
  const { data: schedules, isLoading } = useScheduledMessagesForContact(open ? contactId : null);
  const cancelMutation = useCancelScheduledMessage();
  const [editing, setEditing] = useState<ScheduledMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ScheduledMessage | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Agendamentos
            </DialogTitle>
            <DialogDescription>
              Mensagens agendadas para <span className="font-medium">{contactName}</span>
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            {isLoading ? (
              <div className="py-12 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : !schedules || schedules.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Nenhum agendamento pendente.
              </div>
            ) : (
              <div className="space-y-2 py-2">
                {schedules.map((s) => {
                  const when = new Date(s.scheduled_at);
                  return (
                    <div key={s.id} className="rounded-lg border p-3 space-y-2 bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm">
                          <div className="font-medium">
                            {format(when, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </div>
                          {s.recurrence_rule && (
                            <Badge variant="secondary" className="mt-1 text-[10px] gap-1">
                              <Repeat className="h-3 w-3" />
                              {recurrenceLabel(s.recurrence_rule, s.recurrence_interval)}
                              {s.recurrence_end_at && (
                                <span className="ml-1 opacity-70">
                                  até {format(new Date(s.recurrence_end_at), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                              )}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEditing(s)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setConfirmDelete(s)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {s.message_content}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {editing && (
        <DeferScheduleDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          contactId={contactId}
          contactName={contactName}
          organizationId={organizationId}
          editing={editing}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.recurrence_rule
                ? 'Esta é uma mensagem recorrente. Cancelar irá interromper todas as futuras execuções.'
                : 'Esta mensagem não será enviada.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) {
                  cancelMutation.mutate(confirmDelete.id);
                  setConfirmDelete(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Cancelar agendamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
