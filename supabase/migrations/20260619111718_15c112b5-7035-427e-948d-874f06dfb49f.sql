
ALTER TABLE public.audit_reports
  ADD COLUMN IF NOT EXISTS reference_number text,
  ADD COLUMN IF NOT EXISTS loan_check_status text,
  ADD COLUMN IF NOT EXISTS loan_check_note text,
  ADD COLUMN IF NOT EXISTS inventory_check_status text,
  ADD COLUMN IF NOT EXISTS inventory_check_note text;

ALTER TABLE public.audit_tasks
  ADD COLUMN IF NOT EXISTS completion_note text,
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_name text;
