-- Storage Policy Updates for Enhanced Security
-- Execute in order to update bucket permissions

-- Optional: Set admin role (uncomment if needed)
-- SET LOCAL ROLE supabase_admin;

-- 1. user-content bucket: Public READ for specific prefixes
DROP POLICY IF EXISTS public_read_user_content ON storage.objects;
CREATE POLICY public_read_user_content
ON storage.objects FOR SELECT
USING (
    bucket_id = 'user-content'
    AND (
        name LIKE 'defaults/%'
        OR name LIKE 'samples/%'
        OR name LIKE 'avatars/%'
    )
);

-- 2. photos-watermarked bucket: Public READ for necessary paths
DROP POLICY IF EXISTS public_read_watermarked ON storage.objects;
CREATE POLICY public_read_watermarked
ON storage.objects FOR SELECT
USING (
    bucket_id = 'photos-watermarked'
    AND (
        name LIKE 'works/%'
        OR name LIKE 'marketplace/%'
    )
);

-- 3. photos-original bucket: Strict access control (Creator RW, Organizer/Admin R)
DROP POLICY IF EXISTS original_creator_read ON storage.objects;
DROP POLICY IF EXISTS original_creator_write ON storage.objects;
DROP POLICY IF EXISTS original_org_admin_read ON storage.objects;

CREATE POLICY original_creator_read
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'photos-original'
    AND split_part(name, '/', 1) = 'works'
    AND split_part(name, '/', 2) = auth.uid()::text
);

CREATE POLICY original_creator_write
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'photos-original'
    AND split_part(name, '/', 1) = 'works'
    AND split_part(name, '/', 2) = auth.uid()::text
);

CREATE POLICY original_org_admin_read
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'photos-original'
    AND (
        public.is_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND COALESCE(u.user_type, '') = 'organizer'
        )
    )
);