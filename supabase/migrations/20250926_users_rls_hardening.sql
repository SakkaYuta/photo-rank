-- Users RLS hardening and admin/service policies
-- Idempotent and safe to run multiple times

DO $$ BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE NOTICE 'public.users not found; skipping users RLS hardening.';
    RETURN;
  END IF;
END $$;

-- 1) Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2) Helper: detect service_role JWT
CREATE OR REPLACE FUNCTION public.current_role_is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role','') = 'service_role'
$$;
COMMENT ON FUNCTION public.current_role_is_service_role IS 'Returns true if JWT role claim is service_role';

-- Drop any existing is_admin_strict(uuid) then recreate with a stable signature (param name p_user)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin_strict'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid'
  ) THEN
    EXECUTE 'DROP FUNCTION public.is_admin_strict(uuid)';
  END IF;
END $$;

CREATE FUNCTION public.is_admin_strict(p_user uuid)
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

-- 4) Drop existing policies to avoid conflicts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='users_self_select') THEN
    EXECUTE 'DROP POLICY "users_self_select" ON public.users';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='users_self_modify') THEN
    EXECUTE 'DROP POLICY "users_self_modify" ON public.users';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='users_self_insert') THEN
    EXECUTE 'DROP POLICY "users_self_insert" ON public.users';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='users_admin_delete') THEN
    EXECUTE 'DROP POLICY "users_admin_delete" ON public.users';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='users_admin_all') THEN
    EXECUTE 'DROP POLICY "users_admin_all" ON public.users';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='service_role_bypass_users') THEN
    EXECUTE 'DROP POLICY service_role_bypass_users ON public.users';
  END IF;
END $$;

-- 5) Self policies (SELECT/UPDATE/INSERT)
CREATE POLICY "users_self_select" ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_self_insert" ON public.users
  FOR INSERT WITH CHECK (id = auth.uid());

-- 6) Admin all (read/write/delete)
CREATE POLICY users_admin_all ON public.users
  FOR ALL USING (public.is_admin_strict(auth.uid()))
  WITH CHECK (public.is_admin_strict(auth.uid()));

-- 7) service_role bypass (Edge Functions / server)
CREATE POLICY service_role_bypass_users ON public.users
  FOR ALL USING (public.current_role_is_service_role())
  WITH CHECK (public.current_role_is_service_role());

-- 8) Helpful index
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Notes:
-- - Public readは user_public_profiles ビューに委譲し、users は本人/管理者/サービスのみアクセス可能にします。
-- - 管理者判定は users.user_type='admin' または metadata.is_admin=true を想定。
