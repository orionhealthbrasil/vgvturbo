
-- =====================================================
-- 1. FEATURE FLAGS POR ORGANIZAÇÃO
-- =====================================================
CREATE TABLE IF NOT EXISTS public.organization_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_at TIMESTAMPTZ,
  enabled_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_org_features_org ON public.organization_features(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_features_key ON public.organization_features(feature_key) WHERE is_enabled = true;

ALTER TABLE public.organization_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org features"
  ON public.organization_features FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Super admin can manage all features"
  ON public.organization_features FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE TRIGGER trg_org_features_updated_at
  BEFORE UPDATE ON public.organization_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: verifica se a org tem uma feature ativada
CREATE OR REPLACE FUNCTION public.org_has_feature(_org_id UUID, _feature TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_features
    WHERE organization_id = _org_id
      AND feature_key = _feature
      AND is_enabled = true
  );
$$;

-- =====================================================
-- 2. CONTAS / CARTEIRAS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'cash', -- cash, bank, credit_card, other
  initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_accounts_org ON public.financial_accounts(organization_id) WHERE is_active = true;

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members with feature can view accounts"
  ON public.financial_accounts FOR SELECT
  USING (
    user_belongs_to_org(auth.uid(), organization_id)
    AND org_has_feature(organization_id, 'financial')
  );

CREATE POLICY "Owners/admins manage accounts"
  ON public.financial_accounts FOR ALL
  USING (
    org_has_feature(organization_id, 'financial')
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = financial_accounts.organization_id
        AND (om.role IN ('owner','admin') OR om.member_role = 'admin')
    )
  )
  WITH CHECK (
    org_has_feature(organization_id, 'financial')
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = financial_accounts.organization_id
        AND (om.role IN ('owner','admin') OR om.member_role = 'admin')
    )
  );

CREATE TRIGGER trg_fin_accounts_updated_at
  BEFORE UPDATE ON public.financial_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 3. CATEGORIAS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.financial_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_type TEXT NOT NULL CHECK (category_type IN ('income','expense')),
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT,
  parent_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_categories_org ON public.financial_categories(organization_id);
CREATE INDEX idx_fin_categories_type ON public.financial_categories(organization_id, category_type) WHERE is_active = true;

ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members with feature view categories"
  ON public.financial_categories FOR SELECT
  USING (
    user_belongs_to_org(auth.uid(), organization_id)
    AND org_has_feature(organization_id, 'financial')
  );

CREATE POLICY "Owners/admins manage categories"
  ON public.financial_categories FOR ALL
  USING (
    org_has_feature(organization_id, 'financial')
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = financial_categories.organization_id
        AND (om.role IN ('owner','admin') OR om.member_role = 'admin')
    )
  )
  WITH CHECK (
    org_has_feature(organization_id, 'financial')
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = financial_categories.organization_id
        AND (om.role IN ('owner','admin') OR om.member_role = 'admin')
    )
  );

CREATE TRIGGER trg_fin_categories_updated_at
  BEFORE UPDATE ON public.financial_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 4. RECORRÊNCIAS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.financial_recurrences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income','expense')),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly','monthly','quarterly','yearly')),
  interval_count INTEGER NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE,
  next_run_date DATE NOT NULL,
  last_run_date DATE,
  total_occurrences INTEGER, -- NULL = infinite
  occurrences_done INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_rec_org ON public.financial_recurrences(organization_id);
CREATE INDEX idx_fin_rec_next_run ON public.financial_recurrences(next_run_date) WHERE is_active = true;

ALTER TABLE public.financial_recurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members with feature view recurrences"
  ON public.financial_recurrences FOR SELECT
  USING (
    user_belongs_to_org(auth.uid(), organization_id)
    AND org_has_feature(organization_id, 'financial')
  );

CREATE POLICY "Owners/admins manage recurrences"
  ON public.financial_recurrences FOR ALL
  USING (
    org_has_feature(organization_id, 'financial')
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = financial_recurrences.organization_id
        AND (om.role IN ('owner','admin') OR om.member_role = 'admin')
    )
  )
  WITH CHECK (
    org_has_feature(organization_id, 'financial')
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = financial_recurrences.organization_id
        AND (om.role IN ('owner','admin') OR om.member_role = 'admin')
    )
  );

CREATE TRIGGER trg_fin_rec_updated_at
  BEFORE UPDATE ON public.financial_recurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 5. TRANSAÇÕES (lançamentos)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  recurrence_id UUID REFERENCES public.financial_recurrences(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income','expense')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  notes TEXT,
  payment_method TEXT, -- pix, cash, credit_card, debit_card, transfer, boleto, other
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','paid','overdue','cancelled')),
  due_date DATE,
  paid_date DATE,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  attachment_url TEXT,
  source TEXT NOT NULL DEFAULT 'manual', -- manual, recurrence, pipeline_won, automation
  source_ref TEXT, -- id externo (ex: contact_id quando vem do pipeline)
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_tx_org ON public.financial_transactions(organization_id);
CREATE INDEX idx_fin_tx_date ON public.financial_transactions(organization_id, transaction_date DESC);
CREATE INDEX idx_fin_tx_status ON public.financial_transactions(organization_id, status) WHERE status IN ('pending','overdue');
CREATE INDEX idx_fin_tx_account ON public.financial_transactions(account_id);
CREATE INDEX idx_fin_tx_contact ON public.financial_transactions(contact_id) WHERE contact_id IS NOT NULL;
CREATE UNIQUE INDEX idx_fin_tx_pipeline_unique ON public.financial_transactions(organization_id, contact_id, source) 
  WHERE source = 'pipeline_won' AND contact_id IS NOT NULL;

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members with feature view transactions"
  ON public.financial_transactions FOR SELECT
  USING (
    user_belongs_to_org(auth.uid(), organization_id)
    AND org_has_feature(organization_id, 'financial')
  );

CREATE POLICY "Members with feature insert transactions"
  ON public.financial_transactions FOR INSERT
  WITH CHECK (
    user_belongs_to_org(auth.uid(), organization_id)
    AND org_has_feature(organization_id, 'financial')
  );

CREATE POLICY "Owners/admins update transactions"
  ON public.financial_transactions FOR UPDATE
  USING (
    org_has_feature(organization_id, 'financial')
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = financial_transactions.organization_id
        AND (om.role IN ('owner','admin') OR om.member_role = 'admin')
    )
  );

