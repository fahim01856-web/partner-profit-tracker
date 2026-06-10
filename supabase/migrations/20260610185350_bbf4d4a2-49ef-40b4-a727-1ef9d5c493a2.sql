
ALTER TABLE public.monthly_targets ADD COLUMN IF NOT EXISTS account_type text;
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS account_type text;

CREATE TABLE IF NOT EXISTS public.document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_bn text NOT NULL,
  name_en text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_categories TO authenticated;
GRANT ALL ON public.document_categories TO service_role;

ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read document categories"
  ON public.document_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert document categories"
  ON public.document_categories FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update document categories"
  ON public.document_categories FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete document categories"
  ON public.document_categories FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_document_categories_updated
  BEFORE UPDATE ON public.document_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.document_categories (slug, name_bn, name_en, sort_order) VALUES
  ('licence','লাইসেন্স কপি','Licence Copy',10),
  ('trade_licence','ট্রেড লাইসেন্স','Trade Licence',20),
  ('bank_authorization','ব্যাংক অথরাইজেশন','Bank Authorization',30),
  ('staff_docs','স্টাফ ডকুমেন্ট','Staff Documents',40),
  ('customer_docs','কাস্টমার ডকুমেন্ট','Customer Documents',50),
  ('other','অন্যান্য','Others',60)
ON CONFLICT (slug) DO NOTHING;
