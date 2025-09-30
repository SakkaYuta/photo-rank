-- Create a dedicated public bucket for static assets (defaults/samples/avatars)
-- Use storage.create_bucket() to avoid ownership issues on storage.buckets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'public-assets'
  ) THEN
    PERFORM storage.create_bucket('public-assets', public := true);
  END IF;
END $$;
