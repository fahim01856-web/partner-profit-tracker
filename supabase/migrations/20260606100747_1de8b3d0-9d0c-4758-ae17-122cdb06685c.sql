
CREATE POLICY "sig auth read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'signature-cards');
CREATE POLICY "sig auth write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signature-cards');
CREATE POLICY "sig auth update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'signature-cards');
CREATE POLICY "sig auth delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'signature-cards');
