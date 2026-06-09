
CREATE TABLE public.pending_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_bn text NOT NULL,
  name_en text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_categories TO authenticated;
GRANT ALL ON public.pending_categories TO service_role;

ALTER TABLE public.pending_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage pending categories"
ON public.pending_categories FOR ALL
TO authenticated
USING (true) WITH CHECK (true);

CREATE TRIGGER pending_categories_touch
BEFORE UPDATE ON public.pending_categories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.pending_categories (slug, name_bn, name_en, sort_order) VALUES
  ('account', 'অ্যাকাউন্ট পেন্ডিং', 'Account Pending', 10),
  ('remittance', 'রেমিট্যান্স পেন্ডিং', 'Remittance Pending', 20),
  ('cheque_book', 'চেক বই পেন্ডিং', 'Cheque Book Pending', 30),
  ('mmp_cheque', 'MMP/DSA চেক পেন্ডিং', 'MMP/DSA Cheque Pending', 40),
  ('mtdr_cheque', 'MTDR চেক পেন্ডিং', 'MTDR Cheque Pending', 50),
  ('atm_card', 'ATM কার্ড পেন্ডিং', 'ATM Card Pending', 60),
  ('dps_fdr', 'DPS/FDR পেন্ডিং', 'DPS/FDR Pending', 70),
  ('mobile_banking', 'মোবাইল ব্যাংকিং পেন্ডিং', 'Mobile Banking Pending', 80),
  ('complaint', 'কাস্টমার অভিযোগ পেন্ডিং', 'Customer Complaint Pending', 90),
  ('document', 'ডকুমেন্ট পেন্ডিং', 'Document Pending', 100),
  ('follow_up', 'ফলোআপ পেন্ডিং', 'Follow Up Pending', 110),
  ('other', 'অন্যান্য পেন্ডিং', 'Other Pending Works', 120);
