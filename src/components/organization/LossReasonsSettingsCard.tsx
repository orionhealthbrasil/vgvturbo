import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, Pencil, Check, X, TrendingDown } from 'lucide-react';
import {
  useLossReasons,
  useCreateLossReason,
  useUpdateLossReason,
  useDeleteLossReason,
} from '@/hooks/useLossReasons';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];

export function LossReasonsSettingsCard() {
  const { data: reasons = [], isLoading } = useLossReasons();
  const create = useCreateLossReason();
  const update = useUpdateLossReason();
  const remove = useDeleteLossReason();

  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState<string>(PALETTE[0]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<string | null>(null);

  const handleCreate = async () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    try {
      await create.mutateAsync({ label: trimmed, color: newColor });
      setNewLabel('');
      toast.success('Motivo adicionado');
    } catch (e: any) {
      toast.error(e?.message?.includes('duplicate') ? 'Esse motivo já existe' : (e?.message || 'Erro ao adicionar motivo'));
    }
  };

  const handleStartEdit = (r: { id: string; label: string; color: string | null }) => {
    setEditingId(r.id);
    setEditLabel(r.label);
    setEditColor(r.color);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const trimmed = editLabel.trim();
    if (!trimmed) return;
    try {
      await update.mutateAsync({ id: editingId, label: trimmed, color: editColor });
      setEditingId(null);
      toast.success('Motivo atualizado');
    } catch (e: any) {
      toast.error(e?.message?.includes('duplicate') ? 'Já existe um motivo com esse nome' : (e?.message || 'Erro ao salvar'));
    }
  };

  const handleToggleActive = async (id: string, is_active: boolean) => {
    try {
      await update.mutateAsync({ id, is_active });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao atualizar');
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete);
      toast.success('Motivo removido');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao remover');
    } finally {
      setToDelete(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-rose-500" />
          Análise de perdas
        </CardTitle>
        <CardDescription>
          Cadastre os motivos de perda que aparecerão como opções no modal de "Venda Perdida" e nos relatórios de Análises.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <Label className="text-xs font-medium">Adicionar motivo</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Ex: Cliente sumiu"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              maxLength={80}
            />
            <Button onClick={handleCreate} disabled={!newLabel.trim() || create.isPending}>
              {create.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Adicionar
            </Button>
          </div>
          <ColorPicker value={newColor} onChange={setNewColor} />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : reasons.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum motivo cadastrado.
          </p>
        ) : (
          <div className="space-y-2">
            {reasons.map((r) => {
              const isEditing = editingId === r.id;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-md border bg-card p-3"
                >
                  <span
                    className="inline-block w-3 h-3 rounded-full shrink-0"
                    style={{ background: r.color || '#94a3b8' }}
                  />
                  {isEditing ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        maxLength={80}
                        autoFocus
                      />
                      <ColorPicker value={editColor || PALETTE[0]} onChange={setEditColor} />
                    </div>
                  ) : (
                    <span className={`flex-1 text-sm ${!r.is_active ? 'text-muted-foreground line-through' : ''}`}>
                      {r.label}
                    </span>
                  )}

                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <Button size="icon" variant="ghost" onClick={handleSaveEdit} disabled={update.isPending}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Switch
                          checked={r.is_active}
                          onCheckedChange={(v) => handleToggleActive(r.id, v)}
                          aria-label="Ativo"
                        />
                        <Button size="icon" variant="ghost" onClick={() => handleStartEdit(r)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setToDelete(r.id)}>
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover motivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Os negócios já marcados com esse motivo continuam com a informação histórica nos relatórios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full transition-all ${value === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-110'}`}
          style={{ background: c }}
          aria-label={`Cor ${c}`}
        />
      ))}
    </div>
  );
}
