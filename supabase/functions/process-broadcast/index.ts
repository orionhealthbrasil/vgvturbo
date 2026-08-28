import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BroadcastCampaign {
  id: string;
  organization_id: string;
  message_content: string;
  media_url: string | null;
  media_type: string | null;
  automation_id: string | null;
  min_interval_seconds: number;
  max_interval_seconds: number;
  batch_size: number;
  batch_pause_min_seconds: number;
  batch_pause_max_seconds: number;
  messages_per_hour_limit: number;
  status: string;
  sent_count: number;
  failed_count: number;
  current_batch: number;
}

interface BroadcastRecipient {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  phone: string;
  name: string | null;
  status: string;
  position: number;
}

interface WhatsAppInstance {
  instance_name: string;
  api_key: string;
  base_url: string;
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

function getRandomDelay(minSeconds: number, maxSeconds: number): number {
  return Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
}

function personalizeMessage(message: string, name: string | null): string {
  if (!name) {
    return message.replace(/\{nome\}/gi, 'você');
  }
  return message.replace(/\{nome\}/gi, name);
}

async function sendWhatsAppMessage(
  instance: WhatsAppInstance,
  phone: string,
  text: string,
  mediaUrl: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = formatPhoneNumber(phone);

    // If there's media, send with image
    if (mediaUrl) {
      const response = await fetch(`${instance.base_url}/send/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': instance.api_key,
        },
        body: JSON.stringify({
          number: formattedPhone,
          url: mediaUrl,
          caption: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `API error: ${response.status} - ${errorText}` };
      }
    } else {
      // Text only
      const response = await fetch(`${instance.base_url}/send/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': instance.api_key,
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `API error: ${response.status} - ${errorText}` };
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function triggerAutomationForRecipient(
  supabase: SupabaseClient,
  campaign: BroadcastCampaign,
  recipient: BroadcastRecipient,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Resolve contact_id — create a transient contact if not linked
    let contactId = recipient.contact_id;
    if (!contactId) {
      const phone = formatPhoneNumber(recipient.phone);
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('organization_id', campaign.organization_id)
        .eq('phone', phone)
        .maybeSingle();

      if (existing) {
        contactId = existing.id;
      } else {
        const { data: created, error: createErr } = await supabase
          .from('contacts')
          .insert({
            organization_id: campaign.organization_id,
            phone,
            name: recipient.name || null,
          })
          .select('id')
          .single();
        if (createErr) return { success: false, error: createErr.message };
        contactId = created.id;
      }
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/automation-engine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        contact_id: contactId,
        organization_id: campaign.organization_id,
        event_type: 'manual_trigger',
        automation_id: campaign.automation_id,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return { success: false, error: `automation-engine ${res.status}: ${txt}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function processNextRecipient(
  supabase: SupabaseClient,
  campaign: BroadcastCampaign,
  instance: WhatsAppInstance
): Promise<{ processed: boolean; shouldContinue: boolean }> {
  // Get next pending recipient
  const { data: recipient, error: recipientError } = await supabase
    .from('broadcast_recipients')
    .select('*')
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (recipientError || !recipient) {
    // No more pending recipients
    await supabase
      .from('broadcast_campaigns')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      } as any)
      .eq('id', campaign.id);

    console.log(`[process-broadcast] Campaign ${campaign.id} completed`);
    return { processed: false, shouldContinue: false };
  }

  const typedRecipient = recipient as BroadcastRecipient;

  // Route: automation mode vs. direct message
  let result: { success: boolean; error?: string };
  if (campaign.automation_id) {
    console.log(`[process-broadcast] Triggering automation ${campaign.automation_id} for ${typedRecipient.phone}`);
    result = await triggerAutomationForRecipient(supabase, campaign, typedRecipient);
  } else {
    const personalizedMessage = personalizeMessage(campaign.message_content, typedRecipient.name);
    console.log(`[process-broadcast] Sending to ${typedRecipient.phone}`);
    result = await sendWhatsAppMessage(instance, typedRecipient.phone, personalizedMessage, campaign.media_url);
  }

  if (result.success) {
    // Update recipient as sent
    await supabase
      .from('broadcast_recipients')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      } as any)
      .eq('id', typedRecipient.id);

    // In direct message mode, save the message to conversation history
    if (!campaign.automation_id) {
      const personalizedMessage = personalizeMessage(campaign.message_content, typedRecipient.name);
      const contactIdForMsg = typedRecipient.contact_id;
      if (contactIdForMsg) {
        await supabase.from('messages').insert({
          contact_id: contactIdForMsg,
          organization_id: campaign.organization_id,
          content: personalizedMessage,
          direction: 'outbound',
          message_type: campaign.media_url ? 'image' : 'text',
          media_url: campaign.media_url,
          status: 'sent',
        } as any);

        await supabase
          .from('contacts')
          .update({ last_message_at: new Date().toISOString() } as any)
          .eq('id', contactIdForMsg);
      }
    }

    // Update campaign sent count
    await supabase
      .from('broadcast_campaigns')
      .update({
        sent_count: campaign.sent_count + 1,
        current_batch: campaign.current_batch + 1,
      } as any)
      .eq('id', campaign.id);

    console.log(`[process-broadcast] Successfully sent to ${typedRecipient.phone}`);
  } else {
    // Update recipient as failed
    await supabase
      .from('broadcast_recipients')
      .update({
        status: 'failed',
        error_message: result.error,
      } as any)
      .eq('id', typedRecipient.id);

    // Update campaign failed count
    await supabase
      .from('broadcast_campaigns')
      .update({
        failed_count: campaign.failed_count + 1,
      } as any)
      .eq('id', campaign.id);

    console.log(`[process-broadcast] Failed to send to ${typedRecipient.phone}: ${result.error}`);
  }

  return { processed: true, shouldContinue: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { campaignId, action } = await req.json();

    // Auth guard: require service-role key OR valid user JWT
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (token !== supabaseServiceKey) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    console.log(`[process-broadcast] Action: ${action}, Campaign: ${campaignId}`);

    if (action === 'start') {
      // Get campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaign) {
        throw new Error('Campaign not found');
      }

      // Get WhatsApp instance
      const { data: instance, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, api_key, base_url')
        .eq('organization_id', campaign.organization_id)
        .single();

      if (instanceError || !instance) {
        throw new Error('WhatsApp instance not configured');
      }

      // Update campaign status to running
      await supabase
        .from('broadcast_campaigns')
        .update({
          status: 'running',
          started_at: campaign.started_at || new Date().toISOString(),
          current_batch: 0,
        } as any)
        .eq('id', campaignId);

      // Interruptible sleep: polls campaign status every 5s so pause/cancel takes effect quickly
      const interruptibleSleep = async (totalMs: number): Promise<boolean> => {
        const step = 5_000;
        const deadline = Date.now() + totalMs;
        while (Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, Math.min(step, deadline - Date.now())));
          const { data: check } = await supabase
            .from('broadcast_campaigns')
            .select('status')
            .eq('id', campaignId)
            .single();
          if (!check || check.status !== 'running') return false; // interrupted
        }
        return true; // completed normally
      };

      // Returns ms to wait until the hourly slot refills, or 0 if under the limit
      const msUntilHourlySlotFree = async (limit: number): Promise<number> => {
        if (!limit || limit <= 0) return 0;
        const since = new Date(Date.now() - 3_600_000).toISOString();
        const { count } = await supabase
          .from('broadcast_recipients')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campaignId)
          .eq('status', 'sent')
          .gte('sent_at', since);
        if ((count ?? 0) < limit) return 0;
        // Find oldest sent_at in the window to know when the slot refills
        const { data: oldest } = await supabase
          .from('broadcast_recipients')
          .select('sent_at')
          .eq('campaign_id', campaignId)
          .eq('status', 'sent')
          .gte('sent_at', since)
          .order('sent_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!oldest?.sent_at) return 60_000;
        const refillAt = new Date(oldest.sent_at).getTime() + 3_600_000;
        return Math.max(0, refillAt - Date.now());
      };

      // Process messages in background using EdgeRuntime.waitUntil
      const processingPromise = (async () => {
        let continueProcessing = true;
        let messagesInCurrentBatch = 0;

        while (continueProcessing) {
          // Re-fetch campaign to check status (might have been paused/cancelled)
          const { data: currentCampaign } = await supabase
            .from('broadcast_campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

          if (!currentCampaign || currentCampaign.status !== 'running') {
            console.log(`[process-broadcast] Campaign ${campaignId} is no longer running`);
            break;
          }

          const typedCampaign = currentCampaign as BroadcastCampaign;

          // Enforce messages_per_hour_limit
          const waitMs = await msUntilHourlySlotFree(typedCampaign.messages_per_hour_limit);
          if (waitMs > 0) {
            console.log(`[process-broadcast] Hourly limit reached, waiting ${Math.ceil(waitMs / 1000)}s`);
            await supabase
              .from('broadcast_campaigns')
              .update({ paused_until: new Date(Date.now() + waitMs).toISOString() } as any)
              .eq('id', campaignId);
            const resumed = await interruptibleSleep(waitMs);
            if (!resumed) break;
            continue;
          }

          // Check if we need a batch pause
          if (messagesInCurrentBatch >= typedCampaign.batch_size) {
            const pauseDuration = getRandomDelay(
              typedCampaign.batch_pause_min_seconds,
              typedCampaign.batch_pause_max_seconds
            );

            console.log(`[process-broadcast] Batch pause: ${pauseDuration}s`);

            await supabase
              .from('broadcast_campaigns')
              .update({
                paused_until: new Date(Date.now() + pauseDuration * 1000).toISOString(),
                current_batch: 0,
              } as any)
              .eq('id', campaignId);

            const resumed = await interruptibleSleep(pauseDuration * 1000);
            if (!resumed) break;
            messagesInCurrentBatch = 0;
          }

          // Process one recipient
          const result = await processNextRecipient(
            supabase,
            typedCampaign,
            instance as WhatsAppInstance
          );

          if (!result.shouldContinue) {
            continueProcessing = false;
            break;
          }

          if (result.processed) {
            messagesInCurrentBatch++;

            // Calculate next send time with random delay
            const delay = getRandomDelay(
              typedCampaign.min_interval_seconds,
              typedCampaign.max_interval_seconds
            );

            console.log(`[process-broadcast] Waiting ${delay}s before next message`);

            await supabase
              .from('broadcast_campaigns')
              .update({
                next_send_at: new Date(Date.now() + delay * 1000).toISOString(),
              } as any)
              .eq('id', campaignId);

            const resumed = await interruptibleSleep(delay * 1000);
            if (!resumed) break;
          }
        }

        console.log(`[process-broadcast] Finished processing campaign ${campaignId}`);
      })();

      // Use EdgeRuntime.waitUntil — required in production; fall back to awaiting if unavailable
      if ((globalThis as any).EdgeRuntime?.waitUntil) {
        (globalThis as any).EdgeRuntime.waitUntil(processingPromise);
      } else {
        await processingPromise;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Broadcast started' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[process-broadcast] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
