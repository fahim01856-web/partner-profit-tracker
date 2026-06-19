CREATE TABLE public.audit_compliance_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_report_id uuid NOT NULL REFERENCES public.audit_reports(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'warning', 'fail')),
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_compliance_checks TO authenticated;
GRANT ALL ON public.audit_compliance_checks TO service_role;

ALTER TABLE public.audit_compliance_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select" ON public.audit_compliance_checks
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_insert" ON public.audit_compliance_checks
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update" ON public.audit_compliance_checks
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete" ON public.audit_compliance_checks
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_audit_compliance_checks_report_order
ON public.audit_compliance_checks(audit_report_id, sort_order, created_at);

CREATE TRIGGER audit_compliance_checks_touch
BEFORE UPDATE ON public.audit_compliance_checks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.audit_compliance_checks (audit_report_id, title, status, note, sort_order)
SELECT r.id, item.title, COALESCE(item.status, 'ok'), item.note, item.sort_order
FROM public.audit_reports r
CROSS JOIN LATERAL (
  VALUES
    ('ক্যাশ ব্যালেন্স ভেরিফিকেশন', r.cash_check_status, r.cash_check_note, 10),
    ('এক্সপেন্স ভাউচার এপ্রুভাল', r.voucher_check_status, r.voucher_check_note, 20),
    ('ডকুমেন্ট এক্সপেন্স চেক', r.document_check_status, r.document_check_note, 30),
    ('পেন্ডিং টাস্ক চেক', r.pending_check_status, r.pending_check_note, 40),
    ('হাজিরা চেক', r.attendance_check_status, r.attendance_check_note, 50),
    ('বেতন পরিশোধ চেক', r.salary_check_status, r.salary_check_note, 60),
    ('সিগনেচার কার্ড চেক', r.signature_check_status, r.signature_check_note, 70),
    ('KYC কমপ্লায়েন্স', r.kyc_check_status, r.kyc_check_note, 80),
    ('ঋণ কমপ্লায়েন্স', r.loan_check_status, r.loan_check_note, 90),
    ('ইনভেন্টরি চেক', r.inventory_check_status, r.inventory_check_note, 100)
) AS item(title, status, note, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.audit_compliance_checks c WHERE c.audit_report_id = r.id
);