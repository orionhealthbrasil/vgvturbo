import { useEffect, useMemo, useState } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAvailableSlots } from '@/hooks/useAvailableSlots';
import { useRescheduleBooking } from '@/hooks/useBookings';
import type { Booking } from '@/types/booking';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  booking: Booking;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}

export function RescheduleBookingDialog({ booking, open, onOpenChange, onDone }: Props) {
  const [date, setDate] = useState(format(new Date(booking.starts_at), 'yyyy-MM-dd'));
  const [selected, setSelected] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const reschedule = useRescheduleBooking();

  const { data: slots } = useAvailableSlots({
    calendarId: booking.calendar_id,
    eventTypeId: booking.event_type_id,
    from: date,
    to: format(addDays(parseISO(date), 1), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    if (!open) return;
    setDate(format(new Date(booking.starts_at), 'yyyy-MM-dd'));
    setSelected('');
    (async () => {
      const { data } = await supabase
        .from('event_types' as any)
        .select('duration_minutes')
        .eq('id', booking.event_type_id)
        .maybeSingle();
      setDuration(((data as any)?.duration_minutes as number) ?? 30);
    })();
  }, [open, booking]);

  const todaySlots = useMemo(
    () => (slots ?? []).filter((s) => format(parseISO(s), 'yyyy-MM-dd') === date),
    [slots, date]
  );

  const submit = async () => {
    if (!selected || !duration) return;
    const ends = new Date(new Date(selected).getTime() + duration * 60_000).toISOString();
    await reschedule.mutateAsync({ id: booking.id, starts_at: selected, ends_at: ends });
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reagendar</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nova data</Label>
            <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSelected(''); }} />
          </div>
          <div>
            <Label>Novo horário</Label>
            {todaySlots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Sem horários disponíveis</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {todaySlots.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={selected === s ? 'default' : 'outline'}
                    onClick={() => setSelected(s)}
                  >
                    {format(parseISO(s), 'HH:mm')}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!selected || reschedule.isPending}>
            {reschedule.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Reagendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
