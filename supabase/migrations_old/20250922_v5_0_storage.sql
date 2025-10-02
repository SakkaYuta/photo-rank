-- v5.0 storage buckets and RLS policies for previews/originals

-- Create buckets if not exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos-watermarked', 'photos-watermarked', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('photos-original', 'photos-original', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects (already enabled by default in Supabase)
-- Public read policy for watermarked previews
DROP POLICY IF EXISTS public_read_photos_watermarked ON storage.objects;
CREATE POLICY public_read_photos_watermarked ON storage.objects
  FOR SELECT USING (
    bucket_id = 'photos-watermarked'
  );

-- Owner write policies (photos-watermarked)
DROP POLICY IF EXISTS owner_write_photos_watermarked ON storage.objects;
CREATE POLICY owner_write_photos_watermarked ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'photos-watermarked' AND
    (storage.foldername(name))[1] = 'watermarked' AND
    auth.uid()::text = (storage.foldername(name))[2]
  );

DROP POLICY IF EXISTS owner_update_photos_watermarked ON storage.objects;
CREATE POLICY owner_update_photos_watermarked ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'photos-watermarked' AND
    (storage.foldername(name))[1] = 'watermarked' AND
    auth.uid()::text = (storage.foldername(name))[2]
  ) WITH CHECK (
    bucket_id = 'photos-watermarked' AND
    (storage.foldername(name))[1] = 'watermarked' AND
    auth.uid()::text = (storage.foldername(name))[2]
  );

DROP POLICY IF EXISTS owner_delete_photos_watermarked ON storage.objects;
CREATE POLICY owner_delete_photos_watermarked ON storage.objects
  FOR DELETE USING (
    bucket_id = 'photos-watermarked' AND
    (storage.foldername(name))[1] = 'watermarked' AND
    auth.uid()::text = (storage.foldername(name))[2]
  );

-- Private originals: only owner may access their path
DROP POLICY IF EXISTS owner_select_photos_original ON storage.objects;
CREATE POLICY owner_select_photos_original ON storage.objects
  FOR SELECT USING (
    bucket_id = 'photos-original' AND
    (storage.foldername(name))[1] = 'originals' AND
    auth.uid()::text = (storage.foldername(name))[2]
  );

DROP POLICY IF EXISTS owner_insert_photos_original ON storage.objects;
CREATE POLICY owner_insert_photos_original ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'photos-original' AND
    (storage.foldername(name))[1] = 'originals' AND
    auth.uid()::text = (storage.foldername(name))[2]
  );

DROP POLICY IF EXISTS owner_update_photos_original ON storage.objects;
CREATE POLICY owner_update_photos_original ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'photos-original' AND
    (storage.foldername(name))[1] = 'originals' AND
    auth.uid()::text = (storage.foldername(name))[2]
  ) WITH CHECK (
    bucket_id = 'photos-original' AND
    (storage.foldername(name))[1] = 'originals' AND
    auth.uid()::text = (storage.foldername(name))[2]
  );

DROP POLICY IF EXISTS owner_delete_photos_original ON storage.objects;
CREATE POLICY owner_delete_photos_original ON storage.objects
  FOR DELETE USING (
    bucket_id = 'photos-original' AND
    (storage.foldername(name))[1] = 'originals' AND
    auth.uid()::text = (storage.foldername(name))[2]
  );

-- Seed initial asset_policies (allow/manual examples)
INSERT INTO public.asset_policies (pattern, rule, notes)
VALUES
  ('creativecommons.org', 'allow', 'Creative Commons official'),
  ('wikimedia.org', 'allow', 'Wikimedia assets (check license)'),
  ('twitter.com', 'manual', 'SNS投稿は手動審査'),
  ('x.com', 'manual', 'SNS投稿は手動審査'),
  ('instagram.com', 'manual', 'SNS投稿は手動審査'),
  ('pixiv.net', 'manual', '二次創作/ファンアートは審査')
ON CONFLICT (pattern) DO NOTHING;

-- mark migration
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_storage', 'local')
ON CONFLICT (version) DO NOTHING;

