-- Fix trigger conflicts and ensure idempotent migration
-- Resolves ERROR: 42710: trigger already exists
-- Including stripe_webhook_events trigger conflict fix

-- Drop existing triggers if they exist (safe operation)
DROP TRIGGER IF EXISTS update_works_updated_at ON public.works;
DROP TRIGGER IF EXISTS update_cart_items_updated_at ON public.cart_items;
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_user_notification_settings_updated_at ON public.user_notification_settings;
DROP TRIGGER IF EXISTS update_user_privacy_settings_updated_at ON public.user_privacy_settings;
DROP TRIGGER IF EXISTS update_manufacturing_partners_updated_at ON public.manufacturing_partners;
DROP TRIGGER IF EXISTS update_stripe_webhook_events_updated_at ON public.stripe_webhook_events;

-- Ensure the helper function exists (safe to re-create)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers only if the tables exist
DO $$ BEGIN
  -- works table trigger
  IF to_regclass('public.works') IS NOT NULL THEN
    CREATE TRIGGER update_works_updated_at
      BEFORE UPDATE ON public.works
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- cart_items table trigger
  IF to_regclass('public.cart_items') IS NOT NULL THEN
    CREATE TRIGGER update_cart_items_updated_at
      BEFORE UPDATE ON public.cart_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- users table trigger
  IF to_regclass('public.users') IS NOT NULL THEN
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- user_notification_settings table trigger
  IF to_regclass('public.user_notification_settings') IS NOT NULL THEN
    CREATE TRIGGER update_user_notification_settings_updated_at
      BEFORE UPDATE ON public.user_notification_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- user_privacy_settings table trigger
  IF to_regclass('public.user_privacy_settings') IS NOT NULL THEN
    CREATE TRIGGER update_user_privacy_settings_updated_at
      BEFORE UPDATE ON public.user_privacy_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- manufacturing_partners table trigger
  IF to_regclass('public.manufacturing_partners') IS NOT NULL THEN
    CREATE TRIGGER update_manufacturing_partners_updated_at
      BEFORE UPDATE ON public.manufacturing_partners
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- stripe_webhook_events table trigger
  IF to_regclass('public.stripe_webhook_events') IS NOT NULL THEN
    CREATE TRIGGER update_stripe_webhook_events_updated_at
      BEFORE UPDATE ON public.stripe_webhook_events
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;