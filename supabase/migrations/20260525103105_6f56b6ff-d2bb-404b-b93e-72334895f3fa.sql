
CREATE TABLE public.pending_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  customer_name TEXT,
  account_number TEXT,
  mobile TEXT,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pending_works ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_select ON public.pending_works FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert ON public.pending_works FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update ON public.pending_works FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_delete ON public.pending_works FOR DELETE TO authenticated USING (true);
CREATE TRIGGER pending_works_touch BEFORE UPDATE ON public.pending_works FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_pending_works_cat ON public.pending_works(category, status);

CREATE TABLE public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sms_type TEXT NOT NULL DEFAULT 'custom',
  customer_name TEXT,
  account_number TEXT,
  mobile TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  receive_date DATE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_select ON public.sms_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert ON public.sms_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update ON public.sms_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_delete ON public.sms_logs FOR DELETE TO authenticated USING (true);

CREATE TABLE public.monthly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  staff_name TEXT NOT NULL,
  target_category TEXT NOT NULL,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  target_quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.monthly_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_select ON public.monthly_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert ON public.monthly_targets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update ON public.monthly_targets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_delete ON public.monthly_targets FOR DELETE TO authenticated USING (true);
CREATE TRIGGER monthly_targets_touch BEFORE UPDATE ON public.monthly_targets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  staff_name TEXT NOT NULL,
  achievement_category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_select ON public.achievements FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert ON public.achievements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update ON public.achievements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_delete ON public.achievements FOR DELETE TO authenticated USING (true);

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  description TEXT,
  expiry_date DATE,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_select ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert ON public.documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update ON public.documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_delete ON public.documents FOR DELETE TO authenticated USING (true);
CREATE TRIGGER documents_touch BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "doc public read" ON storage.objects FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY "doc auth insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "doc auth update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "doc auth delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents');
