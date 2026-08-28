-- =============================================================
-- PAYMENT INTEGRATIONS (webhooks externos: Hotmart, Stripe, etc)
-- =============================================================

CREATE TABLE public.payment_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  platform text NOT NULL DEFAULT 'generic' CHECK (platform IN ('hotmart','stripe','kiwify','eduzz','monetizze','generic')),
  webhook_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  secret text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_integrations_org ON public.payment_integrations(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_integrations TO authenticated;
GRANT ALL ON public.payment_integrations TO service_role;
ALTER TABLE public.payment_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payment integrations" ON public.payment_integrations
  FOR ALL TO authenticated
  USING (public.is_org_admin_or_owner(organization_id))
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE TRIGGER trg_payment_integrations_updated
  BEFORE UPDATE ON public.payment_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- PAYMENT INTEGRATION EVENTS (log de webhooks recebidos)
-- =============================================================

CREATE TABLE public.payment_integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES public.payment_integrations(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform text NOT NULL,
  purchase_event text,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  buyer_name text,
  buyer_phone text,
  buyer_email text,
  product_name text,
  value numeric,
  status text NOT NULL DEFAULT 'processed' CHECK (status IN ('processed','error','rejected')),
  error_message text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_integration_events_org ON public.payment_integration_events(organization_id, created_at DESC);
CREATE INDEX idx_payment_integration_events_integration ON public.payment_integration_events(integration_id, created_at DESC);

GRANT SELECT ON public.payment_integration_events TO authenticated;
GRANT ALL ON public.payment_integration_events TO service_role;
ALTER TABLE public.payment_integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read payment integration events" ON public.payment_integration_events
  FOR SELECT TO authenticated
  USING (public.is_org_admin_or_owner(organization_id));
