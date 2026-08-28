import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ShoppingBag, Plus, Minus, Trash2, Search, X, Package,
  MapPin, Tag, ChevronLeft, ChevronRight, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { brl, hasPromo, discountPct } from '@/lib/catalog/format';
import { renderWhatsAppMessage, buildWhatsAppUrl } from '@/lib/catalog/whatsapp-message';
import { usePublicCatalog } from '@/hooks/useCatalog';

/* ─── types ─── */
interface CartItem {
  key: string;
  product_id: string;
  variant_id?: string | null;
  name: string;
  variant_name?: string | null;
  unit_price: number;
  qty: number;
  image?: string;
}

/* ─── cart persistence ─── */
const loadCart = (slug: string): CartItem[] => {
  try { return JSON.parse(localStorage.getItem(`cart:${slug}`) || '[]'); } catch { return []; }
};
const saveCart = (slug: string, items: CartItem[]) =>
  localStorage.setItem(`cart:${slug}`, JSON.stringify(items));

/* ─── helpers ─── */
const LISTING_LABEL: Record<string, string> = { sale: 'Venda', rent: 'Aluguel', sale_rent: 'Venda/Aluguel' };
const LISTING_COLOR: Record<string, string> = { sale: 'bg-sky-100 text-sky-700', rent: 'bg-violet-100 text-violet-700', sale_rent: 'bg-emerald-100 text-emerald-700' };

function contrast(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#111827' : '#ffffff';
}

