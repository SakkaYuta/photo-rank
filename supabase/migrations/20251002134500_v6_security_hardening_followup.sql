-- ============================================================================
-- v6 Security Hardening Follow-up (views + privileges + columns)
-- Date: 2025-10-02
-- Purpose:
--  - Ensure columns exist for RLS policies (is_active/is_available)
--  - Set views to security_invoker to avoid owner-evaluation surprises
--  - Restrict SECURITY DEFINER function execution to service_role
-- Usage: Run in Supabase SQL editor or as part of migrations
-- ============================================================================

-- Ensure gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Columns used in policies (idempotent)
ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE IF EXISTS public.product_variants
  ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true;

-- 2) Views: enable security_invoker if they exist (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='factory_orders_vw') THEN
    EXECUTE 'ALTER VIEW public.factory_orders_vw SET (security_invoker = on)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='purchases_vw') THEN
    EXECUTE 'ALTER VIEW public.purchases_vw SET (security_invoker = on)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='works_vw') THEN
    EXECUTE 'ALTER VIEW public.works_vw SET (security_invoker = on)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='users_vw') THEN
    EXECUTE 'ALTER VIEW public.users_vw SET (security_invoker = on)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='sales_vw') THEN
    EXECUTE 'ALTER VIEW public.sales_vw SET (security_invoker = on)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='refund_requests_vw') THEN
    EXECUTE 'ALTER VIEW public.refund_requests_vw SET (security_invoker = on)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='publishing_approvals_vw') THEN
    EXECUTE 'ALTER VIEW public.publishing_approvals_vw SET (security_invoker = on)';
  END IF;
END$$;

-- 3) SECURITY DEFINER function: lock down execution to service_role
DO $$
DECLARE
  has_func boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public'
      AND p.proname='approve_publishing'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, boolean, uuid, text'
  ) INTO has_func;

  IF has_func THEN
    -- Revoke from public roles; then allow only service_role
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.approve_publishing(uuid, uuid, boolean, uuid, text) FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.approve_publishing(uuid, uuid, boolean, uuid, text) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.approve_publishing(uuid, uuid, boolean, uuid, text) FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.approve_publishing(uuid, uuid, boolean, uuid, text) TO service_role';
  END IF;
END$$;

-- 4) Notices
DO $$
BEGIN
  RAISE NOTICE '✅ Security hardening follow-up applied:';
  RAISE NOTICE '  - products.is_active / product_variants.is_available ensured';
  RAISE NOTICE '  - Views set to security_invoker (if present)';
  RAISE NOTICE '  - approve_publishing() execution limited to service_role';
END$$;

