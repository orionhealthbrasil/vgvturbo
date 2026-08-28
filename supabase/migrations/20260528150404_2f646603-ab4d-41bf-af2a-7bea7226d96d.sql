CREATE TABLE public.loss_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX loss_reasons_org_label_unique
  ON public.loss_reasons (organization_id, lower(label));

CREATE INDEX loss_reasons_org_idx ON public.loss_reasons (organization_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loss_reasons TO authenticated;
GRANT ALL ON public.loss_reasons TO service_role;

ALTER TABLE public.loss_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view loss reasons"
  ON public.loss_reasons FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Org admins can insert loss reasons"
  ON public.loss_reasons FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "Org admins can update loss reasons"
  ON public.loss_reasons FOR UPDATE
  TO authenticated
  USING (public.is_org_admin_or_owner(organization_id))
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "Org admins can delete loss reasons"
  ON public.loss_reasons FOR DELETE
  TO authenticated
  USING (public.is_org_admin_or_owner(organization_id));

CREATE TRIGGER update_loss_reasons_updated_at
  BEFORE UPDATE ON public.loss_reasons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default loss reasons for all existing organizations
INSERT INTO public.loss_reasons (organization_id, label, position)
SELECT o.id, r.label, r.pos
FROM public.organizations o
CROSS JOIN (VALUES
  ('Preço', 0),
  ('Prazo', 1),
  ('Concorrente', 2),
  ('Sumiu', 3),
  ('Sem orçamento', 4),
  ('Não era o decisor', 5)
) AS r(label, pos)
WHERE NOT EXISTS (
  SELECT 1 FROM public.loss_reasons lr WHERE lr.organization_id = o.id
);

-- Seed default loss reasons on new organization creation
CREATE OR REPLACE FUNCTION public.seed_default_loss_reasons()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.loss_reasons (organization_id, label, position) VALUES
    (NEW.id, 'Preço', 0),
    (NEW.id, 'Prazo', 1),
    (NEW.id, 'Concorrente', 2),
    (NEW.id, 'Sumiu', 3),
    (NEW.id, 'Sem orçamento', 4),
    (NEW.id, 'Não era o decisor', 5)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_default_loss_reasons_trigger ON public.organizations;
CREATE TRIGGER seed_default_loss_reasons_trigger
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_loss_reasons();