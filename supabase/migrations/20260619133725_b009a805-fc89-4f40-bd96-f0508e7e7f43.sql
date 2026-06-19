-- =====================================================
-- M.S. KYC. Task module — Meetings, KYC, Tasks
-- =====================================================

-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.meeting_status AS ENUM ('scheduled','in_progress','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.action_status AS ENUM ('pending','in_progress','completed','overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.kyc_status AS ENUM ('pending','verified','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.risk_level AS ENUM ('low','medium','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('pending','in_progress','completed','verified','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low','medium','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ MEETINGS ============
CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  meeting_type text NOT NULL DEFAULT 'weekly',
  meeting_date date NOT NULL,
  meeting_time time,
  location text,
  chairperson text,
  status public.meeting_status NOT NULL DEFAULT 'scheduled',
  summary text,
  next_meeting_date date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all meetings" ON public.meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_meetings_updated BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.meeting_agendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  topic text NOT NULL,
  presenter text,
  time_slot text,
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_agendas TO authenticated;
GRANT ALL ON public.meeting_agendas TO service_role;
ALTER TABLE public.meeting_agendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all meeting_agendas" ON public.meeting_agendas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.meeting_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  problem text NOT NULL,
  raised_by text,
  status text NOT NULL DEFAULT 'open',
  resolution text,
  resolved_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_problems TO authenticated;
GRANT ALL ON public.meeting_problems TO service_role;
ALTER TABLE public.meeting_problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all meeting_problems" ON public.meeting_problems FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.meeting_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  target text NOT NULL,
  assigned_to text,
  due_date date,
  achievement_percent int NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_targets TO authenticated;
GRANT ALL ON public.meeting_targets TO service_role;
ALTER TABLE public.meeting_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all meeting_targets" ON public.meeting_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.meeting_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  action text NOT NULL,
  responsible text,
  deadline date,
  status public.action_status NOT NULL DEFAULT 'pending',
  completion_note text,
  completed_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_actions TO authenticated;
GRANT ALL ON public.meeting_actions TO service_role;
ALTER TABLE public.meeting_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all meeting_actions" ON public.meeting_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_meeting_actions_updated BEFORE UPDATE ON public.meeting_actions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.meeting_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  name text NOT NULL,
  role text,
  present boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_attendees TO authenticated;
GRANT ALL ON public.meeting_attendees TO service_role;
ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all meeting_attendees" ON public.meeting_attendees FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ KYC ============
CREATE TABLE IF NOT EXISTS public.kyc_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  nid_number text,
  phone text,
  email text,
  address text,
  account_number text,
  date_of_birth date,
  father_name text,
  mother_name text,
  spouse_name text,
  occupation text,
  source_of_income text,
  monthly_income numeric,
  nominee_name text,
  nominee_relation text,
  nominee_nid text,
  photo_url text,
  risk_level public.risk_level NOT NULL DEFAULT 'low',
  status public.kyc_status NOT NULL DEFAULT 'pending',
  verified_by text,
  verified_on date,
  approved_by text,
  approved_on date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kyc_profiles TO authenticated;
GRANT ALL ON public.kyc_profiles TO service_role;
ALTER TABLE public.kyc_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all kyc_profiles" ON public.kyc_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_kyc_profiles_updated BEFORE UPDATE ON public.kyc_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_id uuid NOT NULL REFERENCES public.kyc_profiles(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  doc_name text,
  file_url text,
  file_path text,
  issued_on date,
  expire_on date,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kyc_documents TO authenticated;
GRANT ALL ON public.kyc_documents TO service_role;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all kyc_documents" ON public.kyc_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.kyc_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_id uuid NOT NULL REFERENCES public.kyc_profiles(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_label text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  note text,
  checked_by text,
  checked_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kyc_checklist_items TO authenticated;
GRANT ALL ON public.kyc_checklist_items TO service_role;
ALTER TABLE public.kyc_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all kyc_checklist" ON public.kyc_checklist_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ TASKS ============
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'daily',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'pending',
  assigned_to uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  assigned_to_name text,
  deadline date,
  reminder_date date,
  completion_note text,
  attachment_url text,
  verified_by text,
  verified_on date,
  source_type text,
  source_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_on timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all tasks" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_status text,
  to_status text,
  note text,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_history TO authenticated;
GRANT ALL ON public.task_history TO service_role;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all task_history" ON public.task_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meetings_date ON public.meetings(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_actions_meeting ON public.meeting_actions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON public.kyc_profiles(status);
CREATE INDEX IF NOT EXISTS idx_kyc_docs_kyc ON public.kyc_documents(kyc_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_task_history_task ON public.task_history(task_id);