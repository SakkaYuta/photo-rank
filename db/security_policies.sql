-- Security Policies for Supabase (Postgres)
-- Apply with psql or Supabase SQL Editor in the project.

-- Enable RLS on works table
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;

-- Allow SELECT only for active works or own drafts
CREATE POLICY works_select_policy ON public.works
  FOR SELECT
  USING (
    is_active = true
    OR creator_id = auth.uid()
  );

-- Only the authenticated user can INSERT their own record
CREATE POLICY works_insert_policy ON public.works
  FOR INSERT
  WITH CHECK (
    creator_id = auth.uid()
    AND (is_active = false OR is_active IS NULL)
  );

-- UPDATE allowed only by owner; publication flag guarded by server-side workflow (disallow true here)
CREATE POLICY works_update_policy ON public.works
  FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (
    creator_id = auth.uid()
    AND (is_active = is_active AND is_active = false) -- prohibit switching to true here
  );

-- Optional: separate policy for moderators/admins (assumes a JWT claim 'role')
-- CREATE POLICY works_admin_update ON public.works FOR UPDATE
--   USING (auth.jwt() ->> 'role' IN ('admin','moderator'))
--   WITH CHECK (true);

-- Enforce sale_end_at not beyond 365 days from sale_start_at
ALTER TABLE public.works
  ADD CONSTRAINT sale_period_max_1y
  CHECK (
    sale_start_at IS NULL OR sale_end_at IS NULL OR
    sale_end_at <= sale_start_at + interval '365 days'
  );

-- Storage policies (example). Replace 'user-content' with your bucket id.
-- Ensure the bucket is set to 'private' in Supabase Storage settings.
-- Policy: users can upload only under their own prefix
CREATE POLICY storage_insert_user_prefix
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-content'
  AND (storage.foldername(name))[1] = 'uploads'
  AND (storage.foldername(name))[2] = 'works'
  AND (storage.foldername(name))[3] = auth.uid()::text
);

-- Policy: users can read only their own originals; previews should be served via signed URLs
CREATE POLICY storage_select_user_prefix
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-content'
  AND (storage.foldername(name))[1] = 'uploads'
  AND (storage.foldername(name))[2] = 'works'
  AND (storage.foldername(name))[3] = auth.uid()::text
);

