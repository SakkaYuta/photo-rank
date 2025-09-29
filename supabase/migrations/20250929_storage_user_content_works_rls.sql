-- Secure user-content uploads for works: owner-only access, no public reads
-- Idempotent policies for uploads/works/{uid}/...

-- Ensure bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-content', 'user-content', true)
ON CONFLICT (id) DO NOTHING;

-- Note: if the bucket is public, direct CDN/public URLs may bypass RLS.
-- We keep the bucket as-is to avoid breaking avatars; consider migrating works to a private bucket.

-- Do not ALTER storage.objects here to avoid ownership issues on hosted environments

-- Owner-only SELECT on uploads/works/{uid}/... (create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'uc_works_owner_select'
  ) THEN
    CREATE POLICY uc_works_owner_select ON storage.objects
      FOR SELECT USING (
        bucket_id = 'user-content'
        AND name LIKE ('uploads/works/' || auth.uid() || '/%')
      );
  END IF;
END$$;

-- Owner-only INSERT on uploads/works/{uid}/... (create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'uc_works_owner_insert'
  ) THEN
    CREATE POLICY uc_works_owner_insert ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'user-content'
        AND name LIKE ('uploads/works/' || auth.uid() || '/%')
      );
  END IF;
END$$;

-- Owner-only UPDATE on uploads/works/{uid}/... (create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'uc_works_owner_update'
  ) THEN
    CREATE POLICY uc_works_owner_update ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'user-content'
        AND name LIKE ('uploads/works/' || auth.uid() || '/%')
      ) WITH CHECK (
        bucket_id = 'user-content'
        AND name LIKE ('uploads/works/' || auth.uid() || '/%')
      );
  END IF;
END$$;

-- Owner-only DELETE on uploads/works/{uid}/... (create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'uc_works_owner_delete'
  ) THEN
    CREATE POLICY uc_works_owner_delete ON storage.objects
      FOR DELETE USING (
        bucket_id = 'user-content'
        AND name LIKE ('uploads/works/' || auth.uid() || '/%')
      );
  END IF;
END$$;

-- Note: avatars policies are defined separately; keep them intact.
