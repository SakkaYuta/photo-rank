-- Admin access for refund_requests and purchases
DO $$ BEGIN
  -- refund_requests: allow admins to read/write all
  IF to_regclass('public.refund_requests') IS NOT NULL THEN
    DROP POLICY IF EXISTS refund_requests_admin_all ON public.refund_requests;
    CREATE POLICY refund_requests_admin_all ON public.refund_requests
      FOR ALL USING (public.is_admin_strict(auth.uid()))
      WITH CHECK (public.is_admin_strict(auth.uid()));
  END IF;

  -- purchases: allow admins to read for joins in admin tools
  IF to_regclass('public.purchases') IS NOT NULL THEN
    DROP POLICY IF EXISTS purchases_admin_select ON public.purchases;
    CREATE POLICY purchases_admin_select ON public.purchases
      FOR SELECT USING (public.is_admin_strict(auth.uid()));
  END IF;
END $$;

