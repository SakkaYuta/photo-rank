-- Consolidation/cleanup of duplicate or legacy tables
-- Safe to run multiple times; guarded with IF EXISTS checks

-- 1) partner_notifications: unify schema to app-expected columns
DO $$ BEGIN
  IF to_regclass('public.partner_notifications') IS NOT NULL THEN
    -- Add canonical columns if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='partner_notifications' AND column_name='notification_type'
    ) THEN
      ALTER TABLE public.partner_notifications ADD COLUMN notification_type text;
      -- Backfill from legacy "type" column if present
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='partner_notifications' AND column_name='type'
      ) THEN
        EXECUTE 'UPDATE public.partner_notifications SET notification_type = type WHERE notification_type IS NULL';
      END IF;
    END IF;

    -- Unify status values: allow pending/sent/failed/retry
    -- Drop any existing CHECK constraint named variably
    BEGIN
      ALTER TABLE public.partner_notifications DROP CONSTRAINT IF EXISTS partner_notifications_status_check;
    EXCEPTION WHEN others THEN
      NULL;
    END;
    ALTER TABLE public.partner_notifications 
      ADD CONSTRAINT partner_notifications_status_check 
      CHECK (status IN ('pending','sent','failed','retry'));

    -- Add missing operational columns (idempotent)
    ALTER TABLE public.partner_notifications
      ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal' CHECK (priority IN ('high','normal','low')),
      ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
      ADD COLUMN IF NOT EXISTS response_code integer,
      ADD COLUMN IF NOT EXISTS response_body text,
      ADD COLUMN IF NOT EXISTS error_message text,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

    -- Map legacy queued -> pending
    EXECUTE 'UPDATE public.partner_notifications SET status = ''pending'' WHERE status = ''queued''';

    -- Optionally keep legacy column for audit; rename to old_type if present and not yet renamed
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='partner_notifications' AND column_name='type'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='partner_notifications' AND column_name='old_type'
    ) THEN
      ALTER TABLE public.partner_notifications RENAME COLUMN type TO old_type;
    END IF;

    -- Ensure RLS is enabled (policies may be defined elsewhere)
    ALTER TABLE public.partner_notifications ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 2) Replace legacy webhook_events with stripe_webhook_events in monitoring view; drop old table
DO $$ BEGIN
  -- Recreate realtime_metrics view to reference stripe_webhook_events
  IF to_regclass('public.work_availability') IS NOT NULL THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.realtime_metrics AS
      SELECT
        (SELECT COUNT(*) FROM public.purchases WHERE purchased_at >= NOW() - INTERVAL ''1 hour'') AS hourly_purchases,
        (SELECT COALESCE(SUM(price),0) FROM public.purchases WHERE purchased_at >= NOW() - INTERVAL ''1 hour'') AS hourly_revenue,
        (SELECT COUNT(*) FROM public.work_availability WHERE locked_until > NOW()) AS active_locks,
        (SELECT COUNT(*) FROM public.work_availability WHERE locked_until < NOW() AND locked_until IS NOT NULL) AS expired_locks,
        (SELECT COUNT(*) FROM public.stripe_webhook_events WHERE created_at >= NOW() - INTERVAL ''1 hour'') AS hourly_webhooks;';
  ELSE
    EXECUTE 'CREATE OR REPLACE VIEW public.realtime_metrics AS
      SELECT
        (SELECT COUNT(*) FROM public.purchases WHERE purchased_at >= NOW() - INTERVAL ''1 hour'') AS hourly_purchases,
        (SELECT COALESCE(SUM(price),0) FROM public.purchases WHERE purchased_at >= NOW() - INTERVAL ''1 hour'') AS hourly_revenue,
        NULL::bigint AS active_locks,
        NULL::bigint AS expired_locks,
        (SELECT COUNT(*) FROM public.stripe_webhook_events WHERE created_at >= NOW() - INTERVAL ''1 hour'') AS hourly_webhooks;';
  END IF;

  -- Drop legacy table if present (not referenced by app)
  IF to_regclass('public.webhook_events') IS NOT NULL THEN
    EXECUTE 'DROP TABLE IF EXISTS public.webhook_events CASCADE';
  END IF;
END $$;

-- 3) manufacturing_orders: drop legacy text column 'partner' if it exists (superseded by partner_id)
DO $$ BEGIN
  IF to_regclass('public.manufacturing_orders') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='manufacturing_orders' AND column_name='partner'
    ) THEN
      ALTER TABLE public.manufacturing_orders DROP COLUMN partner;
    END IF;
  END IF;
END $$;

-- 4) Remove obvious test seed rows that may have been created by dev-only migrations
DO $$ BEGIN
  -- manufacturing_partners test row
  IF to_regclass('public.manufacturing_partners') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.manufacturing_partners 
              WHERE name = ''Test Manufacturing Partner'' 
                AND contact_email = ''test@partner.com''';
  END IF;

  -- Users test row (only if users has an email column)
  IF to_regclass('public.users') IS NOT NULL AND EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='email'
  ) THEN
    EXECUTE 'DELETE FROM public.users WHERE email IN (''test@example.com'')';
  END IF;
END $$;

-- 5) Mark migration (if you maintain a tracker)
DO $$ BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    INSERT INTO public.schema_migrations(version, checksum)
    VALUES ('v5.0_cleanup_unify_20250919', 'local')
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;
