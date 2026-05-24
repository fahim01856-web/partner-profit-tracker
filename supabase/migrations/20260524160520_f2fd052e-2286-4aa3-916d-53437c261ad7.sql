ALTER TABLE public.salaries
  ADD COLUMN IF NOT EXISTS allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS working_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';