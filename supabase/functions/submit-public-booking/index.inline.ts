// VERSÃO SELF-CONTAINED para colar no editor web do Supabase externo.
// Esta versão tem o conteúdo de _shared/booking-helpers.ts inlinado no topo.
// NÃO usada pelo Lovable em runtime — somente para deploy manual no painel.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// ============= INLINED FROM booking-helpers.ts ==============
// ============================================================
interface BookingContext {
  customer_name: string;
  professional_name: string;
  date_formatted: string;
  time_formatted: string;
  event_type_name: string;
  google_review_url?: string | null;
  cancel_url?: string | null;
}

const DEFAULT_TEMPLATES = {
  confirmation_whatsapp: 'Olá {nome}! Seu agendamento foi confirmado para {data} às {hora} com {profissional} ({tipo_evento}). Em caso de imprevisto, avise-nos.',
  '24h_whatsapp': 'Olá {nome}! Lembrando do seu agendamento amanhã ({data}) às {hora} com {profissional}.',
  '1h_whatsapp': 'Olá {nome}! Seu agendamento com {profissional} é em 1 hora ({hora}). Te esperamos!',
  review_10min_whatsapp: 'Olá {nome}, obrigado pelo atendimento com {profissional}! Se puder, avalie nosso serviço aqui: {link_avaliacao}',
  cancellation_whatsapp: 'Olá {nome}, seu agendamento de {data} às {hora} foi cancelado. Caso queira reagendar, é só nos chamar.',
  reschedule_whatsapp: 'Olá {nome}! Seu agendamento foi reagendado para {data} às {hora} com {profissional}.',
  confirmation_subject: 'Agendamento confirmado — {data} às {hora}',
  '24h_subject': 'Lembrete: seu atendimento é amanhã às {hora}',
  '1h_subject': 'Lembrete: seu atendimento é em 1 hora',
  review_subject: 'Como foi seu atendimento? Avalie em segundos',
  cancellation_subject: 'Agendamento cancelado',
  reschedule_subject: 'Agendamento reagendado para {data} às {hora}',
};

function renderTemplate(tpl: string, ctx: BookingContext): string {
  return tpl
    .replaceAll('{nome}', ctx.customer_name)
    .replaceAll('{profissional}', ctx.professional_name)
    .replaceAll('{data}', ctx.date_formatted)
    .replaceAll('{hora}', ctx.time_formatted)
    .replaceAll('{tipo_evento}', ctx.event_type_name)
    .replaceAll('{link_avaliacao}', ctx.google_review_url || '');
}

function getWhatsAppMessage(
  type: 'confirmation' | '24h' | '1h' | 'review_10min' | 'cancellation' | 'reschedule',
  customTemplate: string | null | undefined,
  ctx: BookingContext
): string {
  const tpl = customTemplate || DEFAULT_TEMPLATES[`${type}_whatsapp` as keyof typeof DEFAULT_TEMPLATES];
  return renderTemplate(tpl, ctx);
}

