
CREATE TABLE public.branch_pending_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sl text NOT NULL DEFAULT '',
  work_date date,
  work text NOT NULL DEFAULT '',
  done boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_pending_list TO authenticated;
GRANT ALL ON public.branch_pending_list TO service_role;

ALTER TABLE public.branch_pending_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own branch pending"
  ON public.branch_pending_list FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_branch_pending_updated_at
  BEFORE UPDATE ON public.branch_pending_list
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.branch_pending_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'কুমিল্লা ব্রাঞ্চ ওয়ার্ক পেন্ডিং',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_pending_settings TO authenticated;
GRANT ALL ON public.branch_pending_settings TO service_role;

ALTER TABLE public.branch_pending_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own branch pending settings"
  ON public.branch_pending_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_branch_pending_settings_updated_at
  BEFORE UPDATE ON public.branch_pending_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
