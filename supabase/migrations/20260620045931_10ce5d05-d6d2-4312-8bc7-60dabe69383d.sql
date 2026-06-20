
-- Account balances per day per account type
CREATE TABLE public.ab_account_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  account_type text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date, account_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ab_account_balances TO authenticated;
GRANT ALL ON public.ab_account_balances TO service_role;
ALTER TABLE public.ab_account_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.ab_account_balances FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_ab_balances_touch BEFORE UPDATE ON public.ab_account_balances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_ab_balances_date ON public.ab_account_balances(date DESC);

-- Profit slabs per account type
CREATE TABLE public.ab_profit_slabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type text NOT NULL,
  min_amount numeric NOT NULL DEFAULT 0,
  max_amount numeric,
  yearly_percent numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ab_profit_slabs TO authenticated;
GRANT ALL ON public.ab_profit_slabs TO service_role;
ALTER TABLE public.ab_profit_slabs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.ab_profit_slabs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_ab_slabs_touch BEFORE UPDATE ON public.ab_profit_slabs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Income entries (online / remittance / other)
CREATE TABLE public.ab_income_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  income_type text NOT NULL,
  source text,
  amount numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ab_income_entries TO authenticated;
GRANT ALL ON public.ab_income_entries TO service_role;
ALTER TABLE public.ab_income_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.ab_income_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_ab_income_touch BEFORE UPDATE ON public.ab_income_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_ab_income_date ON public.ab_income_entries(date DESC);
