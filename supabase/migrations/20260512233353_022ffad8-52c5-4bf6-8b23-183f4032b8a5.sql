CREATE TABLE public.whatsapp_meta_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL UNIQUE,
  display_phone_number text,
  waba_id text,
  business_name text,
  is_active boolean NOT NULL DEFAULT true,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wmi_phone_number_id ON public.whatsapp_meta_instances(phone_number_id);

ALTER TABLE public.whatsapp_meta_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their meta instance"
  ON public.whatsapp_meta_instances FOR SELECT
  USING (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "Admins can insert their meta instance"
  ON public.whatsapp_meta_instances FOR INSERT
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "Admins can update their meta instance"
  ON public.whatsapp_meta_instances FOR UPDATE
  USING (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "Admins can delete their meta instance"
  ON public.whatsapp_meta_instances FOR DELETE
  USING (public.is_org_admin_or_owner(organization_id));

CREATE TRIGGER trg_wmi_updated_at
  BEFORE UPDATE ON public.whatsapp_meta_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();