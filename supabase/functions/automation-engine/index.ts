import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeOpenAiKey(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function resolveOpenAiKey(supabase: any, organizationId: string) {
  const [orgRes, legacyRes] = await Promise.all([
    supabase
      .from('organizations')
      .select('openai_api_key')
      .eq('id', organizationId)
      .single(),
    supabase
      .from('ai_agent_config')
      .select('openai_api_key')
      .eq('organization_id', organizationId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (orgRes.error) throw orgRes.error;
  if (legacyRes.error) throw legacyRes.error;

  const orgKey = normalizeOpenAiKey(orgRes.data?.openai_api_key);
  if (orgKey) return { openaiApiKey: orgKey, keySource: 'organizations' as const };

  const legacyKey = normalizeOpenAiKey(legacyRes.data?.openai_api_key);
  if (legacyKey) return { openaiApiKey: legacyKey, keySource: 'ai_agent_config' as const };

  return { openaiApiKey: null, keySource: null };
}

interface AutomationEnginePayload {
  contact_id: string;
  organization_id: string;
  message_content?: string;
  message_type?: string; // e.g. 'text', 'image', 'video', 'audio', 'document', 'sticker'
  event_type:
    | 'message_received'
    | 'tag_added'
    | 'resume_delay'
    | 'user_response'
    | 'manual_trigger'
    | 'funnel_stage_change'
    | 'funnel_stage_exit'
    | 'deal_won'
    | 'deal_lost'
    | 'conversation_closed'
    | 'form_submitted'
    | 'booking_created'
    | 'booking_cancelled'
    | 'external_purchase';
  tag_name?: string;
  resume_from_node_id?: string;
  automation_id?: string;
  funnel_stage_name?: string;
  pipeline_id?: string;
  form_id?: string;
  booking_id?: string;
  calendar_id?: string;
  payment_integration_id?: string;
  purchase_event?: string;
  initial_context?: Record<string, string>;
}

interface FlowNode {
  id: string;
  type: string;
  data: Record<string, any>;
  position: { x: number; y: number };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
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
  assigned_to?: string | null;
  active_flow_id: string | null;
  current_node_id: string | null;
  flow_context: Record<string, any>;
  resume_at: string | null;
  waiting_response: boolean;
  waiting_response_timeout: string | null;
  organization_id: string;
}

// Replace variables in message with contact data
async function replaceVariables(
  message: string, 
  contact: Contact, 
  context: Record<string, any> = {},
  supabase: any
): Promise<string> {
  const now = new Date();
  // Use UTC-3 as default Brazil timezone
  const brazilOffset = -3 * 60;
  const localOffset = now.getTimezoneOffset();
  const brazilTime = new Date(now.getTime() + (localOffset + brazilOffset) * 60000);
  const hour = brazilTime.getHours();
  
  let greeting = 'Olá';
  if (hour >= 5 && hour < 12) greeting = 'Bom dia';
  else if (hour >= 12 && hour < 18) greeting = 'Boa tarde';
  else greeting = 'Boa noite';

  const firstName = contact.name?.split(' ')[0] || '';
  
  const weekDays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  
  // Fetch next holiday for variables
  let nextHolidayName = '';
  let nextHolidayDate = '';
  let nextReturnDate = '';
  
  try {
    const today = brazilTime.toISOString().split('T')[0];
    const { data: nextHoliday } = await supabase
      .from('organization_holidays')
      .select('name, holiday_date, return_date')
      .eq('organization_id', contact.organization_id)
      .gte('holiday_date', today)
      .order('holiday_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    
    if (nextHoliday) {
      nextHolidayName = nextHoliday.name || '';
      nextHolidayDate = nextHoliday.holiday_date 
        ? new Date(nextHoliday.holiday_date + 'T12:00:00').toLocaleDateString('pt-BR')
        : '';
      nextReturnDate = nextHoliday.return_date 
        ? new Date(nextHoliday.return_date + 'T12:00:00').toLocaleDateString('pt-BR')
        : '';
    }
  } catch (e) {
    console.log('[AutomationEngine] Error fetching holiday for variables:', e);
  }
  
  const variables: Record<string, string> = {
    '{nome}': contact.name || '',
    '{primeiro_nome}': firstName,
    '{telefone}': contact.phone || '',
    '{email}': contact.email || '',
    '{saudacao}': greeting,
    '{data_atual}': brazilTime.toLocaleDateString('pt-BR'),
    '{hora_atual}': brazilTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    '{dia_semana}': weekDays[brazilTime.getDay()],
    '{ultima_resposta}': context.last_response || '',
    '{proximo_feriado}': nextHolidayName,
    '{data_feriado}': nextHolidayDate,
    '{data_retorno}': nextReturnDate,
    ...Object.entries(context).reduce((acc, [key, value]) => {
      acc[`{${key}}`] = String(value);
      return acc;
    }, {} as Record<string, string>),
  };

  // Inject custom fields as variables: field name slugified -> value
  // E.g. "Cidade" -> {cidade}, "CEP do cliente" -> {cep_do_cliente}
  try {
    const { data: customFields } = await supabase
      .from('contact_custom_fields')
      .select('field_name, field_value')
      .eq('contact_id', contact.id);

    if (Array.isArray(customFields)) {
      for (const cf of customFields) {
        if (!cf?.field_name) continue;
        const slug = String(cf.field_name)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        if (!slug) continue;
        const key = `{${slug}}`;
        // Don't override system variables
        if (variables[key] === undefined) {
          variables[key] = cf.field_value == null ? '' : String(cf.field_value);
        }
      }
    }
  } catch (e) {
    console.log('[AutomationEngine] Error fetching custom fields for variables:', e);
  }

  let result = message;
  for (const [variable, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  
  return result;
}

// Find the next node(s) connected to a given node
function findNextNodes(edges: FlowEdge[], currentNodeId: string, sourceHandle?: string): string[] {
  return edges
    .filter(edge => {
      if (edge.source !== currentNodeId) return false;
      // Prevent self-loops (edge pointing to itself)
      if (edge.target === currentNodeId) {
        console.warn(`[AutomationEngine] Self-loop detected on node ${currentNodeId}, skipping`);
        return false;
      }
      if (sourceHandle && edge.sourceHandle && edge.sourceHandle !== sourceHandle) return false;
      return true;
    })
    .map(edge => edge.target);
}

// Find node by ID
function findNode(nodes: FlowNode[], nodeId: string): FlowNode | undefined {
  return nodes.find(n => n.id === nodeId);
}

// Check if trigger matches
function checkTriggerMatch(triggerNode: FlowNode, eventType: string, messageContent?: string, tagName?: string, funnelStageName?: string, messageType?: string, formId?: string, calendarId?: string, pipelineId?: string, contact?: any, paymentIntegrationId?: string, purchaseEvent?: string): boolean {
  const triggerType = triggerNode.data?.triggerType;
  
  if (eventType === 'message_received') {
    if (triggerType === 'message_received') return true;
    if (triggerType === 'keyword' && messageContent) {
      const keyword = triggerNode.data?.keyword || '';
      const matchType = triggerNode.data?.keywordMatchType || 'contains';
      
      if (!keyword) return false;
      
      const contentLower = messageContent.toLowerCase().trim();
      
      // Split keywords by comma and trim each one (supports multiple keywords)
      const keywords = keyword.split(',').map((k: string) => k.toLowerCase().trim()).filter((k: string) => k.length > 0);
      
      if (keywords.length === 0) return false;
      
      console.log(`[AutomationEngine] Checking ${keywords.length} keyword(s): ${keywords.join(', ')}`);
      
      // Check if ANY of the keywords match
      for (const kw of keywords) {
        let matched = false;
        
        switch (matchType) {
          case 'exact':
            matched = contentLower === kw;
            break;
          case 'starts_with':
            matched = contentLower.startsWith(kw);
            break;
          case 'ends_with':
            matched = contentLower.endsWith(kw);
            break;
          case 'regex':
            try {
              const regex = new RegExp(kw, 'i');
              matched = regex.test(messageContent);
            } catch {
              console.log(`[AutomationEngine] Invalid regex pattern: ${kw}`);
              matched = false;
            }
            break;
          case 'contains':
          default:
            matched = contentLower.includes(kw);
            break;
        }
        
        if (matched) {
          console.log(`[AutomationEngine] Keyword matched: "${kw}"`);
          return true;
        }
      }
      
      console.log(`[AutomationEngine] No keyword matched`);
      return false;
    }
  }
  
  if (eventType === 'tag_added' && triggerType === 'tag_added') {
    const triggerTagName = triggerNode.data?.tagName?.toLowerCase() || '';
    return tagName?.toLowerCase() === triggerTagName;
  }
  
  if (eventType === 'funnel_stage_change' && triggerType === 'funnel_stage_change') {
    const triggerFunnelStageName = triggerNode.data?.funnelStageName?.toLowerCase() || '';
    const triggerPipelineId = triggerNode.data?.pipelineId || '';
    const stageMatched = funnelStageName?.toLowerCase() === triggerFunnelStageName;
    const pipelineMatched = !triggerPipelineId || !pipelineId || triggerPipelineId === pipelineId;
    const matched = stageMatched && pipelineMatched;
    console.log(`[AutomationEngine] Funnel stage trigger check: stage="${funnelStageName}"==="${triggerFunnelStageName}" (${stageMatched}), pipeline="${pipelineId}"==="${triggerPipelineId}" (${pipelineMatched}) = ${matched}`);
    return matched;
  }

  if (eventType === 'funnel_stage_exit' && triggerType === 'funnel_stage_exit') {
    const triggerExitName = triggerNode.data?.funnelStageExitName?.toLowerCase() || '';
    const triggerPipelineId = triggerNode.data?.pipelineId || '';
    const stageMatched = funnelStageName?.toLowerCase() === triggerExitName;
    const pipelineMatched = !triggerPipelineId || !pipelineId || triggerPipelineId === pipelineId;
    const matched = stageMatched && pipelineMatched;
    console.log(`[AutomationEngine] Funnel stage EXIT trigger check: stage="${funnelStageName}"==="${triggerExitName}" (${stageMatched}), pipeline="${pipelineId}"==="${triggerPipelineId}" (${pipelineMatched}) = ${matched}`);
    return matched;
  }

  if ((eventType === 'deal_won' && triggerType === 'deal_won') ||
      (eventType === 'deal_lost' && triggerType === 'deal_lost')) {
    const reasonFilter = (triggerNode.data?.reasonFilter || '').toString().trim().toLowerCase();
    if (!reasonFilter) {
      return true;
    }
    const contactReason = eventType === 'deal_won'
      ? (contact?.win_reason || '').toString().trim().toLowerCase()
      : (contact?.loss_reason || '').toString().trim().toLowerCase();
    const matched = !!contactReason && contactReason === reasonFilter;
    console.log(`[AutomationEngine] Deal result trigger check: event=${eventType}, contactReason="${contactReason}", filter="${reasonFilter}", matched=${matched}`);
    return matched;
  }

  // Media received trigger
  if (eventType === 'message_received' && triggerType === 'media_received') {
    const triggerMediaType = triggerNode.data?.mediaType || 'any_media';
    const incomingType = messageType || 'text';
    const mediaTypes: Record<string, string[]> = {
      'image': ['image'],
      'video': ['video'],
      'audio': ['audio', 'ptt'],
      'any_media': ['image', 'video', 'audio', 'ptt', 'document', 'sticker'],
    };
    const allowedTypes = mediaTypes[triggerMediaType] || [];
    const matched = allowedTypes.includes(incomingType);
    console.log(`[AutomationEngine] Media trigger check: type="${incomingType}", expected="${triggerMediaType}", matched=${matched}`);
    return matched;
  }

  if (eventType === 'conversation_closed' && triggerType === 'conversation_closed') {
    return true;
  }

  if (eventType === 'form_submitted' && triggerType === 'form_submitted') {
    const triggerFormId = triggerNode.data?.formId || '';
    // If trigger has no specific formId, match any submission
    if (!triggerFormId) return true;
    return triggerFormId === formId;
  }

  if (eventType === 'booking_created' && triggerType === 'booking_created') {
    const triggerCalId = triggerNode.data?.calendarId || '';
    if (!triggerCalId) return true;
    return triggerCalId === calendarId;
  }

  if (eventType === 'booking_cancelled' && triggerType === 'booking_cancelled') {
    const triggerCalId = triggerNode.data?.calendarId || '';
    if (!triggerCalId) return true;
    return triggerCalId === calendarId;
  }

  if (eventType === 'external_purchase' && triggerType === 'external_purchase') {
    const wantedIntegration = triggerNode.data?.paymentIntegrationId || '';
    if (wantedIntegration && wantedIntegration !== paymentIntegrationId) return false;
    const wantedEvent = triggerNode.data?.purchaseEvent || '';
    if (wantedEvent && wantedEvent !== purchaseEvent) return false;
    return true;
  }

  return false;
}

// Evaluate a single condition based on source type
async function evaluateSingleCondition(
  conditionSource: string,
  conditionData: Record<string, any>,
  messageContent: string,
  contact: Contact,
  supabase: any
): Promise<boolean> {
  // Message-based condition
  if (conditionSource === 'message') {
    const conditionType = conditionData.conditionType;
    const value = conditionData.value || '';
    const caseSensitive = conditionData.caseSensitive || false;
    
    const content = caseSensitive ? messageContent.trim() : messageContent.toLowerCase().trim();
    
    // Split values by comma and trim each one (supports multiple values)
    const values = value.split(',').map((v: string) => {
      const trimmed = v.trim();
      return caseSensitive ? trimmed : trimmed.toLowerCase();
    }).filter((v: string) => v.length > 0);
    
    if (values.length === 0) return false;
    
    console.log(`[AutomationEngine] Condition checking ${values.length} value(s): ${values.join(', ')}`);
    
    // Check if ANY of the values match
    for (const compareValue of values) {
      let matched = false;
      
      switch (conditionType) {
        case 'contains':
          matched = content.includes(compareValue);
          break;
        case 'equals':
          matched = content === compareValue;
          break;
        case 'starts_with':
          matched = content.startsWith(compareValue);
          break;
        case 'ends_with':
          matched = content.endsWith(compareValue);
          break;
        case 'regex':
          try {
            const regex = new RegExp(compareValue, caseSensitive ? '' : 'i');
            matched = regex.test(messageContent);
          } catch {
            matched = false;
          }
          break;
        default:
          matched = false;
      }
      
      if (matched) {
        console.log(`[AutomationEngine] Condition matched: "${compareValue}"`);
        return true;
      }
    }
    
    console.log(`[AutomationEngine] No condition value matched`);
    return false;
  }
  
  // Tag-based condition
  if (conditionSource === 'tag') {
    const tagCondition = conditionData.tagCondition || 'has_tag';
    const tagName = conditionData.tagName || '';
    
    if (!tagName) {
      console.log('[AutomationEngine] Tag condition missing tag name');
      return false;
    }
    
    // Find tag by name
    const { data: tag } = await supabase
      .from('tags')
      .select('id')
      .eq('organization_id', contact.organization_id)
      .ilike('name', tagName)
      .maybeSingle();
    
    if (!tag) {
      console.log(`[AutomationEngine] Tag "${tagName}" not found`);
      return tagCondition === 'not_has_tag';
    }
    
    // Check if contact has the tag
    const { data: contactTag } = await supabase
      .from('contact_tags')
      .select('id')
      .eq('contact_id', contact.id)
      .eq('tag_id', tag.id)
      .maybeSingle();
    
    const hasTag = !!contactTag;
    console.log(`[AutomationEngine] Contact ${hasTag ? 'has' : 'does not have'} tag "${tagName}"`);
    
    return tagCondition === 'has_tag' ? hasTag : !hasTag;
  }
  
  // Kanban-based condition
  if (conditionSource === 'kanban') {
    const kanbanCondition = conditionData.kanbanCondition || 'is_in_column';
    const columnName = conditionData.columnName || '';
    const pipelineId = conditionData.pipelineId || null;
    
    if (!columnName) {
      console.log('[AutomationEngine] Kanban condition missing column name');
      return false;
    }
    
    // Find column by name, optionally filtered by pipeline
    let columnQuery = supabase
      .from('kanban_columns')
      .select('id')
      .eq('organization_id', contact.organization_id)
      .ilike('name', columnName);
    
    if (pipelineId) {
      columnQuery = columnQuery.eq('pipeline_id', pipelineId);
    }
    
    const { data: column } = await columnQuery.maybeSingle();
    
    if (!column) {
      console.log(`[AutomationEngine] Column "${columnName}" not found${pipelineId ? ' in specified pipeline' : ''}`);
      return kanbanCondition === 'not_in_column';
    }
    
    // Get contact's current column and pipeline
    const { data: currentContact } = await supabase
      .from('contacts')
      .select('kanban_column_id, pipeline_id')
      .eq('id', contact.id)
      .single();
    
    const isInColumn = currentContact?.kanban_column_id === column.id;
    console.log(`[AutomationEngine] Contact ${isInColumn ? 'is in' : 'is not in'} column "${columnName}"`);
    
    return kanbanCondition === 'is_in_column' ? isInColumn : !isInColumn;
  }
  
  // Assigned user condition
  if (conditionSource === 'assigned_user') {
    const assignedUserCondition = conditionData.assignedUserCondition || 'has_assigned';
    const assignedUserId = conditionData.assignedUserId || '';
    
    // Get contact's current assignment
    const { data: currentContact } = await supabase
      .from('contacts')
      .select('assigned_to')
      .eq('id', contact.id)
      .single();
    
    const hasAssigned = !!currentContact?.assigned_to;
    
    switch (assignedUserCondition) {
      case 'has_assigned':
        console.log(`[AutomationEngine] Contact ${hasAssigned ? 'has' : 'does not have'} assigned user`);
        return hasAssigned;
      case 'not_assigned':
        console.log(`[AutomationEngine] Contact ${!hasAssigned ? 'is not' : 'is'} assigned`);
        return !hasAssigned;
      case 'is_user':
        if (!assignedUserId) {
          console.log('[AutomationEngine] is_user condition missing user ID');
          return false;
        }
        const isSpecificUser = currentContact?.assigned_to === assignedUserId;
        console.log(`[AutomationEngine] Contact ${isSpecificUser ? 'is' : 'is not'} assigned to user ${assignedUserId}`);
        return isSpecificUser;
      default:
        return false;
    }
  }
  
  // Business hours-based condition
  if (conditionSource === 'business_hours') {
    const businessHoursCondition = conditionData.businessHoursCondition || 'is_open';
    
    // Get organization business hours settings
    const { data: org } = await supabase
      .from('organizations')
      .select('business_hours_start, business_hours_end, lunch_break_start, lunch_break_end, lunch_break_enabled, lunch_break_days, working_days, weekend_hours_enabled, weekend_hours_start, weekend_hours_end')
      .eq('id', contact.organization_id)
      .single();
    
    if (!org) {
      console.log('[AutomationEngine] Could not fetch organization settings');
      return false;
    }
    
    // Parse time values (format: HH:MM:SS)
    const parseTime = (timeStr: string): { hours: number; minutes: number } => {
      const parts = timeStr.split(':');
      return { hours: parseInt(parts[0], 10), minutes: parseInt(parts[1], 10) };
    };
    
    // Get current time in Brazil timezone (most common use case)
    const now = new Date();
    const brazilOffset = -3 * 60;
    const localOffset = now.getTimezoneOffset();
    const brazilTime = new Date(now.getTime() + (localOffset + brazilOffset) * 60000);
    
    const currentHour = brazilTime.getHours();
    const currentMinute = brazilTime.getMinutes();
    const currentDay = brazilTime.getDay();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    
    const isWeekendDay = currentDay === 0 || currentDay === 6;
    const weekendHoursEnabled = org.weekend_hours_enabled || false;
    
    let effectiveOpenTime: { hours: number; minutes: number };
    let effectiveCloseTime: { hours: number; minutes: number };
    
    if (isWeekendDay && weekendHoursEnabled) {
      effectiveOpenTime = parseTime(org.weekend_hours_start || '09:00:00');
      effectiveCloseTime = parseTime(org.weekend_hours_end || '13:00:00');
    } else {
      effectiveOpenTime = parseTime(org.business_hours_start || '08:00:00');
      effectiveCloseTime = parseTime(org.business_hours_end || '18:00:00');
    }
    
    const lunchStartTime = parseTime(org.lunch_break_start || '12:00:00');
    const lunchEndTime = parseTime(org.lunch_break_end || '13:00:00');
    
    const openTimeMinutes = effectiveOpenTime.hours * 60 + effectiveOpenTime.minutes;
    const closeTimeMinutes = effectiveCloseTime.hours * 60 + effectiveCloseTime.minutes;
    const lunchStartMinutes = lunchStartTime.hours * 60 + lunchStartTime.minutes;
    const lunchEndMinutes = lunchEndTime.hours * 60 + lunchEndTime.minutes;
    
    const workingDays: number[] = org.working_days || [1, 2, 3, 4, 5];
    const lunchBreakDays: number[] = org.lunch_break_days || [1, 2, 3, 4, 5];
    const lunchEnabled = org.lunch_break_enabled || false;
    
    const isWorkingDay = workingDays.includes(currentDay);
    const isLunchDay = lunchBreakDays.includes(currentDay);
    const isBeforeOpen = currentTimeMinutes < openTimeMinutes;
    const isAfterClose = currentTimeMinutes >= closeTimeMinutes;
    const isLunchTime = lunchEnabled && isLunchDay && currentTimeMinutes >= lunchStartMinutes && currentTimeMinutes < lunchEndMinutes;
    const isWithinHours = currentTimeMinutes >= openTimeMinutes && currentTimeMinutes < closeTimeMinutes;
    const isOpen = isWorkingDay && isWithinHours;
    const isClosed = !isOpen;
    
    console.log(`[AutomationEngine] Business hours check: day=${currentDay}, time=${currentHour}:${currentMinute}, isOpen=${isOpen}`);
    
    switch (businessHoursCondition) {
      case 'is_open':
        return isOpen;
      case 'is_closed':
        return isClosed;
      case 'is_lunch_break':
        return isLunchTime && isWorkingDay;
      case 'is_working_day':
        return isWorkingDay;
      case 'is_before_open':
        return isBeforeOpen || !isWorkingDay;
      case 'is_after_close':
        return isAfterClose || !isWorkingDay;
      default:
        return false;
    }
  }
  
  // Holiday-based condition
  if (conditionSource === 'holiday') {
    const holidayCondition = conditionData.holidayCondition || 'is_holiday';
    
    const now = new Date();
    const brazilOffset = -3 * 60;
    const localOffset = now.getTimezoneOffset();
    const brazilTime = new Date(now.getTime() + (localOffset + brazilOffset) * 60000);
    const today = brazilTime.toISOString().split('T')[0];
    
    const { data: holiday } = await supabase
      .from('organization_holidays')
      .select('id, is_closed')
      .eq('organization_id', contact.organization_id)
      .eq('holiday_date', today)
      .maybeSingle();
    
    const isHoliday = !!holiday;
    console.log(`[AutomationEngine] Holiday check: date=${today}, isHoliday=${isHoliday}`);
    
    return holidayCondition === 'is_holiday' ? isHoliday : !isHoliday;
  }
  
  // Media type condition
  if (conditionSource === 'media_type') {
    const mediaTypeCondition = conditionData.mediaTypeCondition || 'is_any_media';
    // message_type is passed via context or we get it from the contact's latest message
    const incomingType = conditionData._messageType || 'text';
    const mediaMap: Record<string, string[]> = {
      'is_image': ['image'],
      'is_video': ['video'],
      'is_audio': ['audio', 'ptt'],
      'is_any_media': ['image', 'video', 'audio', 'ptt', 'document', 'sticker'],
    };
    const allowedTypes = mediaMap[mediaTypeCondition] || [];
    const matched = allowedTypes.includes(incomingType);
    console.log(`[AutomationEngine] Media type condition: type="${incomingType}", condition="${mediaTypeCondition}", matched=${matched}`);
    return matched;
  }
  
  // Custom field condition
  if (conditionSource === 'custom_field') {
    const customFieldName = conditionData.customFieldName || '';
    const customFieldCondition = conditionData.customFieldCondition || 'equals';
    const customFieldValue = conditionData.customFieldValue || '';
    
    if (!customFieldName) {
      console.log('[AutomationEngine] Custom field condition missing field name');
      return false;
    }
    
    // Get the custom field value for this contact
    const { data: customField } = await supabase
      .from('contact_custom_fields')
      .select('field_value')
      .eq('contact_id', contact.id)
      .eq('field_name', customFieldName)
      .maybeSingle();
    
    const fieldValue = customField?.field_value || '';
    const isEmpty = !fieldValue || fieldValue.trim() === '';
    
    console.log(`[AutomationEngine] Custom field "${customFieldName}" = "${fieldValue}"`);
    
    // Support comma-separated values for equals/contains/not_equals
    const fieldValueLower = fieldValue.toLowerCase();
    const valuesToCheck = customFieldValue.split(',').map((v: string) => v.trim().toLowerCase()).filter((v: string) => v.length > 0);
    
    switch (customFieldCondition) {
      case 'equals':
        return valuesToCheck.some((v: string) => fieldValueLower === v);
      case 'contains':
        return valuesToCheck.some((v: string) => fieldValueLower.includes(v));
      case 'not_equals':
        return valuesToCheck.every((v: string) => fieldValueLower !== v);
      case 'is_empty':
        return isEmpty;
      case 'is_not_empty':
        return !isEmpty;
      default:
        return false;
    }
  }

  // AI status condition: check if AI is currently enabled on contact (and optionally for a specific agent)
  if (conditionSource === 'ai_enabled') {
    const aiCondition = conditionData.aiEnabledCondition || 'is_enabled'; // is_enabled | is_disabled | is_specific_agent | is_not_specific_agent
    const targetAgentId = conditionData.aiAgentId || null;

    const { data: currentContact } = await supabase
      .from('contacts')
      .select('ai_enabled, ai_agent_id')
      .eq('id', contact.id)
      .single();

    const aiEnabled = !!currentContact?.ai_enabled;
    const currentAgentId = currentContact?.ai_agent_id || null;

    switch (aiCondition) {
      case 'is_enabled':
        return aiEnabled;
      case 'is_disabled':
        return !aiEnabled;
      case 'is_specific_agent':
        return aiEnabled && !!targetAgentId && currentAgentId === targetAgentId;
      case 'is_not_specific_agent':
        return !aiEnabled || !targetAgentId || currentAgentId !== targetAgentId;
      default:
        return false;
    }
  }

  return false;
}

// Check condition node - supports message, tag, kanban, assigned user, business hours, holiday, media type, and AND/OR logic
async function evaluateCondition(
  conditionNode: FlowNode, 
  messageContent: string, 
  contact: Contact,
  supabase: any,
  messageType?: string
): Promise<boolean> {
  const logicOperator = conditionNode.data?.logicOperator || 'single';
  const conditionSource = conditionNode.data?.conditionSource || 'message';
  
  // Build first condition data
  const firstConditionData: Record<string, any> = {
    conditionType: conditionNode.data?.conditionType,
    value: conditionNode.data?.value,
    caseSensitive: conditionNode.data?.caseSensitive,
    tagCondition: conditionNode.data?.tagCondition,
    tagName: conditionNode.data?.tagName,
    kanbanCondition: conditionNode.data?.kanbanCondition,
    pipelineId: conditionNode.data?.pipelineId,
    columnName: conditionNode.data?.columnName,
    assignedUserCondition: conditionNode.data?.assignedUserCondition,
    assignedUserId: conditionNode.data?.assignedUserId,
    businessHoursCondition: conditionNode.data?.businessHoursCondition,
    holidayCondition: conditionNode.data?.holidayCondition,
    customFieldName: conditionNode.data?.customFieldName,
    customFieldCondition: conditionNode.data?.customFieldCondition,
    customFieldValue: conditionNode.data?.customFieldValue,
    mediaTypeCondition: conditionNode.data?.mediaTypeCondition,
    aiEnabledCondition: conditionNode.data?.aiEnabledCondition,
    aiAgentId: conditionNode.data?.aiAgentId,
    _messageType: messageType || contact.flow_context?._messageType || 'text',
  };
  
  // Evaluate first condition
  const firstResult = await evaluateSingleCondition(
    conditionSource,
    firstConditionData,
    messageContent,
    contact,
    supabase
  );
  
  console.log(`[AutomationEngine] First condition (${conditionSource}): ${firstResult}`);
  
  // If single condition, return result
  if (logicOperator === 'single') {
    return firstResult;
  }
  
  // For AND/OR, we need to evaluate the second condition
  const secondConditionSource = conditionNode.data?.secondConditionSource || 'message';
  
  // Build second condition data (with "second" prefix)
  const secondConditionData: Record<string, any> = {
    conditionType: conditionNode.data?.secondConditionType,
    value: conditionNode.data?.secondValue,
    caseSensitive: conditionNode.data?.secondCaseSensitive,
    tagCondition: conditionNode.data?.secondTagCondition,
    tagName: conditionNode.data?.secondTagName,
    kanbanCondition: conditionNode.data?.secondKanbanCondition,
    pipelineId: conditionNode.data?.secondPipelineId,
    columnName: conditionNode.data?.secondColumnName,
    assignedUserCondition: conditionNode.data?.secondAssignedUserCondition,
    assignedUserId: conditionNode.data?.secondAssignedUserId,
    businessHoursCondition: conditionNode.data?.secondBusinessHoursCondition,
    holidayCondition: conditionNode.data?.secondHolidayCondition,
    customFieldName: conditionNode.data?.secondCustomFieldName,
    customFieldCondition: conditionNode.data?.secondCustomFieldCondition,
    customFieldValue: conditionNode.data?.secondCustomFieldValue,
    mediaTypeCondition: conditionNode.data?.secondMediaTypeCondition,
    aiEnabledCondition: conditionNode.data?.secondAiEnabledCondition,
    aiAgentId: conditionNode.data?.secondAiAgentId,
    _messageType: messageType || contact.flow_context?._messageType || 'text',
  };
  
  // Short-circuit evaluation for performance
  if (logicOperator === 'and' && !firstResult) {
    console.log(`[AutomationEngine] AND logic: first is false, skipping second`);
    return false;
  }
  
  if (logicOperator === 'or' && firstResult) {
    console.log(`[AutomationEngine] OR logic: first is true, skipping second`);
    return true;
  }
  
  // Evaluate second condition
  const secondResult = await evaluateSingleCondition(
    secondConditionSource,
    secondConditionData,
    messageContent,
    contact,
    supabase
  );
  
  console.log(`[AutomationEngine] Second condition (${secondConditionSource}): ${secondResult}`);
  
  // Apply logic operator
  if (logicOperator === 'and') {
    const finalResult = firstResult && secondResult;
    console.log(`[AutomationEngine] AND result: ${firstResult} && ${secondResult} = ${finalResult}`);
    return finalResult;
  }
  
  if (logicOperator === 'or') {
    const finalResult = firstResult || secondResult;
    console.log(`[AutomationEngine] OR result: ${firstResult} || ${secondResult} = ${finalResult}`);
    return finalResult;
  }
  
  return firstResult;
}

// Format phone number for Stevo API
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

// Resolve which WhatsApp provider is active for the organization
async function resolveWhatsAppProvider(
  supabase: any,
  organizationId: string,
): Promise<'meta' | 'stevo'> {
  const { data } = await supabase
    .from('whatsapp_meta_instances')
    .select('access_token, phone_number_id, is_active')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle();
  if (data?.access_token && data?.phone_number_id) return 'meta';
  return 'stevo';
}

// Send via Meta WhatsApp Cloud API (text only - automations only send text)
async function sendViaMeta(
  supabase: any,
  organizationId: string,
  contactId: string,
  phone: string,
  message: string,
): Promise<boolean> {
  const { data: instance } = await supabase
    .from('whatsapp_meta_instances')
    .select('phone_number_id, access_token')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle();

  if (!instance?.phone_number_id || !instance?.access_token) {
    console.error('[AutomationEngine] Meta instance missing for org:', organizationId);
    return false;
  }

  const to = formatPhoneNumber(phone);
  const url = `https://graph.facebook.com/v21.0/${instance.phone_number_id}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${instance.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: message },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AutomationEngine] Meta send failed: ${response.status} - ${errorText}`);
    return false;
  }

  let wamid: string | null = null;
  try {
    const data = await response.json();
    wamid = data?.messages?.[0]?.id || null;
  } catch (_) {}

  const { error: insertErr } = await supabase.from('messages').insert({
    contact_id: contactId,
    organization_id: organizationId,
    content: message,
    message_type: 'text',
    direction: 'outbound',
    status: 'sent',
    sent_by_user_id: null,
    whatsapp_message_id: wamid,
  });
  if (insertErr && (insertErr as any).code !== '23505') {
    console.error('[AutomationEngine] Failed to save Meta message:', insertErr);
  }

  await supabase
    .from('contacts')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', contactId);

  console.log('[AutomationEngine] Message sent via Meta');
  return true;
}

// Send message - auto-routes to Meta or Stevo based on org config
async function sendWhatsAppMessage(
  supabase: any,
  organizationId: string,
  contactId: string,
  phone: string,
  message: string
): Promise<boolean> {
  try {
    const provider = await resolveWhatsAppProvider(supabase, organizationId);
    console.log(`[AutomationEngine] Provider resolved: ${provider} for org ${organizationId}`);

    if (provider === 'meta') {
      return await sendViaMeta(supabase, organizationId, contactId, phone, message);
    }

    // Stevo (default / fallback)
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, api_key, base_url')
      .eq('organization_id', organizationId)
      .single();

    if (!instance) {
      console.error('[AutomationEngine] WhatsApp instance not found for organization:', organizationId);
      return false;
    }

    if (!instance.base_url) {
      console.error(`[AutomationEngine] No base_url configured for WhatsApp instance in org ${organizationId}`);
      return false;
    }
    const baseUrl = instance.base_url;

    const formattedPhone = formatPhoneNumber(phone);
    const sendUrl = `${baseUrl}/send/text`;

    console.log(`[AutomationEngine] Sending message to ${formattedPhone} via ${instance.instance_name}`);

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
      console.error(`[AutomationEngine] Failed to send message: ${response.status} - ${errorText}`);
      return false;
    }

    // Capture whatsapp_message_id from Stevo response for dedupe with webhook echo
    let whatsappMessageId: string | null = null;
    try {
      const stevoData = await response.json();
      whatsappMessageId = stevoData?.data?.Info?.ID || stevoData?.data?.key?.id || stevoData?.key?.id || null;
    } catch (_) {
      // ignore body parse error
    }

    // Save the sent message to database (sent_by_user_id = null indicates system/automation message)
    const { error: insertErr } = await supabase
      .from('messages')
      .insert({
        contact_id: contactId,
        organization_id: organizationId,
        content: message,
        message_type: 'text',
        direction: 'outbound',
        status: 'sent',
        sent_by_user_id: null, // Explicitly null = automation/system message
        whatsapp_message_id: whatsappMessageId,
      });
    if (insertErr && (insertErr as any).code !== '23505') {
      console.error('[AutomationEngine] Failed to save message:', insertErr);
    }

    // Update contact's last_message_at
    await supabase
      .from('contacts')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', contactId);

    console.log(`[AutomationEngine] Message sent successfully via Stevo`);
    return true;
  } catch (error) {
    console.error('[AutomationEngine] Error sending message:', error);
    return false;
  }
}

async function sendWhatsAppMedia(
  supabase: any,
  organizationId: string,
  contactId: string,
  phone: string,
  mediaUrl: string,
  mediaType: 'image' | 'video',
  caption?: string,
): Promise<boolean> {
  try {
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, api_key, base_url')
      .eq('organization_id', organizationId)
      .single();

    if (!instance?.base_url) {
      console.error('[AutomationEngine] No WhatsApp instance for media send');
      return false;
    }

    const formattedPhone = formatPhoneNumber(phone);
    const response = await fetch(`${instance.base_url}/send/media`, {
      method: 'POST',
      headers: { 'apikey': instance.api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: formattedPhone,
        type: mediaType,
        url: mediaUrl,
        caption: caption || '',
        formatJid: true,
      }),
    });

    if (!response.ok) {
      console.error(`[AutomationEngine] Media send failed: ${response.status} ${await response.text()}`);
      return false;
    }

    await supabase.from('messages').insert({
      contact_id: contactId,
      organization_id: organizationId,
      content: caption || '',
      message_type: mediaType,
      media_url: mediaUrl,
      direction: 'outbound',
      status: 'sent',
      sent_by_user_id: null,
    });

    await supabase
      .from('contacts')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', contactId);

    console.log(`[AutomationEngine] Media (${mediaType}) sent successfully`);
    return true;
  } catch (error) {
    console.error('[AutomationEngine] Error sending media:', error);
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
    // Find tag by name (case-insensitive to avoid duplicates)
    const { data: tag } = await supabase
      .from('tags')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike('name', tagName)
      .maybeSingle();

    if (!tag) {
      console.log(`[AutomationEngine] Tag "${tagName}" not found, creating it`);
      const { data: newTag, error: createError } = await supabase
        .from('tags')
        .insert({ organization_id: organizationId, name: tagName })
        .select('id')
        .single();

      if (createError || !newTag) {
        console.error('[AutomationEngine] Failed to create tag:', createError);
        return false;
      }

      if (action === 'add') {
        await supabase.from('contact_tags').insert({ contact_id: contactId, tag_id: newTag.id });
      }
      return true;
    }

    if (action === 'add') {
      // Check if tag already exists
      const { data: existing } = await supabase
        .from('contact_tags')
        .select('id')
        .eq('contact_id', contactId)
        .eq('tag_id', tag.id)
        .single();

      if (!existing) {
        await supabase.from('contact_tags').insert({ contact_id: contactId, tag_id: tag.id });
        console.log(`[AutomationEngine] Added tag "${tagName}" to contact`);
      }
    } else {
      await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', tag.id);
      console.log(`[AutomationEngine] Removed tag "${tagName}" from contact`);
    }

    return true;
  } catch (error) {
    console.error('[AutomationEngine] Error managing tag:', error);
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
      console.log(`[AutomationEngine] Column "${columnName}" not found`);
      return false;
    }

    await supabase
      .from('contacts')
      .update({ kanban_column_id: column.id })
      .eq('id', contactId);

    console.log(`[AutomationEngine] Moved contact to column "${columnName}"`);
    return true;
  } catch (error) {
    console.error('[AutomationEngine] Error moving to column:', error);
    return false;
  }
}

// Assign contact to a member
async function assignContact(
  supabase: any,
  organizationId: string,
  contactId: string,
  assignTo: 'specific' | 'round_robin' | 'least_busy' | 'random',
  memberId?: string,
  memberIds?: string[] // For random distribution
): Promise<boolean> {
  try {
    let targetMemberId = memberId;

    // Helper: busca user_ids dos membros que estão "On" (is_available = true)
    async function fetchAvailableUserIds(): Promise<Set<string>> {
      const { data } = await supabase
        .from('organization_members')
        .select('user_id, is_available')
        .eq('organization_id', organizationId);
      const set = new Set<string>();
      (data || []).forEach((m: any) => {
        if (m.is_available !== false) set.add(m.user_id); // default true
      });
      return set;
    }

    if (assignTo === 'random' && memberIds && memberIds.length > 0) {
      // Random: filtra por disponibilidade (On). Atribuição manual específica não é afetada.
      const available = await fetchAvailableUserIds();
      const eligible = memberIds.filter(id => available.has(id));
      if (eligible.length === 0) {
        console.log(`[AutomationEngine] Random: nenhum membro On entre ${memberIds.length} selecionados. Não atribuindo.`);
        return false;
      }
      targetMemberId = eligible[Math.floor(Math.random() * eligible.length)];
      console.log(`[AutomationEngine] Random assignment: selected ${targetMemberId} from ${eligible.length} On options (de ${memberIds.length})`);
    } else if (assignTo === 'round_robin') {
      // Round Robin: pula membros Off
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, is_available')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });

      if (!members || members.length === 0) {
        console.log('[AutomationEngine] No members found for round robin assignment');
        return false;
      }

      const allUserIds = members.map((m: any) => m.user_id);
      const availableUserIds = members
        .filter((m: any) => m.is_available !== false)
        .map((m: any) => m.user_id);

      if (availableUserIds.length === 0) {
        console.log('[AutomationEngine] Round robin: nenhum membro On disponível. Não atribuindo.');
        return false;
      }

      // Pega último atribuído para determinar rotação
      const { data: lastAssigned } = await supabase
        .from('contacts')
        .select('assigned_to')
        .eq('organization_id', organizationId)
        .not('assigned_to', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastAssigned?.assigned_to) {
        // Procura próximo "On" depois do último atribuído, na ordem global de membros
        const lastIndex = allUserIds.indexOf(lastAssigned.assigned_to);
        const total = allUserIds.length;
        let picked: string | undefined;
        for (let step = 1; step <= total; step++) {
          const candidate = allUserIds[(lastIndex + step) % total];
          if (availableUserIds.includes(candidate)) {
            picked = candidate;
            break;
          }
        }
        targetMemberId = picked || availableUserIds[0];
      } else {
        targetMemberId = availableUserIds[0];
      }

      console.log(`[AutomationEngine] Round robin: assigned to ${targetMemberId} (skipping Off members)`);
    } else if (assignTo === 'least_busy') {
      // Least Busy: considera apenas membros On
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, is_available')
        .eq('organization_id', organizationId);

      const availableMembers = (members || []).filter((m: any) => m.is_available !== false);

      if (availableMembers.length === 0) {
        console.log('[AutomationEngine] Least busy: nenhum membro On disponível. Não atribuindo.');
        return false;
      }

      let minCount = Infinity;
      let leastBusyMemberId = availableMembers[0].user_id;

      for (const member of availableMembers) {
        const { count } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('assigned_to', member.user_id)
          .eq('status', 'open');

        const contactCount = count || 0;
        console.log(`[AutomationEngine] Member ${member.user_id} has ${contactCount} open contacts`);

        if (contactCount < minCount) {
          minCount = contactCount;
          leastBusyMemberId = member.user_id;
        }
      }

      targetMemberId = leastBusyMemberId;
      console.log(`[AutomationEngine] Least busy (On only): assigned to ${targetMemberId} with ${minCount} open contacts`);
    }

    if (!targetMemberId) {
      console.log('[AutomationEngine] No target member for assignment');
      return false;
    }

    // Update contact with the assigned user_id directly
    await supabase
      .from('contacts')
      .update({ assigned_to: targetMemberId })
      .eq('id', contactId);
    
    console.log(`[AutomationEngine] Assigned contact to user ${targetMemberId}`);
    return true;
  } catch (error) {
    console.error('[AutomationEngine] Error assigning contact:', error);
    return false;
  }
}

// Call external webhook
async function callWebhook(
  url: string,
  method: 'GET' | 'POST' | 'PUT',
  contact: Contact,
  context: Record<string, any>
): Promise<boolean> {
  try {
    const body = method !== 'GET' ? JSON.stringify({
      contact_id: contact.id,
      contact_name: contact.name,
      contact_phone: contact.phone,
      contact_email: contact.email,
      context,
      timestamp: new Date().toISOString(),
    }) : undefined;

    const response = await fetch(url, {
      method,
      headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : undefined,
      body,
    });

    console.log(`[AutomationEngine] Webhook ${method} ${url} - Status: ${response.status}`);
    return response.ok;
  } catch (error) {
    console.error('[AutomationEngine] Error calling webhook:', error);
    return false;
  }
}

// Execute a single node
async function executeNode(
  supabase: any,
  node: FlowNode,
  contact: Contact,
  messageContent: string,
  flowData: FlowData
): Promise<{ continue: boolean; nextHandle?: string; pauseUntil?: Date; waitForResponse?: boolean; responseTimeout?: Date; connectToFlow?: string; saveVariableName?: string }> {
  console.log(`[AutomationEngine] Executing node: ${node.type} (${node.id})`);

  switch (node.type) {
    case 'trigger':
      // Trigger node just passes through
      return { continue: true };

    case 'sendMessage': {
      const message = node.data?.message || '';
      const mediaUrl: string | null = node.data?.mediaUrl || null;
      const mediaType: string = node.data?.mediaType || 'image';
      const processedMessage = await replaceVariables(message, contact, contact.flow_context, supabase);

      // Send media first (if any), then text
      if (mediaUrl) {
        await sendWhatsAppMedia(
          supabase,
          contact.organization_id,
          contact.id,
          contact.phone,
          mediaUrl,
          mediaType as 'image' | 'video',
          processedMessage || undefined,
        );
        // If there's also text AND a caption was already sent with the media, skip duplicate text
        if (processedMessage) {
          // caption already sent with media — no extra text message needed
        }
      } else if (processedMessage) {
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

    case 'triggerSdr': {
      const agentId = node.data?.agentId;
      const additionalInstructions = node.data?.additionalInstructions || '';

      if (!agentId) {
        console.log('[AutomationEngine] triggerSdr: no agentId configured, skipping');
        return { continue: true };
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      // Fire-and-continue: SDR generation can take several seconds (OpenAI + send).
      // Use EdgeRuntime.waitUntil so the engine doesn't block the rest of the flow.
      const sdrCall = fetch(`${supabaseUrl}/functions/v1/ai-sdr-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          contact_id: contact.id,
          agent_id: agentId,
          additional_instructions: additionalInstructions,
        }),
      }).then(async (r) => {
        if (!r.ok) {
          console.error(`[AutomationEngine] triggerSdr ai-sdr-generate failed: ${r.status} ${await r.text()}`);
        } else {
          console.log(`[AutomationEngine] triggerSdr SDR message generated for contact ${contact.id}`);
        }
      }).catch((e) => console.error('[AutomationEngine] triggerSdr fetch error:', e));

      try {
        // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
        if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(sdrCall);
        }
      } catch {
        // ignore — fire-and-forget anyway
      }

      return { continue: true };
    }

    case 'sendEmail': {
      const logEmailResult = async (params: {
        toEmail: string;
        fromEmail?: string | null;
        subject?: string | null;
        status: 'sent' | 'failed';
        resendMessageId?: string | null;
        errorMessage?: string | null;
      }) => {
        const { error } = await supabase.from('email_send_history').insert({
          organization_id: contact.organization_id,
          contact_id: contact.id,
          automation_id: contact.active_flow_id,
          to_email: params.toEmail,
          from_email: params.fromEmail || null,
          subject: params.subject || null,
          source: 'automation',
          status: params.status,
          resend_message_id: params.resendMessageId || null,
          error_message: params.errorMessage || null,
        });

        if (error) {
          console.error('[AutomationEngine] sendEmail history insert failed:', error.message || error);
        }
      };

      const escapeHtml = (value: string) =>
        value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      const htmlToText = (value: string) =>
        value
          .replace(/<br\s*\/?\s*>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .trim();

      const parseEmailList = async (value: string) => {
        if (!value.trim()) return [];
        const processed = await replaceVariables(value, contact, contact.flow_context, supabase);
        return processed
          .split(',')
          .map((email: string) => email.trim())
          .filter((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
      };

      try {
        const toMode = node.data?.to;
        const customTo = node.data?.customTo || '';
        const rawTo = toMode === 'custom' ? customTo : (toMode || '{email}');
        const subject = node.data?.subject || '';
        const content = node.data?.content || '';
        const htmlMode = !!node.data?.htmlMode;
        const cc = node.data?.cc || '';
        const bcc = node.data?.bcc || '';

        const processedTo = await replaceVariables(rawTo, contact, contact.flow_context, supabase);
        const processedSubject = await replaceVariables(subject, contact, contact.flow_context, supabase);
        const processedContent = await replaceVariables(content, contact, contact.flow_context, supabase);

        const recipientEmail = processedTo.trim();
        const safeSubject = processedSubject.trim() || '(sem assunto)';

        if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
          console.log(`[AutomationEngine] sendEmail: invalid recipient "${recipientEmail}"`);
          return { continue: true };
        }

        if (!processedContent.trim()) {
          await logEmailResult({
            toEmail: recipientEmail,
            subject: safeSubject,
            status: 'failed',
            errorMessage: 'Conteúdo do email vazio no nó Enviar Email',
          });
          return { continue: true };
        }

        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('resend_api_key, resend_from_email, resend_from_name, resend_reply_to')
          .eq('id', contact.organization_id)
          .single();

        if (orgError || !org) {
          const errMsg = orgError?.message || 'Organização não encontrada';
          console.log(`[AutomationEngine] sendEmail: ${errMsg}`);
          await logEmailResult({
            toEmail: recipientEmail,
            subject: safeSubject,
            status: 'failed',
            errorMessage: errMsg,
          });
          return { continue: true };
        }

        const apiKey = (org.resend_api_key || '').trim();
        const fromEmail = (org.resend_from_email || '').trim();
        const fromName = (org.resend_from_name || '').trim();
        const replyTo = (org.resend_reply_to || '').trim();
        const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

        if (!apiKey) {
          console.log(`[AutomationEngine] sendEmail: Resend API key not configured for org ${contact.organization_id}`);
          await logEmailResult({
            toEmail: recipientEmail,
            fromEmail,
            subject: safeSubject,
            status: 'failed',
            errorMessage: 'Chave de API Resend não configurada',
          });
          return { continue: true };
        }

        if (!fromEmail) {
          const errMsg = 'Email remetente não configurado para esta organização';
          console.log(`[AutomationEngine] sendEmail: ${errMsg}`);
          await logEmailResult({
            toEmail: recipientEmail,
            subject: safeSubject,
            status: 'failed',
            errorMessage: errMsg,
          });
          return { continue: true };
        }

        console.log(`[AutomationEngine] sendEmail using from "${fromEmail}" to "${recipientEmail}"`);

        const htmlContent = htmlMode
          ? processedContent
          : processedContent
              .split(/\n{2,}/)
              .map((paragraph: string) => `<p style="margin:0 0 16px;line-height:1.6;">${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</p>`)
              .join('');

        const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      ${htmlContent}
    </div>
  </body>
</html>`;

        const text = htmlMode ? htmlToText(processedContent) : processedContent.trim();
        const ccList = await parseEmailList(cc);
        const bccList = await parseEmailList(bcc);

        const payload: Record<string, unknown> = {
          from: fromHeader,
          to: [recipientEmail],
          subject: safeSubject,
          html,
          text: text || safeSubject,
        };
        if (replyTo) payload.reply_to = replyTo;
        if (ccList.length > 0) payload.cc = ccList;
        if (bccList.length > 0) payload.bcc = bccList;

        const resendResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const resendBody = await resendResp.json().catch(() => ({}));
        const resendMessageId = typeof resendBody?.id === 'string' ? resendBody.id : null;

        if (!resendResp.ok || !resendMessageId) {
          const errMsg =
            resendBody?.message ||
            resendBody?.error ||
            (!resendMessageId ? 'Resend não retornou ID de mensagem' : `HTTP ${resendResp.status}`);
          console.log(`[AutomationEngine] sendEmail failed: ${errMsg}`);
          await logEmailResult({
            toEmail: recipientEmail,
            fromEmail,
            subject: safeSubject,
            status: 'failed',
            errorMessage: errMsg,
          });
        } else {
          console.log(`[AutomationEngine] sendEmail success: ${resendMessageId}`);
          await logEmailResult({
            toEmail: recipientEmail,
            fromEmail,
            subject: safeSubject,
            status: 'sent',
            resendMessageId,
          });
        }
      } catch (err: any) {
        console.error('[AutomationEngine] sendEmail exception:', err?.message || err);
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

      // Delays up to 45s: synchronous (safe within Edge Function timeout)
      // Delays > 45s: pause flow and resume via cron (resume-delayed-flows every minute)
      const SYNC_THRESHOLD_MS = 45 * 1000;
      if (milliseconds <= SYNC_THRESHOLD_MS) {
        if (milliseconds > 0) {
          console.log(`[AutomationEngine] Synchronous delay: waiting ${milliseconds}ms`);
          await new Promise(resolve => setTimeout(resolve, milliseconds));
        }
        return { continue: true };
      } else {
        const resumeAt = new Date(Date.now() + milliseconds);
        console.log(`[AutomationEngine] Delay ${milliseconds}ms — pausing flow until ${resumeAt.toISOString()}`);
        return { continue: false, pauseUntil: resumeAt };
      }
    }

    case 'condition': {
      const result = await evaluateCondition(node, messageContent, contact, supabase, contact.flow_context?._messageType);
      console.log(`[AutomationEngine] Condition result: ${result}`);
      return { continue: true, nextHandle: result ? 'yes' : 'no' };
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

    case 'assign': {
      const assignTo = node.data?.assignTo || 'specific';
      const memberId = node.data?.memberId;
      const memberIds = node.data?.memberIds;
      await assignContact(supabase, contact.organization_id, contact.id, assignTo, memberId, memberIds);
      return { continue: true };
    }

    case 'webhook': {
      const url = node.data?.url || '';
      const method = node.data?.method || 'POST';
      if (url) {
        await callWebhook(url, method, contact, contact.flow_context);
      }
      return { continue: true };
    }

    case 'waitResponse': {
      const timeout = node.data?.timeout || 5;
      const timeoutUnit = node.data?.timeoutUnit || 'minutes';
      
      let milliseconds = timeout * 60 * 1000; // Default to minutes
      switch (timeoutUnit) {
        case 'minutes': milliseconds = timeout * 60 * 1000; break;
        case 'hours': milliseconds = timeout * 60 * 60 * 1000; break;
        case 'days': milliseconds = timeout * 24 * 60 * 60 * 1000; break;
      }
      
      const timeoutAt = new Date(Date.now() + milliseconds);
      console.log(`[AutomationEngine] Waiting for user response, timeout at ${timeoutAt.toISOString()}`);
      
      return { 
        continue: false, 
        waitForResponse: true,
        responseTimeout: timeoutAt
      };
    }

    case 'saveResponse': {
      const timeout = node.data?.timeout || 5;
      const timeoutUnit = node.data?.timeoutUnit || 'minutes';
      const variableName = node.data?.variableName || 'resposta';
      
      let milliseconds = timeout * 60 * 1000; // Default to minutes
      switch (timeoutUnit) {
        case 'minutes': milliseconds = timeout * 60 * 1000; break;
        case 'hours': milliseconds = timeout * 60 * 60 * 1000; break;
        case 'days': milliseconds = timeout * 24 * 60 * 60 * 1000; break;
      }
      
      const timeoutAt = new Date(Date.now() + milliseconds);
      console.log(`[AutomationEngine] Waiting for response to save as "${variableName}", timeout at ${timeoutAt.toISOString()}`);
      
      return { 
        continue: false, 
        waitForResponse: true,
        responseTimeout: timeoutAt,
        saveVariableName: variableName
      };
    }

    case 'connectFlow': {
      const targetFlowId = node.data?.targetFlowId;
      if (!targetFlowId) {
        console.log('[AutomationEngine] No target flow configured');
        return { continue: true };
      }
      
      console.log(`[AutomationEngine] Connecting to flow: ${targetFlowId}`);
      return { 
        continue: false, 
        connectToFlow: targetFlowId 
      };
    }

    case 'sendSurvey': {
      // Check if contact has "fornecedor" or "colaborador" tags — skip survey for them
      const { data: contactTagsForSurvey } = await supabase
        .from('contact_tags')
        .select('tags (name)')
        .eq('contact_id', contact.id);
      
      const hasExcludedTag = (contactTagsForSurvey || []).some((ct: any) => {
        const tagName = ct.tags?.name?.toLowerCase()?.trim() || '';
        return tagName.startsWith('fornecedor') || tagName.startsWith('colaborador');
      });
      
      if (hasExcludedTag) {
        console.log(`[AutomationEngine] Skipping survey for contact ${contact.id} — has fornecedor/colaborador tag`);
        return { continue: true };
      }

      // Generate a unique token for the survey link
      const token = crypto.randomUUID();
      
      // Get the active survey for this organization
      const { data: survey } = await supabase
        .from('satisfaction_surveys')
        .select('id')
        .eq('organization_id', contact.organization_id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (!survey) {
        console.log('[AutomationEngine] No active satisfaction survey found for organization');
        return { continue: true };
      }
      
      // Create a satisfaction_response record with the token, contact, and assigned user
      const { data: contactData } = await supabase
        .from('contacts')
        .select('assigned_to')
        .eq('id', contact.id)
        .single();
      
      const { error: insertError } = await supabase
        .from('satisfaction_responses')
        .insert({
          organization_id: contact.organization_id,
          survey_id: survey.id,
          contact_id: contact.id,
          assigned_to: contactData?.assigned_to || null,
          token,
        });
      
      if (insertError) {
        console.error('[AutomationEngine] Error creating satisfaction response:', insertError);
        return { continue: true };
      }
      
      // Build the survey link
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      // Extract the project domain for the public app URL
      const appUrl = supabaseUrl.replace('.supabase.co', '').replace('https://','');
      const surveyLink = `${Deno.env.get('APP_URL') || 'https://vgvturbo.com.br'}/pesquisa/${token}`;
      
      // Replace {link_pesquisa} in the message and send
      const message = node.data?.message || 'Avalie seu atendimento: {link_pesquisa}';
      let processedMessage = await replaceVariables(message, contact, contact.flow_context, supabase);
      processedMessage = processedMessage.replace(/\{link_pesquisa\}/g, surveyLink);
      
      if (processedMessage) {
        await sendWhatsAppMessage(
          supabase,
          contact.organization_id,
          contact.id,
          contact.phone,
          processedMessage
        );
      }
      
      console.log(`[AutomationEngine] Satisfaction survey link sent to ${contact.phone}, token: ${token}`);
      return { continue: true };
    }

    case 'toggleAi': {
      const aiAction = node.data?.aiAction || 'enable';
      const newAiEnabled = aiAction === 'enable';
      const aiAgentId = node.data?.aiAgentId || null;
      
      const updatePayload: any = { ai_enabled: newAiEnabled };
      if (newAiEnabled && aiAgentId) {
        updatePayload.ai_agent_id = aiAgentId;
      } else if (!newAiEnabled) {
        updatePayload.ai_agent_id = null;
      }

      await supabase
        .from('contacts')
        .update(updatePayload)
        .eq('id', contact.id);
      
      console.log(`[AutomationEngine] AI ${newAiEnabled ? 'enabled' : 'disabled'} for contact ${contact.id}${aiAgentId ? ` with agent ${aiAgentId}` : ''}`);
      return { continue: true };
    }

    case 'createTask': {
      try {
        const rawTitle = node.data?.title || '';
        if (!rawTitle || !rawTitle.trim()) {
          console.log('[AutomationEngine] createTask: empty title, skipping');
          return { continue: true };
        }
        const title = await replaceVariables(rawTitle, contact, contact.flow_context, supabase);
        const rawDescription = node.data?.description || '';
        const description = rawDescription
          ? await replaceVariables(rawDescription, contact, contact.flow_context, supabase)
          : null;

        const priority = node.data?.priority || 'medium';
        const projectId = node.data?.projectId || null;
        const areaId = node.data?.areaId || null;
        const linkContact = node.data?.linkContact !== false;

        // Resolve due_at
        let dueAt: string | null = null;
        const dueMode = node.data?.dueMode || 'none';
        if (dueMode === 'in_days') {
          const days = Math.max(1, parseInt(String(node.data?.dueDays ?? 1)) || 1);
          const d = new Date();
          d.setDate(d.getDate() + days);
          dueAt = d.toISOString();
        }

        // Resolve assignee
        const assignMode = node.data?.assignMode || 'assigned_user';
        let assigneeUserId: string | null = null;
        if (assignMode === 'assigned_user') {
          assigneeUserId = contact.assigned_to || null;
        } else if (assignMode === 'specific_user') {
          assigneeUserId = node.data?.assigneeUserId || null;
        }

        // Resolve created_by: prefer assignee, else contact.assigned_to, else first org owner
        let createdBy: string | null = assigneeUserId || contact.assigned_to || null;
        if (!createdBy) {
          const { data: owner } = await supabase
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', contact.organization_id)
            .in('role', ['owner', 'admin'])
            .order('role', { ascending: true })
            .limit(1)
            .maybeSingle();
          createdBy = owner?.user_id || null;
        }

        if (!createdBy) {
          console.log('[AutomationEngine] createTask: could not resolve created_by, skipping');
          return { continue: true };
        }

        const { data: task, error: taskErr } = await supabase
          .from('tasks')
          .insert({
            organization_id: contact.organization_id,
            project_id: projectId,
            area_id: areaId,
            contact_id: linkContact ? contact.id : null,
            title,
            description,
            priority,
            status: 'todo',
            due_at: dueAt,
            created_by: createdBy,
          })
          .select('id')
          .single();

        if (taskErr) {
          console.error('[AutomationEngine] createTask insert error:', taskErr);
          return { continue: true };
        }

        if (assigneeUserId && task?.id) {
          const { error: assignErr } = await supabase
            .from('task_assignees')
            .insert({ task_id: task.id, user_id: assigneeUserId });
          if (assignErr) {
            console.error('[AutomationEngine] createTask assignee error:', assignErr);
          }
        }

        console.log(`[AutomationEngine] createTask: created task ${task?.id} for contact ${contact.id} (assignee=${assigneeUserId || 'none'})`);
      } catch (err) {
        console.error('[AutomationEngine] createTask error:', err);
      }
      return { continue: true };
    }

    case 'notify_manager': {
      try {
        const eventType = node.data?.notifyEventType || 'automation_trigger';
        const rawContext = node.data?.context || '';
        const context = rawContext
          ? await replaceVariables(rawContext, contact, contact.flow_context, supabase)
          : `Automação acionada para ${contact.name || contact.phone}`;

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const notifyRes = await fetch(`${supabaseUrl}/functions/v1/system-agent-notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            organization_id: contact.organization_id,
            contact_id: contact.id,
            event_type: eventType,
            context,
          }),
        });

        const notifyBody = await notifyRes.text();
        if (!notifyRes.ok) {
          console.error(`[AutomationEngine] notify_manager failed: ${notifyRes.status}`, notifyBody);
        } else {
          console.log(`[AutomationEngine] notify_manager sent for contact ${contact.id}:`, notifyBody);
        }
      } catch (err) {
        console.error('[AutomationEngine] notify_manager error:', err);
      }
      return { continue: true };
    }

    case 'analyzeConversation': {
      const agentId = node.data?.agentId;
      const contextMessages = node.data?.contextMessages || 20;
      const additionalPrompt = node.data?.additionalPrompt || '';

      // Get org's OpenAI API key
      const { openaiApiKey, keySource } = await resolveOpenAiKey(supabase, contact.organization_id);

      if (!openaiApiKey) {
        console.log('[AutomationEngine] No OpenAI API key configured, skipping analysis');
        return { continue: true };
      }
      console.log(`[AutomationEngine] Using OpenAI key source "${keySource}" for org ${contact.organization_id}`);

      // Get agent config if specified
      let systemPrompt = 'Você é um analista de conversas. Analise o histórico e execute ações conforme necessário.';
      if (agentId) {
        const { data: agent } = await supabase
          .from('ai_agents')
          .select('system_prompt, about_company, faq_content')
          .eq('id', agentId)
          .single();
        if (agent) {
          systemPrompt = agent.system_prompt;
          if (agent.about_company) systemPrompt += `\n\nSobre a empresa: ${agent.about_company}`;
          if (agent.faq_content) systemPrompt += `\n\nFAQ: ${agent.faq_content}`;
        }
      }
      if (additionalPrompt) {
        systemPrompt += `\n\nInstruções adicionais: ${additionalPrompt}`;
      }

      // Get recent messages with transcriptions
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('content, message_type, direction, transcription, created_at')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(contextMessages);

      const chatHistory = (recentMessages || []).reverse().map((m: any) => {
        let content = m.content || '';
        if (m.transcription) {
          content = m.message_type === 'audio'
            ? `[Áudio transcrito]: ${m.transcription}`
            : `[${m.message_type} - descrição]: ${m.transcription}`;
        } else if (!content && m.message_type !== 'text') {
          content = `[${m.message_type}]`;
        }
        return { role: m.direction === 'inbound' ? 'user' : 'assistant', content };
      });

      // Get available tags for tool calling
      const { data: orgTags } = await supabase
        .from('tags')
        .select('name')
        .eq('organization_id', contact.organization_id);

      const { data: orgStages } = await supabase
        .from('funnel_stages')
        .select('name, slug, pipeline_id')
        .eq('organization_id', contact.organization_id)
        .order('position');

      // Get available automations for trigger_automation tool
      const { data: availableAutomations } = await supabase
        .from('automations')
        .select('id, name')
        .eq('organization_id', contact.organization_id)
        .eq('is_active', true);

      const tools: any[] = [
        {
          type: 'function',
          function: {
            name: 'add_tag',
            description: 'Adiciona uma tag ao contato',
            parameters: {
              type: 'object',
              properties: { tag_name: { type: 'string', description: 'Nome da tag' } },
              required: ['tag_name'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'remove_tag',
            description: 'Remove uma tag do contato',
            parameters: {
              type: 'object',
              properties: { tag_name: { type: 'string', description: 'Nome da tag' } },
              required: ['tag_name'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'move_funnel_stage',
            description: 'Move o contato para uma etapa do funil de vendas',
            parameters: {
              type: 'object',
              properties: { stage_name: { type: 'string', description: 'Nome da etapa' } },
              required: ['stage_name'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'move_kanban_column',
            description: 'Move o contato para uma coluna do Kanban',
            parameters: {
              type: 'object',
              properties: { column_name: { type: 'string', description: 'Nome da coluna' } },
              required: ['column_name'],
            },
          },
        },
      ];

      // Add trigger_automation tool if there are active automations
      if (availableAutomations && availableAutomations.length > 0) {
        const autoDesc = availableAutomations.map((a: any) => `- "${a.name}" (id: ${a.id})`).join('\n');
        tools.push({
          type: 'function',
          function: {
            name: 'trigger_automation',
            description: `Dispara uma automação/fluxo para o contato. Automações disponíveis:\n${autoDesc}`,
            parameters: {
              type: 'object',
              properties: {
                automation_id: { type: 'string', enum: availableAutomations.map((a: any) => a.id), description: 'ID da automação a ser disparada' },
              },
              required: ['automation_id'],
            },
          },
        });
      }

      const contextInfo = [
        `Tags disponíveis: ${(orgTags || []).map((t: any) => t.name).join(', ') || 'nenhuma'}`,
        `Etapas do funil: ${(orgStages || []).map((s: any) => s.name).join(', ') || 'nenhuma'}`,
        `Nome do contato: ${contact.name}`,
        `Telefone: ${contact.phone}`,
      ].join('\n');

      const messages = [
        { role: 'system', content: `${systemPrompt}\n\nContexto:\n${contextInfo}` },
        ...chatHistory,
        { role: 'user', content: 'Analise a conversa acima e execute as ações necessárias usando as ferramentas disponíveis.' },
      ];

      // Call OpenAI with tool calling - loop until no more tool calls
      let maxToolLoops = 5;
      let currentMessages = [...messages];

      while (maxToolLoops > 0) {
        maxToolLoops--;

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: currentMessages,
            tools,
            tool_choice: 'auto',
          }),
        });

        if (!aiResponse.ok) {
          console.error(`[AutomationEngine] OpenAI error: ${aiResponse.status}`);
          break;
        }

        const aiData = await aiResponse.json();
        const choice = aiData.choices?.[0];
        if (!choice) break;

        const assistantMessage = choice.message;
        currentMessages.push(assistantMessage);

        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
          console.log(`[AutomationEngine] Analysis complete. AI response: ${assistantMessage.content?.substring(0, 200)}`);
          break;
        }

        // Execute tool calls
        for (const toolCall of assistantMessage.tool_calls) {
          const fn = toolCall.function;
          let args: any = {};
          try { args = JSON.parse(fn.arguments); } catch {}

          let result = 'ok';
          switch (fn.name) {
            case 'add_tag':
              await manageTag(supabase, contact.organization_id, contact.id, args.tag_name, 'add');
              result = `Tag "${args.tag_name}" adicionada`;
              break;
            case 'remove_tag':
              await manageTag(supabase, contact.organization_id, contact.id, args.tag_name, 'remove');
              result = `Tag "${args.tag_name}" removida`;
              break;
            case 'move_funnel_stage': {
              const stage = (orgStages || []).find((s: any) => s.name.toLowerCase() === args.stage_name?.toLowerCase());
              if (stage) {
                await supabase.from('contacts').update({ funnel_stage: stage.slug, pipeline_id: stage.pipeline_id }).eq('id', contact.id);
                result = `Movido para etapa "${stage.name}"`;
              } else {
                result = `Etapa "${args.stage_name}" não encontrada`;
              }
              break;
            }
            case 'move_kanban_column':
              await moveToColumn(supabase, contact.organization_id, contact.id, args.column_name);
              result = `Movido para coluna "${args.column_name}"`;
              break;
            case 'trigger_automation': {
              const targetAutomationId = args.automation_id;
              console.log(`[AutomationEngine] AnalyzeConversation triggering automation ${targetAutomationId} for contact ${contact.id}`);
              const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
              const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
              await fetch(`${supabaseUrl}/functions/v1/automation-engine`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                body: JSON.stringify({
                  contact_id: contact.id,
                  organization_id: contact.organization_id,
                  event_type: 'manual_trigger',
                  automation_id: targetAutomationId,
                  message_content: '',
                }),
              });
              result = `Automação disparada com sucesso`;
              break;
            }
          }

          console.log(`[AutomationEngine] Tool ${fn.name}: ${result}`);
          currentMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
        }
      }

      return { continue: true };
    }

    case 'scheduleMessage': {
      const message = node.data?.message || '';
      const offsetDays = node.data?.offsetDays || 1;

      if (!message) {
        console.log('[AutomationEngine] No message content for scheduleMessage');
        return { continue: true };
      }

      // Process variables
      const processedMessage = await replaceVariables(message, contact, contact.flow_context, supabase);

      // Call RPC to get scheduled date
      const { data: scheduledAt, error: rpcError } = await supabase
        .rpc('get_next_open_slot', { 
          p_organization_id: contact.organization_id, 
          p_offset_days: offsetDays 
        });

      if (rpcError || !scheduledAt) {
        console.error('[AutomationEngine] Error getting next open slot:', rpcError);
        return { continue: true };
      }

      // Insert into scheduled_messages
      const { error: insertError } = await supabase
        .from('scheduled_messages')
        .insert({
          contact_id: contact.id,
          organization_id: contact.organization_id,
          message_content: processedMessage,
          scheduled_at: scheduledAt,
          scheduled_by: contact.assigned_to || '00000000-0000-0000-0000-000000000000',
          status: 'pending',
        });

      if (insertError) {
        console.error('[AutomationEngine] Error scheduling message:', insertError);
      } else {
        console.log(`[AutomationEngine] Message scheduled for ${scheduledAt} (${offsetDays} business days)`);
      }

      return { continue: true };
    }

    case 'moveFunnelStage': {
      const targetStageName = node.data?.stageName as string | undefined;
      const targetStageSlug = node.data?.stageSlug as string | undefined;
      const targetPipelineId = node.data?.pipelineId as string | undefined;
      if (!targetStageName && !targetStageSlug) {
        console.log('[AutomationEngine] moveFunnelStage missing stage');
        return { continue: true };
      }
      let stage: any = null;
      const baseSelect = 'id, slug, name, pipeline_id, stage_type, auto_close_conversation';
      if (targetStageSlug) {
        let q = supabase
          .from('funnel_stages')
          .select(baseSelect)
          .eq('organization_id', contact.organization_id)
          .eq('slug', targetStageSlug);
        if (targetPipelineId) q = q.eq('pipeline_id', targetPipelineId);
        const { data } = await q.maybeSingle();
        stage = data;
      }
      if (!stage && targetStageName) {
        let q = supabase
          .from('funnel_stages')
          .select(baseSelect)
          .eq('organization_id', contact.organization_id)
          .ilike('name', targetStageName);
        if (targetPipelineId) q = q.eq('pipeline_id', targetPipelineId);
        const { data } = await q.maybeSingle();
        stage = data;
      }
      if (!stage) {
        console.log(`[AutomationEngine] moveFunnelStage: stage not found (${targetStageName ?? targetStageSlug})`);
        return { continue: true };
      }

      // Read previous stage + pipeline for exit trigger
      const { data: prevContact } = await supabase
        .from('contacts')
        .select('funnel_stage, pipeline_id')
        .eq('id', contact.id)
        .maybeSingle();
      let prevStageName: string | null = null;
      const prevPipelineId: string | null = prevContact?.pipeline_id ?? null;
      if (prevContact?.funnel_stage && prevContact.funnel_stage !== stage.slug) {
        const { data: prev } = await supabase
          .from('funnel_stages')
          .select('name')
          .eq('organization_id', contact.organization_id)
          .eq('slug', prevContact.funnel_stage)
          .maybeSingle();
        prevStageName = prev?.name ?? null;
      }

      // Build update payload with stage-driven side effects
      const stageUpdates: any = {
        funnel_stage: stage.slug,
        pipeline_id: stage.pipeline_id,
      };
      if (stage.stage_type === 'won') {
        stageUpdates.sale_result = 'won';
        stageUpdates.status = 'closed';
        stageUpdates.closed_at = new Date().toISOString();
      } else if (stage.stage_type === 'lost') {
        stageUpdates.sale_result = 'lost';
        stageUpdates.status = 'closed';
        stageUpdates.closed_at = new Date().toISOString();
      } else if (stage.auto_close_conversation) {
        stageUpdates.status = 'closed';
        stageUpdates.closed_at = new Date().toISOString();
      }

      await supabase
        .from('contacts')
        .update(stageUpdates)
        .eq('id', contact.id);

      const crossPipeline = prevPipelineId && prevPipelineId !== stage.pipeline_id;
      console.log(`[AutomationEngine] moveFunnelStage: contact ${contact.id} -> "${stage.name}"${crossPipeline ? ` (funnel: ${prevPipelineId} -> ${stage.pipeline_id})` : ''}`);

      // Recursively trigger stage exit + entry automations
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` };

      if (prevStageName) {
        fetch(`${supabaseUrl}/functions/v1/automation-engine`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            contact_id: contact.id,
            organization_id: contact.organization_id,
            event_type: 'funnel_stage_exit',
            funnel_stage_name: prevStageName,
            pipeline_id: prevPipelineId,
          }),
        }).catch(() => {});
      }
      fetch(`${supabaseUrl}/functions/v1/automation-engine`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contact_id: contact.id,
          organization_id: contact.organization_id,
          event_type: 'funnel_stage_change',
          funnel_stage_name: stage.name,
          pipeline_id: stage.pipeline_id,
        }),
      }).catch(() => {});

      return { continue: true };
    }

    case 'setDealValue': {
      const operation = (node.data?.operation as string) || 'set'; // set | add | multiply
      const rawValue = node.data?.value;
      const processed = typeof rawValue === 'string'
        ? await replaceVariables(rawValue, contact, contact.flow_context, supabase)
        : String(rawValue ?? '');
      const numeric = parseFloat(processed.replace(/[^\d.,-]/g, '').replace(',', '.'));
      if (isNaN(numeric)) {
        console.log(`[AutomationEngine] setDealValue: invalid value "${processed}"`);
        return { continue: true };
      }

      const { data: cur } = await supabase
        .from('contacts')
        .select('deal_value')
        .eq('id', contact.id)
        .maybeSingle();
      const current = Number(cur?.deal_value || 0);

      let next = numeric;
      if (operation === 'add') next = current + numeric;
      else if (operation === 'multiply') next = current * numeric;

      await supabase.from('contacts').update({ deal_value: next }).eq('id', contact.id);
      console.log(`[AutomationEngine] setDealValue: contact ${contact.id} ${operation} ${numeric} = ${next}`);
      return { continue: true };
    }

    case 'setSaleResult': {
      const result = node.data?.result as 'won' | 'lost' | undefined;
      if (result !== 'won' && result !== 'lost') {
        console.log('[AutomationEngine] setSaleResult: missing/invalid result');
        return { continue: true };
      }
      const lossReasonRaw = node.data?.lossReason as string | undefined;
      const lossReason = result === 'lost' && lossReasonRaw
        ? await replaceVariables(lossReasonRaw, contact, contact.flow_context, supabase)
        : null;

      const updates: Record<string, any> = { sale_result: result };
      if (result === 'lost' && lossReason) updates.loss_reason = lossReason;

      await supabase.from('contacts').update(updates).eq('id', contact.id);
      console.log(`[AutomationEngine] setSaleResult: contact ${contact.id} -> ${result}`);

      // Fire deal_won / deal_lost recursive trigger
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      fetch(`${supabaseUrl}/functions/v1/automation-engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({
          contact_id: contact.id,
          organization_id: contact.organization_id,
          event_type: result === 'won' ? 'deal_won' : 'deal_lost',
        }),
      }).catch(() => {});

      return { continue: true };
    }

    default:
      console.log(`[AutomationEngine] Unknown node type: ${node.type}`);
      return { continue: true };
  }
}

// Main flow processor
async function processFlow(
  supabase: any,
  contact: Contact,
  flowData: FlowData,
  startNodeId: string,
  messageContent: string
): Promise<void> {
  let currentNodeId: string | null = startNodeId;
  let iterations = 0;
  const maxIterations = 100; // Prevent infinite loops

  while (currentNodeId && iterations < maxIterations) {
    iterations++;

    const node = findNode(flowData.nodes, currentNodeId);
    if (!node) {
      console.log(`[AutomationEngine] Node not found: ${currentNodeId}`);
      break;
    }

    const result = await executeNode(supabase, node, contact, messageContent, flowData);

    // Handle pause until (delay)
    if (result.pauseUntil) {
      // Find next node for when we resume
      const nextNodes = findNextNodes(flowData.edges, currentNodeId);
      const nextNodeId = nextNodes[0] || null;

      // Save the resume_at timestamp and next node ID
      await supabase
        .from('contacts')
        .update({
          current_node_id: nextNodeId,
          resume_at: result.pauseUntil.toISOString(),
        })
        .eq('id', contact.id);

      console.log(`[AutomationEngine] Flow paused until ${result.pauseUntil.toISOString()}, will resume at node: ${nextNodeId}`);
      return;
    }

    // Handle wait for response (includes saveResponse node)
    if (result.waitForResponse && result.responseTimeout) {
      // Store current node so we know where to branch from when user responds
      // Also store the variable name if this is a saveResponse node
      const updateData: Record<string, any> = {
        current_node_id: currentNodeId,
        waiting_response: true,
        waiting_response_timeout: result.responseTimeout.toISOString(),
      };
      
      // If saveVariableName exists, store it in flow_context
      if (result.saveVariableName) {
        updateData.flow_context = { 
          ...contact.flow_context, 
          pending_variable_name: result.saveVariableName 
        };
      }
      
      await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', contact.id);

      console.log(`[AutomationEngine] Waiting for response${result.saveVariableName ? ` to save as "${result.saveVariableName}"` : ''}, timeout at ${result.responseTimeout.toISOString()}`);
      return;
    }

    // Handle connect to another flow
    if (result.connectToFlow) {
      // Get the target automation
      const { data: targetAutomation } = await supabase
        .from('automations')
        .select('id, flow_data')
        .eq('id', result.connectToFlow)
        .eq('is_active', true)
        .single();

      if (!targetAutomation?.flow_data) {
        console.log(`[AutomationEngine] Target flow not found or inactive: ${result.connectToFlow}`);
        // End current flow
        await supabase
          .from('contacts')
          .update({
            active_flow_id: null,
            current_node_id: null,
            flow_context: {},
            resume_at: null,
            waiting_response: false,
            waiting_response_timeout: null,
          })
          .eq('id', contact.id);
        return;
      }

      const targetFlowData = targetAutomation.flow_data as FlowData;
      
      let startNodeId: string | null = null;
      
      // First, try to find a trigger node in target flow
      const triggerNode = targetFlowData.nodes.find(n => n.type === 'trigger');
      if (triggerNode) {
        // Find first node after trigger
        const nextNodes = findNextNodes(targetFlowData.edges, triggerNode.id);
        if (nextNodes.length > 0) {
          startNodeId = nextNodes[0];
        }
      }
      
      // If no trigger or no nodes after trigger, find the first "root" node
      // (a node that is not a target of any edge, excluding trigger nodes)
      if (!startNodeId) {
        const targetNodeIds = new Set(targetFlowData.edges.map(e => e.target));
        const rootNodes = targetFlowData.nodes.filter(n => 
          n.type !== 'trigger' && !targetNodeIds.has(n.id)
        );
        
        if (rootNodes.length > 0) {
          // Pick the first root node (ideally the one positioned topmost)
          rootNodes.sort((a, b) => a.position.y - b.position.y);
          startNodeId = rootNodes[0].id;
          console.log(`[AutomationEngine] No trigger found, using root node: ${startNodeId}`);
        } else {
          // Fallback: just use the first non-trigger node
          const firstNode = targetFlowData.nodes.find(n => n.type !== 'trigger');
          if (firstNode) {
            startNodeId = firstNode.id;
            console.log(`[AutomationEngine] Using first non-trigger node: ${startNodeId}`);
          }
        }
      }

      if (!startNodeId) {
        console.log('[AutomationEngine] Target flow has no executable nodes');
        return;
      }

      // Update contact to new flow
      await supabase
        .from('contacts')
        .update({
          active_flow_id: targetAutomation.id,
          current_node_id: startNodeId,
          flow_context: { ...contact.flow_context, connected_from_flow: contact.active_flow_id },
          resume_at: null,
          waiting_response: false,
          waiting_response_timeout: null,
        })
        .eq('id', contact.id);

      console.log(`[AutomationEngine] Connected to flow ${targetAutomation.id}, starting at node ${startNodeId}`);

      // Refresh contact and process new flow
      const { data: refreshedContact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contact.id)
        .single();

      if (refreshedContact) {
        await processFlow(supabase, refreshedContact, targetFlowData, startNodeId, messageContent);
      }
      return;
    }

    if (!result.continue) {
      break;
    }

    // Find next node(s)
    const nextNodes = findNextNodes(flowData.edges, currentNodeId, result.nextHandle);
    
    if (nextNodes.length === 0) {
      // Flow complete
      console.log('[AutomationEngine] Flow completed');
      await supabase
        .from('contacts')
        .update({
          active_flow_id: null,
          current_node_id: null,
          flow_context: {},
          resume_at: null,
        })
        .eq('id', contact.id);
      return;
    }

    // Take first next node (for branching, we pick the matched path)
    currentNodeId = nextNodes[0];

    // Update current position
    await supabase
      .from('contacts')
      .update({ current_node_id: currentNodeId })
      .eq('id', contact.id);

    // Refresh contact data
    const { data: updatedContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contact.id)
      .single();

    if (updatedContact) {
      contact = updatedContact;
    }
  }

  if (iterations >= maxIterations) {
    console.error('[AutomationEngine] Max iterations reached, stopping flow');
    await supabase
      .from('contacts')
      .update({
        active_flow_id: null,
        current_node_id: null,
        flow_context: {},
        resume_at: null,
      })
      .eq('id', contact.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload: AutomationEnginePayload = await req.json();
    const { contact_id, organization_id, message_content, message_type, event_type, tag_name, resume_from_node_id, automation_id, funnel_stage_name, form_id, calendar_id, pipeline_id: payloadPipelineId, payment_integration_id, purchase_event, initial_context } = payload as any;

    console.log(`[AutomationEngine] Processing event: ${event_type} for contact: ${contact_id}${funnel_stage_name ? ` (funnel: ${funnel_stage_name})` : ''}`);

    // Get contact with flow state
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .single();

    if (contactError || !contact) {
      console.error('[AutomationEngine] Contact not found:', contactError);
      return new Response(
        JSON.stringify({ error: 'Contact not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 0: Check if contact has automations paused (immune to all automations)
    if (contact.automations_paused === true) {
      console.log(`[AutomationEngine] Contact has automations paused, skipping all automations`);
      return new Response(
        JSON.stringify({ success: true, message: 'Contact has automations paused' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 1: Handle resume_delay event
    if (event_type === 'resume_delay') {
      console.log(`[AutomationEngine] Resuming flow for contact: ${contact_id}`);
      
      if (!contact.active_flow_id) {
        console.log('[AutomationEngine] No active flow to resume');
        return new Response(
          JSON.stringify({ success: true, message: 'No active flow to resume' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get the automation
      const { data: automation } = await supabase
        .from('automations')
        .select('flow_data')
        .eq('id', contact.active_flow_id)
        .single();

      if (!automation?.flow_data) {
        console.error('[AutomationEngine] Automation not found for resume');
        return new Response(
          JSON.stringify({ error: 'Automation not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const flowData = automation.flow_data as FlowData;
      const nodeToResume = resume_from_node_id || contact.current_node_id;

      if (!nodeToResume) {
        console.log('[AutomationEngine] No node to resume from');
        return new Response(
          JSON.stringify({ success: true, message: 'No node to resume from' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Process the flow from the resumed node
      await processFlow(supabase, contact, flowData, nodeToResume, message_content || '');

      return new Response(
        JSON.stringify({ success: true, message: 'Flow resumed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 1.5: Handle manual_trigger event - start a specific automation without trigger matching
    if (event_type === 'manual_trigger' && automation_id) {
      console.log(`[AutomationEngine] Manual trigger for automation: ${automation_id}`);
      
      // Check if contact is already in a flow
      if (contact.active_flow_id) {
        console.log('[AutomationEngine] Contact already in a flow, cannot start new one');
        return new Response(
          JSON.stringify({ error: 'Contato já está em um fluxo ativo. Resete o fluxo antes de iniciar outro.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Get the specified automation
      const { data: automation, error: automationError } = await supabase
        .from('automations')
        .select('id, flow_data, is_active')
        .eq('id', automation_id)
        .eq('organization_id', organization_id)
        .single();
      
      if (automationError || !automation) {
        console.error('[AutomationEngine] Automation not found:', automationError);
        return new Response(
          JSON.stringify({ error: 'Automação não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!automation.is_active) {
        return new Response(
          JSON.stringify({ error: 'Automação está desativada' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const flowData = automation.flow_data as FlowData;
      if (!flowData?.nodes || !flowData?.edges || flowData.nodes.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Automação não possui nós configurados' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Find the first executable node (skip trigger if exists, or use root/first node)
      const triggerNode = flowData.nodes.find(n => n.type === 'trigger');
      let startNodeId: string;
      
      if (triggerNode) {
        // Find the node connected to the trigger
        const nextNodes = findNextNodes(flowData.edges, triggerNode.id);
        if (nextNodes.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Nenhum nó conectado ao gatilho da automação' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        startNodeId = nextNodes[0];
      } else {
        // No trigger node, find a root node (node with no incoming edges)
        const targetIds = new Set(flowData.edges.map(e => e.target));
        const rootNode = flowData.nodes.find(n => !targetIds.has(n.id));
        if (!rootNode) {
          // Fallback to first node
          startNodeId = flowData.nodes[0].id;
        } else {
          startNodeId = rootNode.id;
        }
      }
      
      // Set contact into this flow
      await supabase
        .from('contacts')
        .update({
          active_flow_id: automation.id,
          current_node_id: startNodeId,
          flow_context: {},
          waiting_response: false,
          waiting_response_timeout: null,
        })
        .eq('id', contact_id);
      
      // Process the flow
      const updatedContact = { ...contact, active_flow_id: automation.id, current_node_id: startNodeId, flow_context: {} };
      await processFlow(supabase, updatedContact, flowData, startNodeId, '');
      
      return new Response(
        JSON.stringify({ success: true, message: 'Automação iniciada manualmente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 2: Check if contact is already in a flow
    if (contact.active_flow_id) {
      console.log(`[AutomationEngine] Contact is in active flow: ${contact.active_flow_id}`);
      
      // Get the automation
      const { data: automation } = await supabase
        .from('automations')
        .select('flow_data')
        .eq('id', contact.active_flow_id)
        .single();

      if (automation?.flow_data) {
        const flowData = automation.flow_data as FlowData;
        
        // Check if waiting for user response
        if (contact.waiting_response && contact.current_node_id) {
          const waitNode = findNode(flowData.nodes, contact.current_node_id);
          if (waitNode && (waitNode.type === 'waitResponse' || waitNode.type === 'saveResponse')) {
            // Check if timeout has passed
            const timedOut = contact.waiting_response_timeout && 
              new Date(contact.waiting_response_timeout) < new Date();
            
            if (timedOut) {
              console.log(`[AutomationEngine] User responded AFTER timeout, routing to timeout branch`);
            } else {
              console.log(`[AutomationEngine] User responded WITHIN timeout, routing to responded branch`);
            }
            
            // Prepare updated flow context
            const updatedContext = { 
              ...contact.flow_context, 
              last_response: message_content,
              _messageType: message_type || contact.flow_context?._messageType || 'text',
            };
            
            // If there's a pending variable name (from saveResponse node), save the response to that variable
            const pendingVarName = contact.flow_context?.pending_variable_name;
            if (pendingVarName && message_content) {
              console.log(`[AutomationEngine] Saving response to variable: {${pendingVarName}}`);
              updatedContext[pendingVarName] = message_content;
              
              // Also save to contact_custom_fields table for persistent storage and conditions
              try {
                // Upsert the custom field (insert or update if exists)
                const { error: upsertError } = await supabase
                  .from('contact_custom_fields')
                  .upsert(
                    {
                      contact_id: contact_id,
                      organization_id: organization_id,
                      field_name: pendingVarName,
                      field_value: message_content,
                      updated_at: new Date().toISOString(),
                    },
                    { 
                      onConflict: 'contact_id,field_name',
                      ignoreDuplicates: false
                    }
                  );
                
                if (upsertError) {
                  console.error(`[AutomationEngine] Error saving custom field: ${upsertError.message}`);
                } else {
                  console.log(`[AutomationEngine] Custom field "${pendingVarName}" saved to database`);
                }
              } catch (err) {
                console.error(`[AutomationEngine] Exception saving custom field:`, err);
              }
              
              // Clean up the pending variable marker
              delete updatedContext.pending_variable_name;
            }
            
            // Clear waiting state
            await supabase
              .from('contacts')
              .update({
                waiting_response: false,
                waiting_response_timeout: null,
                flow_context: updatedContext,
              })
              .eq('id', contact_id);
            
            // Update local contact reference
            contact.flow_context = updatedContext;
            
            // Route to appropriate branch based on timeout
            const branchHandle = timedOut ? 'timeout' : 'responded';
            const nextNodes = findNextNodes(flowData.edges, contact.current_node_id, branchHandle);
            
            if (nextNodes.length > 0) {
              await processFlow(supabase, contact, flowData, nextNodes[0], message_content || '');
            } else {
              console.log(`[AutomationEngine] No "${branchHandle}" branch connected, ending flow`);
              await supabase
                .from('contacts')
                .update({
                  active_flow_id: null,
                  current_node_id: null,
                  flow_context: {},
                })
                .eq('id', contact_id);
            }
            
            return new Response(
              JSON.stringify({ success: true, message: `User responded (${timedOut ? 'after' : 'within'} timeout)${pendingVarName ? `, saved to {${pendingVarName}}` : ''}` }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        
        // If paused (has resume_at), check if it's time to resume
        if (contact.resume_at) {
          const resumeAt = new Date(contact.resume_at);
          if (resumeAt > new Date()) {
            console.log(`[AutomationEngine] Flow is paused until ${contact.resume_at}, not resuming yet`);
            return new Response(
              JSON.stringify({ success: true, message: 'Flow paused' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          // Clear resume_at and continue
          await supabase
            .from('contacts')
            .update({ resume_at: null })
            .eq('id', contact_id);
        }

        // Recovery: contact is in active flow, not waiting, no resume_at — but the
        // current node IS a wait/save response node. This means a previous timeout
        // run cleared waiting_response without routing. Recover by routing through
        // the timeout branch (or ending the flow) so the contact isn't permanently stuck.
        if (contact.current_node_id) {
          const currentNode = findNode(flowData.nodes, contact.current_node_id);
          if (currentNode && (currentNode.type === 'waitResponse' || currentNode.type === 'saveResponse')) {
            console.log(`[AutomationEngine] Recovering stuck contact at ${currentNode.type} node ${contact.current_node_id}`);
            const timeoutNodes = findNextNodes(flowData.edges, contact.current_node_id, 'timeout');
            const respondedNodes = findNextNodes(flowData.edges, contact.current_node_id, 'responded');
            const nextNodes = respondedNodes.length > 0 ? respondedNodes : timeoutNodes;

            const updatedContext = {
              ...contact.flow_context,
              last_response: message_content,
              _messageType: message_type || contact.flow_context?._messageType || 'text',
            };

            await supabase
              .from('contacts')
              .update({ waiting_response: false, waiting_response_timeout: null, flow_context: updatedContext })
              .eq('id', contact_id);
            contact.flow_context = updatedContext;

            if (nextNodes.length > 0) {
              await processFlow(supabase, contact, flowData, nextNodes[0], message_content || '');
            } else {
              await supabase
                .from('contacts')
                .update({ active_flow_id: null, current_node_id: null, flow_context: {} })
                .eq('id', contact_id);
            }
            return new Response(
              JSON.stringify({ success: true, message: 'Recovered stuck flow' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // For message_received events: don't re-trigger if contact is in an active flow
        // (prevents infinite loops). For tag_added, funnel_stage_change, and other events,
        // fall through to STEP 3 so those triggers can still fire a new automation.
        if (event_type === 'message_received') {
          console.log(`[AutomationEngine] Contact is in active flow but not waiting for response. Ignoring message to prevent loop.`);
          return new Response(
            JSON.stringify({ success: true, message: 'Contact in flow, not waiting for response' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log(`[AutomationEngine] Contact is in active flow but event is "${event_type}", falling through to trigger matching.`);
      }
    }

    // STEP 3: Check for matching triggers in active automations (ordered by priority DESC)
    const { data: automations } = await supabase
      .from('automations')
      .select('id, flow_data, priority')
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (!automations || automations.length === 0) {
      console.log('[AutomationEngine] No active automations found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active automations' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find ALL matching triggers across all automations (supports multiple triggers per automation)
    let matchFound = false;

    for (const automation of automations) {
      const flowData = automation.flow_data as FlowData;
      if (!flowData?.nodes || !flowData?.edges) continue;

      // Find ALL trigger nodes in this automation (not just the first one)
      const triggerNodes = flowData.nodes.filter(n => n.type === 'trigger');
      if (triggerNodes.length === 0) continue;

      for (const triggerNode of triggerNodes) {
        // Check if this trigger matches
        if (checkTriggerMatch(triggerNode, event_type, message_content, tag_name, funnel_stage_name, message_type, form_id, calendar_id, payloadPipelineId || contact.pipeline_id, contact, payment_integration_id, purchase_event)) {
          console.log(`[AutomationEngine] Trigger "${triggerNode.id}" matched for automation: ${automation.id}`);

          // Find first node after this specific trigger
          const nextNodes = findNextNodes(flowData.edges, triggerNode.id);
          if (nextNodes.length === 0) {
            console.log(`[AutomationEngine] No nodes connected to trigger ${triggerNode.id}`);
            continue;
          }

          const startNodeId = nextNodes[0];

          // Set contact into the flow
          await supabase
            .from('contacts')
            .update({
              active_flow_id: automation.id,
              current_node_id: startNodeId,
              flow_context: { trigger_message: message_content || '', _messageType: message_type || 'text', ...(initial_context || {}) },
              resume_at: null,
            })
            .eq('id', contact_id);

          // Refresh contact
          contact.active_flow_id = automation.id;
          contact.current_node_id = startNodeId;
          contact.flow_context = { trigger_message: message_content || '', _messageType: message_type || 'text', ...(initial_context || {}) };

          // Start processing from this trigger's connected node
          await processFlow(supabase, contact, flowData, startNodeId, message_content || '');

          matchFound = true;
          // Once a trigger matches within an automation, don't check other triggers in the same automation
          break;
        }
      }

      // Once an automation matched, stop checking others (priority-based)
      if (matchFound) break;
    }

    if (matchFound) {
      return new Response(
        JSON.stringify({ success: true, message: 'Automation started' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AutomationEngine] No matching trigger found');
    return new Response(
      JSON.stringify({ success: true, message: 'No matching trigger' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AutomationEngine] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
