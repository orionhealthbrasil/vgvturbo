import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export interface ColumnMapping {
  firstName: number | null;
  lastName: number | null;
  name: number | null;
  phone: number | null;
  email: number | null;
  tags: number | null;
}

interface CSVColumnMapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headers: string[];
  sampleRows: string[][];
  onConfirm: (mapping: ColumnMapping) => void;
  autoDetectedMapping?: Partial<ColumnMapping>;
}

const FIELD_OPTIONS = [
  { value: 'firstName', label: 'Primeiro Nome', required: false },
  { value: 'lastName', label: 'Sobrenome', required: false },
  { value: 'name', label: 'Nome Completo', required: false },
  { value: 'phone', label: 'Telefone', required: true },
  { value: 'email', label: 'Email', required: false },
  { value: 'tags', label: 'Tags', required: false },
] as const;

type FieldKey = typeof FIELD_OPTIONS[number]['value'];

export function CSVColumnMapper({
  open,
  onOpenChange,
  headers,
  sampleRows,
  onConfirm,
  autoDetectedMapping,
}: CSVColumnMapperProps) {
  // Initialize mapping from auto-detected or empty
  const [mapping, setMapping] = useState<Record<FieldKey, number | null>>(() => ({
    firstName: autoDetectedMapping?.firstName ?? null,
    lastName: autoDetectedMapping?.lastName ?? null,
    name: autoDetectedMapping?.name ?? null,
    phone: autoDetectedMapping?.phone ?? null,
    email: autoDetectedMapping?.email ?? null,
    tags: autoDetectedMapping?.tags ?? null,
  }));

  // Reverse mapping: column index -> field
  const columnToField = useMemo(() => {
    const map: Record<number, FieldKey> = {};
    Object.entries(mapping).forEach(([field, colIdx]) => {
      if (colIdx !== null) {
        map[colIdx] = field as FieldKey;
      }
    });
    return map;
  }, [mapping]);

  const handleFieldChange = (field: FieldKey, columnIndex: string) => {
    const newMapping = { ...mapping };
    
    // If selecting "none", clear this field
    if (columnIndex === '__none__') {
      newMapping[field] = null;
    } else {
      const idx = parseInt(columnIndex, 10);
      
      // Clear any other field that was using this column
      Object.keys(newMapping).forEach((key) => {
        if (newMapping[key as FieldKey] === idx) {
          newMapping[key as FieldKey] = null;
        }
      });
      
      newMapping[field] = idx;
    }
    
    setMapping(newMapping);
  };

  // Validation
  const hasPhone = mapping.phone !== null;
  const hasName = mapping.name !== null || mapping.firstName !== null;
  const isValid = hasPhone && hasName;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm({
      firstName: mapping.firstName,
      lastName: mapping.lastName,
      name: mapping.name,
      phone: mapping.phone,
      email: mapping.email,
      tags: mapping.tags,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Mapear Colunas do CSV</DialogTitle>
          <DialogDescription>
            Associe as colunas do seu arquivo aos campos de contato.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6 py-4">
          {/* Field Mapping */}
          <div className="grid grid-cols-2 gap-4">
            {FIELD_OPTIONS.map((field) => (
              <div key={field.value} className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  {field.label}
                  {field.required && <Badge variant="destructive" className="text-[10px] px-1 py-0">Obrigatório</Badge>}
                </Label>
                <Select
                  value={mapping[field.value]?.toString() ?? '__none__'}
                  onValueChange={(val) => handleFieldChange(field.value, val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Não mapear —</SelectItem>
                    {headers.map((header, idx) => (
                      <SelectItem 
                        key={idx} 
                        value={idx.toString()}
                        disabled={columnToField[idx] !== undefined && columnToField[idx] !== field.value}
                      >
                        {header || `Coluna ${idx + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* Validation Messages */}
          <div className="space-y-2">
            <div className={`flex items-center gap-2 text-sm ${hasPhone ? 'text-green-600' : 'text-destructive'}`}>
              {hasPhone ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {hasPhone ? 'Coluna de telefone mapeada' : 'Selecione a coluna de telefone'}
            </div>
            <div className={`flex items-center gap-2 text-sm ${hasName ? 'text-green-600' : 'text-destructive'}`}>
              {hasName ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {hasName ? 'Coluna de nome mapeada' : 'Selecione "Nome Completo" ou "Primeiro Nome"'}
            </div>
          </div>

          {/* Preview Table */}
          <div className="space-y-2">
            <Label>Pré-visualização (primeiras 5 linhas)</Label>
            <div className="border rounded-lg overflow-auto max-h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map((header, idx) => (
                      <TableHead key={idx} className="whitespace-nowrap">
                        <div className="space-y-1">
                          <span>{header || `Col ${idx + 1}`}</span>
                          {columnToField[idx] && (
                            <Badge variant="secondary" className="block text-[10px]">
                              → {FIELD_OPTIONS.find(f => f.value === columnToField[idx])?.label}
                            </Badge>
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleRows.slice(0, 5).map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      {headers.map((_, colIdx) => (
                        <TableCell key={colIdx} className="text-sm">
                          {row[colIdx] || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            Confirmar Mapeamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
