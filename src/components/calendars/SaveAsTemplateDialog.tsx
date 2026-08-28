import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useSaveCalendarAsTemplate } from '@/hooks/useCalendarTemplates';
import { useIsSuperAdmin } from '@/hooks/useSuperAdmin';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  calendarId: string;
  calendarName: string;
}

const CATEGORIES = ['clinica', 'consultoria', 'beleza', 'rotina', 'educacao', 'fitness', 'outro'];

export function SaveAsTemplateDialog({ open, onOpenChange, calendarId, calendarName }: Props) {
  const save = useSaveCalendarAsTemplate();
  const { data: isSuperAdmin } = useIsSuperAdmin();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('outro');
  const [icon, setIcon] = useState('');
  const [global, setGlobal] = useState(false);

  useEffect(() => {
    if (open) {
      setName(calendarName);
      setDescription('');
      setCategory('outro');
      setIcon('');
      setGlobal(false);
    }
  }, [open, calendarName]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await save.mutateAsync({
      calendar_id: calendarId,
      template_name: name.trim(),
      scope: global && isSuperAdmin ? 'global' : 'organization',
      category: category || null,
      description: description.trim() || null,
      icon: icon.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar como template</DialogTitle>
          <DialogDescription>
            Salve a disponibilidade, tipos de evento e mensagens deste calendário para reutilizar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Nome do template *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Ícone (emoji)</Label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🩺" maxLength={4} />
            </div>
          </div>
          {isSuperAdmin && (
            <div className="rounded-md border p-3 flex items-center justify-between">
              <div>
                <Label className="m-0">Template global</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Visível para todas as organizações da plataforma.
                </p>
              </div>
              <Switch checked={global} onCheckedChange={setGlobal} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={save.isPending || !name.trim()}>
            {save.isPending ? 'Salvando...' : 'Salvar template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
