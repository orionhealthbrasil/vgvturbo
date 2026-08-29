-- VGVCash: AI credit ledger, append-only.
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount numeric(12,6) NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'adjustment')),
  description text,
  added_by_user_id uuid REFERENCES auth.users(id),
  metadata jsonb,
  credit_subtype text CHECK (credit_subtype IN ('purchased', 'bonus')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_org ON public.credit_transactions (organization_id, created_at DESC);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='credit_transactions' AND policyname='org_members_read_credits') THEN
    CREATE POLICY org_members_read_credits ON public.credit_transactions
      FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
  END IF;
END $$;
