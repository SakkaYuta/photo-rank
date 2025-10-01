-- Ensure SECURITY DEFINER functions run with a safe, fixed search_path
-- This avoids hijacking via altered search_path at execution time.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'complete_purchase_transaction'
      AND (p.oid::regprocedure)::text = 'complete_purchase_transaction(text, uuid, uuid, integer, text, uuid)'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.complete_purchase_transaction(text, uuid, uuid, integer, text, uuid) SET search_path = public, pg_temp';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'restore_work_availability'
      AND (p.oid::regprocedure)::text = 'restore_work_availability(uuid, integer)'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.restore_work_availability(uuid, integer) SET search_path = public, pg_temp';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'is_admin_strict'
      AND (p.oid::regprocedure)::text = 'is_admin_strict(uuid)'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.is_admin_strict(uuid) SET search_path = public, pg_temp';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'is_moderator_or_admin'
      AND (p.oid::regprocedure)::text = 'is_moderator_or_admin(uuid)'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.is_moderator_or_admin(uuid) SET search_path = public, pg_temp';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'audit_trigger'
      AND (p.oid::regprocedure)::text = 'audit_trigger()'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.audit_trigger() SET search_path = public, pg_temp';
  END IF;
END $$;
-- ARCHIVED: superseded by later search_path fixes.
-- Kept for history; do not run in new setups.
