import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SnoozedContact {
  id: string;
  name: string;
  phone: string;
  organization_id: string;
  assigned_to: string | null;
}

interface OrganizationSettings {
  snooze_reactivation_message: string | null;
}

interface WhatsAppInstance {
  instance_name: string;
  api_key: string;
  base_url: string;
}

// Generate random delay between min and max milliseconds
function getRandomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
}

// Sleep function for human-like delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Send reactivation message to customer via WhatsApp
async function sendReactivationMessage(
  supabase: any,
  organizationId: string,
  contactId: string,
  phone: string,
  message: string
): Promise<boolean> {
  try {
    // Get WhatsApp instance for this organization
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, api_key, base_url')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (instanceError || !instance) {
      console.log(`[WakeUpSnoozed] No WhatsApp instance found for org ${organizationId}`);
      return false;
    }

    if (!instance.base_url) {
      console.error(`[WakeUpSnoozed] No base_url configured for org ${organizationId}`);
      return false;
    }

    // Format phone number
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55') && formattedPhone.length <= 11) {
      formattedPhone = '55' + formattedPhone;
    }

    // Send message via Stevo API
    const response = await fetch(`${instance.base_url}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': instance.api_key,
      },
      body: JSON.stringify({
        instanceName: instance.instance_name,
        number: formattedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[WakeUpSnoozed] Failed to send reactivation message:`, errorText);
      return false;
    }

    const result = await response.json();
    const whatsappMessageId = result?.key?.id || null;

    // Save message to database
    const { error: insertError } = await supabase
      .from('messages')
      .insert({
        contact_id: contactId,
        organization_id: organizationId,
        content: message,
        direction: 'outbound',
        message_type: 'text',
        status: 'sent',
        whatsapp_message_id: whatsappMessageId,
        sent_by_user_id: null, // System message
      });

    if (insertError) {
      console.error('[WakeUpSnoozed] Error saving message to DB:', insertError);
      // Don't return false - the message was sent, just not saved
    }

    console.log(`[WakeUpSnoozed] 📤 Sent reactivation message to ${phone}`);
    return true;
  } catch (error) {
    console.error('[WakeUpSnoozed] Error sending reactivation message:', error);
    return false;
  }
}

// Send notification to seller via WhatsApp
async function sendSellerNotification(
  supabase: any,
  organizationId: string,
  sellerUserId: string,
  contactName: string
): Promise<void> {
  try {
    // Get seller's profile to find their phone (if linked to a salesperson)
    const { data: salesperson } = await supabase
      .from('salespeople')
      .select('name')
      .eq('user_id', sellerUserId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!salesperson) {
      console.log(`[WakeUpSnoozed] No salesperson found for user ${sellerUserId}`);
      return;
    }

    // For now, just log the notification - in production you might send via WhatsApp or push
    console.log(`[WakeUpSnoozed] 🔔 Notification: Cliente ${contactName} voltou para a fila (Loja Aberta) - Vendedor: ${salesperson.name}`);
  } catch (error) {
    console.error('[WakeUpSnoozed] Error sending notification:', error);
  }
}

// Process a single contact wake-up
async function wakeUpContact(
  supabase: any,
  contact: SnoozedContact,
  reactivationMessage: string | null
): Promise<boolean> {
  try {
    // Update contact: status = 'open', clear snoozed_until
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        status: 'open',
        snoozed_until: null,
        last_message_at: new Date().toISOString(), // Bump to top of list
      })
      .eq('id', contact.id);

    if (updateError) {
      console.error(`[WakeUpSnoozed] Error updating contact ${contact.id}:`, updateError);
      return false;
    }

    console.log(`[WakeUpSnoozed] ✅ Woke up contact: ${contact.name} (${contact.phone})`);

    // Send reactivation message if configured
    if (reactivationMessage) {
      await sendReactivationMessage(
        supabase,
        contact.organization_id,
        contact.id,
        contact.phone,
        reactivationMessage
      );
    }

    // Send notification to assigned seller if exists
    if (contact.assigned_to) {
      await sendSellerNotification(
        supabase,
        contact.organization_id,
        contact.assigned_to,
        contact.name
      );
    }

    return true;
  } catch (err) {
    console.error(`[WakeUpSnoozed] Error processing contact ${contact.id}:`, err);
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[WakeUpSnoozed] Starting wake-up check with human-like delays...');

    // Find contacts that need to be woken up
    // SECURITY: Limit to 5 contacts per batch for natural behavior
    // With cron running every 2 min + random delays, this simulates organic activity
    const { data: snoozedContacts, error: fetchError } = await supabase
      .from('contacts')
      .select('id, name, phone, organization_id, assigned_to')
      .eq('status', 'snoozed')
      .lte('snoozed_until', new Date().toISOString())
      .order('snoozed_until', { ascending: true }) // Prioritize oldest scheduled
      .limit(5); // SAFETY LOCK: Max 5 contacts per batch

    if (fetchError) {
      console.error('[WakeUpSnoozed] Error fetching snoozed contacts:', fetchError);
      throw fetchError;
    }

    if (!snoozedContacts || snoozedContacts.length === 0) {
      console.log('[WakeUpSnoozed] No contacts to wake up');
      return new Response(
        JSON.stringify({ success: true, woken_up: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[WakeUpSnoozed] Found ${snoozedContacts.length} contacts to wake up`);

    // Group contacts by organization to fetch settings once per org
    const orgIds = [...new Set((snoozedContacts as SnoozedContact[]).map(c => c.organization_id))];
    
    // Fetch organization settings (reactivation messages)
    const { data: orgsData } = await supabase
      .from('organizations')
      .select('id, snooze_reactivation_message')
      .in('id', orgIds);

    const orgSettings: Record<string, string | null> = {};
    if (orgsData) {
      for (const org of orgsData as Array<{ id: string; snooze_reactivation_message: string | null }>) {
        orgSettings[org.id] = org.snooze_reactivation_message;
      }
    }

    let wokenUp = 0;
    const errors: string[] = [];
    const delays: number[] = [];

    // Process each contact with random human-like delays
    for (const contact of snoozedContacts as SnoozedContact[]) {
      // MICRO-DELAY: Random sleep between 5-25 seconds before each contact
      // This simulates natural human interaction timing
      const delay = getRandomDelay(5000, 25000);
      delays.push(delay);
      
      console.log(`[WakeUpSnoozed] ⏳ Waiting ${(delay / 1000).toFixed(1)}s before processing ${contact.name}...`);
      await sleep(delay);

      // Get reactivation message for this contact's organization
      const reactivationMessage = orgSettings[contact.organization_id] || null;

      // Now process the contact
      const success = await wakeUpContact(supabase, contact, reactivationMessage);
      
      if (success) {
        wokenUp++;
      } else {
        errors.push(`Failed to wake up ${contact.name}`);
      }
    }

    const totalDelaySeconds = delays.reduce((a, b) => a + b, 0) / 1000;
    console.log(`[WakeUpSnoozed] Completed. Woken up: ${wokenUp}/${snoozedContacts.length}. Total delay: ${totalDelaySeconds.toFixed(1)}s`);

    return new Response(
      JSON.stringify({
        success: true,
        woken_up: wokenUp,
        total_found: snoozedContacts.length,
        total_delay_seconds: totalDelaySeconds,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[WakeUpSnoozed] Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
