// Helpers para envio de mensagens de booking (texto WhatsApp + email Resend)
// Usado por submit-public-booking e process-booking-reminders

export interface BookingContext {
  customer_name: string;
  professional_name: string;
  date_formatted: string; // ex: 24/04/2026
  time_formatted: string; // ex: 14:00
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

export function renderTemplate(tpl: string, ctx: BookingContext): string {
  return tpl
    .replaceAll('{nome}', ctx.customer_name)
    .replaceAll('{profissional}', ctx.professional_name)
    .replaceAll('{data}', ctx.date_formatted)
    .replaceAll('{hora}', ctx.time_formatted)
    .replaceAll('{tipo_evento}', ctx.event_type_name)
    .replaceAll('{link_avaliacao}', ctx.google_review_url || '');
}

export function getWhatsAppMessage(
  type: 'confirmation' | '24h' | '1h' | 'review_10min' | 'cancellation' | 'reschedule',
  customTemplate: string | null | undefined,
  ctx: BookingContext
): string {
  const tpl = customTemplate || DEFAULT_TEMPLATES[`${type}_whatsapp` as keyof typeof DEFAULT_TEMPLATES];
  return renderTemplate(tpl, ctx);
}

export function getEmailSubject(
  type: 'confirmation' | '24h' | '1h' | 'review_10min' | 'cancellation' | 'reschedule',
  customSubject: string | null | undefined,
  ctx: BookingContext
): string {
  const tpl = customSubject || DEFAULT_TEMPLATES[`${type}_subject` as keyof typeof DEFAULT_TEMPLATES];
  return renderTemplate(tpl, ctx);
}

export function buildEmailHtml(params: {
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
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titles[type])}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; background:#f9fafb; margin:0;">
  <div style="max-width: 560px; margin: 0 auto; background:#ffffff; border-radius:12px; padding:32px; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
    <h2 style="color:#111827; margin-top:0; font-size:22px;">${escapeHtml(titles[type])}</h2>
    <p style="font-size:15px; color:#374151; line-height:1.6;">${intros[type]}</p>
    ${
      customMessage
        ? `<p style="font-size:15px; color:#374151; line-height:1.6; padding:12px 16px; background:#f3f4f6; border-radius:8px;">${escapeHtml(customMessage)}</p>`
        : ''
    }
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

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function normalizeBrazilianPhone(input: string): string {
  let cleaned = String(input || '').replace(/\D/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;
  // Brazilian mobile: 55 + DDD(2) + 9 + 8 digits = 13
  // Landline: 55 + DDD(2) + 8 digits = 12
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

export function formatDateBR(iso: string, timezone: string = 'America/Sao_Paulo'): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: timezone,
  }).format(d);
}

export function formatTimeBR(iso: string, timezone: string = 'America/Sao_Paulo'): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(d);
}

export async function sendResendEmail(params: {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const fromHeader = params.fromName ? `${params.fromName} <${params.fromEmail}>` : params.fromEmail;
  const payload: Record<string, unknown> = {
    from: fromHeader,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  };
  if (params.replyTo) payload.reply_to = params.replyTo;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { ok: false, error: body?.message || body?.error || `HTTP ${r.status}` };
    }
    return { ok: true, id: body?.id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
