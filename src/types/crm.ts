export interface KanbanPipeline {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
}

export interface KanbanColumn {
  id: string;
  name: string;
  position: number;
  organization_id: string;
  pipeline_id: string | null;
  color: string | null;
  created_at: string;
}

export interface Tag {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ContactTag {
  id: string;
  contact_id: string;
  tag_id: string;
  created_at: string;
}

export type ContactStatus = 'open' | 'closed' | 'snoozed';
export type FunnelStage = 'lead' | 'negotiation' | 'closed';
export type SaleResult = 'won' | 'lost';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  kanban_column_id: string | null;
  pipeline_id: string | null;
  assigned_to: string | null;
  organization_id: string;
  last_message_at: string | null;
  notes: string | null;
  unread_count: number;
  status: ContactStatus;
  funnel_stage: FunnelStage;
  sale_result: SaleResult | null;
  closed_at: string | null;
  profile_picture_url: string | null;
  // Group fields
  is_group?: boolean;
  group_jid?: string | null;
  // Automation flow state (optional for creation)
  active_flow_id?: string | null;
  current_node_id?: string | null;
  waiting_response?: boolean | null;
  automations_paused?: boolean;
  ai_enabled?: boolean;
  channel?: string;
  // Pipeline / deal fields
  deal_value?: number | null;
  loss_reason?: string | null;
  deal_notes?: string | null;
  // Personal info
  birth_date?: string | null;
  ai_agent_id?: string | null;
  is_archived?: boolean;
  is_pinned?: boolean;
  hidden_from_funnel?: boolean;
  created_at: string;
  updated_at: string;
}

export interface LastMessage {
  content: string | null;
  message_type: MessageType;
  direction: MessageDirection;
  created_at: string;
}

export interface ContactWithColumn extends Contact {
  kanban_columns: KanbanColumn | null;
  profiles: { id: string; full_name: string | null } | null;
  last_message?: LastMessage | null;
  tags?: Tag[];
}

export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'contact' | 'contacts' | 'location' | 'ig_reel' | 'ig_post' | 'ig_story';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  contact_id: string;
  content: string | null;
  message_type: MessageType;
  media_url: string | null;
  direction: MessageDirection;
  status: MessageStatus;
  organization_id: string;
  created_at: string;
  // Quote/reply fields
  quoted_message_id: string | null;
  quoted_content: string | null;
  quoted_type: string | null;
  // Sender tracking
  sent_by_user_id: string | null;
  sent_by_name?: string | null;
  // WhatsApp message ID for deletion/reference
  whatsapp_message_id?: string | null;
  // Forwarding
  is_forwarded?: boolean;
  forwarded_from?: string | null;
  // Group message sender info
  sender_phone?: string | null;
  sender_name?: string | null;
  // AI transcription/description
  transcription?: string | null;
}
