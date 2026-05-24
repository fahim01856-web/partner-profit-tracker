CREATE TABLE public.monthly_report_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  item_type TEXT NOT NULL CHECK (item_type IN ('income','expense')),
  sl_no INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mri_period ON public.monthly_report_items(year, month, item_type, sl_no);

ALTER TABLE public.monthly_report_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_select ON public.monthly_report_items FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert ON public.monthly_report_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update ON public.monthly_report_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_delete ON public.monthly_report_items FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_mri_updated_at BEFORE UPDATE ON public.monthly_report_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();