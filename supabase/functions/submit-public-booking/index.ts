// submit-public-booking - cria agendamento via página pública (sem auth)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildEmailHtml,
  formatDateBR,
  formatTimeBR,
  getEmailSubject,
  getWhatsAppMessage,
  normalizeBrazilianPhone,
  sendResendEmail,
  type BookingContext,
} from '../_shared/booking-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit em memória (por instância)
const rateBucket = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = rateBucket.get(key);
  if (!b || b.resetAt < now) {
    rateBucket.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { slug, event_type_id, starts_at, customer, honeypot } = body;

    // Honeypot
    if (honeypot && String(honeypot).trim() !== '') {
      return new Response(JSON.stringify({ ok: true, booking_id: 'fake' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!slug || !event_type_id || !starts_at || !customer?.name || !customer?.phone) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    if (!rateLimit(`${ip}:${slug}`)) {
      return new Response(JSON.stringify({ error: 'Muitas tentativas. Tente em alguns minutos.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Carrega calendar pelo slug
    const { data: calendar, error: calErr } = await admin
      .from('calendars')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (calErr || !calendar) {
      return new Response(JSON.stringify({ error: 'Calendário não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Carrega event type
    const { data: eventType, error: etErr } = await admin
      .from('event_types')
      .select('*')
      .eq('id', event_type_id)
      .eq('calendar_id', (calendar as any).id)
      .eq('is_active', true)
      .maybeSingle();

    if (etErr || !eventType) {
      return new Response(JSON.stringify({ error: 'Tipo de evento não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cal = calendar as any;
    const et = eventType as any;
    const startsDate = new Date(starts_at);
    const endsDate = new Date(startsDate.getTime() + et.duration_minutes * 60_000);

    // Re-check slot livre
    const { data: overlap } = await admin
      .from('bookings')
      .select('id')
      .eq('calendar_id', cal.id)
      .in('status', ['confirmed', 'pending'])
      .lt('starts_at', endsDate.toISOString())
      .gt('ends_at', startsDate.toISOString())
      .limit(1);

    if (overlap && overlap.length > 0) {
      return new Response(JSON.stringify({ error: 'Horário não está mais disponível' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: blocked } = await admin
      .from('calendar_blocks')
      .select('id')
      .eq('calendar_id', cal.id)
      .lt('starts_at', endsDate.toISOString())
      .gt('ends_at', startsDate.toISOString())
      .limit(1);

    if (blocked && blocked.length > 0) {
      return new Response(JSON.stringify({ error: 'Horário não está mais disponível' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normaliza telefone
    const normalizedPhone = normalizeBrazilianPhone(customer.phone);

    // Encontra/cria contato
    let contactId: string | null = null;
    const { data: existing } = await admin
      .from('contacts')
      .select('id')
      .eq('organization_id', cal.organization_id)
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existing) {
      contactId = (existing as any).id;
    } else {
      const { data: created, error: createErr } = await admin
        .from('contacts')
        .insert({
          organization_id: cal.organization_id,
          name: customer.name,
          phone: normalizedPhone,
          email: customer.email || null,
          channel: 'whatsapp',
        })
        .select('id')
        .single();
      if (!createErr && created) contactId = (created as any).id;
    }

    // Cria booking
    const { data: booking, error: bookingErr } = await admin
      .from('bookings')
      .insert({
        organization_id: cal.organization_id,
        calendar_id: cal.id,
        event_type_id: et.id,
        contact_id: contactId,
        customer_name: customer.name,
        customer_phone: normalizedPhone,
        customer_email: customer.email || null,
        starts_at: startsDate.toISOString(),
        ends_at: endsDate.toISOString(),
        status: et.requires_confirmation ? 'pending' : 'confirmed',
        notes: customer.notes || null,
        source: 'public',
        ip_address: ip,
      })
      .select('*')
      .single();

    if (bookingErr || !booking) {
      console.error('[submit-public-booking] insert error:', bookingErr);
      return new Response(JSON.stringify({ error: 'Erro ao criar agendamento' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const b = booking as any;

    // Carrega organização (flag email + resend config)
    const { data: org } = await admin
      .from('organizations')
      .select('name, bookings_email_enabled, resend_api_key, resend_from_email, resend_from_name, resend_reply_to')
      .eq('id', cal.organization_id)
      .single();

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

    // Envia confirmação imediata (WhatsApp via scheduled_messages, Email via Resend direto)
    const ctx: BookingContext = {
      customer_name: customer.name,
      professional_name: cal.name,
      date_formatted: formatDateBR(startsDate.toISOString(), cal.timezone),
      time_formatted: formatTimeBR(startsDate.toISOString(), cal.timezone),
      event_type_name: et.name,
      google_review_url: et.google_review_url || cal.google_review_url,
    };

    // WhatsApp confirmação
    if (remindersOn && contactId) {
      const text = getWhatsAppMessage('confirmation', et.confirmation_message_whatsapp, ctx);
      const { data: schedMsg } = await admin
        .from('scheduled_messages')
        .insert({
          organization_id: cal.organization_id,
          contact_id: contactId,
          scheduled_by: cal.created_by,
          message_content: text,
          scheduled_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (schedMsg) {
        await admin
          .from('booking_reminders')
          .update({ status: 'queued', scheduled_message_id: (schedMsg as any).id })
          .eq('booking_id', b.id)
          .eq('reminder_type', 'confirmation')
          .eq('channel', 'whatsapp');
      }
    }

    // Email confirmação
    if (emailEnabled) {
      const subject = getEmailSubject('confirmation', et.confirmation_subject_email, ctx);
      const html = buildEmailHtml({
        type: 'confirmation',
        organizationName: orgRow.name,
        ctx,
        customMessage: et.confirmation_message_whatsapp,
      });
      const result = await sendResendEmail({
        apiKey: orgRow.resend_api_key,
        fromEmail: orgRow.resend_from_email,
        fromName: orgRow.resend_from_name,
        replyTo: orgRow.resend_reply_to,
        to: customer.email,
        subject,
        html,
      });

      await admin
        .from('booking_reminders')
        .update({
          status: result.ok ? 'sent' : 'failed',
          sent_at: result.ok ? new Date().toISOString() : null,
          error_message: result.error || null,
        })
        .eq('booking_id', b.id)
        .eq('reminder_type', 'confirmation')
        .eq('channel', 'email');

      await admin.from('email_send_history').insert({
        organization_id: cal.organization_id,
        to_email: customer.email,
        from_email: orgRow.resend_from_email,
        subject,
        source: 'booking',
        status: result.ok ? 'sent' : 'failed',
        resend_message_id: result.id || null,
        error_message: result.error || null,
        contact_id: contactId,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        booking_id: b.id,
        status: b.status,
        message:
          b.status === 'pending'
            ? 'Seu agendamento foi recebido e aguarda confirmação.'
            : 'Agendamento confirmado! Você receberá os lembretes em breve.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[submit-public-booking] error:', e);
    return new Response(JSON.stringify({ error: e?.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
