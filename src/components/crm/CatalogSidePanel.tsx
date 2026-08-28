import { useState, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Search, GripVertical, Send, Package, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Product, useProductCategories } from '@/hooks/useCatalog';
import { brl } from '@/lib/catalog/format';

interface CatalogItemCardProps {
  product: Product;
  onSendProduct?: (product: Product) => void;
  dragging?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  selectionActive?: boolean;
}

export function CatalogItemCard({ product, onSendProduct, dragging = false, selected = false, onToggleSelect, selectionActive = false }: CatalogItemCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `catalog:${product.id}`,
    disabled: dragging,
  });
  const cover = product.images?.[0]?.url;

  return (
    <div
      ref={dragging ? undefined : setNodeRef}
      className={cn(
        'group flex items-center gap-2 rounded-lg border border-border bg-card p-2 transition-colors hover:border-primary/40 hover:bg-accent/40',
        isDragging && !dragging && 'opacity-30',
        dragging && 'w-[260px] shadow-2xl rotate-2 cursor-grabbing',
        selected && 'border-primary/60 bg-primary/5',
      )}
    >
      {/* Checkbox — always visible, replaces grip in selection mode */}
      {!dragging && (
        <div className="shrink-0 flex items-center">
          {selectionActive ? (
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              className="h-4 w-4"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              {...attributes}
              {...listeners}
              type="button"
              className="touch-none cursor-grab text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
              aria-label={`Arrastar ${product.name} para a conversa`}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Thumbnail */}
      <div
        className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted cursor-pointer"
        onClick={onToggleSelect}
      >
        {cover ? (
          <img src={cover} alt={product.name} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Name + price */}
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onToggleSelect}>
        <p className="truncate text-sm font-medium leading-tight">{product.name}</p>
        <p className="text-xs text-muted-foreground">{product.hide_price ? 'Consultar' : brl(product.base_price)}</p>
        {!product.is_available && (
          <span className="text-[10px] text-destructive/70">Indisponível</span>
        )}
      </div>

      {/* Send single (only when nothing is selected) */}
      {!dragging && !selectionActive && onSendProduct && (
        <button
          type="button"
          onClick={() => onSendProduct(product)}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
          aria-label={`Enviar ${product.name} no chat`}
          title="Enviar no chat"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Internal panel ──────────────────────────────────────────────────────────

interface PanelContentProps {
  products: Product[];
  allProducts: Product[];
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSendProduct: (product: Product) => void;
  onSendSelected: (products: Product[]) => void;
  categoryId: string | null;
  onCategoryChange: (id: string | null) => void;
  showUnavailable: boolean;
  onToggleUnavailable: () => void;
  onClose?: () => void;
}

function PanelContent({
  products,
  allProducts,
  isLoading,
  search,
  onSearchChange,
  onSendProduct,
  onSendSelected,
  categoryId,
  onCategoryChange,
  showUnavailable,
  onToggleUnavailable,
  onClose,
}: PanelContentProps) {
  const { data: categories = [] } = useProductCategories();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectionActive = selectedIds.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleSendSelected = () => {
    const toSend = products.filter((p) => selectedIds.has(p.id));
    onSendSelected(toSend);
    clearSelection();
  };

  // Category filter tabs — only show categories that have products in the full list
  const usedCategoryIds = new Set(allProducts.map((p) => p.category_id).filter(Boolean));
  const visibleCategories = categories.filter((c) => usedCategoryIds.has(c.id));

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Package className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Catálogo</h3>
        {selectionActive && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
          </Badge>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'ml-auto shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              selectionActive && 'ml-2'
            )}
            aria-label="Fechar catálogo"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search + filters */}
      <div className="border-b p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar no catálogo..."
            className="h-8 pl-8 text-sm"
          />
        </div>

        {/* Category pills */}
        {visibleCategories.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => onCategoryChange(null)}
              className={cn(
                'px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors',
                categoryId === null
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              )}
            >
              Todos
            </button>
            {visibleCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(categoryId === cat.id ? null : cat.id)}
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors',
                  categoryId === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Availability toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleUnavailable}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors',
              showUnavailable
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            )}
          >
            {showUnavailable ? 'Todos (incl. indisponíveis)' : 'Só disponíveis'}
          </button>
        </div>

        {!selectionActive && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Arraste ou clique em <Send className="inline h-3 w-3 mx-0.5" /> para enviar. Clique na foto para selecionar vários.
          </p>
        )}
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 py-3 pl-3 pr-4">
          {isLoading ? (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">Carregando catálogo...</p>
          ) : products.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">Nenhum item encontrado.</p>
          ) : (
            products.map((product) => (
              <CatalogItemCard
                key={product.id}
                product={product}
                onSendProduct={onSendProduct}
                selected={selectedIds.has(product.id)}
                onToggleSelect={() => toggleSelect(product.id)}
                selectionActive={selectionActive}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Multi-select footer */}
      {selectionActive && (
        <div className="border-t border-primary/20 bg-primary/5 px-3 py-2.5 flex items-center gap-2">
          <button
            onClick={clearSelection}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Limpar seleção"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground flex-1">
            {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selecionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleSendSelected}>
            <Send className="h-3.5 w-3.5" />
            Enviar {selectedIds.size > 1 ? `${selectedIds.size} itens` : 'item'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Public component ────────────────────────────────────────────────────────

interface CatalogSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  isLoading: boolean;
  onSendProduct: (product: Product) => void;
}

export function CatalogSidePanel({ open, onOpenChange, products, isLoading, onSendProduct }: CatalogSidePanelProps) {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [showUnavailable, setShowUnavailable] = useState(false);

  const filtered = products.filter((p) => {
    if (!showUnavailable && !p.is_available) return false;
    if (categoryId && p.category_id !== categoryId) return false;
    if (search.trim() && !p.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const handleSendSelected = useCallback((selected: Product[]) => {
    selected.forEach((p) => onSendProduct(p));
  }, [onSendProduct]);

  const sharedProps = {
    products: filtered,
    allProducts: products,
    isLoading,
    search,
    onSearchChange: setSearch,
    onSendProduct,
    onSendSelected: handleSendSelected,
    categoryId,
    onCategoryChange: setCategoryId,
    showUnavailable,
    onToggleUnavailable: () => setShowUnavailable((v) => !v),
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Catálogo</SheetTitle>
          </SheetHeader>
          <PanelContent
            {...sharedProps}
            onSendProduct={(product) => {
              onSendProduct(product);
              onOpenChange(false);
            }}
          />
        </SheetContent>
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <aside className="hidden h-full w-[360px] shrink-0 animate-in slide-in-from-right flex-col overflow-hidden border-l bg-card duration-200 md:flex">
      <PanelContent {...sharedProps} onClose={() => onOpenChange(false)} />
    </aside>
  );
}
