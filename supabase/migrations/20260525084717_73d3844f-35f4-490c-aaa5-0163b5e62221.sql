-- Foreign Remittance
CREATE TABLE public.remittance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  branch text,
  customer_name text,
  remittance_type text,
  quantity integer NOT NULL DEFAULT 1,
  amount numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.remittance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_select ON public.remittance_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert ON public.remittance_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update ON public.remittance_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_delete ON public.remittance_entries FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_remittance_updated BEFORE UPDATE ON public.remittance_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Account Opening
CREATE TABLE public.account_opening_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  month integer NOT NULL,
  year integer NOT NULL,
  account_type text NOT NULL,
  num_accounts integer NOT NULL DEFAULT 0,
  opening_amount numeric NOT NULL DEFAULT 0,
  officer_name text,
  status text NOT NULL DEFAULT 'active',
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_opening_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_select ON public.account_opening_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert ON public.account_opening_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update ON public.account_opening_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_delete ON public.account_opening_entries FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_account_opening_updated BEFORE UPDATE ON public.account_opening_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_remittance_date ON public.remittance_entries(date);
CREATE INDEX idx_account_opening_period ON public.account_opening_entries(year, month);