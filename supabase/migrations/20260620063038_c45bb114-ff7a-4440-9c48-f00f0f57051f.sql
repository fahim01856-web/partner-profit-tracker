
CREATE TABLE public.tin_ereturns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  account_number TEXT,
  tin_number TEXT,
  submitted_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tin_ereturns TO authenticated;
GRANT ALL ON public.tin_ereturns TO service_role;
ALTER TABLE public.tin_ereturns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage tin_ereturns" ON public.tin_ereturns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tin_ereturns_set_updated_at BEFORE UPDATE ON public.tin_ereturns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
