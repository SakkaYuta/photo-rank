-- Tighten manufacturing_orders RLS: remove overly permissive public SELECT
-- Safe and idempotent: drops only if the policy exists

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manufacturing_orders'
      AND policyname = 'manufacturing_orders_basic_access'
  ) THEN
    EXECUTE 'DROP POLICY "manufacturing_orders_basic_access" ON public.manufacturing_orders';
  END IF;
END $$;

-- Ensure a minimally safe SELECT policy exists (creators, partner owner, or admin)
-- If v5_0_rls policies already exist, this will co-exist safely
DROP POLICY IF EXISTS morders_view_safe ON public.manufacturing_orders;
CREATE POLICY morders_view_safe ON public.manufacturing_orders
  FOR SELECT USING (
    -- Creator of the work/order
    (CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='manufacturing_orders' AND column_name='creator_user_id'
    ) THEN creator_user_id = auth.uid() ELSE false END)
    OR
    -- Owner of the partner (factory)
    EXISTS (
      SELECT 1 FROM public.manufacturing_partners mp
      WHERE mp.id = public.manufacturing_orders.partner_id
        AND (mp.owner_user_id = auth.uid())
    )
    OR
    -- Admin check (if function exists)
    (EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'is_admin_strict'
    ) AND public.is_admin_strict(auth.uid()))
  );

COMMENT ON POLICY morders_view_safe ON public.manufacturing_orders IS 'Restrict SELECT to creator, partner owner, or admin';

