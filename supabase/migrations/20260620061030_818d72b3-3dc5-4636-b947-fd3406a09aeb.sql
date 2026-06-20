
CREATE TABLE public.application_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  description text,
  body_html text NOT NULL DEFAULT '',
  placeholders jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_templates TO authenticated;
GRANT ALL ON public.application_templates TO service_role;
ALTER TABLE public.application_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage templates" ON public.application_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_app_templates_updated BEFORE UPDATE ON public.application_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.application_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.application_templates(id) ON DELETE SET NULL,
  application_no text,
  customer_name text NOT NULL,
  customer_nid text,
  customer_mobile text,
  account_number text,
  account_type text,
  application_type text,
  application_date date NOT NULL DEFAULT CURRENT_DATE,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_html text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  remarks text,
  amount numeric,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_records TO authenticated;
GRANT ALL ON public.application_records TO service_role;
ALTER TABLE public.application_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage records" ON public.application_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_app_records_updated BEFORE UPDATE ON public.application_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_app_records_status ON public.application_records(status);
CREATE INDEX idx_app_records_customer ON public.application_records(customer_name);

CREATE TABLE public.application_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.application_templates(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  required boolean NOT NULL DEFAULT false,
  default_value text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_fields TO authenticated;
GRANT ALL ON public.application_fields TO service_role;
ALTER TABLE public.application_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage fields" ON public.application_fields FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.customer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_nid text,
  customer_mobile text,
  account_number text,
  doc_type text NOT NULL,
  title text NOT NULL,
  file_url text,
  file_path text,
  mime_type text,
  size_bytes bigint,
  notes text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_documents TO authenticated;
GRANT ALL ON public.customer_documents TO service_role;
ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage cust docs" ON public.customer_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_cust_docs_updated BEFORE UPDATE ON public.customer_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_cust_docs_customer ON public.customer_documents(customer_name);

CREATE TABLE public.application_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.application_records(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  action text NOT NULL,
  snapshot jsonb,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_history TO authenticated;
GRANT ALL ON public.application_history TO service_role;
ALTER TABLE public.application_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage history" ON public.application_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.approval_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.application_records(id) ON DELETE CASCADE,
  stage text NOT NULL,
  decision text NOT NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  comments text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_records TO authenticated;
GRANT ALL ON public.approval_records TO service_role;
ALTER TABLE public.approval_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage approvals" ON public.approval_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.application_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.application_records(id) ON DELETE CASCADE,
  title text,
  file_url text,
  file_path text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_attachments TO authenticated;
GRANT ALL ON public.application_attachments TO service_role;
ALTER TABLE public.application_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage attachments" ON public.application_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.application_user_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_user_activities TO authenticated;
GRANT ALL ON public.application_user_activities TO service_role;
ALTER TABLE public.application_user_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage activities" ON public.application_user_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth read app attachments bucket" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'application-attachments');
CREATE POLICY "auth upload app attachments bucket" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'application-attachments');
CREATE POLICY "auth update app attachments bucket" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'application-attachments');
CREATE POLICY "auth delete app attachments bucket" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'application-attachments');
