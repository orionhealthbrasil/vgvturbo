-- Create scheduled_messages table for storing scheduled messages
CREATE TABLE public.scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  scheduled_by UUID NOT NULL,
  message_content TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Policies for scheduled_messages
CREATE POLICY "Users can view scheduled messages in their organization"
ON public.scheduled_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = scheduled_messages.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create scheduled messages in their organization"
ON public.scheduled_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = scheduled_messages.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update scheduled messages in their organization"
ON public.scheduled_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = scheduled_messages.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete scheduled messages in their organization"
ON public.scheduled_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = scheduled_messages.organization_id
    AND om.user_id = auth.uid()
  )
);

-- Index for efficient querying of pending messages
CREATE INDEX idx_scheduled_messages_pending ON public.scheduled_messages(scheduled_at) 
WHERE status = 'pending';