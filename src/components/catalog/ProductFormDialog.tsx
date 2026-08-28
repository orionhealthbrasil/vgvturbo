import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  useProductCategories,
  useProductVariants,
  useSaveVariants,
  useUpsertProduct,
  type Product,
  type ProductImage,
  type ProductVariant,
} from '@/hooks/useCatalog';
import { ProductMediaUploader } from './ProductMediaUploader';
import { VariantsEditor } from './VariantsEditor';

const EMPTY_VARIANTS: ProductVariant[] = [];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: Product | null;
  organizationId: string;
}

export function ProductFormDialog({ open, onOpenChange, product, organizationId }: Props) {
  const { data: categories = [] } = useProductCategories();
  const { data: existingVariants = EMPTY_VARIANTS } = useProductVariants(product?.id);
  const upsert = useUpsertProduct();
  const saveVariants = useSaveVariants();

  const [form, setForm] = useState<Partial<Product>>({});
  const [tagsText, setTagsText] = useState('');
  const [variants, setVariants] = useState<Partial<ProductVariant>[]>([]);

  useEffect(() => {
    if (open) {
      setForm(
        product || {
          name: '',
          description: '',
          sku: '',
          kind: 'product',
          listing_type: 'sale',
          city: null,
          neighborhood: null,
          base_price: 0,
          compare_at_price: null,
          is_available: true,
          has_variants: false,
          category_id: null,
          tags: [],
          images: [],
        }
      );
      setTagsText((product?.tags || []).join(', '));
    }
  }, [open, product]);

  useEffect(() => {
    setVariants(existingVariants);
  }, [existingVariants]);

  const submit = async () => {
    if (!form.name?.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    try {
      const tags = tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const id = await upsert.mutateAsync({
        ...form,
        id: product?.id,
        tags,
      });
      if (form.has_variants) {
        await saveVariants.mutateAsync({ productId: id, variants });
      } else if (product?.has_variants) {
        await saveVariants.mutateAsync({ productId: id, variants: [] });
      }
      toast.success(product ? 'Produto atualizado' : 'Produto criado');
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro', { description: e.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar produto' : 'Novo produto'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="geral" className="mt-2">
          <TabsList>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="midia">Mídia</TabsTrigger>
            <TabsTrigger value="variacoes">Variações</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label>Nome *</Label>
                <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>SKU</Label>
                <Input value={form.sku || ''} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.kind || 'product'}
                  onValueChange={(v) => setForm({ ...form, kind: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Produto</SelectItem>
                    <SelectItem value="service">Serviço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Negociação</Label>
                <Select
                  value={form.listing_type || 'sale'}
                  onValueChange={(v) => setForm({ ...form, listing_type: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">Venda</SelectItem>
                    <SelectItem value="rent">Aluguel</SelectItem>
                    <SelectItem value="sale_rent">Venda e Aluguel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preço *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.base_price ?? 0}
                  onChange={(e) => setForm({ ...form, base_price: parseFloat(e.target.value) || 0 })}
                  disabled={!!form.has_variants}
                />
              </div>
              <div>
                <Label>Preço de comparação (riscado)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.compare_at_price ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      compare_at_price: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="Opcional"
                  disabled={!!form.has_variants}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Categoria</Label>
                <Select
                  value={form.category_id || 'none'}
                  onValueChange={(v) => setForm({ ...form, category_id: v === 'none' ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  rows={4}
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input
                  value={form.city || ''}
                  onChange={(e) => setForm({ ...form, city: e.target.value || null })}
                  placeholder="Ex: Belém"
                />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input
                  value={form.neighborhood || ''}
                  onChange={(e) => setForm({ ...form, neighborhood: e.target.value || null })}
                  placeholder="Ex: Nazaré"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Tags (separadas por vírgula)</Label>
                <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="destaque, novidade" />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2 pt-2">
                <Switch
                  checked={form.is_available ?? true}
                  onCheckedChange={(c) => setForm({ ...form, is_available: c })}
                />
                <span className="text-sm">Disponível para venda</span>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch
                  checked={form.has_variants ?? false}
                  onCheckedChange={(c) => setForm({ ...form, has_variants: c })}
                />
                <span className="text-sm">Este produto tem variações (tamanho, cor, etc.)</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="midia" className="pt-4">
            <ProductMediaUploader
              organizationId={organizationId}
              value={form.images || []}
              onChange={(imgs: ProductImage[]) => setForm({ ...form, images: imgs })}
            />
          </TabsContent>

          <TabsContent value="variacoes" className="pt-4">
            {form.has_variants ? (
              <VariantsEditor value={variants} onChange={setVariants} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Ative "Este produto tem variações" na aba Geral para configurar.
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={upsert.isPending || saveVariants.isPending}>
            {product ? 'Salvar' : 'Criar produto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
