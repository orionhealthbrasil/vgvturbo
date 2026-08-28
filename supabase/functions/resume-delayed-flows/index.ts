import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum contacts to process per execution to avoid timeouts
const BATCH_LIMIT = 100;
// Maximum recursive calls to prevent infinite loops
const MAX_RECURSION_DEPTH = 10;

interface FlowNode {
  id: string;
  type: string;
  data?: Record<string, any>;
  position?: { x: number; y: number };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  active_flow_id: string | null;
  current_node_id: string | null;
  flow_context: Record<string, any>;
  organization_id: string;
  waiting_response_timeout: string | null;
}

function findNextNodes(edges: FlowEdge[], currentNodeId: string, sourceHandle?: string): string[] {
  return edges
    .filter(edge => edge.source === currentNodeId && (!sourceHandle || edge.sourceHandle === sourceHandle))
    .map(edge => edge.target);
}

function findNode(nodes: FlowNode[], nodeId: string): FlowNode | undefined {
  return nodes.find(n => n.id === nodeId);
}

// Replace variables in message with contact data
function replaceVariables(message: string, contact: Contact, context: Record<string, any> = {}): string {
  const now = new Date();
  const hour = now.getHours();
  
  let greeting = 'Olá';
  if (hour >= 5 && hour < 12) greeting = 'Bom dia';
  else if (hour >= 12 && hour < 18) greeting = 'Boa tarde';
  else greeting = 'Boa noite';

  const firstName = contact.name?.split(' ')[0] || '';
  
  const weekDays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  
  const variables: Record<string, string> = {
    '{nome}': contact.name || '',
    '{primeiro_nome}': firstName,
    '{telefone}': contact.phone || '',
    '{email}': contact.email || '',
    '{saudacao}': greeting,
    '{data_atual}': now.toLocaleDateString('pt-BR'),
    '{hora_atual}': now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    '{dia_semana}': weekDays[now.getDay()],
    ...Object.entries(context).reduce((acc, [key, value]) => {
      acc[`{${key}}`] = String(value);
      return acc;
    }, {} as Record<string, string>),
  };

  let result = message;
  for (const [variable, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  
  return result;
}

// Format phone number for Stevo API
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

// Send message via Stevo API
async function sendWhatsAppMessage(
  supabase: any,
  organizationId: string,
  contactId: string,
  phone: string,
  message: string
): Promise<boolean> {
  try {
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, api_key, base_url')
      .eq('organization_id', organizationId)
      .single();

    if (!instance) {
      console.error('[ResumeDelayedFlows] WhatsApp instance not found for organization:', organizationId);
      return false;
    }

    if (!instance.base_url) {
      console.error(`[ResumeDelayedFlows] No base_url configured for org ${organizationId}`);
      return false;
    }

    const formattedPhone = formatPhoneNumber(phone);
    const sendUrl = `${instance.base_url}/send/text`;

    console.log(`[ResumeDelayedFlows] Sending message to ${formattedPhone}`);

    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'apikey': instance.api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ResumeDelayedFlows] Failed to send message: ${response.status} - ${errorText}`);
      return false;
    }

    // Save message with sent_by_user_id = null (indicates system/automation message)
    await supabase
      .from('messages')
      .insert({
        contact_id: contactId,
        organization_id: organizationId,
        content: message,
        message_type: 'text',
        direction: 'outbound',
        status: 'sent',
        sent_by_user_id: null, // Explicitly null = automation/system message
      });

    await supabase
      .from('contacts')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', contactId);

    console.log(`[ResumeDelayedFlows] Message sent successfully`);
    return true;
  } catch (error) {
    console.error('[ResumeDelayedFlows] Error sending message:', error);
    return false;
  }
}

// Add or remove tag from contact
async function manageTag(
  supabase: any,
  organizationId: string,
  contactId: string,
  tagName: string,
  action: 'add' | 'remove'
): Promise<boolean> {
  try {
    const { data: tag } = await supabase
      .from('tags')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('name', tagName)
      .single();

    if (!tag) {
      console.log(`[ResumeDelayedFlows] Tag "${tagName}" not found, creating it`);
      const { data: newTag, error: createError } = await supabase
        .from('tags')
        .insert({ organization_id: organizationId, name: tagName })
        .select('id')
        .single();

      if (createError || !newTag) {
        console.error('[ResumeDelayedFlows] Failed to create tag:', createError);
        return false;
      }

      if (action === 'add') {
        await supabase.from('contact_tags').insert({ contact_id: contactId, tag_id: newTag.id });
      }
      return true;
    }

    if (action === 'add') {
      const { data: existing } = await supabase
        .from('contact_tags')
        .select('id')
        .eq('contact_id', contactId)
        .eq('tag_id', tag.id)
        .single();

      if (!existing) {
        await supabase.from('contact_tags').insert({ contact_id: contactId, tag_id: tag.id });
        console.log(`[ResumeDelayedFlows] Added tag "${tagName}" to contact`);
      }
    } else {
      await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', tag.id);
      console.log(`[ResumeDelayedFlows] Removed tag "${tagName}" from contact`);
    }

    return true;
  } catch (error) {
    console.error('[ResumeDelayedFlows] Error managing tag:', error);
    return false;
  }
}

// Move contact to a kanban column
async function moveToColumn(
  supabase: any,
  organizationId: string,
  contactId: string,
  columnName: string
): Promise<boolean> {
  try {
    // Get contact's pipeline to filter columns
    const { data: contact } = await supabase
      .from('contacts')
      .select('pipeline_id')
      .eq('id', contactId)
      .single();

    let columnQuery = supabase
      .from('kanban_columns')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('name', columnName);

    if (contact?.pipeline_id) {
      columnQuery = columnQuery.eq('pipeline_id', contact.pipeline_id);
    }

    const { data: column } = await columnQuery.single();

    if (!column) {
      console.log(`[ResumeDelayedFlows] Column "${columnName}" not found`);
      return false;
    }

    await supabase
      .from('contacts')
      .update({ kanban_column_id: column.id })
      .eq('id', contactId);

    console.log(`[ResumeDelayedFlows] Moved contact to column "${columnName}"`);
    return true;
  } catch (error) {
    console.error('[ResumeDelayedFlows] Error moving to column:', error);
    return false;
  }
}

// Execute a single node (simplified version for timeout path)
async function executeNode(
  supabase: any,
  node: FlowNode,
  contact: Contact,
  flowData: FlowData
): Promise<{ continue: boolean; nextHandle?: string; waitForResponse?: boolean; responseTimeout?: Date }> {
  console.log(`[ResumeDelayedFlows] Executing node: ${node.type} (${node.id})`);

  switch (node.type) {
    case 'trigger':
      return { continue: true };

    case 'sendMessage': {
      const message = node.data?.message || '';
      const processedMessage = replaceVariables(message, contact, contact.flow_context || {});
      
      if (processedMessage) {
        await sendWhatsAppMessage(
          supabase,
          contact.organization_id,
          contact.id,
          contact.phone,
          processedMessage
        );
      }
      return { continue: true };
    }

    case 'delay': {
      const duration = node.data?.duration || 0;
      const unit = node.data?.unit || 'seconds';
      
      let milliseconds = duration * 1000;
      switch (unit) {
        case 'seconds': milliseconds = duration * 1000; break;
        case 'minutes': milliseconds = duration * 60 * 1000; break;
        case 'hours': milliseconds = duration * 60 * 60 * 1000; break;
        case 'days': milliseconds = duration * 24 * 60 * 60 * 1000; break;
      }

      // SAFETY CAP: Max 30 seconds for batch processing
      const MAX_DELAY_MS = 30 * 1000;
      if (milliseconds > MAX_DELAY_MS) {
        console.log(`[ResumeDelayedFlows] Delay ${milliseconds}ms exceeds max, capping to ${MAX_DELAY_MS}ms`);
        milliseconds = MAX_DELAY_MS;
      }

      if (milliseconds > 0) {
        console.log(`[ResumeDelayedFlows] Synchronous delay: waiting ${milliseconds}ms`);
        await new Promise(resolve => setTimeout(resolve, milliseconds));
      }
      
      return { continue: true };
    }

    case 'condition': {
      // For timeout path, we don't have message content, use 'no' path by default
      return { continue: true, nextHandle: 'no' };
    }

    case 'manageTag': {
      const tagName = node.data?.tagName || '';
      const action = node.data?.action || 'add';
      if (tagName) {
        await manageTag(supabase, contact.organization_id, contact.id, tagName, action);
      }
      return { continue: true };
    }

    case 'moveColumn': {
      const columnName = node.data?.columnName || '';
      if (columnName) {
        await moveToColumn(supabase, contact.organization_id, contact.id, columnName);
      }
      return { continue: true };
    }

    case 'waitResponse': {
      const timeout = node.data?.timeout || 5;
      const timeoutUnit = node.data?.timeoutUnit || 'minutes';
      
      let milliseconds = timeout * 60 * 1000;
      switch (timeoutUnit) {
        case 'minutes': milliseconds = timeout * 60 * 1000; break;
        case 'hours': milliseconds = timeout * 60 * 60 * 1000; break;
        case 'days': milliseconds = timeout * 24 * 60 * 60 * 1000; break;
      }
      
      const timeoutAt = new Date(Date.now() + milliseconds);
      return { 
        continue: false, 
        waitForResponse: true,
        responseTimeout: timeoutAt
      };
    }

    default:
      console.log(`[ResumeDelayedFlows] Skipping unsupported node type: ${node.type}`);
      return { continue: true };
  }
}

// Process timeout path for a single contact
async function processTimeoutPath(
  supabase: any,
  contact: Contact,
  flowData: FlowData,
  startNodeId: string
): Promise<void> {
  let currentNodeId: string | null = startNodeId;
  let iterations = 0;
  const maxIterations = 50; // Limit for batch processing

  while (currentNodeId && iterations < maxIterations) {
    iterations++;

    const node = findNode(flowData.nodes, currentNodeId);
    if (!node) {
      console.log(`[ResumeDelayedFlows] Node not found: ${currentNodeId}`);
      break;
    }

    const result = await executeNode(supabase, node, contact, flowData);

    // Handle wait for response
    if (result.waitForResponse && result.responseTimeout) {
      await supabase
        .from('contacts')
        .update({
          current_node_id: currentNodeId,
          waiting_response: true,
          waiting_response_timeout: result.responseTimeout.toISOString(),
        })
        .eq('id', contact.id);

      console.log(`[ResumeDelayedFlows] Contact ${contact.id} waiting for response, timeout at ${result.responseTimeout.toISOString()}`);
      return;
    }

    if (!result.continue) {
      break;
    }

    // Find next node
    const nextNodes = findNextNodes(flowData.edges, currentNodeId, result.nextHandle);
    currentNodeId = nextNodes[0] || null;

    // Update current position
    if (currentNodeId) {
      await supabase
        .from('contacts')
        .update({ current_node_id: currentNodeId })
        .eq('id', contact.id);
    }
  }

  // Flow completed - clear state
  console.log(`[ResumeDelayedFlows] Flow completed for contact ${contact.id}`);
  await supabase
    .from('contacts')
    .update({
      active_flow_id: null,
      current_node_id: null,
      flow_context: {},
      waiting_response: false,
      waiting_response_timeout: null,
    })
    .eq('id', contact.id);
}

// Main handler - processes expired timeouts in batch
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for recursion tracking
    let currentDepth = 0;
    try {
      const body = await req.json();
      currentDepth = body?.depth || 0;
    } catch {
      // No body or invalid JSON, start at depth 0
    }

    console.log(`[ResumeDelayedFlows] Starting batch processing (limit: ${BATCH_LIMIT}, depth: ${currentDepth}/${MAX_RECURSION_DEPTH})...`);

    const now = new Date().toISOString();
    const { data: expiredContacts, error } = await supabase
      .from('contacts')
      .select('id, name, phone, email, organization_id, active_flow_id, current_node_id, flow_context, waiting_response_timeout')
      .eq('waiting_response', true)
      .not('waiting_response_timeout', 'is', null)
      .lt('waiting_response_timeout', now)
      .limit(BATCH_LIMIT);

    if (error) {
      console.error('[ResumeDelayedFlows] Error fetching contacts:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ResumeDelayedFlows] Found ${expiredContacts?.length || 0} contacts with expired timeouts`);

    let processed = 0;
    let errors = 0;

    // Cache automations to avoid repeated queries
    const automationCache: Record<string, FlowData> = {};

    for (const contact of expiredContacts || []) {
      try {
        console.log(`[ResumeDelayedFlows] Processing contact: ${contact.name} (${contact.id})`);

        if (!contact.active_flow_id || !contact.current_node_id) {
          console.log(`[ResumeDelayedFlows] Contact ${contact.id} has no active flow, clearing state`);
          await supabase
            .from('contacts')
            .update({
              waiting_response: false,
              waiting_response_timeout: null,
            })
            .eq('id', contact.id);
          continue;
        }

        // Get automation from cache or fetch
        let flowData = automationCache[contact.active_flow_id];
        if (!flowData) {
          const { data: automation, error: automationError } = await supabase
            .from('automations')
            .select('flow_data')
            .eq('id', contact.active_flow_id)
            .single();

          if (automationError || !automation?.flow_data) {
            console.error(`[ResumeDelayedFlows] Automation not found for contact ${contact.id}:`, automationError);
            errors++;
            continue;
          }

          flowData = automation.flow_data as FlowData;
          automationCache[contact.active_flow_id] = flowData;
        }

        const waitNode = findNode(flowData.nodes, contact.current_node_id);

        if (!waitNode || (waitNode.type !== 'waitResponse' && waitNode.type !== 'saveResponse')) {
          console.log(`[ResumeDelayedFlows] Contact ${contact.id} not at a wait/save response node (type=${waitNode?.type}), clearing flow state`);
          await supabase
            .from('contacts')
            .update({
              active_flow_id: null,
              current_node_id: null,
              flow_context: {},
              waiting_response: false,
              waiting_response_timeout: null,
            })
            .eq('id', contact.id);
          continue;
        }

        // Find the timeout branch
        const timeoutNodes = findNextNodes(flowData.edges, contact.current_node_id, 'timeout');

        if (timeoutNodes.length === 0) {
          console.log(`[ResumeDelayedFlows] No timeout branch for contact ${contact.id}, ending flow`);
          await supabase
            .from('contacts')
            .update({
              active_flow_id: null,
              current_node_id: null,
              flow_context: {},
              waiting_response: false,
              waiting_response_timeout: null,
            })
            .eq('id', contact.id);
          continue;
        }

        // Clear waiting state before processing
        await supabase
          .from('contacts')
          .update({
            waiting_response: false,
            waiting_response_timeout: null,
          })
          .eq('id', contact.id);

        // Process timeout path inline
        await processTimeoutPath(
          supabase,
          contact as Contact,
          flowData,
          timeoutNodes[0]
        );

        processed++;
        console.log(`[ResumeDelayedFlows] Successfully processed timeout for contact ${contact.id}`);
      } catch (contactError) {
        console.error(`[ResumeDelayedFlows] Error processing contact ${contact.id}:`, contactError);
        errors++;
      }
    }

    const hasMorePending = (expiredContacts?.length || 0) === BATCH_LIMIT;
    console.log(`[ResumeDelayedFlows] waitResponse batch completed. Processed: ${processed}, Errors: ${errors}, More pending: ${hasMorePending}`);

    // --- Resume contacts paused by delay node (resume_at mechanism) ---
    const { data: delayedContacts, error: delayError } = await supabase
      .from('contacts')
      .select('id, organization_id, active_flow_id')
      .not('resume_at', 'is', null)
      .lt('resume_at', now)
      .not('active_flow_id', 'is', null)
      .limit(BATCH_LIMIT);

    if (delayError) {
      console.error('[ResumeDelayedFlows] Error fetching delayed contacts:', delayError);
    } else {
      console.log(`[ResumeDelayedFlows] Found ${delayedContacts?.length || 0} contacts with expired resume_at`);

      for (const dc of delayedContacts || []) {
        try {
          // Clear resume_at first to prevent double-processing
          await supabase
            .from('contacts')
            .update({ resume_at: null })
            .eq('id', dc.id);

          // Trigger automation-engine to continue the flow from where it paused
          const automationUrl = `${supabaseUrl}/functions/v1/automation-engine`;
          await fetch(automationUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'x-internal-service-key': supabaseServiceKey,
            },
            body: JSON.stringify({
              contact_id: dc.id,
              organization_id: dc.organization_id,
              event_type: 'resume_delay',
            }),
          });

          console.log(`[ResumeDelayedFlows] Resumed delay flow for contact ${dc.id}`);
          processed++;
        } catch (dcErr) {
          console.error(`[ResumeDelayedFlows] Error resuming delay for contact ${dc.id}:`, dcErr);
          errors++;
        }
      }
    }

    // Recursive self-invocation if there are more contacts to process
    if (hasMorePending && currentDepth < MAX_RECURSION_DEPTH) {
      console.log(`[ResumeDelayedFlows] More contacts pending, triggering next batch (depth ${currentDepth + 1})...`);
      
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      
      // Fire-and-forget: don't await, let the current request complete
      fetch(`${supabaseUrl}/functions/v1/resume-delayed-flows`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ depth: currentDepth + 1 }),
      }).catch(err => {
        console.error('[ResumeDelayedFlows] Failed to trigger next batch:', err);
      });
    } else if (hasMorePending) {
      console.log(`[ResumeDelayedFlows] Max recursion depth reached (${MAX_RECURSION_DEPTH}), stopping. Remaining contacts will be processed in next cron run.`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Batch timeout check completed',
        expiredCount: expiredContacts?.length || 0,
        processed,
        errors,
        hasMorePending,
        batchLimit: BATCH_LIMIT,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ResumeDelayedFlows] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