/* ════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════ */
export default function PublicCatalog() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = usePublicCatalog(slug);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeListingType, setActiveListingType] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customer, setCustomer] = useState({ nome: '', telefone: '', observacoes: '' });
  const [submitting, setSubmitting] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (slug) setCart(loadCart(slug)); }, [slug]);
  useEffect(() => { if (slug) saveCart(slug, cart); }, [cart, slug]);

  const settings = data?.settings;
  const products = (data?.products || []) as any[];
  const categories = (data?.categories || []) as any[];
  const theme = settings?.theme_color || '#111827';
  const fg = contrast(theme);

  const listingTypes = useMemo(() => {
    const types = new Set(products.map((p) => p.listing_type).filter(Boolean));
    return Array.from(types) as string[];
  }, [products]);

  const filtered = useMemo(() => products.filter((p) => {
    if (activeCat && p.category_id !== activeCat) return false;
    if (activeListingType && p.listing_type !== activeListingType) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [products, activeCat, activeListingType, search]);

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.qty, 0);

  const addToCart = (p: any, variant?: any) => {
    const unit = variant ? variant.price : p.base_price;
    const key = `${p.id}:${variant?.id || ''}`;
    setCart((prev) => {
      const exists = prev.find((i) => i.key === key);
      if (exists) return prev.map((i) => i.key === key ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { key, product_id: p.id, variant_id: variant?.id || null, name: p.name, variant_name: variant?.name || null, unit_price: unit, qty: 1, image: p.images?.[0]?.url }];
    });
    toast.success('Adicionado ao carrinho', { duration: 1500 });
  };

  const setQty = (key: string, qty: number) => {
    if (qty <= 0) setCart((p) => p.filter((i) => i.key !== key));
    else setCart((p) => p.map((i) => i.key === key ? { ...i, qty } : i));
  };

  const checkout = async () => {
    if (!customer.nome.trim() || !customer.telefone.trim()) { toast.error('Preencha nome e telefone'); return; }
    setSubmitting(true);
    const win = window.open('', '_blank');
    try {
      const { data: result, error } = await supabase.rpc('create_catalog_order' as any, {
        p_slug: slug, p_customer_name: customer.nome, p_customer_phone: customer.telefone,
        p_items: cart.map((i) => ({ product_id: i.product_id, variant_id: i.variant_id, qty: i.qty })),
        p_notes: customer.observacoes || null,
      });
      if (error) throw error;
      const { data: phoneData } = await supabase.rpc('get_public_catalog_whatsapp' as any, { p_slug: slug });
      const phone = (phoneData as any) || '';
      const msg = renderWhatsAppMessage((result as any).template, {
        items: (result as any).items, subtotal: (result as any).subtotal,
        nome: customer.nome, telefone: customer.telefone, observacoes: customer.observacoes,
        order_id: (result as any).order_id,
      });
      const url = phone ? buildWhatsAppUrl(phone, msg) : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      setCart([]); setCheckoutOpen(false); setCartOpen(false);
      if (win) win.location.href = url; else window.location.href = url;
    } catch (e: any) {
      win?.close();
      toast.error('Erro ao finalizar', { description: e.message });
    } finally { setSubmitting(false); }
  };

  /* ── loading ── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="h-16 bg-white border-b flex items-center px-4 gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-40" />
          <div className="ml-auto"><Skeleton className="h-9 w-24" /></div>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-10">
          <Skeleton className="h-48 w-full rounded-2xl mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[3/4] rounded-xl w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── not found ── */
  if (!data || !settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-xs">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <Package className="h-7 w-7 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Loja não encontrada</h1>
          <p className="text-gray-500 text-sm">O link pode estar incorreto ou a loja não está publicada.</p>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-50" style={{ ['--brand' as any]: theme, ['--brand-fg' as any]: fg }}>
      <Helmet>
        <title>{settings.display_name}</title>
        {settings.tagline && <meta name="description" content={settings.tagline} />}
      </Helmet>

      {/* ── Sticky Navbar ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          {/* Logo + name */}
          <div className="flex items-center gap-2.5 shrink-0 min-w-0">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt={settings.display_name} className="h-8 w-8 rounded-lg object-contain" />
            ) : (
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: theme }}>
                {settings.display_name[0]}
              </div>
            )}
            <span className="font-semibold text-gray-900 truncate hidden sm:block">{settings.display_name}</span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xs sm:max-w-sm relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-9 h-9 bg-gray-100 border-0 focus-visible:ring-1 text-sm rounded-full"
              style={{ ['--ring' as any]: theme }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Cart button */}
          <button
            onClick={() => setCartOpen(true)}
            className="ml-auto relative flex items-center gap-2 h-10 pl-3 pr-4 rounded-full text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: theme, color: fg }}
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Carrinho</span>
            {totalQty > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {totalQty}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Hero banner ── */}
      {(settings.banner_url || settings.tagline || settings.about) && (
        <section
          className="relative overflow-hidden"
          style={{
            background: settings.banner_url
              ? `url(${settings.banner_url}) center/cover no-repeat`
              : `linear-gradient(135deg, ${theme}18, ${theme}08)`,
          }}
        >
          {settings.banner_url && <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/70" />}
          <div className={`relative max-w-6xl mx-auto px-4 py-12 md:py-20 ${settings.banner_url ? 'text-white' : 'text-gray-900'}`}>
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight max-w-xl leading-tight">
              {settings.tagline || settings.display_name}
            </h2>
            {settings.about && (
              <p className={`mt-3 text-sm md:text-base max-w-lg leading-relaxed ${settings.banner_url ? 'text-white/80' : 'text-gray-600'}`}>
                {settings.about}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── Filters bar ── */}
      {(categories.length > 0 || listingTypes.length > 1) && (
        <div ref={catRef} className="sticky top-16 z-30 bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center gap-2 py-2.5 overflow-x-auto scrollbar-none">
              {/* Category filters */}
              {categories.length > 0 && (
                <>
                  <FilterPill active={!activeCat} color={theme} fg={fg} onClick={() => setActiveCat(null)}>Todos</FilterPill>
                  {categories.map((c: any) => (
                    <FilterPill key={c.id} active={activeCat === c.id} color={theme} fg={fg} onClick={() => setActiveCat(c.id === activeCat ? null : c.id)}>
                      {c.name}
                    </FilterPill>
                  ))}
                </>
              )}

              {/* Divider */}
              {categories.length > 0 && listingTypes.length > 1 && (
                <span className="w-px h-5 bg-gray-200 shrink-0 mx-1" />
              )}

              {/* Listing type filters */}
              {listingTypes.length > 1 && listingTypes.map((lt) => (
                <FilterPill key={lt} active={activeListingType === lt} color={theme} fg={fg} onClick={() => setActiveListingType(activeListingType === lt ? null : lt)}>
                  {LISTING_LABEL[lt] || lt}
                </FilterPill>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Products grid ── */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Package className="h-7 w-7 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">Nenhum produto encontrado</p>
            <p className="text-gray-400 text-sm mt-1">Tente outros filtros ou busca</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-5">{filtered.length} {filtered.length === 1 ? 'item' : 'itens'}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {filtered.map((p: any) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  theme={theme}
                  showPrices={settings.show_prices}
                  onClick={() => setSelected(p)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="mt-16 border-t bg-white">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            {settings.logo_url && <img src={settings.logo_url} alt="" className="h-6 w-6 rounded object-contain" />}
            <span className="font-medium text-gray-600">{settings.display_name}</span>
          </div>
          <span>© {new Date().getFullYear()} — Todos os direitos reservados</span>
        </div>
      </footer>

      {/* ══════════════════════════════════════════
          PRODUCT DETAIL
      ══════════════════════════════════════════ */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl w-full max-h-[95vh] overflow-y-auto p-0 gap-0 [&>button]:hidden rounded-2xl">
          {selected && (
            <ProductDetail
              product={selected}
              theme={theme}
              fg={fg}
              showPrices={settings.show_prices}
              onAdd={(variant) => { addToCart(selected, variant); setSelected(null); }}
              onClose={() => setSelected(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════
          CART SHEET
      ══════════════════════════════════════════ */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="flex flex-col p-0 sm:max-w-md w-full gap-0">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-gray-700" />
              <h2 className="font-bold text-gray-900">Carrinho</h2>
              {totalQty > 0 && <span className="text-xs font-semibold bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{totalQty}</span>}
            </div>
            <button onClick={() => setCartOpen(false)} className="rounded-full p-1.5 hover:bg-gray-100 transition-colors">
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingBag className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Seu carrinho está vazio</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.key} className="flex gap-3 py-3 border-b border-gray-50 last:border-0">
                  <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden shrink-0">
                    {item.image
                      ? <img src={item.image} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Package className="h-5 w-5 text-gray-300" /></div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 line-clamp-2 leading-tight">{item.name}</p>
                    {item.variant_name && <p className="text-xs text-gray-400 mt-0.5">{item.variant_name}</p>}
                    <p className="text-sm font-bold text-gray-900 mt-1">{brl(item.unit_price * item.qty)}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <button onClick={() => setQty(item.key, item.qty - 1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                        {item.qty === 1 ? <Trash2 className="h-3 w-3 text-rose-500" /> : <Minus className="h-3 w-3 text-gray-600" />}
                      </button>
                      <span className="text-sm font-medium w-6 text-center">{item.qty}</span>
                      <button onClick={() => setQty(item.key, item.qty + 1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                        <Plus className="h-3 w-3 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="border-t px-5 py-4 space-y-3 bg-gray-50/80">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-gray-500">Total</span>
                <span className="text-xl font-bold text-gray-900">{brl(subtotal)}</span>
              </div>
              <button
                className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: theme, color: fg }}
                onClick={() => setCheckoutOpen(true)}
              >
                Finalizar pelo WhatsApp
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ══════════════════════════════════════════
          CHECKOUT DIALOG
      ══════════════════════════════════════════ */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <div className="space-y-1 mb-2">
            <h2 className="text-lg font-bold text-gray-900">Seus dados</h2>
            <p className="text-sm text-gray-500">Vamos abrir o WhatsApp com seu pedido pronto.</p>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nome</Label>
              <Input value={customer.nome} onChange={(e) => setCustomer({ ...customer, nome: e.target.value })} className="mt-1 h-11" placeholder="Seu nome completo" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Telefone</Label>
              <Input value={customer.telefone} onChange={(e) => setCustomer({ ...customer, telefone: e.target.value })} className="mt-1 h-11" placeholder="(11) 91234-5678" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Observações <span className="normal-case font-normal">(opcional)</span></Label>
              <Textarea rows={3} value={customer.observacoes} onChange={(e) => setCustomer({ ...customer, observacoes: e.target.value })} className="mt-1" placeholder="Alguma observação sobre o pedido?" />
            </div>
          </div>
          <button
            className="w-full h-12 mt-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: theme, color: fg }}
            onClick={checkout}
            disabled={submitting}
          >
            {submitting ? (
              <><span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />Enviando...</>
            ) : (
              <>Enviar pedido pelo WhatsApp<ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   FILTER PILL
════════════════════════════════════════════════════════ */
function FilterPill({ active, color, fg, onClick, children }: { active: boolean; color: string; fg: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 h-8 px-4 rounded-full text-sm font-medium transition-all whitespace-nowrap"
      style={active ? { backgroundColor: color, color: fg } : { backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb' }}
    >
      {children}
    </button>
  );
}

/* ════════════════════════════════════════════════════════
   PRODUCT CARD
════════════════════════════════════════════════════════ */
function ProductCard({ product: p, theme, showPrices, onClick }: { product: any; theme: string; showPrices: boolean; onClick: () => void }) {
  const cover = p.images?.[0]?.url;
  const promo = hasPromo(p.base_price, p.compare_at_price);
  const lt = p.listing_type as string | undefined;

  return (
    <button
      onClick={onClick}
      className="group text-left bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex flex-col"
    >
      {/* Image */}
      <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
        {cover ? (
          <img src={cover} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Package className="h-10 w-10" />
          </div>
        )}
        {/* Badges top-left */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {promo && (
            <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              -{discountPct(p.base_price, p.compare_at_price)}%
            </span>
          )}
          {lt && lt !== 'sale' && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LISTING_COLOR[lt] || 'bg-gray-100 text-gray-700'}`}>
              {LISTING_LABEL[lt] || lt}
            </span>
          )}
        </div>
        {/* Image count */}
        {p.images?.length > 1 && (
          <span className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full backdrop-blur-sm">
            +{p.images.length - 1}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 md:p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{p.name}</h3>

        {(p.city || p.neighborhood) && (
          <div className="flex items-center gap-1 text-gray-400">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="text-xs truncate">{[p.neighborhood, p.city].filter(Boolean).join(', ')}</span>
          </div>
        )}

        <div className="mt-auto pt-1 flex items-baseline gap-2">
          <span className="font-bold text-base text-gray-900" style={showPrices ? { color: theme } : undefined}>
            {showPrices ? brl(p.base_price) : 'Consultar'}
          </span>
          {promo && showPrices && (
            <span className="text-xs text-gray-400 line-through">{brl(p.compare_at_price)}</span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ════════════════════════════════════════════════════════
   PRODUCT DETAIL
════════════════════════════════════════════════════════ */
function ProductDetail({ product, theme, fg, showPrices, onAdd, onClose }: {
  product: any; theme: string; fg: string; showPrices: boolean;
  onAdd: (variant?: any) => void; onClose: () => void;
}) {
  const [activeImg, setActiveImg] = useState(0);
  const [variant, setVariant] = useState<any>(product.variants?.[0] || null);
  const images = product.images || [];
  const price = variant ? variant.price : product.base_price;
  const comparePrice = variant ? variant.compare_at_price : product.compare_at_price;
  const promo = hasPromo(price, comparePrice);
  const lt = product.listing_type as string | undefined;

  return (
    <div className="grid md:grid-cols-2 min-h-0">
      {/* Left: images */}
      <div className="relative bg-gray-100">
        <div className="aspect-square md:aspect-auto md:h-full relative overflow-hidden">
          {images[activeImg]?.url ? (
            <img src={images[activeImg].url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full min-h-[280px] flex items-center justify-center text-gray-300">
              <Package className="h-16 w-16" />
            </div>
          )}
          {/* Prev/next */}
          {images.length > 1 && (
            <>
              <button
                onClick={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-gray-700" />
              </button>
              <button
                onClick={() => setActiveImg((i) => (i + 1) % images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-gray-700" />
              </button>
            </>
          )}
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors md:hidden"
          >
            <X className="h-4 w-4 text-gray-700" />
          </button>
        </div>
        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto bg-white border-t">
            {images.map((img: any, i: number) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${i === activeImg ? 'border-gray-800' : 'border-transparent opacity-60 hover:opacity-100'}`}
              >
                <img src={img.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: details */}
      <div className="p-6 md:p-7 flex flex-col gap-4 relative overflow-y-auto">
        {/* Close — desktop */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hidden md:flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>

        <div>
          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {lt && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${LISTING_COLOR[lt] || 'bg-gray-100 text-gray-700'}`}>
                {LISTING_LABEL[lt] || lt}
              </span>
            )}
            {promo && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
                -{discountPct(price, comparePrice)}% OFF
              </span>
            )}
          </div>

          <h2 className="text-xl font-bold text-gray-900 leading-tight">{product.name}</h2>
          {product.sku && <p className="text-xs text-gray-400 mt-1">Ref: {product.sku}</p>}
        </div>

        {/* Location */}
        {(product.city || product.neighborhood) && (
          <div className="flex items-center gap-1.5 text-gray-500">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="text-sm">{[product.neighborhood, product.city].filter(Boolean).join(' · ')}</span>
          </div>
        )}

        {/* Price */}
        {showPrices && (
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold" style={{ color: theme }}>{brl(price)}</span>
            {promo && (
              <span className="text-base text-gray-400 line-through">{brl(comparePrice)}</span>
            )}
          </div>
        )}

        {/* Description */}
        {product.description && (
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{product.description}</p>
        )}

        {/* Tags */}
        {product.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {product.tags.map((t: string) => (
              <span key={t} className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
                <Tag className="h-2.5 w-2.5" />{t}
              </span>
            ))}
          </div>
        )}

        {/* Variants */}
        {product.has_variants && product.variants?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Variação</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v: any) => (
                <button
                  key={v.id}
                  onClick={() => setVariant(v)}
                  className={`h-9 px-4 rounded-lg text-sm font-medium border-2 transition-all ${
                    variant?.id === v.id
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto pt-2">
          <button
            className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: theme, color: fg }}
            onClick={() => onAdd(variant)}
          >
            <ShoppingBag className="h-4 w-4" />
            Adicionar ao carrinho
          </button>
        </div>
      </div>
    </div>
  );
}
