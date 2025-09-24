-- Users table RLS policies: allow users to manage only their own row
-- Safe and idempotent: drops existing policies by name if present

-- Ensure RLS is enabled (should already be enabled in previous migration)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies safely
DROP POLICY IF EXISTS "users_self_select" ON public.users;
DROP POLICY IF EXISTS "users_self_modify" ON public.users;
DROP POLICY IF EXISTS "users_self_insert" ON public.users;
DROP POLICY IF EXISTS "users_admin_delete" ON public.users;

-- Users can SELECT their own profile; admins may view all
CREATE POLICY "users_self_select" ON public.users
  FOR SELECT USING (
    id = auth.uid() OR
    (EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'is_admin_strict'
    ) AND public.is_admin_strict(auth.uid()))
  );

-- Users can UPDATE their own profile; admins may update all
CREATE POLICY "users_self_modify" ON public.users
  FOR UPDATE USING (
    id = auth.uid() OR
    (EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'is_admin_strict'
    ) AND public.is_admin_strict(auth.uid()))
  )
  WITH CHECK (
    id = auth.uid() OR
    (EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'is_admin_strict'
    ) AND public.is_admin_strict(auth.uid()))
  );

-- Users may INSERT their own row (on first login/profile setup)
CREATE POLICY "users_self_insert" ON public.users
  FOR INSERT WITH CHECK (id = auth.uid());

-- Optionally, restrict DELETE to admins only (avoid accidental self-delete)
CREATE POLICY "users_admin_delete" ON public.users
  FOR DELETE USING (
    (EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'is_admin_strict'
    ) AND public.is_admin_strict(auth.uid()))
  );

-- Helpful indexes (id already PK, but email is frequently queried)
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

COMMENT ON POLICY "users_self_select" ON public.users IS 'Users can read their own profile; admins can read all';
COMMENT ON POLICY "users_self_modify" ON public.users IS 'Users can update their own profile; admins can update all';
COMMENT ON POLICY "users_self_insert" ON public.users IS 'Users can insert their own profile row';
COMMENT ON POLICY "users_admin_delete" ON public.users IS 'Only admins can delete user rows';

