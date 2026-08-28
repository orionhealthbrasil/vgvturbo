import { useState } from 'react';
import { Plus, Trash2, GripVertical, Loader2, TextCursorInput, Hash, ToggleLeft, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  useCustomFieldDefinitions,
  useCreateFieldDefinition,
  useUpdateFieldDefinition,
  useDeleteFieldDefinition,
  type FieldType,
  type CustomFieldDefinition,
} from '@/hooks/useCustomFieldDefinitions';

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Texto',
  number: 'Número',
  boolean: 'Sim/Não',
  select: 'Seleção',
};

const FIELD_TYPE_ICONS: Record<FieldType, React.ReactNode> = {
  text: <TextCursorInput className="w-4 h-4" />,
  number: <Hash className="w-4 h-4" />,
  boolean: <ToggleLeft className="w-4 h-4" />,
  select: <List className="w-4 h-4" />,
};

export function CustomFieldsSettingsCard() {
  const { data: fields, isLoading } = useCustomFieldDefinitions();
  const createField = useCreateFieldDefinition();
  const updateField = useUpdateFieldDefinition();
  const deleteField = useDeleteFieldDefinition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [fieldToDelete, setFieldToDelete] = useState<CustomFieldDefinition | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [options, setOptions] = useState('');
  const [isRequired, setIsRequired] = useState(false);

  const openNew = () => {
    setEditingField(null);
    setName('');
    setFieldType('text');
    setOptions('');
    setIsRequired(false);
    setDialogOpen(true);
  };

  const openEdit = (field: CustomFieldDefinition) => {
    setEditingField(field);
    setName(field.name);
    setFieldType(field.field_type);
    setOptions(field.options.join(', '));
    setIsRequired(field.is_required);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome do campo é obrigatório');
      return;
    }

    const parsedOptions = fieldType === 'select'
      ? options.split(',').map(o => o.trim()).filter(Boolean)
      : [];

    if (fieldType === 'select' && parsedOptions.length < 2) {
      toast.error('Tipo "Seleção" precisa de pelo menos 2 opções');
      return;
    }

    try {
      if (editingField) {
        await updateField.mutateAsync({
          id: editingField.id,
          name: name.trim(),
          field_type: fieldType,
          options: parsedOptions,
          is_required: isRequired,
        });
        toast.success('Campo atualizado!');
      } else {
        await createField.mutateAsync({
          name: name.trim(),
          field_type: fieldType,
          options: parsedOptions,
          is_required: isRequired,
        });
        toast.success('Campo criado!');
      }
      setDialogOpen(false);
    } catch (err: any) {
      if (err.message?.includes('duplicate')) {
        toast.error('Já existe um campo com este nome');
      } else {
        toast.error('Erro ao salvar campo');
      }
    }
  };

  const handleDelete = async () => {
    if (!fieldToDelete) return;
    try {
      await deleteField.mutateAsync(fieldToDelete.id);
      toast.success('Campo removido');
      setFieldToDelete(null);
    } catch {
      toast.error('Erro ao remover campo');
    }
  };

  return (
    <>
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TextCursorInput className="w-5 h-5" />
                Campos Personalizados
              </CardTitle>
              <CardDescription>
                Defina campos extras para armazenar informações dos contatos
              </CardDescription>
            </div>
            <Button onClick={openNew} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Novo Campo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !fields || fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TextCursorInput className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum campo personalizado criado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map(field => (
                <div
                  key={field.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => openEdit(field)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{FIELD_TYPE_ICONS[field.field_type]}</span>
                    <div>
                      <p className="font-medium text-sm">{field.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-xs">
                          {FIELD_TYPE_LABELS[field.field_type]}
                        </Badge>
                        {field.is_required && (
                          <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                        )}
                        {field.field_type === 'select' && (
                          <span className="text-xs text-muted-foreground">
                            {field.options.length} opções
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFieldToDelete(field);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingField ? 'Editar Campo' : 'Novo Campo Personalizado'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Campo *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: CPF, Empresa, Plano..."
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map(type => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        {FIELD_TYPE_ICONS[type]}
                        {FIELD_TYPE_LABELS[type]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {fieldType === 'select' && (
              <div className="space-y-2">
                <Label>Opções (separadas por vírgula)</Label>
                <Input
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                  placeholder="Opção 1, Opção 2, Opção 3"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={isRequired} onCheckedChange={setIsRequired} />
              <Label>Campo obrigatório</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={createField.isPending || updateField.isPending}
            >
              {(createField.isPending || updateField.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingField ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!fieldToDelete} onOpenChange={() => setFieldToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover campo "{fieldToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Os valores já salvos nos contatos serão mantidos, mas o campo não aparecerá mais para edição.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
