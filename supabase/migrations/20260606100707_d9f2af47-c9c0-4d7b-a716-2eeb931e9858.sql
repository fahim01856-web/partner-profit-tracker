
-- 1. Daily Cash Book
CREATE TABLE public.cash_book_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('in','out')),
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_book_entries TO authenticated;
GRANT ALL ON public.cash_book_entries TO service_role;
ALTER TABLE public.cash_book_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all cash_book" ON public.cash_book_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_cash_book_updated BEFORE UPDATE ON public.cash_book_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_cash_book_date ON public.cash_book_entries(date);

-- Optional manual opening balance per day (overrides computed)
CREATE TABLE public.cash_book_opening (
  date date PRIMARY KEY,
  opening_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_book_opening TO authenticated;
GRANT ALL ON public.cash_book_opening TO service_role;
ALTER TABLE public.cash_book_opening ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all cash_book_opening" ON public.cash_book_opening FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_cash_book_opening_updated BEFORE UPDATE ON public.cash_book_opening FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Signature Cards
CREATE TABLE public.signature_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number text NOT NULL,
  customer_name text NOT NULL,
  mobile text,
  image_path text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_cards TO authenticated;
GRANT ALL ON public.signature_cards TO service_role;
ALTER TABLE public.signature_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all signature_cards" ON public.signature_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_signature_cards_updated BEFORE UPDATE ON public.signature_cards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_signature_cards_acct ON public.signature_cards(account_number);

-- 3. Inventory: Receipts (from branch) + Distributions (to customers)
CREATE TABLE public.inventory_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('mtdr','mmpdsa','cheque_book')),
  quantity integer NOT NULL CHECK (quantity > 0),
  source text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_receipts TO authenticated;
GRANT ALL ON public.inventory_receipts TO service_role;
ALTER TABLE public.inventory_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all inv_receipts" ON public.inventory_receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_inv_receipts_updated BEFORE UPDATE ON public.inventory_receipts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_inv_receipts_date ON public.inventory_receipts(date);
CREATE INDEX idx_inv_receipts_type ON public.inventory_receipts(item_type);

CREATE TABLE public.inventory_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('mtdr','mmpdsa','cheque_book')),
  quantity integer NOT NULL CHECK (quantity > 0),
  customer_name text NOT NULL,
  account_number text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_distributions TO authenticated;
GRANT ALL ON public.inventory_distributions TO service_role;
ALTER TABLE public.inventory_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all inv_dist" ON public.inventory_distributions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_inv_dist_updated BEFORE UPDATE ON public.inventory_distributions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_inv_dist_date ON public.inventory_distributions(date);
CREATE INDEX idx_inv_dist_type ON public.inventory_distributions(item_type);
