import { useState, useEffect } from 'react';
import { Clock, Save, Loader2, Coffee, Calendar, Bot, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface BusinessHoursSettingsCardProps {
  organizationId: string;
  businessHoursStart: string;
  businessHoursEnd: string;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  lunchBreakEnabled: boolean;
  lunchBreakDays: number[];
  workingDays: number[];
  weekendHoursEnabled: boolean;
  weekendHoursStart: string;
  weekendHoursEnd: string;
  closedHoursMessage: string | null;
  isOwner: boolean;
}

const WEEKDAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const WEEKEND_DAYS = [0, 6];

const sortNumbers = (values: number[]) => [...values].sort((a, b) => a - b);

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const getSaoPauloNow = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

  return { day: weekdayMap[weekday] ?? 1, minutes: hour * 60 + minute };
};

export function BusinessHoursSettingsCard({
  organizationId,
  businessHoursStart,
  businessHoursEnd,
  lunchBreakStart,
  lunchBreakEnd,
  lunchBreakEnabled,
  lunchBreakDays,
  workingDays,
  weekendHoursEnabled,
  weekendHoursStart,
  weekendHoursEnd,
  closedHoursMessage,
  isOwner,
}: BusinessHoursSettingsCardProps) {
  const queryClient = useQueryClient();
  
  // Format time from TIME type (HH:MM:SS) to input format (HH:MM)
  const formatTimeForInput = (time: string) => {
    if (!time) return '08:00';
    return time.substring(0, 5);
  };

  const [hoursStart, setHoursStart] = useState(formatTimeForInput(businessHoursStart));
  const [hoursEnd, setHoursEnd] = useState(formatTimeForInput(businessHoursEnd));
  const [lunchStart, setLunchStart] = useState(formatTimeForInput(lunchBreakStart));
  const [lunchEnd, setLunchEnd] = useState(formatTimeForInput(lunchBreakEnd));
  const [lunchEnabled, setLunchEnabled] = useState(lunchBreakEnabled);
  const [lunchDays, setLunchDays] = useState<number[]>(lunchBreakDays || [1, 2, 3, 4, 5]);
  const [days, setDays] = useState<number[]>(workingDays || [1, 2, 3, 4, 5]);
  const [weekendEnabled, setWeekendEnabled] = useState(weekendHoursEnabled);
  const [weekendStart, setWeekendStart] = useState(formatTimeForInput(weekendHoursStart));
  const [weekendEnd, setWeekendEnd] = useState(formatTimeForInput(weekendHoursEnd));

  const DEFAULT_CLOSED_MSG = 'Estamos fechados no momento, mas você já pode adiantar sua demanda (enviar detalhes, dúvidas ou informações relevantes) para agilizar o atendimento quando a equipe retornar.';
  const [closedMsg, setClosedMsg] = useState(closedHoursMessage || DEFAULT_CLOSED_MSG);

  const selectedWeekendDays = WEEKDAYS.filter((day) => WEEKEND_DAYS.includes(day.value) && days.includes(day.value));
  const hasWeekendDays = selectedWeekendDays.length > 0;
  const nowInSaoPaulo = getSaoPauloNow();
  const currentDayIsOpen = days.includes(nowInSaoPaulo.day);
  const currentUsesWeekendHours = weekendEnabled && WEEKEND_DAYS.includes(nowInSaoPaulo.day) && currentDayIsOpen;
  const currentStart = currentUsesWeekendHours ? weekendStart : hoursStart;
  const currentEnd = currentUsesWeekendHours ? weekendEnd : hoursEnd;
  const isOpenNow = currentDayIsOpen && nowInSaoPaulo.minutes >= timeToMinutes(currentStart) && nowInSaoPaulo.minutes < timeToMinutes(currentEnd);
  const currentStatusText = currentDayIsOpen
    ? `${isOpenNow ? 'Aberto agora' : 'Fechado agora'} • hoje ${currentStart} às ${currentEnd}`
    : 'Fechado agora • hoje sem expediente';
  const weekendDescription = hasWeekendDays
    ? `Aplica somente em: ${selectedWeekendDays.map((day) => day.label).join(' e ')}.`
    : 'Selecione sábado e/ou domingo em Dias de Funcionamento para liberar horário de fim de semana.';

  const hasChanges = 
    hoursStart !== formatTimeForInput(businessHoursStart) ||
    hoursEnd !== formatTimeForInput(businessHoursEnd) ||
    lunchStart !== formatTimeForInput(lunchBreakStart) ||
    lunchEnd !== formatTimeForInput(lunchBreakEnd) ||
    lunchEnabled !== lunchBreakEnabled ||
    JSON.stringify(sortNumbers(lunchDays)) !== JSON.stringify(sortNumbers(lunchBreakDays || [1, 2, 3, 4, 5])) ||
    JSON.stringify(sortNumbers(days)) !== JSON.stringify(sortNumbers(workingDays || [1, 2, 3, 4, 5])) ||
    weekendEnabled !== weekendHoursEnabled ||
    weekendStart !== formatTimeForInput(weekendHoursStart) ||
    weekendEnd !== formatTimeForInput(weekendHoursEnd) ||
    closedMsg !== (closedHoursMessage || DEFAULT_CLOSED_MSG);

  useEffect(() => {
    setHoursStart(formatTimeForInput(businessHoursStart));
    setHoursEnd(formatTimeForInput(businessHoursEnd));
    setLunchStart(formatTimeForInput(lunchBreakStart));
    setLunchEnd(formatTimeForInput(lunchBreakEnd));
    setLunchEnabled(lunchBreakEnabled);
    setLunchDays(lunchBreakDays || [1, 2, 3, 4, 5]);
    setDays(workingDays || [1, 2, 3, 4, 5]);
    setWeekendEnabled(weekendHoursEnabled);
    setWeekendStart(formatTimeForInput(weekendHoursStart));
    setWeekendEnd(formatTimeForInput(weekendHoursEnd));
    setClosedMsg(closedHoursMessage || DEFAULT_CLOSED_MSG);
  }, [businessHoursStart, businessHoursEnd, lunchBreakStart, lunchBreakEnd, lunchBreakEnabled, lunchBreakDays, workingDays, weekendHoursEnabled, weekendHoursStart, weekendHoursEnd, closedHoursMessage]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('organizations')
        .update({
          business_hours_start: hoursStart + ':00',
          business_hours_end: hoursEnd + ':00',
          lunch_break_start: lunchStart + ':00',
          lunch_break_end: lunchEnd + ':00',
          lunch_break_enabled: lunchEnabled,
          lunch_break_days: lunchDays,
          working_days: days,
          weekend_hours_enabled: weekendEnabled,
          weekend_hours_start: weekendStart + ':00',
          weekend_hours_end: weekendEnd + ':00',
          closed_hours_message: closedMsg,
        } as any)
        .eq('id', organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organization'] });
      toast.success('Horário de funcionamento atualizado!');
    },
    onError: () => {
      toast.error('Erro ao salvar horário');
    },
  });

  const toggleDay = (day: number) => {
    setDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const toggleLunchDay = (day: number) => {
    setLunchDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Horário de Funcionamento
          </CardTitle>
          <CardDescription>
            Configure o horário de atendimento da empresa
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Working Hours */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Horário de Atendimento (Dias Úteis)</Label>
          <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${isOpenNow ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-muted/50 text-muted-foreground'}`}>
            <span className={`h-2 w-2 rounded-full ${isOpenNow ? 'bg-primary' : 'bg-muted-foreground'}`} />
            {currentStatusText}
          </div>
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Início</Label>
              <Input
                type="time"
                value={hoursStart}
                onChange={(e) => setHoursStart(e.target.value)}
                disabled={!isOwner}
                className="w-32"
              />
            </div>
            <span className="text-muted-foreground mt-5">às</span>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fim</Label>
              <Input
                type="time"
                value={hoursEnd}
                onChange={(e) => setHoursEnd(e.target.value)}
                disabled={!isOwner}
                className="w-32"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Working Days */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Dias de Funcionamento</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => {
              const isSelected = days.includes(day.value);
              const isWeekend = WEEKEND_DAYS.includes(day.value);
              const hoursLabel = !isSelected
                ? 'Fechado'
                : isWeekend && weekendEnabled
                  ? `${weekendStart}–${weekendEnd}`
                  : `${hoursStart}–${hoursEnd}`;

              return (
                <label
                  key={day.value}
                  className={`
                    flex min-w-20 flex-col items-center justify-center rounded-md cursor-pointer
                    border-2 px-3 py-2 transition-all text-sm font-medium
                    ${isSelected 
                      ? 'bg-primary text-primary-foreground border-primary' 
                      : 'bg-muted border-border text-muted-foreground hover:border-muted-foreground/50'
                    }
                    ${!isOwner ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => isOwner && toggleDay(day.value)}
                    disabled={!isOwner}
                    className="sr-only"
                  />
                  <span>{day.label}</span>
                  <span className="mt-0.5 text-[10px] font-normal opacity-80">{hoursLabel}</span>
                </label>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Weekend Hours */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Horário Diferenciado (Sábado/Domingo)
            </Label>
            <Switch
              checked={weekendEnabled}
              onCheckedChange={setWeekendEnabled}
              disabled={!isOwner || !hasWeekendDays}
            />
          </div>
          
          <div className="space-y-3 pl-4 border-l-2 border-primary/20">
            <p className="text-xs text-muted-foreground">
              {weekendDescription} Dias fechados não usam esse horário.
            </p>
            {weekendEnabled && hasWeekendDays && (
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Início</Label>
                  <Input
                    type="time"
                    value={weekendStart}
                    onChange={(e) => setWeekendStart(e.target.value)}
                    disabled={!isOwner}
                    className="w-32"
                  />
                </div>
                <span className="text-muted-foreground mt-5">às</span>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fim</Label>
                  <Input
                    type="time"
                    value={weekendEnd}
                    onChange={(e) => setWeekendEnd(e.target.value)}
                    disabled={!isOwner}
                    className="w-32"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Lunch Break */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Coffee className="w-4 h-4" />
              Intervalo de Almoço
            </Label>
            <Switch
              checked={lunchEnabled}
              onCheckedChange={setLunchEnabled}
              disabled={!isOwner}
            />
          </div>
          
          {lunchEnabled && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Início</Label>
                  <Input
                    type="time"
                    value={lunchStart}
                    onChange={(e) => setLunchStart(e.target.value)}
                    disabled={!isOwner}
                    className="w-32"
                  />
                </div>
                <span className="text-muted-foreground mt-5">às</span>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fim</Label>
                  <Input
                    type="time"
                    value={lunchEnd}
                    onChange={(e) => setLunchEnd(e.target.value)}
                    disabled={!isOwner}
                    className="w-32"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Dias com intervalo de almoço</Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.filter(day => days.includes(day.value)).map((day) => (
                    <label
                      key={day.value}
                      className={`
                        flex items-center justify-center w-12 h-8 rounded-md cursor-pointer
                        border transition-all text-xs font-medium
                        ${lunchDays.includes(day.value) 
                          ? 'bg-orange-500/20 text-orange-600 border-orange-500' 
                          : 'bg-muted border-border hover:border-muted-foreground/50'
                        }
                        ${!isOwner ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={lunchDays.includes(day.value)}
                        onChange={() => isOwner && toggleLunchDay(day.value)}
                        disabled={!isOwner}
                        className="sr-only"
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Closed Hours AI Message */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Mensagem IA (Fora do Expediente)
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Info className="w-4 h-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p>
                  Instrução adicionada ao agente conversacional de IA quando o estabelecimento está fechado. 
                  O agente usará esse texto para orientar o cliente.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Textarea
            value={closedMsg}
            onChange={(e) => setClosedMsg(e.target.value)}
            disabled={!isOwner}
            rows={3}
            placeholder="Instrução para o agente quando estiver fora do expediente..."
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Variáveis disponíveis: o agente já sabe o horário de reabertura e informará automaticamente.
          </p>
        </div>

        {/* Save Button */}
        {isOwner && (
          <Button 
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
            className="w-full"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Horário
          </Button>
        )}

        {!isOwner && (
          <p className="text-xs text-muted-foreground text-center">
            Apenas o proprietário pode alterar o horário de funcionamento
          </p>
        )}
      </CardContent>
    </Card>
  );
}