import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Send, AlarmClock, CalendarClock, Repeat } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSnoozeContact } from "@/hooks/useSnooze";
import {
  RecurrenceRule,
  ScheduledMessage,
  useUpdateScheduledMessage,
} from "@/hooks/useScheduledMessages";
import { useQueryClient } from "@tanstack/react-query";

interface DeferScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  organizationId: string;
  editing?: ScheduledMessage | null;
}

const DEFAULT_MESSAGE = "Olá! Passando para dar continuidade ao nosso atendimento. Como posso ajudar?";

export function DeferScheduleDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  organizationId,
  editing,
}: DeferScheduleDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("defer");
  const [date, setDate] = useState<Date>();
  const [hour, setHour] = useState<string>("09");
  const [minute, setMinute] = useState<string>("00");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(null);
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const [recurrenceEndAt, setRecurrenceEndAt] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextBusinessDay, setNextBusinessDay] = useState<Date | null>(null);

  const snoozeContact = useSnoozeContact();
  const updateScheduled = useUpdateScheduledMessage();
  const queryClient = useQueryClient();
  const isEditing = !!editing;

  // Hydrate from editing target
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const d = new Date(editing.scheduled_at);
      setActiveTab("schedule");
      setDate(d);
      setHour(String(d.getHours()).padStart(2, "0"));
      setMinute(String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, "0"));
      setMessage(editing.message_content);
      setRecurrenceRule(editing.recurrence_rule);
      setRecurrenceInterval(editing.recurrence_interval || 1);
      setRecurrenceEndAt(editing.recurrence_end_at ? new Date(editing.recurrence_end_at) : undefined);
    }
  }, [open, editing]);

  useEffect(() => {
    if (!open || !organizationId) return;
    const fetchNextOpenSlot = async () => {
      try {
        const { data, error } = await supabase.rpc('get_next_open_slot', {
          p_organization_id: organizationId,
        });
        if (!error && data) setNextBusinessDay(new Date(data));
      } catch (err) {
        console.error('Error fetching next open slot:', err);
      }
    };
    fetchNextOpenSlot();
  }, [open, organizationId]);

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  const minutes = ["00", "15", "30", "45"];

  const handleDefer = async () => {
    setIsSubmitting(true);
    try {
      await snoozeContact.mutateAsync(contactId);
      onOpenChange(false);
    } catch (err) {
      console.error("Error deferring contact:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSchedule = async () => {
    if (!date) {
      toast.error("Selecione uma data");
      return;
    }
    if (!message.trim()) {
      toast.error("Digite uma mensagem");
      return;
    }

    const scheduledAt = new Date(date);
    scheduledAt.setHours(parseInt(hour), parseInt(minute), 0, 0);

    if (!isEditing && scheduledAt <= new Date()) {
      toast.error("A data/hora deve ser no futuro");
      return;
    }

    if (recurrenceRule && recurrenceEndAt && recurrenceEndAt <= scheduledAt) {
      toast.error("A data limite da recorrência deve ser após a primeira execução");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && editing) {
        await updateScheduled.mutateAsync({
          id: editing.id,
          scheduled_at: scheduledAt.toISOString(),
          message_content: message.trim(),
          recurrence_rule: recurrenceRule,
          recurrence_interval: Math.max(1, recurrenceInterval || 1),
          recurrence_end_at: recurrenceEndAt ? recurrenceEndAt.toISOString() : null,
        });
        onOpenChange(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await (supabase as any).from("scheduled_messages").insert({
        organization_id: organizationId,
        contact_id: contactId,
        scheduled_by: user.id,
        message_content: message.trim(),
        scheduled_at: scheduledAt.toISOString(),
        recurrence_rule: recurrenceRule,
        recurrence_interval: Math.max(1, recurrenceInterval || 1),
        recurrence_end_at: recurrenceEndAt ? recurrenceEndAt.toISOString() : null,
      });

      if (error) throw error;

      const suffix = recurrenceRule ? " (recorrente)" : "";
      toast.success(
        `Mensagem agendada para ${format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}${suffix}`,
      );
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-contacts'] });
      onOpenChange(false);

      setDate(undefined);
      setHour("09");
      setMinute("00");
      setMessage(DEFAULT_MESSAGE);
      setRecurrenceRule(null);
      setRecurrenceInterval(1);
      setRecurrenceEndAt(undefined);
    } catch (err) {
      console.error("Error scheduling message:", err);
      toast.error("Erro ao agendar mensagem");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setActiveTab("defer");
      setDate(undefined);
      setHour("09");
      setMinute("00");
      setMessage(DEFAULT_MESSAGE);
      setRecurrenceRule(null);
      setRecurrenceInterval(1);
      setRecurrenceEndAt(undefined);
    }
    onOpenChange(newOpen);
  };

  const nextBusinessDayPreview = nextBusinessDay
    ? format(nextBusinessDay, "EEEE, dd/MM", { locale: ptBR })
    : "Carregando...";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {isEditing ? "Editar agendamento" : "Adiar ou Agendar"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? <>Editando agendamento para <span className="font-medium">{contactName}</span></>
              : <>Configure quando retomar o atendimento de <span className="font-medium">{contactName}</span></>}
          </DialogDescription>
        </DialogHeader>

        {isEditing ? (
          <div className="space-y-4 pt-2">
            <ScheduleForm
              date={date}
              setDate={setDate}
              hour={hour} setHour={setHour}
              minute={minute} setMinute={setMinute}
              hours={hours} minutes={minutes}
              message={message} setMessage={setMessage}
              recurrenceRule={recurrenceRule} setRecurrenceRule={setRecurrenceRule}
              recurrenceInterval={recurrenceInterval} setRecurrenceInterval={setRecurrenceInterval}
              recurrenceEndAt={recurrenceEndAt} setRecurrenceEndAt={setRecurrenceEndAt}
            />
            <Button className="w-full" onClick={handleSchedule} disabled={isSubmitting}>
              <Send className="mr-2 h-4 w-4" />
              {isSubmitting ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="defer" className="flex items-center gap-2">
                <AlarmClock className="h-4 w-4" />
                Adiar
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Agendar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="defer" className="space-y-4 pt-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <AlarmClock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Próximo dia útil</p>
                    <p className="text-sm text-muted-foreground capitalize">{nextBusinessDayPreview}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  O contato será movido para a aba "Agendados" e reaparecerá automaticamente na abertura do próximo dia útil.
                </p>
              </div>

              <Button className="w-full" onClick={handleDefer} disabled={isSubmitting}>
                {isSubmitting ? "Adiando..." : "Adiar atendimento"}
              </Button>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4 pt-4">
              <ScheduleForm
                date={date}
                setDate={setDate}
                hour={hour} setHour={setHour}
                minute={minute} setMinute={setMinute}
                hours={hours} minutes={minutes}
                message={message} setMessage={setMessage}
                recurrenceRule={recurrenceRule} setRecurrenceRule={setRecurrenceRule}
                recurrenceInterval={recurrenceInterval} setRecurrenceInterval={setRecurrenceInterval}
                recurrenceEndAt={recurrenceEndAt} setRecurrenceEndAt={setRecurrenceEndAt}
              />
              <Button className="w-full" onClick={handleSchedule} disabled={isSubmitting}>
                <Send className="mr-2 h-4 w-4" />
                {isSubmitting ? "Agendando..." : "Agendar mensagem"}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ScheduleFormProps {
  date: Date | undefined;
  setDate: (d: Date | undefined) => void;
  hour: string; setHour: (s: string) => void;
  minute: string; setMinute: (s: string) => void;
  hours: string[]; minutes: string[];
  message: string; setMessage: (s: string) => void;
  recurrenceRule: RecurrenceRule; setRecurrenceRule: (r: RecurrenceRule) => void;
  recurrenceInterval: number; setRecurrenceInterval: (n: number) => void;
  recurrenceEndAt: Date | undefined; setRecurrenceEndAt: (d: Date | undefined) => void;
}

function ScheduleForm({
  date, setDate, hour, setHour, minute, setMinute, hours, minutes,
  message, setMessage, recurrenceRule, setRecurrenceRule,
  recurrenceInterval, setRecurrenceInterval, recurrenceEndAt, setRecurrenceEndAt,
}: ScheduleFormProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label>Data</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !date && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP", { locale: ptBR }) : "Selecione uma data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              initialFocus
              className="p-3 pointer-events-auto"
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-2">
        <Label>Horário</Label>
        <div className="flex gap-2">
          <Select value={hour} onValueChange={setHour}>
            <SelectTrigger className="w-[100px]"><SelectValue placeholder="Hora" /></SelectTrigger>
            <SelectContent>
              {hours.map((h) => (<SelectItem key={h} value={h}>{h}h</SelectItem>))}
            </SelectContent>
          </Select>
          <span className="flex items-center text-muted-foreground">:</span>
          <Select value={minute} onValueChange={setMinute}>
            <SelectTrigger className="w-[100px]"><SelectValue placeholder="Min" /></SelectTrigger>
            <SelectContent>
              {minutes.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2 rounded-lg border p-3 bg-muted/20">
        <Label className="flex items-center gap-2"><Repeat className="h-4 w-4" /> Repetir</Label>
        <Select
          value={recurrenceRule ?? 'none'}
          onValueChange={(v) => setRecurrenceRule(v === 'none' ? null : (v as RecurrenceRule))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Não repete</SelectItem>
            <SelectItem value="daily">Diariamente</SelectItem>
            <SelectItem value="weekly">Semanalmente</SelectItem>
            <SelectItem value="monthly">Mensalmente</SelectItem>
            <SelectItem value="yearly">Anualmente</SelectItem>
          </SelectContent>
        </Select>

        {recurrenceRule && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">A cada</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label className="text-xs">Até (opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal text-sm",
                        !recurrenceEndAt && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {recurrenceEndAt ? format(recurrenceEndAt, "dd/MM/yyyy", { locale: ptBR }) : "Sem fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={recurrenceEndAt}
                      onSelect={setRecurrenceEndAt}
                      disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className="p-3 pointer-events-auto"
                      locale={ptBR}
                    />
                    {recurrenceEndAt && (
                      <div className="p-2 border-t">
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setRecurrenceEndAt(undefined)}>
                          Limpar
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              A mensagem será reenviada automaticamente no mesmo horário, no intervalo escolhido.
            </p>
          </>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Mensagem</Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Digite a mensagem..."
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Esta mensagem será enviada automaticamente no horário agendado.
        </p>
      </div>
    </>
  );
}
