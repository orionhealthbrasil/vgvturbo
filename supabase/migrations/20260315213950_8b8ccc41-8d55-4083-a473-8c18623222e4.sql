
CREATE TABLE public.sla_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  agent_name TEXT,
  assigned_to UUID,
  wait_time_minutes INTEGER NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view SLA notifications in their organization"
  ON public.sla_notifications FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update SLA notifications in their organization"
  ON public.sla_notifications FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Service role can insert SLA notifications"
  ON public.sla_notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sla_notifications;

-- Index for fast queries
CREATE INDEX idx_sla_notifications_org_unread ON public.sla_notifications(organization_id, is_read) WHERE is_read = false;
