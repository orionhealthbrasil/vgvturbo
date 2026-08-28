import { useState, useEffect } from 'react';
import { Loader2, TextCursorInput } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCustomFieldDefinitions,
  useContactCustomFields,
  useUpsertContactCustomField,
} from '@/hooks/useCustomFieldDefinitions';
import { useDebounce } from '@/hooks/useDebounce';

interface ContactCustomFieldsProps {
  contactId: string;
}

function FieldEditor({
  definition,
  value,
  onSave,
  isSaving,
}: {
  definition: { id: string; name: string; field_type: string; options: string[] };
  value: string | null;
  onSave: (val: string | null) => void;
  isSaving: boolean;
}) {
  const [localValue, setLocalValue] = useState(value || '');
  const debouncedValue = useDebounce(localValue, 800);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  useEffect(() => {
    // Only save if changed from original
    if (debouncedValue !== (value || '') && definition.field_type !== 'boolean' && definition.field_type !== 'select') {
      onSave(debouncedValue || null);
    }
  }, [debouncedValue]);

  switch (definition.field_type) {
    case 'boolean':
      return (
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground">{definition.name}</Label>
          <Switch
            checked={value === 'true'}
            onCheckedChange={(checked) => onSave(checked ? 'true' : 'false')}
          />
        </div>
      );

    case 'select':
      return (
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">{definition.name}</Label>
          <Select
            value={value || ''}
            onValueChange={(v) => onSave(v || null)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {definition.options.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case 'number':
      return (
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">{definition.name}</Label>
          <Input
            type="number"
            className="h-8 text-xs"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder="0"
          />
        </div>
      );

    default: // text
      return (
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">{definition.name}</Label>
          <Input
            className="h-8 text-xs"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder={`${definition.name}...`}
          />
        </div>
      );
  }
}

export function ContactCustomFields({ contactId }: ContactCustomFieldsProps) {
  const { data: definitions = [] } = useCustomFieldDefinitions();
  const { data: fieldValues = [] } = useContactCustomFields(contactId);
  const upsertField = useUpsertContactCustomField();

  if (definitions.length === 0) return null;

  const valueMap: Record<string, string | null> = {};
  fieldValues.forEach(f => {
    valueMap[f.field_name] = f.field_value;
  });

  const handleSave = (def: { id: string; name: string }, value: string | null) => {
    upsertField.mutate({
      contactId,
      fieldName: def.name,
      fieldValue: value,
      fieldDefinitionId: def.id,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <TextCursorInput className="w-3.5 h-3.5" />
        Campos Personalizados
      </div>
      <div className="space-y-2">
        {definitions.map(def => (
          <FieldEditor
            key={def.id}
            definition={def}
            value={valueMap[def.name] ?? null}
            onSave={(val) => handleSave(def, val)}
            isSaving={upsertField.isPending}
          />
        ))}
      </div>
    </div>
  );
}
