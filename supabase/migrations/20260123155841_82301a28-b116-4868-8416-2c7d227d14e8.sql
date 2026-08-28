-- Internal Chat System Tables

-- Table for internal chat conversations (1:1 and groups)
CREATE TABLE public.internal_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT, -- NULL for 1:1 chats, set for groups
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for conversation participants
CREATE TABLE public.internal_conversation_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.internal_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_admin BOOLEAN NOT NULL DEFAULT false, -- For group admins
  UNIQUE(conversation_id, user_id)
);

-- Table for internal messages
CREATE TABLE public.internal_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.internal_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text', -- text, image, document, audio, video
  media_url TEXT,
  mentioned_user_ids UUID[] DEFAULT '{}',
  quoted_message_id UUID REFERENCES public.internal_messages(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for internal_conversations
CREATE POLICY "Users can view conversations they participate in"
ON public.internal_conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.internal_conversation_participants p
    WHERE p.conversation_id = id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create conversations in their organization"
ON public.internal_conversations FOR INSERT
WITH CHECK (
  user_belongs_to_org(auth.uid(), organization_id) AND created_by = auth.uid()
);

CREATE POLICY "Admins can update group conversations"
ON public.internal_conversations FOR UPDATE
USING (
  (NOT is_group) OR
  EXISTS (
    SELECT 1 FROM public.internal_conversation_participants p
    WHERE p.conversation_id = id AND p.user_id = auth.uid() AND p.is_admin = true
  )
);

-- RLS Policies for internal_conversation_participants
CREATE POLICY "Users can view participants of their conversations"
ON public.internal_conversation_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.internal_conversation_participants p
    WHERE p.conversation_id = internal_conversation_participants.conversation_id 
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add participants to conversations they created or admin"
ON public.internal_conversation_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.internal_conversations c
    WHERE c.id = conversation_id AND c.created_by = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.internal_conversation_participants p
    WHERE p.conversation_id = internal_conversation_participants.conversation_id 
    AND p.user_id = auth.uid() AND p.is_admin = true
  )
);

CREATE POLICY "Users can update their own participant record"
ON public.internal_conversation_participants FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Admins can remove participants from groups"
ON public.internal_conversation_participants FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.internal_conversation_participants p
    WHERE p.conversation_id = internal_conversation_participants.conversation_id 
    AND p.user_id = auth.uid() AND p.is_admin = true
  )
  OR user_id = auth.uid() -- Users can leave conversations
);

-- RLS Policies for internal_messages
CREATE POLICY "Users can view messages in their conversations"
ON public.internal_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.internal_conversation_participants p
    WHERE p.conversation_id = internal_messages.conversation_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages in their conversations"
ON public.internal_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.internal_conversation_participants p
    WHERE p.conversation_id = internal_messages.conversation_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own messages"
ON public.internal_messages FOR UPDATE
USING (sender_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_internal_conversations_org ON public.internal_conversations(organization_id);
CREATE INDEX idx_internal_conversation_participants_user ON public.internal_conversation_participants(user_id);
CREATE INDEX idx_internal_conversation_participants_conv ON public.internal_conversation_participants(conversation_id);
CREATE INDEX idx_internal_messages_conv ON public.internal_messages(conversation_id);
CREATE INDEX idx_internal_messages_sender ON public.internal_messages(sender_id);
CREATE INDEX idx_internal_messages_created ON public.internal_messages(created_at DESC);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_conversation_participants;

-- Trigger to update conversation's last_message_at
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.internal_conversations
  SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_conversation_last_message
AFTER INSERT ON public.internal_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message();