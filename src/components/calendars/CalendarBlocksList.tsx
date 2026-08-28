import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { useCalendarBlocks, useCreateBlock, useDeleteBlock } from '@/hooks/useAvailability';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function CalendarBlocksList({ calendarId, organizationId }: { calendarId: string; organizationId: string }) {
  const { data: blocks } = useCalendarBlocks(calendarId);
  const createBlock = useCreateBlock();
  const deleteBlock = useDeleteBlock();

  const [showForm, setShowForm] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');

  const handleCreate = async () => {
    if (!startsAt || !endsAt) return;
    await createBlock.mutateAsync({
      calendar_id: calendarId,
      organization_id: organizationId,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      reason: reason.trim() || undefined,
    });
    setShowForm(false);
    setStartsAt('');
    setEndsAt('');
    setReason('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Períodos bloqueados</h3>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" /> Novo
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Motivo (opcional)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Férias, congresso..." />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={createBlock.isPending}>Salvar</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {(blocks ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum bloqueio cadastrado.</p>
        ) : (
          blocks!.map((b) => (
            <div key={b.id} className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <p className="font-medium text-sm">
                  {format(parseISO(b.starts_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  {' → '}
                  {format(parseISO(b.ends_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
                {b.reason && <p className="text-xs text-muted-foreground mt-1">{b.reason}</p>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => deleteBlock.mutate({ id: b.id, calendar_id: calendarId })}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
