import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { downloadTemplate, parseExcel, type ParsedRow } from '@/lib/catalog/excel-import';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  organizationId: string;
}

export function ImportProductsDialog({ open, onOpenChange, organizationId }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const onFile = async (file: File) => {
    try {
      const parsed = await parseExcel(file);
      setRows(parsed);
    } catch (e: any) {
      toast.error('Erro ao ler planilha', { description: e.message });
    }
  };

  const importValid = async () => {
    const valid = rows.filter((r) => r._errors.length === 0);
    if (!valid.length) return;
    setBusy(true);
    try {
      // Build categories map (create missing)
      const categoryNames = Array.from(new Set(valid.map((r) => r.categoria).filter(Boolean))) as string[];
      const catMap = new Map<string, string>();
      if (categoryNames.length) {
        const { data: existing } = await supabase
          .from('product_categories' as any)
          .select('id, name')
          .eq('organization_id', organizationId);
        for (const c of (existing || []) as any[]) {
          catMap.set(c.name.toLowerCase(), c.id);
        }
        const missing = categoryNames.filter((n) => !catMap.has(n.toLowerCase()));
        if (missing.length) {
          const { data: created } = await supabase
            .from('product_categories' as any)
            .insert(
              missing.map((name) => ({
                organization_id: organizationId,
                name,
                slug: name
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-+|-+$/g, ''),
              }))
            )
            .select('id, name');
          for (const c of (created || []) as any[]) catMap.set(c.name.toLowerCase(), c.id);
        }
      }

      let created = 0;
      let updated = 0;

      for (const r of valid) {
        const images = [r.imagem_url1, r.imagem_url2, r.imagem_url3]
          .filter(Boolean)
          .map((url, i) => ({ url: url!, position: i }));
        const tagsArr = r.tags
          ? r.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [];
        const payload: any = {
          organization_id: organizationId,
          name: r.nome,
          description: r.descricao || null,
          sku: r.sku || null,
          kind: r.tipo,
          base_price: r.preco,
          compare_at_price: r.preco_promocional,
          is_available: r.disponivel,
          category_id: r.categoria ? catMap.get(r.categoria.toLowerCase()) || null : null,
          tags: tagsArr,
          images,
        };
        if (r.sku) {
          const { data: existing } = await supabase
            .from('products' as any)
            .select('id')
            .eq('organization_id', organizationId)
            .eq('sku', r.sku)
            .maybeSingle();
          if (existing) {
            await supabase.from('products' as any).update(payload).eq('id', (existing as any).id);
            updated++;
            continue;
          }
        }
        await supabase.from('products' as any).insert(payload);
        created++;
      }
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success(`Importação concluída: ${created} criados, ${updated} atualizados`);
      onOpenChange(false);
      setRows([]);
    } catch (e: any) {
      toast.error('Erro na importação', { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const errors = rows.filter((r) => r._errors.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar produtos por planilha</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Baixar planilha modelo
          </Button>

          <label className="block border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover:bg-muted/50">
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <span className="text-sm">Clique para selecionar a planilha (.xlsx)</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>

          {rows.length > 0 && (
            <div className="border rounded-md max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Linha</th>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-left p-2">SKU</th>
                    <th className="text-left p-2">Preço</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r._row}</td>
                      <td className="p-2">{r.nome}</td>
                      <td className="p-2">{r.sku || '—'}</td>
                      <td className="p-2">{r.preco}</td>
                      <td className="p-2">
                        {r._errors.length ? (
                          <span className="text-destructive">{r._errors.join(', ')}</span>
                        ) : (
                          <span className="text-emerald-600">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {rows.length - errors} válidos · {errors} com erro
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={importValid} disabled={busy || rows.length === 0 || rows.length === errors}>
            Importar {rows.length - errors} produtos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
