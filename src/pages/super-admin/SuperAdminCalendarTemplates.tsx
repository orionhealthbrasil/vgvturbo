import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  useAllGlobalTemplates,
  useDeleteCalendarTemplate,
  useUpdateCalendarTemplate,
} from '@/hooks/useCalendarTemplates';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CalendarTemplate } from '@/types/booking';

const CATEGORIES = [
  { value: 'clinica', label: 'Clínica / Saúde' },
  { value: 'consultoria', label: 'Consultoria / Coach' },
  { value: 'beleza', label: 'Beleza / Estética' },
  { value: 'rotina', label: 'Rotina / Interno' },
  { value: 'outros', label: 'Outros' },
];

interface TemplateFormState {
  id?: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  reminders_enabled: boolean;
  default_color: string;
  default_timezone: string;
  is_active: boolean;
}

const EMPTY_FORM: TemplateFormState = {
  name: '',
  description: '',
  category: 'outros',
  icon: '📅',
  reminders_enabled: true,
  default_color: '#6366f1',
  default_timezone: 'America/Sao_Paulo',
  is_active: true,
};

export default function SuperAdminCalendarTemplates() {
  const { data: templates = [], isLoading } = useAllGlobalTemplates();
  const updateMut = useUpdateCalendarTemplate();
  const deleteMut = useDeleteCalendarTemplate();
  const qc = useQueryClient();

  const [editing, setEditing] = useState<TemplateFormState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: async (input: TemplateFormState) => {
      const { error } = await supabase.from('calendar_templates' as any).insert({
        scope: 'global',
        organization_id: null,
        name: input.name.trim(),
        description: input.description.trim() || null,
        category: input.category,
        icon: input.icon || null,
        reminders_enabled: input.reminders_enabled,
        default_color: input.default_color,
        default_timezone: input.default_timezone,
        is_active: input.is_active,
        availability: [],
        event_types: [],
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-templates-admin'] });
      qc.invalidateQueries({ queryKey: ['calendar-templates'] });
      toast.success('Template criado');
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar template'),
  });

  const handleSave = () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (editing.id) {
      updateMut.mutate(
        {
          id: editing.id,
          name: editing.name.trim(),
          description: editing.description.trim() || null,
          category: editing.category,
          icon: editing.icon || null,
          reminders_enabled: editing.reminders_enabled,
          default_color: editing.default_color,
          default_timezone: editing.default_timezone,
          is_active: editing.is_active,
        } as Partial<CalendarTemplate> & { id: string },
        { onSuccess: () => setEditing(null) },
      );
    } else {
      createMut.mutate(editing);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarTemplate[]>();
    for (const t of templates) {
      const key = t.category || 'outros';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [templates]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates de Calendário</h1>
          <p className="text-muted-foreground mt-1">
            Modelos globais disponíveis para todas as organizações do SaaS.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY_FORM })}>
          <Plus className="mr-2 h-4 w-4" />
          Novo template
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarRange className="mx-auto h-10 w-10 mb-3 opacity-50" />
            Nenhum template cadastrado. Crie o primeiro acima ou salve um calendário existente como template.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([cat, items]) => (
            <div key={cat} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {CATEGORIES.find((c) => c.value === cat)?.label || cat}
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {items.map((t) => {
                  const eventTypes = Array.isArray(t.event_types) ? t.event_types : [];
                  const availability = Array.isArray(t.availability) ? t.availability : [];
                  return (
                    <Card key={t.id} className={!t.is_active ? 'opacity-60' : ''}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{t.icon || '📅'}</span>
                            <CardTitle className="text-base">{t.name}</CardTitle>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() =>
                                updateMut.mutate({
                                  id: t.id,
                                  is_active: !t.is_active,
                                } as Partial<CalendarTemplate> & { id: string })
                              }
                              title={t.is_active ? 'Desativar' : 'Ativar'}
                            >
                              {t.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() =>
                                setEditing({
                                  id: t.id,
                                  name: t.name,
                                  description: t.description || '',
                                  category: t.category || 'outros',
                                  icon: t.icon || '📅',
                                  reminders_enabled: t.reminders_enabled,
                                  default_color: t.default_color || '#6366f1',
                                  default_timezone: t.default_timezone || 'America/Sao_Paulo',
                                  is_active: t.is_active,
                                })
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingId(t.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        {t.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary">{eventTypes.length} tipo(s)</Badge>
                          <Badge variant="secondary">{availability.length} faixa(s)</Badge>
                          <Badge variant={t.reminders_enabled ? 'default' : 'outline'}>
                            {t.reminders_enabled ? 'Lembretes on' : 'Silencioso'}
                          </Badge>
                          {!t.is_active && <Badge variant="destructive">Inativo</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar template' : 'Novo template global'}</DialogTitle>
            <DialogDescription>
              {editing?.id
                ? 'Atualize os metadados deste template.'
                : 'Cria um template vazio. Use "Salvar como template" em um calendário existente para preencher disponibilidade e tipos de evento.'}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-[80px_1fr] gap-3">
                <div className="space-y-2">
                  <Label>Ícone</Label>
                  <Input
                    value={editing.icon}
                    onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                    maxLength={4}
                    className="text-2xl text-center"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Clínica Médica"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                  placeholder="Atendimento médico padrão com lembretes..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={editing.category}
                    onValueChange={(v) => setEditing({ ...editing, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cor padrão</Label>
                  <Input
                    type="color"
                    value={editing.default_color}
                    onChange={(e) => setEditing({ ...editing, default_color: e.target.value })}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fuso horário</Label>
                <Input
                  value={editing.default_timezone}
                  onChange={(e) => setEditing({ ...editing, default_timezone: e.target.value })}
                  placeholder="America/Sao_Paulo"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm font-medium">Lembretes automáticos</Label>
                  <p className="text-xs text-muted-foreground">
                    Quando desligado, calendários criados a partir deste template não enviam WhatsApp/email.
                  </p>
                </div>
                <Switch
                  checked={editing.reminders_enabled}
                  onCheckedChange={(v) => setEditing({ ...editing, reminders_enabled: v })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm font-medium">Ativo</Label>
                  <p className="text-xs text-muted-foreground">
                    Templates inativos ficam ocultos das organizações.
                  </p>
                </div>
                <Switch
                  checked={editing.is_active}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {editing?.id ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os calendários já criados a partir deste template não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingId) deleteMut.mutate(deletingId);
                setDeletingId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
