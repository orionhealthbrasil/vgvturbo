import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, Tag, MoreVertical, Pencil, Trash2, FileSpreadsheet, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useUserOrganization } from '@/hooks/useOrganization';
import {
  useProducts,
  useDeleteProduct,
  useToggleProductAvailability,
  type Product,
} from '@/hooks/useCatalog';
import { ProductFormDialog } from '@/components/catalog/ProductFormDialog';
import { CategoriesManager } from '@/components/catalog/CategoriesManager';
import { CatalogSettingsCard } from '@/components/catalog/CatalogSettingsCard';
import { ImportProductsDialog } from '@/components/catalog/ImportProductsDialog';
import { brl, hasPromo, discountPct } from '@/lib/catalog/format';

export default function Catalog() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  const [search, setSearch] = useState('');
  const [available, setAvailable] = useState<'all' | 'yes' | 'no'>('all');
  const { data: products = [] } = useProducts({ search, available });
  const del = useDeleteProduct();
  const toggle = useToggleProductAvailability();

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const openNew = () => {
    setEditing(null);
    setEditOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setEditOpen(true);
  };
  const remove = async (p: Product) => {
    if (!confirm(`Excluir "${p.name}"?`)) return;
    try {
      await del.mutateAsync(p.id);
      toast.success('Produto excluído');
    } catch (e: any) {
      toast.error('Erro', { description: e.message });
    }
  };

  if (!orgId) return null;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" /> Catálogo
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie produtos, serviços e a página pública da sua loja.
          </p>
        </div>
      </div>

      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="loja">Loja</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={available === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAvailable('all')}
              >
                Todos
              </Button>
              <Button
                variant={available === 'yes' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAvailable('yes')}
              >
                Disponíveis
              </Button>
              <Button
                variant={available === 'no' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAvailable('no')}
              >
                Indisponíveis
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCatsOpen(true)}>
                <Tag className="h-4 w-4 mr-1" /> Categorias
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Importar
              </Button>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" /> Novo produto
              </Button>
            </div>
          </div>

          {products.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Nenhum produto cadastrado.</p>
                <Button className="mt-4" onClick={openNew}>
                  <Plus className="h-4 w-4 mr-1" /> Cadastrar primeiro produto
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((p) => {
                const cover = p.images?.[0]?.url;
                const promo = !p.hide_price && hasPromo(p.base_price, p.compare_at_price);
                return (
                  <Card key={p.id} className="overflow-hidden group">
                    <div className="aspect-[4/3] bg-muted relative">
                      {cover ? (
                        <img src={cover} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Package className="h-8 w-8" />
                        </div>
                      )}
                      {promo && (
                        <Badge className="absolute top-2 left-2 bg-rose-600 hover:bg-rose-600">
                          -{discountPct(p.base_price, p.compare_at_price)}%
                        </Badge>
                      )}
                      {!p.is_available && (
                        <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                          <Badge variant="secondary">Indisponível</Badge>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium leading-tight line-clamp-2">{p.name}</h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 -mr-1 -mt-1">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(p)}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => remove(p)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold">{p.hide_price ? 'Consultar' : brl(p.base_price)}</span>
                        {promo && (
                          <span className="text-xs text-muted-foreground line-through">
                            {brl(p.compare_at_price!)}
                          </span>
                        )}
                      </div>
                      {p.sku && <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-muted-foreground">
                          {p.kind === 'service' ? 'Serviço' : 'Produto'}
                          {p.has_variants && ' · com variações'}
                        </span>
                        <Switch
                          checked={p.is_available}
                          onCheckedChange={(c) => toggle.mutate({ id: p.id, is_available: c })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="loja" className="pt-4">
          <CatalogSettingsCard organizationId={orgId} />
        </TabsContent>
      </Tabs>

      <ProductFormDialog open={editOpen} onOpenChange={setEditOpen} product={editing} organizationId={orgId} />
      <CategoriesManager open={catsOpen} onOpenChange={setCatsOpen} />
      <ImportProductsDialog open={importOpen} onOpenChange={setImportOpen} organizationId={orgId} />
    </div>
  );
}
