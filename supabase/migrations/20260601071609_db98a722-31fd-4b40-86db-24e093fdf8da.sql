ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_staff_sort_order ON public.staff(sort_order);