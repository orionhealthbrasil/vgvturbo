import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Clock, Loader2, CheckCircle2, ArrowLeft, Mail, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAvailableSlots, usePublicCalendar } from '@/hooks/useAvailableSlots';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { PublicCalendarData } from '@/types/booking';

type Step = 'event' | 'date' | 'form' | 'success';

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const { data: calendar, isLoading } = usePublicCalendar(slug ?? null);
  const cal = calendar as PublicCalendarData | null;

  const [step, setStep] = useState<Step>('event');
  const [eventTypeId, setEventTypeId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [slot, setSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ id: string; cancel_token: string } | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const eventType = useMemo(
    () => cal?.event_types.find((et) => et.id === eventTypeId) ?? null,
    [cal, eventTypeId]
  );

  const fromDate = date ? format(date, 'yyyy-MM-dd') : '';
  const toDate = date ? format(date, 'yyyy-MM-dd') : '';

  const { data: slots, isLoading: loadingSlots } = useAvailableSlots({
    calendarId: cal?.calendar_id ?? null,
    eventTypeId: eventTypeId,
    from: fromDate,
    to: toDate,
  });

  useEffect(() => {
    setSlot(null);
  }, [eventTypeId, date]);

  const googleCalendarUrl = useMemo(() => {
    if (!slot || !eventType) return '';
    const start = new Date(slot);
    const end = new Date(start.getTime() + eventType.duration_minutes * 60_000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${eventType.name} — ${cal?.calendar_name ?? ''}`,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: notes || `Agendamento`,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }, [slot, eventType, cal, notes]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Agenda não encontrada</h2>
            <p className="text-muted-foreground">Verifique o link e tente novamente.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const emailRequired = cal.bookings_email_enabled;

  const handleSubmit = async () => {
    if (!eventTypeId || !slot || !name.trim() || !phone.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (emailRequired && !email.trim()) {
      toast.error('Email é obrigatório');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-public-booking', {
        body: {
          calendar_id: cal.calendar_id,
          event_type_id: eventTypeId,
          starts_at: slot,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_email: email.trim() || null,
          notes: notes.trim() || null,
        },
      });
      if (error) throw error;
      if (!data?.booking_id) throw new Error('Resposta inválida');
      setBookingResult({ id: data.booking_id, cancel_token: data.cancel_token });
      setStep('success');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao agendar');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelUrl = bookingResult
    ? `${window.location.origin}/booking/cancel/${bookingResult.cancel_token}`
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="max-w-3xl mx-auto py-6">
        <Card className="overflow-hidden">
          <CardHeader
            className="border-b"
            style={{ borderTopColor: cal.calendar_color, borderTopWidth: 4 }}
          >
            <div className="flex items-center gap-4">
              <Avatar className="w-14 h-14">
                {cal.calendar_avatar_url && <AvatarImage src={cal.calendar_avatar_url} />}
                <AvatarFallback style={{ backgroundColor: cal.calendar_color, color: '#fff' }}>
                  {cal.calendar_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle>{cal.calendar_name}</CardTitle>
                {cal.calendar_description && (
                  <p className="text-sm text-muted-foreground mt-1">{cal.calendar_description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{cal.organization_name}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {step === 'event' && (
              <div className="space-y-3">
                <h3 className="font-semibold mb-2">Escolha o tipo de atendimento</h3>
                {cal.event_types.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum tipo de atendimento ativo.</p>
                ) : (
                  cal.event_types.map((et) => (
                    <button
                      key={et.id}
                      onClick={() => {
                        setEventTypeId(et.id);
                        setStep('date');
                      }}
                      className="w-full text-left p-4 rounded-lg border hover:border-primary hover:bg-accent transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{et.name}</p>
                          {et.description && (
                            <p className="text-sm text-muted-foreground mt-1">{et.description}</p>
                          )}
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          <Clock className="w-3 h-3 mr-1" />
                          {et.duration_minutes} min
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {step === 'date' && eventType && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep('event')}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                  </Button>
                  <span className="text-sm text-muted-foreground">{eventType.name}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="mb-2 block">Selecione uma data</Label>
                    <CalendarPicker
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      disabled={(d) => d < startOfDay(new Date()) || d > addDays(new Date(), eventType.max_advance_days)}
                      locale={ptBR}
                      className="rounded-md border"
                    />
                  </div>

                  <div>
                    <Label className="mb-2 block">Horários disponíveis</Label>
                    {!date ? (
                      <p className="text-sm text-muted-foreground">Escolha uma data primeiro</p>
                    ) : loadingSlots ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" /> Buscando horários...
                      </div>
                    ) : !slots || slots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum horário disponível neste dia</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                        {slots.map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={slot === s ? 'default' : 'outline'}
                            onClick={() => setSlot(s)}
                          >
                            {format(new Date(s), 'HH:mm')}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setStep('form')} disabled={!slot}>
                    Continuar
                  </Button>
                </div>
              </div>
            )}

            {step === 'form' && eventType && slot && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep('date')}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                  </Button>
                </div>

                <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                  <p className="flex items-center gap-2 font-medium">
                    <CalendarDays className="w-4 h-4" />
                    {format(new Date(slot), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                  <p className="text-muted-foreground">
                    {eventType.name} • {eventType.duration_minutes} min
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="name">Nome completo *</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="phone">WhatsApp *</Label>
                    <Input
                      id="phone"
                      placeholder="(11) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email {emailRequired && '*'}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Confirmar agendamento
                  </Button>
                </div>
              </div>
            )}

            {step === 'success' && bookingResult && eventType && slot && (
              <div className="text-center py-6 space-y-4">
                <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
                <div>
                  <h3 className="text-xl font-semibold">Agendamento confirmado!</h3>
                  <p className="text-muted-foreground mt-2">
                    {format(new Date(slot), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 justify-center pt-4">
                  <Button asChild variant="outline">
                    <a href={googleCalendarUrl} target="_blank" rel="noreferrer">
                      <CalendarDays className="w-4 h-4 mr-2" /> Adicionar ao Google Calendar
                    </a>
                  </Button>
                  <Button asChild variant="ghost">
                    <a href={cancelUrl}>Cancelar agendamento</a>
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground pt-4 flex items-center justify-center gap-3">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Lembretes WhatsApp
                  </span>
                  {cal.bookings_email_enabled && email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Lembretes Email
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
