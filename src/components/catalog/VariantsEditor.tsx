import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import type { ProductVariant } from '@/hooks/useCatalog';

type V = Partial<ProductVariant>;

interface Props {
  value: V[];
  onChange: (next: V[]) => void;
}

export function VariantsEditor({ value, onChange }: Props) {
  const add = () =>
    onChange([
      ...value,
      { name: '', sku: '', price: 0, compare_at_price: null, is_available: true, attributes: {} },
    ]);
  const update = (i: number, patch: V) =>
    onChange(value.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sem variações. Adicione variações se este produto tem opções com preços diferentes (ex: tamanhos, cores).
        </p>
      )}
      {value.map((v, i) => (
        <div key={i} className="border rounded-md p-3 space-y-3 bg-card">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={v.name || ''}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Ex: Tamanho M"
              />
            </div>
            <div>
              <Label className="text-xs">SKU</Label>
              <Input
                value={v.sku || ''}
                onChange={(e) => update(i, { sku: e.target.value })}
                placeholder="SKU-M"
              />
            </div>
            <div>
              <Label className="text-xs">Preço</Label>
              <Input
                type="number"
                step="0.01"
                value={v.price ?? 0}
                onChange={(e) => update(i, { price: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label className="text-xs">Preço de comparação (riscado)</Label>
              <Input
                type="number"
                step="0.01"
                value={v.compare_at_price ?? ''}
                onChange={(e) =>
                  update(i, { compare_at_price: e.target.value ? parseFloat(e.target.value) : null })
                }
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={v.is_available ?? true}
                onCheckedChange={(c) => update(i, { is_available: c })}
              />
              <span className="text-sm">Disponível</span>
            </div>
            <Button size="sm" variant="ghost" type="button" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4 mr-1" /> Remover
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4 mr-1" /> Adicionar variação
      </Button>
    </div>
  );
}
