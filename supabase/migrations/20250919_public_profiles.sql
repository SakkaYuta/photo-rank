-- Public profiles table synced from users for safe public display

CREATE TABLE IF NOT EXISTS public.user_public_profiles (
  id uuid PRIMARY KEY,
  display_name text,
  avatar_url text,
  updated_at timestamptz DEFAULT now()
);

-- Sync trigger: upsert on users insert/update
CREATE OR REPLACE FUNCTION public.sync_user_public_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_public_profiles (id, display_name, avatar_url, updated_at)
  VALUES (NEW.id, NEW.display_name, NEW.avatar_url, now())
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cleanup trigger: delete on users delete
CREATE OR REPLACE FUNCTION public.delete_user_public_profile()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.user_public_profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to users table
DROP TRIGGER IF EXISTS trg_users_sync_public_profile ON public.users;
CREATE TRIGGER trg_users_sync_public_profile
AFTER INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.sync_user_public_profile();

DROP TRIGGER IF EXISTS trg_users_delete_public_profile ON public.users;
CREATE TRIGGER trg_users_delete_public_profile
AFTER DELETE ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.delete_user_public_profile();

-- RLS: allow public read-only access to safe fields
ALTER TABLE public.user_public_profiles ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies if exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_public_profiles') THEN
    -- no-op; we'll (re)create below
  END IF;
END $$;

-- Everyone can read public profiles
CREATE POLICY upp_read_all ON public.user_public_profiles
  FOR SELECT USING (true);

-- No direct writes by clients (only triggers/owners)
CREATE POLICY upp_no_insert ON public.user_public_profiles
  FOR INSERT WITH CHECK (false);
CREATE POLICY upp_no_update ON public.user_public_profiles
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY upp_no_delete ON public.user_public_profiles
  FOR DELETE USING (false);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_upp_updated_at ON public.user_public_profiles(updated_at DESC);

-- Backfill existing
INSERT INTO public.user_public_profiles (id, display_name, avatar_url)
SELECT id, display_name, avatar_url FROM public.users
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, avatar_url = EXCLUDED.avatar_url;

-- Mark migration
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_public_profiles_20250919', 'local')
ON CONFLICT (version) DO NOTHING;

