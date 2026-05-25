
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS employee_code text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS photo_url text;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS in_time time;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS out_time time;

CREATE TABLE IF NOT EXISTS public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  name text NOT NULL,
  holiday_type text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.holidays FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.holidays FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON public.holidays FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  leave_type text NOT NULL DEFAULT 'casual',
  reason text,
  approved_by text,
  status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select" ON public.leaves FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.leaves FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.leaves FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON public.leaves FOR DELETE TO authenticated USING (true);
