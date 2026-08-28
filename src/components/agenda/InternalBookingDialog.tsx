import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCalendars } from '@/hooks/useCalendars';
import { useEventTypes } from '@/hooks/useEventTypes';
import { useAvailableSlots } from '@/hooks/useAvailableSlots';
import { useCreateInternalBooking } from '@/hooks/useBookings';
import { ContactPicker, type ContactSelection } from './ContactPicker';
import { format, addDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCalendarId?: string;
  prefilledContact?: ContactSelection | null;
  contactLocked?: boolean;
}

export function InternalBookingDialog({ open, onOpenChange, defaultCalendarId, prefilledContact, contactLocked }: Props) {
  const { data: calendars } = useCalendars();
  const [calendarId, setCalendarId] = useState<string>('');
  const { data: eventTypes } = useEventTypes(calendarId || null);
  const [eventTypeId, setEventTypeId] = useState<string>('');
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const fromDate = date;
  const toDate = format(addDays(parseISO(date), 1), 'yyyy-MM-dd');
  const { data: slots } = useAvailableSlots({
    calendarId: calendarId || null,
    eventTypeId: eventTypeId || null,
    from: fromDate,
    to: toDate,
  });

  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [contact, setContact] = useState<ContactSelection | null>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [skipReminders, setSkipReminders] = useState(false);
  const [scheduleAnother, setScheduleAnother] = useState(false);

  const create = useCreateInternalBooking();

  useEffect(() => {
    if (open) {
      setCalendarId(defaultCalendarId || calendars?.[0]?.id || '');
      setEventTypeId('');
      setSelectedSlot('');
      setNotes('');
      setSkipReminders(false);
      if (prefilledContact) {
        setContact(prefilledContact);
        setName(prefilledContact.name);
        setPhone(prefilledContact.phone);
        setEmail(prefilledContact.email ?? '');
      } else {
        setContact(null);
        setName('');
        setPhone('');
        setEmail('');
      }
    }
  }, [open, defaultCalendarId, calendars, prefilledContact]);

  useEffect(() => {
    if (contact) {
      setName(contact.name);
      setPhone(contact.phone);
      setEmail(contact.email ?? '');
    }
  }, [contact]);

  const todaySlots = useMemo(
    () => (slots ?? []).filter((s) => format(parseISO(s), 'yyyy-MM-dd') === date),
    [slots, date]
  );

  const submit = async () => {
    if (!calendarId || !eventTypeId || !selectedSlot || !name.trim() || !phone.trim()) return;
    await create.mutateAsync({
      calendar_id: calendarId,
      event_type_id: eventTypeId,
      starts_at: selectedSlot,
      contact_id: contact?.contact_id ?? null,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      customer_email: email.trim() || null,
      notes: notes.trim() || null,
      skip_reminders: skipReminders,
    });
    if (scheduleAnother) {
      setSelectedSlot('');
      setNotes('');
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Calendário *</Label>
              <Select value={calendarId} onValueChange={(v) => { setCalendarId(v); setEventTypeId(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(calendars ?? []).filter((c) => c.is_active).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de evento *</Label>
              <Select value={eventTypeId} onValueChange={setEventTypeId} disabled={!calendarId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(eventTypes ?? []).filter((e) => e.is_active).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name} · {e.duration_minutes}min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Data *</Label>
            <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSelectedSlot(''); }} />
          </div>

          {eventTypeId && (
            <div>
              <Label>Horário *</Label>
              {todaySlots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">Sem horários disponíveis nesta data.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {todaySlots.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant={selectedSlot === s ? 'default' : 'outline'}
                      onClick={() => setSelectedSlot(s)}
                    >
                      {format(parseISO(s), 'HH:mm', { locale: ptBR })}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            <div>
              <Label>Contato</Label>
              <ContactPicker value={contact} onChange={setContact} disabled={contactLocked} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={contactLocked} />
              </div>
              <div>
                <Label>Telefone *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={contactLocked} />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={contactLocked} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label className="m-0 text-sm">Pular lembretes automáticos</Label>
              <Switch checked={skipReminders} onCheckedChange={setSkipReminders} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="m-0 text-sm">Agendar outro após salvar</Label>
              <Switch checked={scheduleAnother} onCheckedChange={setScheduleAnother} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={submit}
            disabled={!calendarId || !eventTypeId || !selectedSlot || !name.trim() || !phone.trim() || create.isPending}
          >
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
