DROP POLICY IF EXISTS staff_photos_select ON storage.objects;
CREATE POLICY staff_photos_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'staff'
    AND has_role(auth.uid(), 'admin'::app_role)
  );