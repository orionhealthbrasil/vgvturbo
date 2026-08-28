-- Manager AI: phone field on organizations + notification throttle log

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS manager_whatsapp_phone text;

CREATE TABLE IF NOT EXISTS public.manager_notifications_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  summary text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manager_notif_org_contact
  ON public.manager_notifications_log(organization_id, contact_id, created_at DESC);

ALTER TABLE public.manager_notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read manager notifications"
  ON public.manager_notifications_log FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
