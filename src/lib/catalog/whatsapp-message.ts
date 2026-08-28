import { brl } from './format';

export interface OrderItem {
  product_id: string;
  product_name: string;
  product_sku?: string | null;
  variant_id?: string | null;
  variant_name?: string | null;
  variant_sku?: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
}

export function renderWhatsAppMessage(
  template: string,
  data: {
    items: OrderItem[];
    subtotal: number;
    nome: string;
    telefone: string;
    observacoes?: string;
    order_id: string;
  }
) {
  const lines = data.items
    .map((it) => {
      const name = it.variant_name ? `${it.product_name} — ${it.variant_name}` : it.product_name;
      const sku = it.variant_sku || it.product_sku;
      const skuPart = sku ? ` (#${sku})` : '';
      return `- ${it.qty}x ${name}${skuPart} — ${brl(it.line_total)}`;
    })
    .join('\n');

  const r = (s: string, k: string, v: string) => s.split(k).join(v);
  let out = template;
  out = r(out, '{itens}', lines);
  out = r(out, '{subtotal}', brl(data.subtotal).replace('R$', '').trim());
  out = r(out, '{nome}', data.nome);
  out = r(out, '{telefone}', data.telefone);
  out = r(out, '{observacoes}', data.observacoes || '—');
  out = r(out, '{order_id}', data.order_id.slice(0, 8));
  return out;
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
