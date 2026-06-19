CREATE OR REPLACE FUNCTION public.seed_audit_compliance_checks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_compliance_checks (audit_report_id, title, status, note, sort_order)
  VALUES
    (NEW.id, 'ক্যাশ ব্যালেন্স ভেরিফিকেশন', COALESCE(NEW.cash_check_status, 'ok'), NEW.cash_check_note, 10),
    (NEW.id, 'এক্সপেন্স ভাউচার এপ্রুভাল', COALESCE(NEW.voucher_check_status, 'ok'), NEW.voucher_check_note, 20),
    (NEW.id, 'ডকুমেন্ট এক্সপেন্স চেক', COALESCE(NEW.document_check_status, 'ok'), NEW.document_check_note, 30),
    (NEW.id, 'পেন্ডিং টাস্ক চেক', COALESCE(NEW.pending_check_status, 'ok'), NEW.pending_check_note, 40),
    (NEW.id, 'হাজিরা চেক', COALESCE(NEW.attendance_check_status, 'ok'), NEW.attendance_check_note, 50),
    (NEW.id, 'বেতন পরিশোধ চেক', COALESCE(NEW.salary_check_status, 'ok'), NEW.salary_check_note, 60),
    (NEW.id, 'সিগনেচার কার্ড চেক', COALESCE(NEW.signature_check_status, 'ok'), NEW.signature_check_note, 70),
    (NEW.id, 'KYC কমপ্লায়েন্স', COALESCE(NEW.kyc_check_status, 'ok'), NEW.kyc_check_note, 80),
    (NEW.id, 'ঋণ কমপ্লায়েন্স', COALESCE(NEW.loan_check_status, 'ok'), NEW.loan_check_note, 90),
    (NEW.id, 'ইনভেন্টরি চেক', COALESCE(NEW.inventory_check_status, 'ok'), NEW.inventory_check_note, 100);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_audit_compliance_checks_after_insert ON public.audit_reports;
CREATE TRIGGER seed_audit_compliance_checks_after_insert
AFTER INSERT ON public.audit_reports
FOR EACH ROW EXECUTE FUNCTION public.seed_audit_compliance_checks();