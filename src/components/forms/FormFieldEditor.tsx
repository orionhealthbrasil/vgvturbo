import { GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { FormField, FormFieldType } from '@/types/forms';
import { useCustomFieldDefinitions } from '@/hooks/useCustomFieldDefinitions';

interface FormFieldEditorProps {
  field: FormField;
  onChange: (patch: Partial<FormField>) => void;
  onRemove: () => void;
}

const TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  email: 'E-mail',
  phone: 'Telefone',
  number: 'Número',
  select: 'Seleção',
  checkbox: 'Checkbox',
};

export function FormFieldEditor({ field, onChange, onRemove }: FormFieldEditorProps) {
  const { data: customDefs } = useCustomFieldDefinitions();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="border">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
            aria-label="Arrastar"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="flex-1 grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Rótulo</Label>
              <Input
                value={field.label}
                onChange={(e) => onChange({ label: e.target.value })}
                placeholder="Ex.: Nome completo"
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={field.type}
                onValueChange={(v) => onChange({ type: v as FormFieldType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="text-destructive shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Chave (interna)</Label>
            <Input
              value={field.key}
              onChange={(e) => onChange({ key: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
              placeholder="nome"
            />
          </div>
          <div>
            <Label className="text-xs">Placeholder</Label>
            <Input
              value={field.placeholder || ''}
              onChange={(e) => onChange({ placeholder: e.target.value })}
              placeholder="opcional"
            />
          </div>
        </div>

        {field.type === 'select' && (
          <div>
            <Label className="text-xs">Opções (uma por linha)</Label>
            <Textarea
              rows={3}
              value={(field.options || []).join('\n')}
              onChange={(e) =>
                onChange({
                  options: e.target.value
                    .split('\n')
                    .map((o) => o.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Opção 1&#10;Opção 2"
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={field.required}
              onCheckedChange={(v) => onChange({ required: v })}
            />
            <span className="text-xs">Obrigatório</span>
          </label>

          <div className="flex-1">
            <Select
              value={field.customFieldId || 'none'}
              onValueChange={(v) => onChange({ customFieldId: v === 'none' ? null : v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Mapear para campo custom (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não mapear</SelectItem>
                {(customDefs || []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
