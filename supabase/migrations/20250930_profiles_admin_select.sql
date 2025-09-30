-- Admin read access on profiles for backoffice joins (conditional)
DO $$ BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS profiles_admin_select ON public.profiles;
    CREATE POLICY profiles_admin_select ON public.profiles
      FOR SELECT USING (public.is_admin_strict(auth.uid()));
  END IF;
END $$;

