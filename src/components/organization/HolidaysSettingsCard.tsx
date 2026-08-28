import { useState } from 'react';
import { CalendarDays, Plus, Trash2, Save, Loader2, Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  useOrganizationHolidays, 
  useCreateHoliday, 
  useDeleteHoliday,
  OrganizationHoliday 
} from '@/hooks/useOrganizationHolidays';

interface HolidaysSettingsCardProps {
  isOwner: boolean;
}

export function HolidaysSettingsCard({ isOwner }: HolidaysSettingsCardProps) {
  const { data: holidays, isLoading } = useOrganizationHolidays();
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    holiday_date: '',
    is_closed: true,
    custom_hours_start: '',
    custom_hours_end: '',
    return_date: '',
  });

  const handleCreateHoliday = async () => {
    if (!newHoliday.name || !newHoliday.holiday_date) {
      toast.error('Preencha o nome e a data do feriado');
      return;
    }

    try {
      await createHoliday.mutateAsync({
        name: newHoliday.name,
        holiday_date: newHoliday.holiday_date,
        is_closed: newHoliday.is_closed,
        custom_hours_start: newHoliday.is_closed ? null : newHoliday.custom_hours_start || null,
        custom_hours_end: newHoliday.is_closed ? null : newHoliday.custom_hours_end || null,
        return_date: newHoliday.return_date || null,
      });
      toast.success('Feriado adicionado!');
      setIsDialogOpen(false);
      setNewHoliday({
        name: '',
        holiday_date: '',
        is_closed: true,
        custom_hours_start: '',
        custom_hours_end: '',
        return_date: '',
      });
    } catch {
      toast.error('Erro ao adicionar feriado');
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      await deleteHoliday.mutateAsync(id);
      toast.success('Feriado removido!');
    } catch {
      toast.error('Erro ao remover feriado');
    }
  };

  const futureHolidays = holidays?.filter(h => 
    !isBefore(parseISO(h.holiday_date), new Date())
  ) || [];

  const pastHolidays = holidays?.filter(h => 
    isBefore(parseISO(h.holiday_date), new Date())
  ) || [];

  const formatHolidayDate = (dateStr: string) => {
    return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const HolidayItem = ({ holiday }: { holiday: OrganizationHoliday }) => (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{holiday.name}</span>
          {holiday.is_closed ? (
            <Badge variant="destructive" className="text-xs">Fechado</Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              {holiday.custom_hours_start?.substring(0, 5)} - {holiday.custom_hours_end?.substring(0, 5)}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatHolidayDate(holiday.holiday_date)}
          {holiday.return_date && (
            <span> • Retorno: {formatHolidayDate(holiday.return_date)}</span>
          )}
        </p>
      </div>
      {isOwner && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleDeleteHoliday(holiday.id)}
          disabled={deleteHoliday.isPending}
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      )}
    </div>
  );

  return (
    <>
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Feriados
              </CardTitle>
              <CardDescription>
                Configure feriados e datas especiais
              </CardDescription>
            </div>
            {isOwner && (
              <Button size="sm" onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : futureHolidays.length === 0 && pastHolidays.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum feriado cadastrado
            </p>
          ) : (
            <>
              {futureHolidays.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Próximos Feriados
                  </Label>
                  <div className="space-y-2">
                    {futureHolidays.map((holiday) => (
                      <HolidayItem key={holiday.id} holiday={holiday} />
                    ))}
                  </div>
                </div>
              )}

              {pastHolidays.length > 0 && futureHolidays.length > 0 && (
                <Separator />
              )}

              {pastHolidays.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Feriados Passados
                  </Label>
                  <div className="space-y-2 opacity-60">
                    {pastHolidays.slice(0, 3).map((holiday) => (
                      <HolidayItem key={holiday.id} holiday={holiday} />
                    ))}
                    {pastHolidays.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{pastHolidays.length - 3} feriados anteriores
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Info about variables */}
          <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Variáveis disponíveis:</p>
            <p>• <code className="bg-background px-1 rounded">{'{proximo_feriado}'}</code> - Nome do próximo feriado</p>
            <p>• <code className="bg-background px-1 rounded">{'{data_feriado}'}</code> - Data do próximo feriado</p>
            <p>• <code className="bg-background px-1 rounded">{'{data_retorno}'}</code> - Data de retorno</p>
          </div>

          {!isOwner && (
            <p className="text-xs text-muted-foreground text-center">
              Apenas o proprietário pode alterar os feriados
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dialog for adding new holiday */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Feriado</DialogTitle>
            <DialogDescription>
              Adicione um feriado ou data especial
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Feriado</Label>
              <Input
                value={newHoliday.name}
                onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Natal, Carnaval..."
              />
            </div>

            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={newHoliday.holiday_date}
                onChange={(e) => setNewHoliday(prev => ({ ...prev, holiday_date: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Fechado neste dia</Label>
                <p className="text-xs text-muted-foreground">
                  Ou defina um horário especial
                </p>
              </div>
              <Switch
                checked={newHoliday.is_closed}
                onCheckedChange={(checked) => setNewHoliday(prev => ({ ...prev, is_closed: checked }))}
              />
            </div>

            {!newHoliday.is_closed && (
              <div className="space-y-2">
                <Label>Horário Especial</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={newHoliday.custom_hours_start}
                    onChange={(e) => setNewHoliday(prev => ({ ...prev, custom_hours_start: e.target.value }))}
                    className="w-32"
                  />
                  <span className="text-muted-foreground">às</span>
                  <Input
                    type="time"
                    value={newHoliday.custom_hours_end}
                    onChange={(e) => setNewHoliday(prev => ({ ...prev, custom_hours_end: e.target.value }))}
                    className="w-32"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Data de Retorno (opcional)</Label>
              <Input
                type="date"
                value={newHoliday.return_date}
                onChange={(e) => setNewHoliday(prev => ({ ...prev, return_date: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Útil para feriados prolongados ou emendas
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateHoliday} disabled={createHoliday.isPending}>
              {createHoliday.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
