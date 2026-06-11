DROP TABLE IF EXISTS public.incomes CASCADE;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.agent_bank_investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  partner_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'investment',
  amount NUMERIC(14,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_bank_investments TO authenticated;
GRANT ALL ON public.agent_bank_investments TO service_role;

ALTER TABLE public.agent_bank_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view investments" ON public.agent_bank_investments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert investments" ON public.agent_bank_investments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update investments" ON public.agent_bank_investments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete investments" ON public.agent_bank_investments FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_agent_bank_investments_updated_at
  BEFORE UPDATE ON public.agent_bank_investments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();