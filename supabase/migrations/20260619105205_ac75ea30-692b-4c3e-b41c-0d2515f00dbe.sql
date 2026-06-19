
-- 1. Audit Reports
CREATE TABLE IF NOT EXISTS public.audit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_date date NOT NULL DEFAULT CURRENT_DATE,
  auditor_name text NOT NULL,
  audit_type text NOT NULL DEFAULT 'internal',
  period_start date,
  period_end date,
  remarks text,
  -- Compliance checks (status: ok/warning/fail, plus note)
  cash_check_status text DEFAULT 'ok',
  cash_check_note text,
  voucher_check_status text DEFAULT 'ok',
  voucher_check_note text,
  document_check_status text DEFAULT 'ok',
  document_check_note text,
  pending_check_status text DEFAULT 'ok',
  pending_check_note text,
  attendance_check_status text DEFAULT 'ok',
  attendance_check_note text,
  salary_check_status text DEFAULT 'ok',
  salary_check_note text,
  signature_check_status text DEFAULT 'ok',
  signature_check_note text,
  kyc_check_status text DEFAULT 'ok',
  kyc_check_note text,
  -- Sign-off
  prepared_by text,
  checked_by text,
  approved_by text,
  sign_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_reports TO authenticated;
GRANT ALL ON public.audit_reports TO service_role;
ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select" ON public.audit_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_insert" ON public.audit_reports FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_update" ON public.audit_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_delete" ON public.audit_reports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_audit_reports_date ON public.audit_reports(audit_date DESC);
CREATE TRIGGER audit_reports_touch BEFORE UPDATE ON public.audit_reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Audit Findings / Issues
CREATE TABLE IF NOT EXISTS public.audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_report_id uuid REFERENCES public.audit_reports(id) ON DELETE SET NULL,
  title text NOT NULL,
  details text,
  category text NOT NULL DEFAULT 'general',
  risk_level text NOT NULL DEFAULT 'medium',
  recommendation text,
  responsible_person text,
  deadline date,
  status text NOT NULL DEFAULT 'pending',
  corrective_action text,
  evidence_url text,
  evidence_name text,
  resolved_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_findings TO authenticated;
GRANT ALL ON public.audit_findings TO service_role;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select" ON public.audit_findings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_insert" ON public.audit_findings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_update" ON public.audit_findings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_delete" ON public.audit_findings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_findings_report ON public.audit_findings(audit_report_id);
CREATE INDEX IF NOT EXISTS idx_findings_status ON public.audit_findings(status, deadline);
CREATE TRIGGER audit_findings_touch BEFORE UPDATE ON public.audit_findings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Audit Tasks (pending tracker)
CREATE TABLE IF NOT EXISTS public.audit_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_report_id uuid REFERENCES public.audit_reports(id) ON DELETE SET NULL,
  task_name text NOT NULL,
  assigned_to text,
  due_date date,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  completion_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_tasks TO authenticated;
GRANT ALL ON public.audit_tasks TO service_role;
ALTER TABLE public.audit_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select" ON public.audit_tasks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_insert" ON public.audit_tasks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_update" ON public.audit_tasks FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_delete" ON public.audit_tasks FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_tasks_report ON public.audit_tasks(audit_report_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.audit_tasks(status, due_date);
CREATE TRIGGER audit_tasks_touch BEFORE UPDATE ON public.audit_tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
