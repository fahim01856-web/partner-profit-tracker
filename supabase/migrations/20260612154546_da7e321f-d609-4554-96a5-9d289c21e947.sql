
ALTER TABLE public.loan_persons
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS nid_url text,
  ADD COLUMN IF NOT EXISTS account_number text;

ALTER TABLE public.loan_transactions
  ADD COLUMN IF NOT EXISTS time time,
  ADD COLUMN IF NOT EXISTS receipt_url text;
