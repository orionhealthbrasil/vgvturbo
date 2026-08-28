import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays,
  Clock,
  Phone,
  Mail,
  User,
  MessageCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useBookingReminders, useUpdateBookingStatus } from '@/hooks/useBookings';
import {
  type Booking,
  type BookingReminder,
  type ReminderChannel,
  REMINDER_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  summarizeRemindersByChannel,
} from '@/types/booking';
import { RescheduleBookingDialog } from '@/components/agenda/RescheduleBookingDialog';

interface Props {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ReminderColumn({
  channel,
  reminders,
}: {
  channel: ReminderChannel;
  reminders: BookingReminder[];
}) {
  const summary = useMemo(() => summarizeRemindersByChannel(reminders, channel), [reminders, channel]);
  const types: (keyof typeof summary)[] = ['confirmation', '24h', '1h', 'review_10min'];

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
        {channel === 'whatsapp' ? <MessageCircle className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
        {channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
      </p>
      {types.map((t) => {
        const status = summary[t];
        const icon =
          status === 'sent' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
          ) : status === 'failed' ? (
            <XCircle className="w-3.5 h-3.5 text-destructive" />
          ) : status === 'skipped' ? (
            <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
          ) : status === 'pending' || status === 'queued' ? (
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-muted-foreground/40" />
          );
        return (
          <div key={t} className="flex items-center gap-2 text-xs">
            {icon}
            <span className="text-muted-foreground">{REMINDER_TYPE_LABELS[t]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function BookingDetailDialog({ booking, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { data: reminders = [] } = useBookingReminders(booking?.id ?? null);
  const updateStatus = useUpdateBookingStatus();

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [reschedule, setReschedule] = useState(false);

  if (!booking) return null;

  const handleStatus = async (status: 'completed' | 'no_show' | 'confirmed') => {
    await updateStatus.mutateAsync({ id: booking.id, status });
    onOpenChange(false);
  };

  const handleCancel = async () => {
    await updateStatus.mutateAsync({
      id: booking.id,
      status: 'cancelled',
      cancellation_reason: cancelReason.trim() || undefined,
    });
    setConfirmCancel(false);
    setCancelReason('');
    onOpenChange(false);
  };

  const isPast = new Date(booking.starts_at) < new Date();
  const isCancelled = booking.status === 'cancelled';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Agendamento
            </DialogTitle>
            <DialogDescription>
              <Badge className={STATUS_COLORS[booking.status]}>{STATUS_LABELS[booking.status]}</Badge>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 space-y-1.5 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <CalendarDays className="w-4 h-4" />
                {format(new Date(booking.starts_at), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </p>
              <p className="text-muted-foreground text-xs">
                até {format(new Date(booking.ends_at), 'HH:mm')}
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                {booking.customer_name}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                {booking.customer_phone}
              </p>
              {booking.customer_email && (
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {booking.customer_email}
                </p>
              )}
            </div>

            {booking.notes && (
              <div className="text-sm">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Observações</p>
                <p className="text-muted-foreground">{booking.notes}</p>
              </div>
            )}

            {booking.cancellation_reason && (
              <div className="text-sm">
                <p className="text-xs font-semibold text-destructive uppercase mb-1">Motivo do cancelamento</p>
                <p className="text-muted-foreground">{booking.cancellation_reason}</p>
              </div>
            )}

            <Separator />

            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Status dos lembretes
              </p>
              <div className="grid grid-cols-2 gap-4">
                <ReminderColumn channel="whatsapp" reminders={reminders} />
                <ReminderColumn channel="email" reminders={reminders} />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-1 flex-wrap">
              {booking.contact_id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/chat?contact=${booking.contact_id}`)}
                >
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Conversa
                </Button>
              )}
            </div>
            {!isCancelled && (
              <div className="flex gap-2 flex-wrap justify-end">
                {!isPast && (
                  <Button variant="outline" size="sm" onClick={() => setReschedule(true)}>
                    Reagendar
                  </Button>
                )}
                {isPast && booking.status === 'confirmed' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatus('no_show')}
                      disabled={updateStatus.isPending}
                    >
                      Não compareceu
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleStatus('completed')}
                      disabled={updateStatus.isPending}
                    >
                      Concluído
                    </Button>
                  </>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmCancel(true)}
                  disabled={updateStatus.isPending}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Os lembretes pendentes serão pulados e o cliente será notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {updateStatus.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RescheduleBookingDialog
        booking={booking}
        open={reschedule}
        onOpenChange={setReschedule}
        onDone={() => onOpenChange(false)}
      />
    </>
  );
}
