// supabase/functions/payment-webhook/index.ts
// Recebe webhooks de plataformas de pagamento (Hotmart, Stripe, e modo genérico
// pra Kiwify/Eduzz/Monetizze/outras) e dispara o motor de automação.
// URL: .../functions/v1/payment-webhook?token={webhook_token}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeBrazilianPhone } from '../_shared/booking-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hotmart-hottok, stripe-signature, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Rate limit em memória por instância (mesmo padrão de submit-public-form)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

type PurchaseEvent = 'approved' | 'refunded' | 'cancelled' | 'chargeback' | 'unknown';

interface NormalizedPurchase {
  event: PurchaseEvent;
  buyerName: string | null;
  buyerPhone: string | null;
  buyerEmail: string | null;
  productName: string | null;
  value: number | null;
}

interface NormalizeResult {
  ok: boolean;
  rejected?: boolean; // assinatura inválida — diferente de "não consegui extrair campo"
  data?: NormalizedPurchase;
  error?: string;
}

function getHeader(req: Request, name: string): string | null {
  return req.headers.get(name) || req.headers.get(name.toLowerCase());
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeHotmart(req: Request, rawBody: string, secret: string | null): NormalizeResult {
  const hottok = getHeader(req, 'X-HOTMART-HOTTOK');
  if (secret) {
    if (!hottok || hottok !== secret) {
      return { ok: false, rejected: true, error: 'hottok inválido ou ausente' };
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: 'JSON inválido' };
  }

  const eventName = String(payload?.event || '').toUpperCase();
  const eventMap: Record<string, PurchaseEvent> = {
    PURCHASE_APPROVED: 'approved',
    PURCHASE_COMPLETE: 'approved',
    PURCHASE_REFUNDED: 'refunded',
    PURCHASE_CANCELED: 'cancelled',
    PURCHASE_CANCELLED: 'cancelled',
    PURCHASE_EXPIRED: 'cancelled',
    PURCHASE_CHARGEBACK: 'chargeback',
    CHARGEBACK: 'chargeback',
  };
  const event = eventMap[eventName] || 'unknown';

  const buyer = payload?.data?.buyer || {};
  const product = payload?.data?.product || {};
  // checkout_phone_code costuma ser o DDD; sem ele, não dá pra montar telefone confiável.
  const buyerPhone = buyer.checkout_phone
    ? `55${buyer.checkout_phone_code || ''}${buyer.checkout_phone}`.replace(/\D/g, '')
    : null;

  // Path do valor não confirmado com 100% de certeza na documentação — tenta os
  // caminhos mais prováveis e cai pra null se não achar (fica visível no raw_payload).
  const rawValue =
    payload?.data?.purchase?.price?.value ??
    payload?.data?.purchase?.full_price?.value ??
    payload?.data?.purchase?.original_offer_price?.value ??
    null;

  return {
    ok: true,
    data: {
      event,
      buyerName: buyer.name || null,
      buyerPhone,
      buyerEmail: buyer.email || null,
      productName: product.name || null,
      value: typeof rawValue === 'number' ? rawValue : null,
    },
  };
}

async function normalizeStripe(req: Request, rawBody: string, secret: string | null): Promise<NormalizeResult> {
  if (secret) {
    const sigHeader = getHeader(req, 'Stripe-Signature');
    if (!sigHeader) return { ok: false, rejected: true, error: 'Stripe-Signature ausente' };
    const parts = Object.fromEntries(
      sigHeader.split(',').map((p) => p.split('=')).filter((kv) => kv.length === 2),
    ) as Record<string, string>;
    const timestamp = parts['t'];
    const v1Candidates = sigHeader.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
    if (!timestamp || v1Candidates.length === 0) {
      return { ok: false, rejected: true, error: 'Stripe-Signature mal formada' };
    }
    const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
    if (!v1Candidates.includes(expected)) {
      return { ok: false, rejected: true, error: 'Assinatura Stripe não corresponde' };
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: 'JSON inválido' };
  }

  const eventName = String(payload?.type || '');
  const eventMap: Record<string, PurchaseEvent> = {
    'checkout.session.completed': 'approved',
    'payment_intent.succeeded': 'approved',
    'invoice.paid': 'approved',
    'charge.refunded': 'refunded',
    'checkout.session.expired': 'cancelled',
    'payment_intent.canceled': 'cancelled',
    'customer.subscription.deleted': 'cancelled',
    'charge.dispute.created': 'chargeback',
  };
  const event = eventMap[eventName] || 'unknown';

  const obj = payload?.data?.object || {};
  const customerDetails = obj.customer_details || {};
  const amount = obj.amount_total ?? obj.amount ?? null;

  return {
    ok: true,
    data: {
      event,
      buyerName: customerDetails.name || null,
      buyerPhone: customerDetails.phone || null,
      buyerEmail: customerDetails.email || null,
      // Stripe não traz nome de produto de forma confiável sem expandir line_items
      // (chamada extra à API da Stripe, fora do escopo desta versão).
      productName: obj.metadata?.product_name || null,
      value: typeof amount === 'number' ? amount / 100 : null,
    },
  };
}

function digValue(obj: any, paths: string[]): any {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function normalizeGeneric(req: Request, rawBody: string, secret: string | null): NormalizeResult {
  if (secret) {
    const provided = getHeader(req, 'X-Webhook-Secret') || new URL(req.url).searchParams.get('secret');
    if (provided !== secret) {
      return { ok: false, rejected: true, error: 'Secret genérico inválido ou ausente' };
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: 'JSON inválido' };
  }

  const statusRaw = String(
    digValue(payload, ['status', 'event', 'evento', 'situacao']) || '',
  ).toLowerCase();
  let event: PurchaseEvent = 'unknown';
  if (/aprov|approv|complet|paid|pago/.test(statusRaw)) event = 'approved';
  else if (/reembol|refund/.test(statusRaw)) event = 'refunded';
  else if (/cancel/.test(statusRaw)) event = 'cancelled';
  else if (/chargeback|disputa/.test(statusRaw)) event = 'chargeback';

  const rawValue = digValue(payload, ['value', 'valor', 'amount', 'price', 'total']);

  return {
    ok: true,
    data: {
      event,
      buyerName: digValue(payload, ['name', 'buyer.name', 'customer.name', 'cliente.nome']),
      buyerPhone: digValue(payload, ['phone', 'telefone', 'buyer.phone', 'customer.phone', 'cliente.telefone']),
      buyerEmail: digValue(payload, ['email', 'buyer.email', 'customer.email', 'cliente.email']),
      productName: digValue(payload, ['product', 'produto', 'product.name', 'item.name']),
      value: rawValue != null ? Number(rawValue) || null : null,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const token = new URL(req.url).searchParams.get('token');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing token' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!checkRateLimit(token)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: integration } = await supabase
    .from('payment_integrations')
    .select('id, organization_id, platform, secret, is_active')
    .eq('webhook_token', token)
    .eq('is_active', true)
    .maybeSingle();

  if (!integration) {
    return new Response(JSON.stringify({ error: 'Integration not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rawBody = await req.text();
  let rawPayloadJson: any = null;
  try {
    rawPayloadJson = JSON.parse(rawBody);
  } catch {
    // mantém null — o normalizador também vai falhar e logar o erro
  }

  let result: NormalizeResult;
  switch (integration.platform) {
    case 'hotmart':
      result = normalizeHotmart(req, rawBody, integration.secret);
      break;
    case 'stripe':
      result = await normalizeStripe(req, rawBody, integration.secret);
      break;
    default:
      result = normalizeGeneric(req, rawBody, integration.secret);
  }

  if (!result.ok && result.rejected) {
    await supabase.from('payment_integration_events').insert({
      integration_id: integration.id,
      organization_id: integration.organization_id,
      platform: integration.platform,
      status: 'rejected',
      error_message: result.error,
      raw_payload: rawPayloadJson,
    });
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!result.ok || !result.data) {
    await supabase.from('payment_integration_events').insert({
      integration_id: integration.id,
      organization_id: integration.organization_id,
      platform: integration.platform,
      status: 'error',
      error_message: result.error || 'Falha ao normalizar payload',
      raw_payload: rawPayloadJson,
    });
    // Retorna 200 pra evitar tempestade de retentativa da plataforma externa.
    return new Response(JSON.stringify({ received: true, processed: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const purchase = result.data;

  // Find or create contact pelo telefone (ou email, se não houver telefone)
  let contactId: string | null = null;
  const normalizedPhone = purchase.buyerPhone ? normalizeBrazilianPhone(purchase.buyerPhone) : null;

  if (normalizedPhone) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('organization_id', integration.organization_id)
      .eq('phone', normalizedPhone)
      .limit(1);
    if (existing && existing.length > 0) {
      contactId = existing[0].id;
    } else {
      const { data: created } = await supabase
        .from('contacts')
        .insert({
          organization_id: integration.organization_id,
          name: purchase.buyerName || 'Sem nome',
          phone: normalizedPhone,
          email: purchase.buyerEmail,
          channel: 'whatsapp',
          notes: `Origem: webhook de pagamento (${integration.platform})`,
        })
        .select('id')
        .single();
      contactId = created?.id || null;
    }
  } else if (purchase.buyerEmail) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('organization_id', integration.organization_id)
      .eq('email', purchase.buyerEmail)
      .limit(1);
    if (existing && existing.length > 0) contactId = existing[0].id;
  }

  await supabase.from('payment_integration_events').insert({
    integration_id: integration.id,
    organization_id: integration.organization_id,
    platform: integration.platform,
    purchase_event: purchase.event,
    contact_id: contactId,
    buyer_name: purchase.buyerName,
    buyer_phone: normalizedPhone || purchase.buyerPhone,
    buyer_email: purchase.buyerEmail,
    product_name: purchase.productName,
    value: purchase.value,
    status: 'processed',
    raw_payload: rawPayloadJson,
  });

  if (contactId) {
    const enginePayload = {
      contact_id: contactId,
      organization_id: integration.organization_id,
      event_type: 'external_purchase',
      payment_integration_id: integration.id,
      purchase_event: purchase.event,
      initial_context: {
        produto: purchase.productName || '',
        valor: purchase.value != null ? purchase.value.toFixed(2).replace('.', ',') : '',
        plataforma: integration.platform,
        comprador_nome: purchase.buyerName || '',
        comprador_telefone: normalizedPhone || purchase.buyerPhone || '',
        comprador_email: purchase.buyerEmail || '',
      },
    };

    // @ts-ignore EdgeRuntime
    EdgeRuntime.waitUntil(
      fetch(`${SUPABASE_URL}/functions/v1/automation-engine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(enginePayload),
      }).catch((e) => console.error('[payment-webhook] engine fire failed', e)),
    );
  }

  return new Response(JSON.stringify({ received: true, processed: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
