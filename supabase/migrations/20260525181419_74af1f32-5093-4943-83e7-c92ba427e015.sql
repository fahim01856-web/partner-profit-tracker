
-- Remove insecure legacy storage policies on documents bucket
DROP POLICY IF EXISTS "doc public read" ON storage.objects;
DROP POLICY IF EXISTS "doc auth delete" ON storage.objects;
DROP POLICY IF EXISTS "doc auth insert" ON storage.objects;
DROP POLICY IF EXISTS "doc auth update" ON storage.objects;

-- Restrict realtime messages to admins
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins receive realtime" ON realtime.messages;
CREATE POLICY "admins receive realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
