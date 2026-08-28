import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function randomDelay(minSeconds: number, maxSeconds: number): Promise<void> {
  const ms = (Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds) * 1000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ScheduledMessage {
  id: string;
  organization_id: string;
  contact_id: string;
  scheduled_by: string;
  message_content: string;
  scheduled_at: string;
  status: string;
  recurrence_rule: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  recurrence_interval: number | null;
  recurrence_end_at: string | null;
  parent_schedule_id: string | null;
}

function computeNextOccurrence(
  from: Date,
  rule: 'daily' | 'weekly' | 'monthly' | 'yearly',
  interval: number,
): Date {
  const n = Math.max(1, interval || 1);
  const next = new Date(from);
  switch (rule) {
    case 'daily':
      next.setDate(next.getDate() + n);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7 * n);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + n);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + n);
      break;
  }
  return next;
}


interface WhatsAppInstance {
  instance_name: string;
  api_key: string;
  base_url: string;
}

interface Contact {
  phone: string;
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[send-scheduled-messages] Starting scheduled message processing...');

    // Get all pending messages that are due
    const now = new Date().toISOString();
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .limit(10);

    if (fetchError) {
      console.error('[send-scheduled-messages] Error fetching messages:', fetchError);
      throw fetchError;
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('[send-scheduled-messages] No pending messages to send');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-scheduled-messages] Found ${pendingMessages.length} messages to process`);

    let successCount = 0;
    let failCount = 0;

    for (const message of pendingMessages as ScheduledMessage[]) {
      try {
        // Get WhatsApp instance for this organization
        const { data: instance, error: instanceError } = await supabase
          .from('whatsapp_instances')
          .select('instance_name, api_key, base_url')
          .eq('organization_id', message.organization_id)
          .maybeSingle();

        if (instanceError || !instance) {
          console.error(`[send-scheduled-messages] No WhatsApp instance for org ${message.organization_id}`);
          await supabase
            .from('scheduled_messages')
            .update({ status: 'failed', error_message: 'WhatsApp instance not configured' })
            .eq('id', message.id);
          failCount++;
          continue;
        }

        // Get contact phone
        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .select('phone')
          .eq('id', message.contact_id)
          .maybeSingle();

        if (contactError || !contact) {
          console.error(`[send-scheduled-messages] Contact not found: ${message.contact_id}`);
          await supabase
            .from('scheduled_messages')
            .update({ status: 'failed', error_message: 'Contact not found' })
            .eq('id', message.id);
          failCount++;
          continue;
        }

        const typedInstance = instance as WhatsAppInstance;
        const typedContact = contact as Contact;
        const formattedPhone = formatPhoneNumber(typedContact.phone);

        // Send via Stevo API
        // Keep consistent with stevo-send-message: POST {base_url}/send/text
        const sendUrl = `${typedInstance.base_url}/send/text`;
        console.log(`[send-scheduled-messages] Sending to ${formattedPhone} via ${sendUrl}`);

        const sendResponse = await fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': typedInstance.api_key,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: message.message_content,
          }),
        });

        if (!sendResponse.ok) {
          const errorText = await sendResponse.text();
          console.error(`[send-scheduled-messages] Stevo API error:`, errorText);
          await supabase
            .from('scheduled_messages')
            .update({
              status: 'failed',
              error_message: `API error: ${sendResponse.status} - ${errorText}`,
            })
            .eq('id', message.id);
          failCount++;
          continue;
        }

        // Save message to messages table
        await supabase.from('messages').insert({
          contact_id: message.contact_id,
          organization_id: message.organization_id,
          content: message.message_content,
          direction: 'outbound',
          message_type: 'text',
          status: 'sent',
          sent_by_user_id: message.scheduled_by,
        });

        // Update contact last_message_at
        await supabase
          .from('contacts')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', message.contact_id);

        // Mark as sent
        await supabase
          .from('scheduled_messages')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', message.id);

        // If this is a recurring schedule, create the next occurrence
        if (message.recurrence_rule) {
          try {
            const next = computeNextOccurrence(
              new Date(message.scheduled_at),
              message.recurrence_rule,
              message.recurrence_interval || 1,
            );
            const endAt = message.recurrence_end_at ? new Date(message.recurrence_end_at) : null;
            if (!endAt || next <= endAt) {
              const parentId = message.parent_schedule_id || message.id;
              const { error: nextErr } = await supabase.from('scheduled_messages').insert({
                organization_id: message.organization_id,
                contact_id: message.contact_id,
                scheduled_by: message.scheduled_by,
                message_content: message.message_content,
                scheduled_at: next.toISOString(),
                status: 'pending',
                recurrence_rule: message.recurrence_rule,
                recurrence_interval: message.recurrence_interval || 1,
                recurrence_end_at: message.recurrence_end_at,
                parent_schedule_id: parentId,
              });
              if (nextErr) {
                console.error(`[send-scheduled-messages] Failed to queue next recurrence for ${message.id}:`, nextErr);
              } else {
                console.log(`[send-scheduled-messages] Queued next recurrence at ${next.toISOString()} for ${message.id}`);
              }
            } else {
              console.log(`[send-scheduled-messages] Recurrence ended for ${message.id} (next ${next.toISOString()} > end ${endAt.toISOString()})`);
            }
          } catch (recErr) {
            console.error(`[send-scheduled-messages] Recurrence error for ${message.id}:`, recErr);
          }
        }

        console.log(`[send-scheduled-messages] Successfully sent message ${message.id}`);
        successCount++;


        // Anti-blocking: random delay between 8-20 seconds between sends
        if (successCount < pendingMessages.length) {
          const waitSecs = Math.floor(Math.random() * 13) + 8;
          console.log(`[send-scheduled-messages] Waiting ${waitSecs}s before next send...`);
          await randomDelay(8, 20);
        }
      } catch (err) {
        console.error(`[send-scheduled-messages] Error processing message ${message.id}:`, err);
        await supabase
          .from('scheduled_messages')
          .update({ status: 'failed', error_message: String(err) })
          .eq('id', message.id);
        failCount++;
      }
    }

    console.log(`[send-scheduled-messages] Completed: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({ processed: pendingMessages.length, success: successCount, failed: failCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[send-scheduled-messages] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
