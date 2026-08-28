import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCalendar } from '@/hooks/useCalendars';
import { useEventTypes, useDeleteEventType } from '@/hooks/useEventTypes';
import { CalendarFormDialog } from '@/components/calendars/CalendarFormDialog';
import { AvailabilityEditor } from '@/components/calendars/AvailabilityEditor';
import { EventTypeFormDialog } from '@/components/calendars/EventTypeFormDialog';
import { CalendarBlocksList } from '@/components/calendars/CalendarBlocksList';
import { SaveAsTemplateDialog } from '@/components/calendars/SaveAsTemplateDialog';
import type { EventType } from '@/types/booking';

export default function CalendarEditor() {
  const { id } = useParams<{ id: string }>();
  const { data: calendar, isLoading } = useCalendar(id ?? null);
  const { data: eventTypes } = useEventTypes(id ?? null);
  const deleteEventType = useDeleteEventType();

  const [editingCalOpen, setEditingCalOpen] = useState(false);
  const [editingEt, setEditingEt] = useState<EventType | null>(null);
  const [etDialogOpen, setEtDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  if (!calendar) return <div className="p-6">Calendário não encontrado.</div>;

  const openCreateEt = () => {
    setEditingEt(null);
    setEtDialogOpen(true);
  };
  const openEditEt = (et: EventType) => {
    setEditingEt(et);
    setEtDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/calendarios"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: calendar.color }} />
          <h1 className="text-2xl font-bold">{calendar.name}</h1>
          {!calendar.is_active && <Badge variant="secondary">Inativo</Badge>}
          {!calendar.reminders_enabled && <Badge variant="secondary">Silencioso</Badge>}
        </div>
        <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
          <Bookmark className="w-4 h-4 mr-2" /> Salvar como template
        </Button>
        <Button variant="outline" onClick={() => setEditingCalOpen(true)}>
          <Pencil className="w-4 h-4 mr-2" /> Editar dados
        </Button>
      </div>

      <Tabs defaultValue="availability">
        <TabsList>
          <TabsTrigger value="availability">Disponibilidade</TabsTrigger>
          <TabsTrigger value="event_types">Tipos de evento</TabsTrigger>
          <TabsTrigger value="blocks">Bloqueios</TabsTrigger>
        </TabsList>

        <TabsContent value="availability" className="pt-4">
          <Card className="p-4">
            <AvailabilityEditor calendarId={calendar.id} />
          </Card>
        </TabsContent>

        <TabsContent value="event_types" className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Tipos de evento</h3>
            <Button size="sm" onClick={openCreateEt}>
              <Plus className="w-4 h-4 mr-1" /> Novo tipo
            </Button>
          </div>
          <div className="space-y-2">
            {(eventTypes ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum tipo de evento ainda.</p>
            ) : (
              eventTypes!.map((et) => (
                <Card key={et.id} className="p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{et.name}</span>
                      {!et.is_active && <Badge variant="secondary">Inativo</Badge>}
                      {et.requires_confirmation && <Badge variant="outline">Confirmação manual</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {et.duration_minutes} min · slots a cada {et.slot_interval_minutes} min · antecedência {et.min_notice_hours}h
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEditEt(et)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteEventType.mutate({ id: et.id, calendar_id: calendar.id })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="blocks" className="pt-4">
          <Card className="p-4">
            <CalendarBlocksList calendarId={calendar.id} organizationId={calendar.organization_id} />
          </Card>
        </TabsContent>
      </Tabs>

      <CalendarFormDialog open={editingCalOpen} onOpenChange={setEditingCalOpen} calendar={calendar} />
      <EventTypeFormDialog open={etDialogOpen} onOpenChange={setEtDialogOpen} calendarId={calendar.id} eventType={editingEt} />
      <SaveAsTemplateDialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen} calendarId={calendar.id} calendarName={calendar.name} />
    </div>
  );
}
