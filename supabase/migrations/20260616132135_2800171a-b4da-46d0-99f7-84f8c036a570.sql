
CREATE SEQUENCE IF NOT EXISTS public.upcoming_payments_serial_seq START 1;

CREATE TABLE public.upcoming_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_no integer NOT NULL DEFAULT nextval('public.upcoming_payments_serial_seq'),
  payment_date date NOT NULL,
  customer_name text NOT NULL,
  customer_mobile text,
  customer_account_id text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  purpose text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  paid_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER SEQUENCE public.upcoming_payments_serial_seq OWNED BY public.upcoming_payments.serial_no;

CREATE INDEX idx_upcoming_payments_date ON public.upcoming_payments(payment_date);
CREATE INDEX idx_upcoming_payments_status ON public.upcoming_payments(status);
CREATE INDEX idx_upcoming_payments_mobile ON public.upcoming_payments(customer_mobile);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.upcoming_payments TO authenticated;
GRANT ALL ON public.upcoming_payments TO service_role;
GRANT USAGE ON SEQUENCE public.upcoming_payments_serial_seq TO authenticated, service_role;

ALTER TABLE public.upcoming_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage upcoming payments"
ON public.upcoming_payments FOR ALL
TO authenticated
USING (true) WITH CHECK (true);

CREATE TRIGGER trg_upcoming_payments_updated_at
BEFORE UPDATE ON public.upcoming_payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
