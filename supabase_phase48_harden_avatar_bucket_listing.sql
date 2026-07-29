-- Phase 48 — Keep public avatar URLs but block public bucket listing

BEGIN;

DROP POLICY IF EXISTS "Public can read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own avatar objects" ON storage.objects;

CREATE POLICY "Users can view own avatar objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

COMMIT;