function getEmailSubject(
  type: 'confirmation' | '24h' | '1h' | 'review_10min' | 'cancellation' | 'reschedule',
  customSubject: string | null | undefined,
  ctx: BookingContext
): string {
  const tpl = customSubject || DEFAULT_TEMPLATES[`${type}_subject` as keyof typeof DEFAULT_TEMPLATES];
  return renderTemplate(tpl, ctx);
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildEmailHtml(params: {
  type: 'confirmation' | '24h' | '1h' | 'review_10min' | 'cancellation' | 'reschedule';
  organizationName: string;
  ctx: BookingContext;
  customMessage?: string | null;
}): string {
  const { type, organizationName, ctx, customMessage } = params;
  const titles: Record<string, string> = {
    confirmation: '✅ Agendamento confirmado',
    '24h': '⏰ Lembrete: seu atendimento é amanhã',
    '1h': '⏰ Seu atendimento é em 1 hora',
    review_10min: '⭐ Como foi seu atendimento?',
    cancellation: '❌ Agendamento cancelado',
    reschedule: '📅 Agendamento reagendado',
  };
  const intros: Record<string, string> = {
    confirmation: `Olá <strong>${escapeHtml(ctx.customer_name)}</strong>! Seu agendamento foi confirmado.`,
    '24h': `Olá <strong>${escapeHtml(ctx.customer_name)}</strong>, lembrando do seu compromisso amanhã.`,
    '1h': `Olá <strong>${escapeHtml(ctx.customer_name)}</strong>, seu atendimento começa em 1 hora.`,
    review_10min: `Olá <strong>${escapeHtml(ctx.customer_name)}</strong>, obrigado pelo seu atendimento!`,
    cancellation: `Olá <strong>${escapeHtml(ctx.customer_name)}</strong>, seu agendamento foi cancelado.`,
    reschedule: `Olá <strong>${escapeHtml(ctx.customer_name)}</strong>, seu agendamento foi reagendado.`,
  };
  const ctaButton =
    type === 'review_10min' && ctx.google_review_url
      ? `<a href="${escapeHtml(ctx.google_review_url)}" style="display:inline-block; background:#6366f1; color:#fff; text-decoration:none; padding:14px 28px; border-radius:8px; font-weight:600;">Avaliar agora ⭐</a>`
      : type === 'cancellation' || type === 'review_10min'
      ? ''
      : ctx.cancel_url
      ? `<a href="${escapeHtml(ctx.cancel_url)}" style="display:inline-block; background:transparent; color:#6b7280; text-decoration:underline; padding:8px 0; font-size:13px;">Cancelar agendamento</a>`
      : '';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>${escapeHtml(titles[type])}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; background:#f9fafb; margin:0;">
  <div style="max-width: 560px; margin: 0 auto; background:#ffffff; border-radius:12px; padding:32px; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
    <h2 style="color:#111827; margin-top:0; font-size:22px;">${escapeHtml(titles[type])}</h2>
    <p style="font-size:15px; color:#374151; line-height:1.6;">${intros[type]}</p>
    ${customMessage ? `<p style="font-size:15px; color:#374151; line-height:1.6; padding:12px 16px; background:#f3f4f6; border-radius:8px;">${escapeHtml(customMessage)}</p>` : ''}
    <div style="background:#f9fafb; border-left:3px solid #6366f1; padding:16px 20px; border-radius:8px; margin:20px 0;">
      <p style="margin:4px 0; font-size:14px; color:#6b7280;"><strong style="color:#111827;">Profissional:</strong> ${escapeHtml(ctx.professional_name)}</p>
      <p style="margin:4px 0; font-size:14px; color:#6b7280;"><strong style="color:#111827;">Tipo:</strong> ${escapeHtml(ctx.event_type_name)}</p>
      <p style="margin:4px 0; font-size:14px; color:#6b7280;"><strong style="color:#111827;">Data:</strong> ${escapeHtml(ctx.date_formatted)}</p>
      <p style="margin:4px 0; font-size:14px; color:#6b7280;"><strong style="color:#111827;">Horário:</strong> ${escapeHtml(ctx.time_formatted)}</p>
    </div>
    ${ctaButton ? `<div style="text-align:center; margin:24px 0;">${ctaButton}</div>` : ''}
    <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
    <p style="font-size:12px; color:#9ca3af; text-align:center;">${escapeHtml(organizationName)}</p>
  </div>
</body>
</html>`;
}

function normalizeBrazilianPhone(input: string): string {
  let cleaned = String(input || '').replace(/\D/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;
  if (cleaned.length === 12) {
    const ddd = cleaned.slice(2, 4);
    const number = cleaned.slice(4);
    const first = number[0];
    if (['6', '7', '8', '9'].includes(first)) {
      cleaned = '55' + ddd + '9' + number;
    }
  }
  return cleaned;
}

function formatDateBR(iso: string, timezone: string = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: timezone }).format(new Date(iso));
}

function formatTimeBR(iso: string, timezone: string = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(iso));
}

async function sendResendEmail(params: {
  apiKey: string; fromEmail: string; fromName?: string; replyTo?: string;
  to: string; subject: string; html: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const fromHeader = params.fromName ? `${params.fromName} <${params.fromEmail}>` : params.fromEmail;
  const payload: Record<string, unknown> = { from: fromHeader, to: [params.to], subject: params.subject, html: params.html };
  if (params.replyTo) payload.reply_to = params.replyTo;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${params.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: body?.message || body?.error || `HTTP ${r.status}` };
    return { ok: true, id: body?.id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
// ============================================================
// =================== END OF INLINED HELPERS =================
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const rateBucket = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = rateBucket.get(key);
  if (!b || b.resetAt < now) { rateBucket.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { slug, event_type_id, starts_at, customer, honeypot } = body;

    if (honeypot && String(honeypot).trim() !== '') {
      return new Response(JSON.stringify({ ok: true, booking_id: 'fake' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!slug || !event_type_id || !starts_at || !customer?.name || !customer?.phone) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    if (!rateLimit(`${ip}:${slug}`)) {
      return new Response(JSON.stringify({ error: 'Muitas tentativas. Tente em alguns minutos.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: calendar, error: calErr } = await admin.from('calendars').select('*').eq('slug', slug).eq('is_active', true).maybeSingle();
    if (calErr || !calendar) {
      return new Response(JSON.stringify({ error: 'Calendário não encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: eventType, error: etErr } = await admin.from('event_types').select('*').eq('id', event_type_id).eq('calendar_id', (calendar as any).id).eq('is_active', true).maybeSingle();
    if (etErr || !eventType) {
      return new Response(JSON.stringify({ error: 'Tipo de evento não encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cal = calendar as any;
    const et = eventType as any;
    const startsDate = new Date(starts_at);
    const endsDate = new Date(startsDate.getTime() + et.duration_minutes * 60_000);

    const { data: overlap } = await admin.from('bookings').select('id').eq('calendar_id', cal.id).in('status', ['confirmed', 'pending']).lt('starts_at', endsDate.toISOString()).gt('ends_at', startsDate.toISOString()).limit(1);
    if (overlap && overlap.length > 0) {
      return new Response(JSON.stringify({ error: 'Horário não está mais disponível' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: blocked } = await admin.from('calendar_blocks').select('id').eq('calendar_id', cal.id).lt('starts_at', endsDate.toISOString()).gt('ends_at', startsDate.toISOString()).limit(1);
    if (blocked && blocked.length > 0) {
      return new Response(JSON.stringify({ error: 'Horário não está mais disponível' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const normalizedPhone = normalizeBrazilianPhone(customer.phone);

    let contactId: string | null = null;
    const { data: existing } = await admin.from('contacts').select('id').eq('organization_id', cal.organization_id).eq('phone', normalizedPhone).maybeSingle();
    if (existing) {
      contactId = (existing as any).id;
    } else {
      const { data: created, error: createErr } = await admin.from('contacts').insert({
        organization_id: cal.organization_id, name: customer.name, phone: normalizedPhone,
        email: customer.email || null, channel: 'whatsapp',
      }).select('id').single();
      if (!createErr && created) contactId = (created as any).id;
    }

    const { data: booking, error: bookingErr } = await admin.from('bookings').insert({
      organization_id: cal.organization_id, calendar_id: cal.id, event_type_id: et.id, contact_id: contactId,
      customer_name: customer.name, customer_phone: normalizedPhone, customer_email: customer.email || null,
      starts_at: startsDate.toISOString(), ends_at: endsDate.toISOString(),
      status: et.requires_confirmation ? 'pending' : 'confirmed',
      notes: customer.notes || null, source: 'public', ip_address: ip,
    }).select('*').single();

    if (bookingErr || !booking) {
      console.error('[submit-public-booking] insert error:', bookingErr);
      return new Response(JSON.stringify({ error: 'Erro ao criar agendamento' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const b = booking as any;

    const { data: org } = await admin.from('organizations').select('name, bookings_email_enabled, resend_api_key, resend_from_email, resend_from_name, resend_reply_to').eq('id', cal.organization_id).single();
    const orgRow = org as any;
    const remindersOn = (cal.reminders_enabled !== false) && (et.reminders_enabled !== false);
    const emailEnabled = remindersOn && orgRow?.bookings_email_enabled && customer.email && orgRow?.resend_api_key && orgRow?.resend_from_email;

    if (remindersOn) {
      const reminders: any[] = [
        { booking_id: b.id, reminder_type: 'confirmation', channel: 'whatsapp', scheduled_for: new Date().toISOString() },
        { booking_id: b.id, reminder_type: '24h', channel: 'whatsapp', scheduled_for: new Date(startsDate.getTime() - 24 * 3600_000).toISOString() },
        { booking_id: b.id, reminder_type: '1h', channel: 'whatsapp', scheduled_for: new Date(startsDate.getTime() - 3600_000).toISOString() },
        { booking_id: b.id, reminder_type: 'review_10min', channel: 'whatsapp', scheduled_for: new Date(endsDate.getTime() + 10 * 60_000).toISOString() },
      ];
      if (emailEnabled) {
        reminders.push(
          { booking_id: b.id, reminder_type: 'confirmation', channel: 'email', scheduled_for: new Date().toISOString() },
          { booking_id: b.id, reminder_type: '24h', channel: 'email', scheduled_for: new Date(startsDate.getTime() - 24 * 3600_000).toISOString() },
          { booking_id: b.id, reminder_type: '1h', channel: 'email', scheduled_for: new Date(startsDate.getTime() - 3600_000).toISOString() },
          { booking_id: b.id, reminder_type: 'review_10min', channel: 'email', scheduled_for: new Date(endsDate.getTime() + 10 * 60_000).toISOString() }
        );
      }
      await admin.from('booking_reminders').insert(reminders);
    }

    const ctx: BookingContext = {
      customer_name: customer.name,
      professional_name: cal.name,
      date_formatted: formatDateBR(startsDate.toISOString(), cal.timezone),
      time_formatted: formatTimeBR(startsDate.toISOString(), cal.timezone),
      event_type_name: et.name,
      google_review_url: et.google_review_url || cal.google_review_url,
    };

    if (remindersOn && contactId) {
      const text = getWhatsAppMessage('confirmation', et.confirmation_message_whatsapp, ctx);
      const { data: schedMsg } = await admin.from('scheduled_messages').insert({
        organization_id: cal.organization_id, contact_id: contactId, scheduled_by: cal.created_by,
        message_content: text, scheduled_at: new Date().toISOString(),
      }).select('id').single();
      if (schedMsg) {
        await admin.from('booking_reminders').update({ status: 'queued', scheduled_message_id: (schedMsg as any).id })
          .eq('booking_id', b.id).eq('reminder_type', 'confirmation').eq('channel', 'whatsapp');
      }
    }

    if (emailEnabled) {
      const subject = getEmailSubject('confirmation', et.confirmation_subject_email, ctx);
      const html = buildEmailHtml({ type: 'confirmation', organizationName: orgRow.name, ctx, customMessage: et.confirmation_message_whatsapp });
      const result = await sendResendEmail({
        apiKey: orgRow.resend_api_key, fromEmail: orgRow.resend_from_email, fromName: orgRow.resend_from_name,
        replyTo: orgRow.resend_reply_to, to: customer.email, subject, html,
      });
      await admin.from('booking_reminders').update({
        status: result.ok ? 'sent' : 'failed',
        sent_at: result.ok ? new Date().toISOString() : null,
        error_message: result.error || null,
      }).eq('booking_id', b.id).eq('reminder_type', 'confirmation').eq('channel', 'email');
      await admin.from('email_send_history').insert({
        organization_id: cal.organization_id, to_email: customer.email, from_email: orgRow.resend_from_email,
        subject, source: 'booking', status: result.ok ? 'sent' : 'failed',
        resend_message_id: result.id || null, error_message: result.error || null, contact_id: contactId,
      });
    }

    return new Response(JSON.stringify({
      ok: true, booking_id: b.id, status: b.status,
      message: b.status === 'pending' ? 'Seu agendamento foi recebido e aguarda confirmação.' : 'Agendamento confirmado! Você receberá os lembretes em breve.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[submit-public-booking] error:', e);
    return new Response(JSON.stringify({ error: e?.message || 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
