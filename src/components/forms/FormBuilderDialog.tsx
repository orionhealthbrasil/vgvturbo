import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { FormFieldEditor } from './FormFieldEditor';
import { PublicFormRenderer } from './PublicFormRenderer';
import { useCreateLeadForm, useUpdateLeadForm } from '@/hooks/useLeadForms';
import { usePipelines, useKanbanColumnsByPipeline } from '@/hooks/useCRM';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useOrganizationMembers } from '@/hooks/useOrganization';
import { useTags } from '@/hooks/useTags';
import type { FormField, LeadForm, AssignmentStrategy } from '@/types/forms';
import { Card, CardContent } from '@/components/ui/card';

interface FormBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form?: LeadForm | null;
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const newField = (type: FormField['type'] = 'text'): FormField => {
  const key = `campo_${Math.random().toString(36).slice(2, 7)}`;
  return { key, label: 'Novo campo', type, required: false };
};

const DEFAULT_FIELDS: FormField[] = [
  { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Seu nome' },
  { key: 'telefone', label: 'Telefone', type: 'phone', required: true, placeholder: '(11) 91234-5678' },
  { key: 'email', label: 'E-mail', type: 'email', required: false, placeholder: 'voce@exemplo.com' },
];

export function FormBuilderDialog({ open, onOpenChange, form }: FormBuilderDialogProps) {
  const isEdit = !!form;
  const createMut = useCreateLeadForm();
  const updateMut = useUpdateLeadForm();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [thankYou, setThankYou] = useState('Recebemos seu contato! Em breve retornaremos.');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [fields, setFields] = useState<FormField[]>(DEFAULT_FIELDS);
  const [defaultTags, setDefaultTags] = useState<string[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [kanbanColumnId, setKanbanColumnId] = useState<string | null>(null);
  const [funnelStage, setFunnelStage] = useState<string | null>(null);
  const [assignmentStrategy, setAssignmentStrategy] = useState<AssignmentStrategy>('none');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const { data: pipelines } = usePipelines();
  const { data: columnsForPipeline } = useKanbanColumnsByPipeline(pipelineId);
  const { data: funnelStages } = useFunnelStages();
  const { data: members } = useOrganizationMembers();
  const { data: allTags } = useTags();

  useEffect(() => {
    if (!open) return;
    if (form) {
      setTitle(form.title);
      setSlug(form.slug);
      setDescription(form.description || '');
      setLogoUrl(form.logo_url || '');
      setPrimaryColor(form.primary_color);
      setThankYou(form.thank_you_message);
      setRedirectUrl(form.redirect_url || '');
      setFields(form.fields.length ? form.fields : DEFAULT_FIELDS);
      setDefaultTags(form.default_tags || []);
      setPipelineId(form.pipeline_id);
      setKanbanColumnId(form.kanban_column_id);
      setFunnelStage(form.funnel_stage);
      setAssignmentStrategy(form.assignment_strategy);
      setAssignedTo(form.assigned_to);
      setIsActive(form.is_active);
    } else {
      setTitle('');
      setSlug('');
      setDescription('');
      setLogoUrl('');
      setPrimaryColor('#6366f1');
      setThankYou('Recebemos seu contato! Em breve retornaremos.');
      setRedirectUrl('');
      setFields(DEFAULT_FIELDS);
      setDefaultTags([]);
      setPipelineId(null);
      setKanbanColumnId(null);
      setFunnelStage(null);
      setAssignmentStrategy('none');
      setAssignedTo(null);
      setIsActive(true);
    }
  }, [open, form]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFields((items) => {
      const oldIndex = items.findIndex((i) => i.key === active.id);
      const newIndex = items.findIndex((i) => i.key === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleSave = async () => {
    if (!title.trim() || !slug.trim()) return;
    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      logo_url: logoUrl.trim() || null,
      primary_color: primaryColor,
      thank_you_message: thankYou.trim(),
      redirect_url: redirectUrl.trim() || null,
      fields,
      default_tags: defaultTags,
      pipeline_id: pipelineId,
      kanban_column_id: kanbanColumnId,
      funnel_stage: funnelStage,
      assignment_strategy: assignmentStrategy,
      assigned_to: assignmentStrategy === 'fixed' ? assignedTo : null,
      is_active: isActive,
    } as any;

    if (isEdit && form) {
      await updateMut.mutateAsync({ id: form.id, ...payload });
    } else {
      await createMut.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const sortedStages = [...(funnelStages || [])]
    .filter((s) => !pipelineId || s.pipeline_id === pipelineId)
    .sort((a, b) => a.position - b.position);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar formulário' : 'Novo formulário'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="campos" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="campos">Campos</TabsTrigger>
            <TabsTrigger value="visual">Visual</TabsTrigger>
            <TabsTrigger value="destino">Destino</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="campos" className="space-y-3 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Título do formulário *</Label>
                <Input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!isEdit) setSlug(slugify(e.target.value));
                  }}
                  placeholder="Ex.: Orçamento Solar"
                />
              </div>
              <div>
                <Label>Slug (URL pública) *</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  placeholder="orcamento-solar"
                />
                {slug && (
                  <p className="text-xs text-muted-foreground mt-1">
                    URL: <code>/f/{slug}</code>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label className="text-base">Campos do formulário</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setFields((f) => [...f, newField()])}
              >
                <Plus className="w-4 h-4 mr-1" /> Adicionar campo
              </Button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={fields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map((f, idx) => (
                    <FormFieldEditor
                      key={f.key}
                      field={f}
                      onChange={(patch) =>
                        setFields((arr) => arr.map((x, i) => (i === idx ? { ...x, ...patch } : x)))
                      }
                      onRemove={() => setFields((arr) => arr.filter((_, i) => i !== idx))}
                    />
                  ))}
                  {fields.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Nenhum campo. Adicione o primeiro acima.
                    </p>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </TabsContent>

          <TabsContent value="visual" className="space-y-3 mt-4">
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Subtítulo exibido abaixo do título do formulário"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>URL do Logo (opcional)</Label>
                <Input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label>Cor primária</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label>Mensagem de agradecimento</Label>
              <Textarea
                value={thankYou}
                onChange={(e) => setThankYou(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label>URL de redirecionamento (opcional)</Label>
              <Input
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="https://seusite.com/obrigado"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Formulário ativo (aceitando submissões)</Label>
            </div>
          </TabsContent>

          <TabsContent value="destino" className="space-y-3 mt-4">
            <div>
              <Label>Tags padrão (separadas por vírgula)</Label>
              <Input
                value={defaultTags.join(', ')}
                onChange={(e) =>
                  setDefaultTags(
                    e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                  )
                }
                placeholder="lead-site, solar"
              />
              {allTags && allTags.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Existentes: {allTags.slice(0, 8).map((t) => t.name).join(', ')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Pipeline</Label>
                <Select
                  value={pipelineId || 'none'}
                  onValueChange={(v) => {
                    setPipelineId(v === 'none' ? null : v);
                    setKanbanColumnId(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {(pipelines || []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Coluna inicial do kanban</Label>
                <Select
                  value={kanbanColumnId || 'none'}
                  onValueChange={(v) => setKanbanColumnId(v === 'none' ? null : v)}
                  disabled={!pipelineId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {(columnsForPipeline || []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Etapa do funil</Label>
              <Select
                value={funnelStage || 'none'}
                onValueChange={(v) => setFunnelStage(v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Etapa inicial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Padrão (lead)</SelectItem>
                  {sortedStages.map((s) => (
                    <SelectItem key={s.id} value={s.slug}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Distribuição de leads</Label>
                <Select
                  value={assignmentStrategy}
                  onValueChange={(v) => setAssignmentStrategy(v as AssignmentStrategy)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem distribuição</SelectItem>
                    <SelectItem value="fixed">Vendedor fixo</SelectItem>
                    <SelectItem value="round_robin">Round-robin (entre vendedores)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {assignmentStrategy === 'fixed' && (
                <div>
                  <Label>Vendedor responsável</Label>
                  <Select
                    value={assignedTo || ''}
                    onValueChange={(v) => setAssignedTo(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(members || []).map((m: any) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.profile?.full_name || m.profile?.email || m.user_id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <Card>
              <CardContent className="p-6">
                {logoUrl && (
                  <img src={logoUrl} alt="logo" className="h-12 mx-auto mb-4 object-contain" />
                )}
                <h2
                  className="text-2xl font-bold mb-1 text-center"
                  style={{ color: primaryColor }}
                >
                  {title || 'Título do formulário'}
                </h2>
                {description && (
                  <p className="text-sm text-muted-foreground text-center mb-4">{description}</p>
                )}
                <PublicFormRenderer
                  fields={fields}
                  primaryColor={primaryColor}
                  preview
                  onSubmit={() => {}}
                  submitLabel="Enviar (preview)"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !slug.trim() || createMut.isPending || updateMut.isPending}
          >
            {isEdit ? 'Salvar alterações' : 'Criar formulário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
