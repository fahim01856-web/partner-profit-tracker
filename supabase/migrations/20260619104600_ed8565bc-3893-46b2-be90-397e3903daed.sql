
-- 1. Link documents to staff (optional)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_staff_id ON public.documents(staff_id);

-- 2. Staff Performance reviews
CREATE TABLE IF NOT EXISTS public.staff_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  period text NOT NULL DEFAULT 'monthly',
  rating numeric NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  strengths text,
  weaknesses text,
  goals text,
  comments text,
  reviewer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_performance TO authenticated;
GRANT ALL ON public.staff_performance TO service_role;

ALTER TABLE public.staff_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select" ON public.staff_performance FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_insert" ON public.staff_performance FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_update" ON public.staff_performance FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_delete" ON public.staff_performance FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_staff_perf_staff_id ON public.staff_performance(staff_id);

CREATE TRIGGER staff_perf_touch BEFORE UPDATE ON public.staff_performance
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Staff Activity Log
CREATE TABLE IF NOT EXISTS public.staff_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  action text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  details text,
  performed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_activity_log TO authenticated;
GRANT ALL ON public.staff_activity_log TO service_role;

ALTER TABLE public.staff_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select" ON public.staff_activity_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_insert" ON public.staff_activity_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_update" ON public.staff_activity_log FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_delete" ON public.staff_activity_log FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_staff_activity_staff_id ON public.staff_activity_log(staff_id, created_at DESC);
