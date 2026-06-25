
CREATE TABLE public.customer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number text NOT NULL UNIQUE,
  name text NOT NULL,
  mobile text,
  account_type text,
  address text,
  opening_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_profiles TO authenticated;
GRANT ALL ON public.customer_profiles TO service_role;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all customer_profiles" ON public.customer_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_customer_profiles_updated BEFORE UPDATE ON public.customer_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_form_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  body_template text NOT NULL DEFAULT '',
  fields_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_form_types TO authenticated;
GRANT ALL ON public.customer_form_types TO service_role;
ALTER TABLE public.customer_form_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all customer_form_types" ON public.customer_form_types FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_customer_form_types_updated BEFORE UPDATE ON public.customer_form_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_form_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id uuid NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  form_type_id uuid REFERENCES public.customer_form_types(id) ON DELETE SET NULL,
  form_type_code text,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  field_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  document_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_form_documents_profile ON public.customer_form_documents(customer_profile_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_form_documents TO authenticated;
GRANT ALL ON public.customer_form_documents TO service_role;
ALTER TABLE public.customer_form_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all customer_form_documents" ON public.customer_form_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_customer_form_documents_updated BEFORE UPDATE ON public.customer_form_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.customer_form_types (code, name, description, body_template, fields_schema, is_system, sort_order) VALUES
('account_close', 'একাউন্ট ক্লোজ আবেদন', 'গ্রাহকের একাউন্ট বন্ধ করার আবেদন',
E'তারিখঃ {{document_date}}\n\nবরাবর,\nব্যবস্থাপক\nএজেন্ট ব্যাংকিং আউটলেট\n\nবিষয়ঃ একাউন্ট বন্ধ করার আবেদন।\n\nজনাব,\nআমি {{name}}, একাউন্ট নং {{account_number}}, মোবাইলঃ {{mobile}}। ব্যক্তিগত কারণে আমি আমার উক্ত একাউন্টটি বন্ধ করতে আগ্রহী। অনুগ্রহপূর্বক একাউন্টটি বন্ধ করে অবশিষ্ট ব্যালেন্স {{balance}} টাকা প্রদান করার ব্যবস্থা গ্রহণ করিবেন।\n\nকারণঃ {{reason}}\n\nনিবেদক\n{{name}}\nস্বাক্ষরঃ ____________________',
'[{"key":"balance","label":"অবশিষ্ট ব্যালেন্স","type":"number"},{"key":"reason","label":"কারণ","type":"text"}]'::jsonb,
true, 10),
('rtgs', 'RTGS ফর্ম', 'Real Time Gross Settlement ট্রান্সফার ফর্ম',
E'তারিখঃ {{document_date}}\n\nRTGS ট্রান্সফার আবেদন\n\nপ্রেরকঃ\nনামঃ {{name}}\nএকাউন্ট নংঃ {{account_number}}\nমোবাইলঃ {{mobile}}\n\nপ্রাপকঃ\nনামঃ {{receiver_name}}\nএকাউন্ট নংঃ {{receiver_account}}\nব্যাংকঃ {{receiver_bank}}\nশাখাঃ {{receiver_branch}}\nরাউটিং নংঃ {{receiver_routing}}\n\nপরিমাণঃ {{amount}} টাকা\nউদ্দেশ্যঃ {{purpose}}\n\nস্বাক্ষরঃ ____________________',
'[{"key":"receiver_name","label":"প্রাপকের নাম","type":"text"},{"key":"receiver_account","label":"প্রাপকের একাউন্ট নং","type":"text"},{"key":"receiver_bank","label":"প্রাপকের ব্যাংক","type":"text"},{"key":"receiver_branch","label":"প্রাপকের শাখা","type":"text"},{"key":"receiver_routing","label":"রাউটিং নং","type":"text"},{"key":"amount","label":"পরিমাণ","type":"number"},{"key":"purpose","label":"উদ্দেশ্য","type":"text"}]'::jsonb,
true, 20),
('eft_beftn', 'EFT/BEFTN ফর্ম', 'Electronic Fund Transfer / BEFTN আবেদন',
E'তারিখঃ {{document_date}}\n\nBEFTN/EFT ট্রান্সফার আবেদন\n\nপ্রেরকঃ {{name}}\nএকাউন্ট নংঃ {{account_number}}\n\nপ্রাপকঃ {{receiver_name}}\nএকাউন্ট নংঃ {{receiver_account}}\nব্যাংকঃ {{receiver_bank}}\nশাখাঃ {{receiver_branch}}\nরাউটিং নংঃ {{receiver_routing}}\n\nপরিমাণঃ {{amount}} টাকা\n\nস্বাক্ষরঃ ____________________',
'[{"key":"receiver_name","label":"প্রাপকের নাম","type":"text"},{"key":"receiver_account","label":"প্রাপকের একাউন্ট নং","type":"text"},{"key":"receiver_bank","label":"প্রাপকের ব্যাংক","type":"text"},{"key":"receiver_branch","label":"প্রাপকের শাখা","type":"text"},{"key":"receiver_routing","label":"রাউটিং নং","type":"text"},{"key":"amount","label":"পরিমাণ","type":"number"}]'::jsonb,
true, 30),
('mobile_change', 'মোবাইল নাম্বার পরিবর্তন আবেদন', 'গ্রাহকের রেজিস্টার্ড মোবাইল নাম্বার পরিবর্তনের আবেদন',
E'তারিখঃ {{document_date}}\n\nবরাবর,\nব্যবস্থাপক\nএজেন্ট ব্যাংকিং আউটলেট\n\nবিষয়ঃ মোবাইল নাম্বার পরিবর্তনের আবেদন।\n\nজনাব,\nআমি {{name}}, একাউন্ট নং {{account_number}}। আমার বর্তমান রেজিস্টার্ড মোবাইল নাম্বার {{mobile}} পরিবর্তন করে নতুন নাম্বার {{new_mobile}} করার অনুরোধ করছি।\n\nকারণঃ {{reason}}\n\nনিবেদক\n{{name}}\nস্বাক্ষরঃ ____________________',
'[{"key":"new_mobile","label":"নতুন মোবাইল নং","type":"text"},{"key":"reason","label":"কারণ","type":"text"}]'::jsonb,
true, 40),
('msa_transfer', 'MSA to MSA ট্রান্সফার আবেদন', 'এক MSA একাউন্ট থেকে অন্য MSA একাউন্টে স্থানান্তর',
E'তারিখঃ {{document_date}}\n\nবরাবর,\nব্যবস্থাপক\nএজেন্ট ব্যাংকিং আউটলেট\n\nবিষয়ঃ MSA to MSA ট্রান্সফার আবেদন।\n\nজনাব,\nআমি {{name}}, একাউন্ট নং {{account_number}} হতে নিচের একাউন্টে {{amount}} টাকা স্থানান্তরের অনুরোধ করছি।\n\nপ্রাপক একাউন্টঃ {{receiver_account}}\nপ্রাপকের নামঃ {{receiver_name}}\nউদ্দেশ্যঃ {{purpose}}\n\nনিবেদক\n{{name}}\nস্বাক্ষরঃ ____________________',
'[{"key":"receiver_name","label":"প্রাপকের নাম","type":"text"},{"key":"receiver_account","label":"প্রাপক একাউন্ট নং","type":"text"},{"key":"amount","label":"পরিমাণ","type":"number"},{"key":"purpose","label":"উদ্দেশ্য","type":"text"}]'::jsonb,
true, 50),
('others', 'অন্যান্য আবেদন', 'কাস্টম আবেদন/ডকুমেন্ট',
E'তারিখঃ {{document_date}}\n\nবরাবর,\nব্যবস্থাপক\nএজেন্ট ব্যাংকিং আউটলেট\n\nবিষয়ঃ {{subject}}\n\nজনাব,\nআমি {{name}}, একাউন্ট নং {{account_number}}, মোবাইলঃ {{mobile}}।\n\n{{details}}\n\nনিবেদক\n{{name}}\nস্বাক্ষরঃ ____________________',
'[{"key":"subject","label":"বিষয়","type":"text"},{"key":"details","label":"বিস্তারিত","type":"textarea"}]'::jsonb,
true, 60);
