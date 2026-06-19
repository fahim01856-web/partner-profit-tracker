
ALTER TABLE public.monthly_targets
  ADD COLUMN IF NOT EXISTS deadline date,
  ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
