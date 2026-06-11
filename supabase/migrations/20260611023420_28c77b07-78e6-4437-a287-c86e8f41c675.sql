
CREATE TABLE public.loan_persons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_persons TO authenticated;
GRANT ALL ON public.loan_persons TO service_role;
ALTER TABLE public.loan_persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_persons auth read" ON public.loan_persons FOR SELECT TO authenticated USING (true);
CREATE POLICY "loan_persons auth insert" ON public.loan_persons FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "loan_persons auth update" ON public.loan_persons FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "loan_persons auth delete" ON public.loan_persons FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_loan_persons_updated BEFORE UPDATE ON public.loan_persons FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.loan_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES public.loan_persons(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('loan_out','loan_in','payment_in','payment_out','interest','adjustment')),
  amount NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_transactions TO authenticated;
GRANT ALL ON public.loan_transactions TO service_role;
ALTER TABLE public.loan_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_tx auth read" ON public.loan_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "loan_tx auth insert" ON public.loan_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "loan_tx auth update" ON public.loan_transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "loan_tx auth delete" ON public.loan_transactions FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_loan_tx_updated BEFORE UPDATE ON public.loan_transactions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_loan_tx_person_date ON public.loan_transactions(person_id, date DESC);
