-- Idempotent triggers for webhook-related tables to avoid 42710 errors

-- Ensure helper function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- stripe_webhook_events
DO $$ BEGIN
  IF to_regclass('public.stripe_webhook_events') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'update_stripe_webhook_events_updated_at'
      AND n.nspname = 'public'
      AND c.relname = 'stripe_webhook_events'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_stripe_webhook_events_updated_at
      BEFORE UPDATE ON public.stripe_webhook_events
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END $$;

-- partner_notifications
DO $$ BEGIN
  IF to_regclass('public.partner_notifications') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'update_partner_notifications_updated_at'
      AND n.nspname = 'public'
      AND c.relname = 'partner_notifications'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_partner_notifications_updated_at
      BEFORE UPDATE ON public.partner_notifications
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END $$;

