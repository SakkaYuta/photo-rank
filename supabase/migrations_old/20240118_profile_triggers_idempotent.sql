-- Idempotent triggers for profile-related tables to avoid 42710 errors

-- Ensure helper function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- user_notification_settings
DO $$ BEGIN
  IF to_regclass('public.user_notification_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'update_user_notification_settings_updated_at'
      AND n.nspname = 'public'
      AND c.relname = 'user_notification_settings'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_user_notification_settings_updated_at
      BEFORE UPDATE ON public.user_notification_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END $$;

-- user_privacy_settings
DO $$ BEGIN
  IF to_regclass('public.user_privacy_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'update_user_privacy_settings_updated_at'
      AND n.nspname = 'public'
      AND c.relname = 'user_privacy_settings'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_user_privacy_settings_updated_at
      BEFORE UPDATE ON public.user_privacy_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END $$;

