-- Fix storage SELECT policy on staff photos: restrict to authenticated admins
DROP POLICY IF EXISTS "staff_photos_select" ON storage.objects;

CREATE POLICY "staff_photos_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'staff' AND has_role(auth.uid(), 'admin'));

-- Strip signed URL query strings; keep only the object path for staff photos
UPDATE public.staff
SET photo_url = regexp_replace(
  regexp_replace(photo_url, '^.*/object/sign/documents/', ''),
  '\?.*$', ''
)
WHERE photo_url IS NOT NULL AND photo_url LIKE '%/object/sign/documents/%';
