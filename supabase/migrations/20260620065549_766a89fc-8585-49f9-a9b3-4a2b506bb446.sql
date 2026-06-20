CREATE TABLE public.inactive_account_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('inoperative','irregular','dormant','zero_balance')),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inactive_account_entries TO authenticated;
GRANT ALL ON public.inactive_account_entries TO service_role;
ALTER TABLE public.inactive_account_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_inactive_accounts" ON public.inactive_account_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER set_updated_at_inactive_accounts BEFORE UPDATE ON public.inactive_account_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_inactive_accounts_cat_date ON public.inactive_account_entries(category, entry_date DESC);