CREATE POLICY "Owners/admins delete transactions"
  ON public.financial_transactions FOR DELETE
  USING (
    org_has_feature(organization_id, 'financial')
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = financial_transactions.organization_id
        AND (om.role IN ('owner','admin') OR om.member_role = 'admin')
    )
  );

CREATE TRIGGER trg_fin_tx_updated_at
  BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 6. SEED: criar contas/categorias padrão ao ativar feature
-- =====================================================
CREATE OR REPLACE FUNCTION public.seed_financial_defaults(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_account BOOLEAN;
  v_has_category BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM financial_accounts WHERE organization_id = p_org_id) INTO v_has_account;
  SELECT EXISTS(SELECT 1 FROM financial_categories WHERE organization_id = p_org_id) INTO v_has_category;

  IF NOT v_has_account THEN
    INSERT INTO financial_accounts (organization_id, name, account_type, color, position)
    VALUES (p_org_id, 'Caixa Principal', 'cash', '#22c55e', 0);
  END IF;

  IF NOT v_has_category THEN
    INSERT INTO financial_categories (organization_id, name, category_type, color, icon, is_default, position) VALUES
      (p_org_id, 'Vendas', 'income', '#22c55e', 'trending-up', true, 0),
      (p_org_id, 'Serviços', 'income', '#10b981', 'briefcase', false, 1),
      (p_org_id, 'Outros', 'income', '#06b6d4', 'circle', false, 2),
      (p_org_id, 'Salários', 'expense', '#ef4444', 'users', false, 0),
      (p_org_id, 'Aluguel', 'expense', '#f97316', 'home', false, 1),
      (p_org_id, 'Marketing', 'expense', '#8b5cf6', 'megaphone', false, 2),
      (p_org_id, 'Operacional', 'expense', '#64748b', 'settings', false, 3),
      (p_org_id, 'Impostos', 'expense', '#dc2626', 'receipt', false, 4);
  END IF;
END;
$$;

-- Trigger: ao ativar feature 'financial', criar defaults
CREATE OR REPLACE FUNCTION public.handle_financial_feature_toggle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.feature_key = 'financial' AND NEW.is_enabled = true 
     AND (TG_OP = 'INSERT' OR OLD.is_enabled = false) THEN
    PERFORM seed_financial_defaults(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_financial_on_enable
  AFTER INSERT OR UPDATE ON public.organization_features
  FOR EACH ROW EXECUTE FUNCTION public.handle_financial_feature_toggle();

-- =====================================================
-- 7. INTEGRAÇÃO PIPELINE → FINANCEIRO
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_transaction_on_deal_won()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_category_id UUID;
BEGIN
  -- Só dispara quando vira 'won' agora E tem deal_value
  IF NEW.sale_result = 'won' 
     AND (OLD.sale_result IS DISTINCT FROM 'won')
     AND NEW.deal_value IS NOT NULL 
     AND NEW.deal_value > 0
     AND org_has_feature(NEW.organization_id, 'financial') THEN

    -- Conta padrão (primeira ativa)
    SELECT id INTO v_account_id
    FROM financial_accounts
    WHERE organization_id = NEW.organization_id AND is_active = true
    ORDER BY position, created_at LIMIT 1;

    IF v_account_id IS NULL THEN RETURN NEW; END IF;

    -- Categoria "Vendas" (default income)
    SELECT id INTO v_category_id
    FROM financial_categories
    WHERE organization_id = NEW.organization_id 
      AND category_type = 'income' 
      AND is_default = true
    LIMIT 1;

    -- Insert idempotente (índice único previne duplicação)
    INSERT INTO financial_transactions (
      organization_id, account_id, category_id, contact_id,
      transaction_type, amount, description,
      status, transaction_date, paid_date,
      source, source_ref, created_by
    ) VALUES (
      NEW.organization_id, v_account_id, v_category_id, NEW.id,
      'income', NEW.deal_value, 
      'Venda fechada: ' || NEW.name,
      'paid', CURRENT_DATE, CURRENT_DATE,
      'pipeline_won', NEW.id::text, NEW.assigned_to
    )
    ON CONFLICT (organization_id, contact_id, source) WHERE source = 'pipeline_won' AND contact_id IS NOT NULL
    DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_tx_on_deal_won
  AFTER UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.create_transaction_on_deal_won();
