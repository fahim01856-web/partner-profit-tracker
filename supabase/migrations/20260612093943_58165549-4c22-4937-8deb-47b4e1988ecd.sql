
-- agent_bank_investments
DROP POLICY IF EXISTS "Authenticated can read agent_bank_investments" ON public.agent_bank_investments;
DROP POLICY IF EXISTS "Authenticated can insert agent_bank_investments" ON public.agent_bank_investments;
DROP POLICY IF EXISTS "Authenticated can update agent_bank_investments" ON public.agent_bank_investments;
DROP POLICY IF EXISTS "Authenticated can delete agent_bank_investments" ON public.agent_bank_investments;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='agent_bank_investments' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.agent_bank_investments', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "Admins manage agent_bank_investments" ON public.agent_bank_investments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- loan_persons
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='loan_persons' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.loan_persons', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "Admins manage loan_persons" ON public.loan_persons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- loan_transactions
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='loan_transactions' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.loan_transactions', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "Admins manage loan_transactions" ON public.loan_transactions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- document_categories
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='document_categories' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.document_categories', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "Admins manage document_categories" ON public.document_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- pending_categories
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='pending_categories' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.pending_categories', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "Admins manage pending_categories" ON public.pending_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
