
-- Tighten upcoming_payments policies: admin-only
DROP POLICY IF EXISTS "Authenticated users can manage upcoming payments" ON public.upcoming_payments;
DROP POLICY IF EXISTS "upcoming_payments_all" ON public.upcoming_payments;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.upcoming_payments;

CREATE POLICY "Admins can select upcoming payments"
ON public.upcoming_payments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert upcoming payments"
ON public.upcoming_payments FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update upcoming payments"
ON public.upcoming_payments FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete upcoming payments"
ON public.upcoming_payments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Tighten voucher-images storage policies: admin-only
DROP POLICY IF EXISTS "voucher_images_select" ON storage.objects;
DROP POLICY IF EXISTS "voucher_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "voucher_images_update" ON storage.objects;
DROP POLICY IF EXISTS "voucher_images_delete" ON storage.objects;

CREATE POLICY "voucher_images_admin_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'voucher-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "voucher_images_admin_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'voucher-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "voucher_images_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'voucher-images' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'voucher-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "voucher_images_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'voucher-images' AND public.has_role(auth.uid(), 'admin'::app_role));
