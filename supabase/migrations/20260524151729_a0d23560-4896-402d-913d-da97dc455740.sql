CREATE TABLE public.monthly_profits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  total_profit NUMERIC NOT NULL DEFAULT 0,
  partner1_name TEXT NOT NULL DEFAULT 'Partner 1',
  partner1_percent NUMERIC NOT NULL DEFAULT 80,
  partner2_name TEXT NOT NULL DEFAULT 'Partner 2',
  partner2_percent NUMERIC NOT NULL DEFAULT 20,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

ALTER TABLE public.monthly_profits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select" ON public.monthly_profits FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.monthly_profits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.monthly_profits FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON public.monthly_profits FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_monthly_profits_year_month ON public.monthly_profits(year DESC, month DESC);