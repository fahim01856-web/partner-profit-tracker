CREATE TABLE public.daily_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  amount numeric NOT NULL DEFAULT 0,
  note text,
  submitted_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select" ON public.daily_deposits FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.daily_deposits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.daily_deposits FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON public.daily_deposits FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_daily_deposits_touch
BEFORE UPDATE ON public.daily_deposits
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_daily_deposits_date ON public.daily_deposits(date DESC);