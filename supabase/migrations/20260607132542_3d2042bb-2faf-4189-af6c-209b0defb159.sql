CREATE TABLE public.inventory_pending_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_type TEXT NOT NULL CHECK (item_type IN ('mtdr','mmpdsa','cheque_book')),
  customer_name TEXT NOT NULL,
  mobile TEXT,
  account_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered')),
  requested_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivered_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_pending_requests TO authenticated;
GRANT ALL ON public.inventory_pending_requests TO service_role;
ALTER TABLE public.inventory_pending_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage pending requests" ON public.inventory_pending_requests
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER touch_inventory_pending_updated_at BEFORE UPDATE ON public.inventory_pending_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();