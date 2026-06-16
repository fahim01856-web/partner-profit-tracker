ALTER TABLE public.agent_bank_investments
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS voucher_image_url text;

-- Storage policies for voucher-images bucket
DROP POLICY IF EXISTS "voucher_images_select" ON storage.objects;
DROP POLICY IF EXISTS "voucher_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "voucher_images_update" ON storage.objects;
DROP POLICY IF EXISTS "voucher_images_delete" ON storage.objects;

CREATE POLICY "voucher_images_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'voucher-images');
CREATE POLICY "voucher_images_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voucher-images');
CREATE POLICY "voucher_images_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'voucher-images');
CREATE POLICY "voucher_images_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'voucher-images');