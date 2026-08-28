import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCreateEventType, useUpdateEventType } from '@/hooks/useEventTypes';
import { useCalendar } from '@/hooks/useCalendars';
import type { EventType } from '@/types/booking';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  calendarId: string;
  eventType?: EventType | null;
}

export function EventTypeFormDialog({ open, onOpenChange, calendarId, eventType }: Props) {
  const create = useCreateEventType();
  const update = useUpdateEventType();
  const { data: parentCal } = useCalendar(calendarId);
  const parentRemindersOff = parentCal && !parentCal.reminders_enabled;

  const [form, setForm] = useState<Partial<EventType>>({});

  useEffect(() => {
    if (eventType) {
      setForm(eventType);
    } else {
      setForm({
        name: '',
        description: '',
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        slot_interval_minutes: 30,
        min_notice_hours: 2,
        max_advance_days: 60,
        requires_confirmation: false,
        reminders_enabled: true,
        is_active: true,
      });
    }
  }, [eventType, open]);

  const update_ = (patch: Partial<EventType>) => setForm((s) => ({ ...s, ...patch }));

  const handleSubmit = async () => {
    if (!form.name?.trim()) return;
    if (eventType) {
      await update.mutateAsync({ id: eventType.id, ...form } as any);
    } else {
      await create.mutateAsync({ ...form, calendar_id: calendarId } as any);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{eventType ? 'Editar tipo de evento' : 'Novo tipo de evento'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-3 pt-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name ?? ''} onChange={(e) => update_({ name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description ?? ''} onChange={(e) => update_({ description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duração (min)</Label>
                <Input type="number" value={form.duration_minutes ?? 30} onChange={(e) => update_({ duration_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Intervalo de slots (min)</Label>
                <Input type="number" value={form.slot_interval_minutes ?? 30} onChange={(e) => update_({ slot_interval_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Buffer antes (min)</Label>
                <Input type="number" value={form.buffer_before_minutes ?? 0} onChange={(e) => update_({ buffer_before_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Buffer depois (min)</Label>
                <Input type="number" value={form.buffer_after_minutes ?? 0} onChange={(e) => update_({ buffer_after_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Antecedência mínima (h)</Label>
                <Input type="number" value={form.min_notice_hours ?? 2} onChange={(e) => update_({ min_notice_hours: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Antecedência máxima (dias)</Label>
                <Input type="number" value={form.max_advance_days ?? 60} onChange={(e) => update_({ max_advance_days: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="m-0">Requer confirmação manual</Label>
              <Switch checked={!!form.requires_confirmation} onCheckedChange={(v) => update_({ requires_confirmation: v })} />
            </div>
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="m-0">Enviar lembretes automáticos</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sobrescreve apenas para este tipo de evento.
                  </p>
                </div>
                <Switch
                  checked={!!form.reminders_enabled}
                  onCheckedChange={(v) => update_({ reminders_enabled: v })}
                  disabled={parentRemindersOff}
                />
              </div>
              {parentRemindersOff && (
                <p className="text-xs rounded bg-muted/50 px-2 py-1.5 text-muted-foreground">
                  ⚠️ O calendário está em modo silencioso — nenhum lembrete será enviado independente desta configuração.
                </p>
              )}
              {!parentRemindersOff && !form.reminders_enabled && (
                <p className="text-xs rounded bg-muted/50 px-2 py-1.5 text-muted-foreground">
                  Lembretes desligados apenas para este tipo de evento.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label className="m-0">Ativo</Label>
              <Switch checked={!!form.is_active} onCheckedChange={(v) => update_({ is_active: v })} />
            </div>
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">
              Use variáveis: {'{nome}'}, {'{data}'}, {'{hora}'}, {'{servico}'}, {'{calendario}'}
            </p>
            <div>
              <Label>Confirmação</Label>
              <Textarea rows={3} value={form.confirmation_message_whatsapp ?? ''} onChange={(e) => update_({ confirmation_message_whatsapp: e.target.value })} />
            </div>
            <div>
              <Label>Lembrete 24h antes</Label>
              <Textarea rows={3} value={form.reminder_24h_message_whatsapp ?? ''} onChange={(e) => update_({ reminder_24h_message_whatsapp: e.target.value })} />
            </div>
            <div>
              <Label>Lembrete 1h antes</Label>
              <Textarea rows={3} value={form.reminder_1h_message_whatsapp ?? ''} onChange={(e) => update_({ reminder_1h_message_whatsapp: e.target.value })} />
            </div>
            <div>
              <Label>Pedido de avaliação</Label>
              <Textarea rows={3} value={form.review_message_whatsapp ?? ''} onChange={(e) => update_({ review_message_whatsapp: e.target.value })} />
            </div>
            <div>
              <Label>Cancelamento</Label>
              <Textarea rows={2} value={form.cancellation_message_whatsapp ?? ''} onChange={(e) => update_({ cancellation_message_whatsapp: e.target.value })} />
            </div>
            <div>
              <Label>Reagendamento</Label>
              <Textarea rows={2} value={form.reschedule_message_whatsapp ?? ''} onChange={(e) => update_({ reschedule_message_whatsapp: e.target.value })} />
            </div>
          </TabsContent>

          <TabsContent value="email" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">Assuntos personalizados dos emails enviados.</p>
            <div>
              <Label>Assunto - Confirmação</Label>
              <Input value={form.confirmation_subject_email ?? ''} onChange={(e) => update_({ confirmation_subject_email: e.target.value })} />
            </div>
            <div>
              <Label>Assunto - 24h antes</Label>
              <Input value={form.reminder_24h_subject_email ?? ''} onChange={(e) => update_({ reminder_24h_subject_email: e.target.value })} />
            </div>
            <div>
              <Label>Assunto - 1h antes</Label>
              <Input value={form.reminder_1h_subject_email ?? ''} onChange={(e) => update_({ reminder_1h_subject_email: e.target.value })} />
            </div>
            <div>
              <Label>Assunto - Pedido de avaliação</Label>
              <Input value={form.review_subject_email ?? ''} onChange={(e) => update_({ review_subject_email: e.target.value })} />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {eventType ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
