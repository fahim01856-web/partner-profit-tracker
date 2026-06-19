CREATE TABLE public.agent_bank_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_bank_assets TO authenticated;
GRANT ALL ON public.agent_bank_assets TO service_role;
ALTER TABLE public.agent_bank_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view assets" ON public.agent_bank_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert assets" ON public.agent_bank_assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update assets" ON public.agent_bank_assets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete assets" ON public.agent_bank_assets FOR DELETE TO authenticated USING (true);
CREATE TRIGGER agent_bank_assets_set_updated_at BEFORE UPDATE ON public.agent_bank_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();