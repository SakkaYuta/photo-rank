-- Replace admin helper without changing signature (avoids 42P13/42723)
-- Safe: CREATE OR REPLACE with identical parameter name 'p_user'

DO $$ BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE NOTICE 'public.users not found; skipping is_admin_strict replace.';
    RETURN;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_admin_strict(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_user
      AND (
        u.user_type = 'admin'
        OR (u.metadata ->> 'is_admin')::boolean IS TRUE
      )
  )
$$;
COMMENT ON FUNCTION public.is_admin_strict(uuid) IS 'App-level admin check from users.user_type/metadata';

