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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const horizon = new Date(Date.now() + 10 * 60_000).toISOString();
    const { data: reminders, error: remErr } = await admin
      .from('booking_reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', horizon)
      .limit(50);

    if (remErr) throw remErr;
    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let processed = 0, skipped = 0, sent = 0, failed = 0;

    for (const r of reminders as any[]) {
      try {
        const { data: booking } = await admin.from('bookings').select('*').eq('id', r.booking_id).maybeSingle();
        if (!booking) {
          await admin.from('booking_reminders').update({ status: 'skipped', error_message: 'Booking not found' }).eq('id', r.id);
          skipped++; continue;
        }
        const b = booking as any;
        if (b.status === 'cancelled' || b.status === 'no_show') {
          await admin.from('booking_reminders').update({ status: 'skipped' }).eq('id', r.id);
          skipped++; continue;
        }
        if (r.reminder_type === 'review_10min' && b.status !== 'completed' && b.status !== 'confirmed') {
          await admin.from('booking_reminders').update({ status: 'skipped' }).eq('id', r.id);
          skipped++; continue;
        }

        const { data: calendar } = await admin.from('calendars').select('*').eq('id', b.calendar_id).maybeSingle();
        const { data: eventType } = await admin.from('event_types').select('*').eq('id', b.event_type_id).maybeSingle();
        if (!calendar || !eventType) {
          await admin.from('booking_reminders').update({ status: 'failed', error_message: 'Calendar/event type missing' }).eq('id', r.id);
          failed++; continue;
        }

        const cal = calendar as any;
        const et = eventType as any;
        const reviewUrl = et.google_review_url || cal.google_review_url;
        if (r.reminder_type === 'review_10min' && !reviewUrl) {
          await admin.from('booking_reminders').update({ status: 'skipped', error_message: 'No review URL' }).eq('id', r.id);
          skipped++; continue;
        }

        const ctx: BookingContext = {
          customer_name: b.customer_name,
          professional_name: cal.name,
          date_formatted: formatDateBR(b.starts_at, cal.timezone),
          time_formatted: formatTimeBR(b.starts_at, cal.timezone),
          event_type_name: et.name,
          google_review_url: reviewUrl,
        };

        if (r.channel === 'whatsapp') {
          if (!b.contact_id) {
            await admin.from('booking_reminders').update({ status: 'skipped', error_message: 'No contact_id' }).eq('id', r.id);
            skipped++; continue;
          }
          const customTpl =
            r.reminder_type === 'confirmation' ? et.confirmation_message_whatsapp :
            r.reminder_type === '24h' ? et.reminder_24h_message_whatsapp :
            r.reminder_type === '1h' ? et.reminder_1h_message_whatsapp :
            et.review_message_whatsapp;
          const text = getWhatsAppMessage(r.reminder_type, customTpl, ctx);

          const { data: schedMsg, error: schedErr } = await admin.from('scheduled_messages').insert({
            organization_id: b.organization_id, contact_id: b.contact_id, scheduled_by: cal.created_by,
            message_content: text, scheduled_at: r.scheduled_for,
          }).select('id').single();

          if (schedErr) {
            await admin.from('booking_reminders').update({ status: 'failed', error_message: schedErr.message }).eq('id', r.id);
            failed++;
          } else {
            await admin.from('booking_reminders').update({ status: 'queued', scheduled_message_id: (schedMsg as any).id }).eq('id', r.id);
            sent++;
          }
        } else if (r.channel === 'email') {
          if (!b.customer_email) {
            await admin.from('booking_reminders').update({ status: 'skipped', error_message: 'No email' }).eq('id', r.id);
            skipped++; continue;
          }
          const { data: org } = await admin.from('organizations').select('name, bookings_email_enabled, resend_api_key, resend_from_email, resend_from_name, resend_reply_to').eq('id', b.organization_id).single();
          const o = org as any;
          if (!o?.bookings_email_enabled || !o?.resend_api_key || !o?.resend_from_email) {
            await admin.from('booking_reminders').update({ status: 'skipped', error_message: 'Email disabled' }).eq('id', r.id);
            skipped++; continue;
          }

          const customSubject =
            r.reminder_type === 'confirmation' ? et.confirmation_subject_email :
            r.reminder_type === '24h' ? et.reminder_24h_subject_email :
            r.reminder_type === '1h' ? et.reminder_1h_subject_email :
            et.review_subject_email;

          const subject = getEmailSubject(r.reminder_type, customSubject, ctx);
          const html = buildEmailHtml({ type: r.reminder_type, organizationName: o.name, ctx });

          const result = await sendResendEmail({
            apiKey: o.resend_api_key, fromEmail: o.resend_from_email, fromName: o.resend_from_name,
            replyTo: o.resend_reply_to, to: b.customer_email, subject, html,
          });

          await admin.from('booking_reminders').update({
            status: result.ok ? 'sent' : 'failed',
            sent_at: result.ok ? new Date().toISOString() : null,
            error_message: result.error || null,
          }).eq('id', r.id);

          await admin.from('email_send_history').insert({
            organization_id: b.organization_id, to_email: b.customer_email, from_email: o.resend_from_email,
            subject, source: 'booking', status: result.ok ? 'sent' : 'failed',
            resend_message_id: result.id || null, error_message: result.error || null, contact_id: b.contact_id,
          });

          if (result.ok) sent++; else failed++;
        }
        processed++;
      } catch (innerErr: any) {
        console.error('[process-booking-reminders] item error:', innerErr);
        await admin.from('booking_reminders').update({ status: 'failed', error_message: String(innerErr?.message || innerErr) }).eq('id', r.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed, sent, skipped, failed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[process-booking-reminders] fatal:', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
