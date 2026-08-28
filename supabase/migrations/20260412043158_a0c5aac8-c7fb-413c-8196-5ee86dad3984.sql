
-- Create support_tickets table
CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org tickets" ON public.support_tickets
  FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id) OR is_super_admin());

CREATE POLICY "Members can create tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id) AND created_by = auth.uid());

CREATE POLICY "Super admins can update tickets" ON public.support_tickets
  FOR UPDATE USING (is_super_admin());

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create support_messages table
CREATE TABLE public.support_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text,
  media_url text,
  message_type text NOT NULL DEFAULT 'text',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages of their tickets" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND (user_belongs_to_org(auth.uid(), t.organization_id) OR is_super_admin())
    )
  );

CREATE POLICY "Users can send messages in their tickets" ON public.support_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND (user_belongs_to_org(auth.uid(), t.organization_id) OR is_super_admin())
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('support-media', 'support-media', true);

CREATE POLICY "Anyone can view support media" ON storage.objects
  FOR SELECT USING (bucket_id = 'support-media');

CREATE POLICY "Authenticated users can upload support media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'support-media' AND auth.role() = 'authenticated');
