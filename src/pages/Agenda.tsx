import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Calendar as CalendarIcon, CalendarDays, BellRing } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBookings } from '@/hooks/useBookings';
import { useCalendars } from '@/hooks/useCalendars';
import { InternalBookingDialog } from '@/components/agenda/InternalBookingDialog';
import { BookingDetailDialog } from '@/components/agenda/BookingDetailDialog';
import { STATUS_LABELS, STATUS_COLORS, type Booking } from '@/types/booking';
import Calendars from './Calendars';
import { BookingsSettingsCard } from '@/components/organization/BookingsSettingsCard';

type TabKey = 'agenda' | 'calendarios' | 'lembretes';
const VALID_TABS: TabKey[] = ['agenda', 'calendarios', 'lembretes'];

function AgendaList() {
  const { data: calendars } = useCalendars();
  const [calendarId, setCalendarId] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);

  const { data: bookings } = useBookings({
    calendarId: calendarId === 'all' ? null : calendarId,
  });

  const grouped = (bookings ?? []).reduce((acc, b) => {
    const key = format(parseISO(b.starts_at), 'yyyy-MM-dd');
    (acc[key] ||= []).push(b);
    return acc;
  }, {} as Record<string, typeof bookings>);

  const sortedDates = Object.keys(grouped).sort();
  const calendarsById = new Map((calendars ?? []).map((c) => [c.id, c]));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <p className="text-muted-foreground text-sm">Próximos agendamentos da organização.</p>
        <div className="flex items-center gap-2">
          <Select value={calendarId} onValueChange={setCalendarId}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os calendários</SelectItem>
              {(calendars ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Novo agendamento
          </Button>
        </div>
      </div>

      {sortedDates.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </h2>
              <div className="space-y-2">
                {grouped[date]!.map((b) => {
                  const cal = calendarsById.get(b.calendar_id);
                  return (
                    <Card
                      key={b.id}
                      className="p-3 flex items-center gap-3 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => setSelected(b)}
                    >
                      <div
                        className="w-1 h-12 rounded-full shrink-0"
                        style={{ backgroundColor: cal?.color ?? 'hsl(var(--primary))' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">
                            {format(parseISO(b.starts_at), 'HH:mm')}
                            {' - '}
                            {format(parseISO(b.ends_at), 'HH:mm')}
                          </span>
                          <span className="text-sm">{b.customer_name}</span>
                          <Badge className={STATUS_COLORS[b.status]} variant="outline">
                            {STATUS_LABELS[b.status]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cal?.name} · {b.customer_phone}
                          {b.customer_email && ` · ${b.customer_email}`}
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <InternalBookingDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <BookingDetailDialog
        booking={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}

export default function Agenda() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'agenda';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Agenda</h1>
        <p className="text-muted-foreground text-sm">Agendamentos, calendários e lembretes em um só lugar.</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="agenda" className="gap-2">
            <CalendarIcon className="w-4 h-4" /> Agenda
          </TabsTrigger>
          <TabsTrigger value="calendarios" className="gap-2">
            <CalendarDays className="w-4 h-4" /> Calendários
          </TabsTrigger>
          <TabsTrigger value="lembretes" className="gap-2">
            <BellRing className="w-4 h-4" /> Lembretes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-0">
          <AgendaList />
        </TabsContent>
        <TabsContent value="calendarios" className="mt-0">
          <Calendars />
        </TabsContent>
        <TabsContent value="lembretes" className="mt-0">
          <BookingsSettingsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
