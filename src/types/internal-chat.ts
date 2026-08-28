export interface InternalConversation {
  id: string;
  organization_id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

export interface InternalConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
  is_admin: boolean;
}

export interface InternalMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  mentioned_user_ids: string[];
  quoted_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationWithDetails extends InternalConversation {
  participants: ParticipantWithProfile[];
  lastMessage?: InternalMessage;
  unreadCount: number;
}

export interface ParticipantWithProfile extends InternalConversationParticipant {
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  };
}

export interface MessageWithSender extends InternalMessage {
  sender?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  quotedMessage?: InternalMessage;
}
