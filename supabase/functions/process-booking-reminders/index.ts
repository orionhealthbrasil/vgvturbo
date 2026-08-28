// process-booking-reminders - cron que envia lembretes pendentes
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildEmailHtml,
  formatDateBR,
  formatTimeBR,
  getEmailSubject,
  getWhatsAppMessage,
  sendResendEmail,
  type BookingContext,
} from '../_shared/booking-helpers.ts';

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

    // Busca reminders pendentes que vencem em até 10 min
    const horizon = new Date(Date.now() + 10 * 60_000).toISOString();
    const { data: reminders, error: remErr } = await admin
      .from('booking_reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', horizon)
      .limit(50);

    if (remErr) throw remErr;
    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let skipped = 0;
    let sent = 0;
    let failed = 0;

    for (const r of reminders as any[]) {
      try {
        // Carrega booking, calendar, event_type, organization
        const { data: booking } = await admin
          .from('bookings')
          .select('*')
          .eq('id', r.booking_id)
          .maybeSingle();

        if (!booking) {
          await admin.from('booking_reminders').update({ status: 'skipped', error_message: 'Booking not found' }).eq('id', r.id);
          skipped++;
          continue;
        }

        const b = booking as any;

        // Pula se booking foi cancelado ou marcado como no_show
        if (b.status === 'cancelled' || b.status === 'no_show') {
          await admin.from('booking_reminders').update({ status: 'skipped' }).eq('id', r.id);
          skipped++;
          continue;
        }

        // Para review_10min, só envia se completed (ou ainda confirmed perto do fim)
        if (r.reminder_type === 'review_10min' && b.status !== 'completed' && b.status !== 'confirmed') {
          await admin.from('booking_reminders').update({ status: 'skipped' }).eq('id', r.id);
          skipped++;
          continue;
        }

        const { data: calendar } = await admin
          .from('calendars')
          .select('*')
          .eq('id', b.calendar_id)
          .maybeSingle();
        const { data: eventType } = await admin
          .from('event_types')
          .select('*')
          .eq('id', b.event_type_id)
          .maybeSingle();

        if (!calendar || !eventType) {
          await admin.from('booking_reminders').update({ status: 'failed', error_message: 'Calendar/event type missing' }).eq('id', r.id);
          failed++;
          continue;
        }

        const cal = calendar as any;
        const et = eventType as any;
        const reviewUrl = et.google_review_url || cal.google_review_url;

        // review_10min sem URL → skip
        if (r.reminder_type === 'review_10min' && !reviewUrl) {
          await admin.from('booking_reminders').update({ status: 'skipped', error_message: 'No review URL' }).eq('id', r.id);
          skipped++;
          continue;
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
            skipped++;
            continue;
          }
          const customTpl =
            r.reminder_type === 'confirmation' ? et.confirmation_message_whatsapp :
            r.reminder_type === '24h' ? et.reminder_24h_message_whatsapp :
            r.reminder_type === '1h' ? et.reminder_1h_message_whatsapp :
            et.review_message_whatsapp;
          const text = getWhatsAppMessage(r.reminder_type, customTpl, ctx);

          const { data: schedMsg, error: schedErr } = await admin
            .from('scheduled_messages')
            .insert({
              organization_id: b.organization_id,
              contact_id: b.contact_id,
              scheduled_by: cal.created_by,
              message_content: text,
              scheduled_at: r.scheduled_for,
            })
            .select('id')
            .single();

          if (schedErr) {
            await admin.from('booking_reminders').update({ status: 'failed', error_message: schedErr.message }).eq('id', r.id);
            failed++;
          } else {
            await admin
              .from('booking_reminders')
              .update({ status: 'queued', scheduled_message_id: (schedMsg as any).id })
              .eq('id', r.id);
            sent++;
          }
        } else if (r.channel === 'email') {
          if (!b.customer_email) {
            await admin.from('booking_reminders').update({ status: 'skipped', error_message: 'No email' }).eq('id', r.id);
            skipped++;
            continue;
          }
          const { data: org } = await admin
            .from('organizations')
            .select('name, bookings_email_enabled, resend_api_key, resend_from_email, resend_from_name, resend_reply_to')
            .eq('id', b.organization_id)
            .single();
          const o = org as any;
          if (!o?.bookings_email_enabled || !o?.resend_api_key || !o?.resend_from_email) {
            await admin.from('booking_reminders').update({ status: 'skipped', error_message: 'Email disabled' }).eq('id', r.id);
            skipped++;
            continue;
          }

          const customSubject =
            r.reminder_type === 'confirmation' ? et.confirmation_subject_email :
            r.reminder_type === '24h' ? et.reminder_24h_subject_email :
            r.reminder_type === '1h' ? et.reminder_1h_subject_email :
            et.review_subject_email;

          const subject = getEmailSubject(r.reminder_type, customSubject, ctx);
          const html = buildEmailHtml({
            type: r.reminder_type,
            organizationName: o.name,
            ctx,
          });

          const result = await sendResendEmail({
            apiKey: o.resend_api_key,
            fromEmail: o.resend_from_email,
            fromName: o.resend_from_name,
            replyTo: o.resend_reply_to,
            to: b.customer_email,
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
            .eq('id', r.id);

          await admin.from('email_send_history').insert({
            organization_id: b.organization_id,
            to_email: b.customer_email,
            from_email: o.resend_from_email,
            subject,
            source: 'booking',
            status: result.ok ? 'sent' : 'failed',
            resend_message_id: result.id || null,
            error_message: result.error || null,
            contact_id: b.contact_id,
          });

          if (result.ok) sent++;
          else failed++;
        }

        processed++;
      } catch (innerErr: any) {
        console.error('[process-booking-reminders] item error:', innerErr);
        await admin.from('booking_reminders').update({ status: 'failed', error_message: String(innerErr?.message || innerErr) }).eq('id', r.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed, sent, skipped, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[process-booking-reminders] fatal:', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
