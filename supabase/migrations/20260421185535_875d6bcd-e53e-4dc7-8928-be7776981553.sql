-- Add Resend config columns to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS resend_api_key TEXT,
  ADD COLUMN IF NOT EXISTS resend_from_email TEXT,
  ADD COLUMN IF NOT EXISTS resend_from_name TEXT,
  ADD COLUMN IF NOT EXISTS resend_reply_to TEXT;

-- Create email send history table
CREATE TABLE IF NOT EXISTS public.email_send_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  automation_id UUID REFERENCES public.automations(id) ON DELETE SET NULL,
  triggered_by UUID,
  to_email TEXT NOT NULL,
  from_email TEXT,
  subject TEXT,
  source TEXT NOT NULL DEFAULT 'automation',
  status TEXT NOT NULL,
  resend_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_send_history_org_created
  ON public.email_send_history (organization_id, created_at DESC);

ALTER TABLE public.email_send_history ENABLE ROW LEVEL SECURITY;

-- Members of the organization can view their history
CREATE POLICY "Members can view org email history"
  ON public.email_send_history
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));