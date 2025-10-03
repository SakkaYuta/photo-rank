-- Moved from root: ensure views run with caller privileges (PG15+)
DO $$
DECLARE
  ver int := current_setting('server_version_num')::int;
BEGIN
  IF ver >= 150000 THEN
    IF to_regclass('public.manufacturing_orders_vw') IS NOT NULL THEN
      EXECUTE 'ALTER VIEW public.manufacturing_orders_vw SET (security_invoker = on)';
      RAISE NOTICE 'Set security_invoker=on for public.manufacturing_orders_vw';
    END IF;
    IF to_regclass('public.factory_orders_vw') IS NOT NULL THEN
      EXECUTE 'ALTER VIEW public.factory_orders_vw SET (security_invoker = on)';
      RAISE NOTICE 'Set security_invoker=on for public.factory_orders_vw';
    END IF;
  ELSE
    RAISE NOTICE 'PostgreSQL < 15 detected. security_invoker is unavailable. Consider replacing sensitive views with RLS-safe functions or gate via RLS on base tables.';
  END IF;
END $$;

