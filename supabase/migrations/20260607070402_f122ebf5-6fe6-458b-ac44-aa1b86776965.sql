
-- Replace permissive policies with admin-only checks
DROP POLICY IF EXISTS "auth all cash_book" ON public.cash_book_entries;
CREATE POLICY "admin all cash_book" ON public.cash_book_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "auth all cash_book_opening" ON public.cash_book_opening;
CREATE POLICY "admin all cash_book_opening" ON public.cash_book_opening
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "auth all inv_dist" ON public.inventory_distributions;
CREATE POLICY "admin all inv_dist" ON public.inventory_distributions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "auth all inv_receipts" ON public.inventory_receipts;
CREATE POLICY "admin all inv_receipts" ON public.inventory_receipts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "auth all signature_cards" ON public.signature_cards;
CREATE POLICY "admin all signature_cards" ON public.signature_cards
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket: signature-cards (admin-only)
DROP POLICY IF EXISTS "sig auth read" ON storage.objects;
DROP POLICY IF EXISTS "sig auth write" ON storage.objects;
DROP POLICY IF EXISTS "sig auth update" ON storage.objects;
DROP POLICY IF EXISTS "sig auth delete" ON storage.objects;

CREATE POLICY "sig admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'signature-cards' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "sig admin write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signature-cards' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "sig admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'signature-cards' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'signature-cards' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "sig admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'signature-cards' AND public.has_role(auth.uid(), 'admin'::app_role));
