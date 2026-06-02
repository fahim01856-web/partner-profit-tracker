ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS nid text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS emergency_contact text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS date_of_birth date;

-- Storage policies for staff photos (uses existing 'documents' bucket under staff/ prefix)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_photos_select' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "staff_photos_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'staff');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_photos_insert' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "staff_photos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'staff' AND has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_photos_update' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "staff_photos_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'staff' AND has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_photos_delete' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "staff_photos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'staff' AND has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;