-- Create kanban_columns table (CRM stages)
CREATE TABLE public.kanban_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contacts table (Leads/Customers)
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  kanban_column_id UUID REFERENCES public.kanban_columns(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table (Chat history)
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document')),
  media_url TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_contacts_organization ON public.contacts(organization_id);
CREATE INDEX idx_contacts_last_message ON public.contacts(organization_id, last_message_at DESC);
CREATE INDEX idx_contacts_phone ON public.contacts(organization_id, phone);
CREATE INDEX idx_contacts_kanban ON public.contacts(kanban_column_id);
CREATE INDEX idx_messages_contact ON public.messages(contact_id, created_at DESC);
CREATE INDEX idx_messages_organization ON public.messages(organization_id);
CREATE INDEX idx_kanban_columns_organization ON public.kanban_columns(organization_id, position);

-- Enable RLS on all tables
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kanban_columns
CREATE POLICY "Users can view kanban columns in their organization"
ON public.kanban_columns FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create kanban columns in their organization"
ON public.kanban_columns FOR INSERT
WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update kanban columns in their organization"
ON public.kanban_columns FOR UPDATE
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Owners and admins can delete kanban columns"
ON public.kanban_columns FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.organization_id = kanban_columns.organization_id 
    AND om.role IN ('owner', 'admin')
  )
);

-- RLS Policies for contacts
CREATE POLICY "Users can view contacts in their organization"
ON public.contacts FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create contacts in their organization"
ON public.contacts FOR INSERT
WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update contacts in their organization"
ON public.contacts FOR UPDATE
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can delete contacts in their organization"
ON public.contacts FOR DELETE
USING (user_belongs_to_org(auth.uid(), organization_id));

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their organization"
ON public.messages FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create messages in their organization"
ON public.messages FOR INSERT
WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update messages in their organization"
ON public.messages FOR UPDATE
USING (user_belongs_to_org(auth.uid(), organization_id));

-- Trigger for updated_at on contacts
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Insert default kanban columns for existing organizations
INSERT INTO public.kanban_columns (name, position, organization_id, color)
SELECT 'Novo Lead', 0, id, '#6366f1' FROM public.organizations
UNION ALL
SELECT 'Em Contato', 1, id, '#f59e0b' FROM public.organizations
UNION ALL
SELECT 'Em Negociação', 2, id, '#3b82f6' FROM public.organizations
UNION ALL
SELECT 'Proposta Enviada', 3, id, '#8b5cf6' FROM public.organizations
UNION ALL
SELECT 'Fechado Ganho', 4, id, '#22c55e' FROM public.organizations
UNION ALL
SELECT 'Fechado Perdido', 5, id, '#ef4444' FROM public.organizations;