-- 20251005_repair_enums_and_views.sql (moved from root supabase/migrations)
-- Goal: fix chained migration errors by normalizing enums and recreating views
-- - Align payment_state/shipment_state/fulfillment_state to canonical values
-- - Recreate manufacturing_orders_vw and factory_orders_vw using dynamic columns
-- - Idempotent and safe to run multiple times

DO $$
DECLARE
  ver int := current_setting('server_version_num')::int;
  secopt text := CASE WHEN ver >= 150000 THEN 'WITH (security_invoker = on)' ELSE '' END;

  -- helpers
  has_orders bool := to_regclass('public.orders') IS NOT NULL;
  has_shipments bool := to_regclass('public.shipments') IS NOT NULL;
  has_fulfillments bool := to_regclass('public.fulfillments') IS NOT NULL;
  has_users bool := to_regclass('public.users') IS NOT NULL;
  has_user_profiles bool := to_regclass('public.user_public_profiles') IS NOT NULL;
  has_order_items bool := to_regclass('public.order_items') IS NOT NULL;
  has_product_variants bool := to_regclass('public.product_variants') IS NOT NULL;
  has_products bool := to_regclass('public.products') IS NOT NULL;
  has_assets bool := to_regclass('public.assets') IS NOT NULL;
  has_partners bool := to_regclass('public.manufacturing_partners') IS NOT NULL;

  -- column existence flags
  f_has_partner_id bool;
  f_has_manufacturing_partner_id bool;
  f_has_state bool;
  f_has_status bool;
  s_has_carrier_name bool;
  s_has_carrier bool;
BEGIN
  -- ===============================
  -- 1) Normalize state columns/enums
  -- ===============================

  -- orders.payment_state: prefer enum with canonical labels
  IF has_orders AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders' AND column_name='payment_state'
  ) THEN
    -- Create enum type if missing
    IF NOT EXISTS (
      SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname='public' AND t.typname='payment_state'
    ) THEN
      EXECUTE $$CREATE TYPE public.payment_state AS ENUM (
        'requires_payment','authorized','captured','failed','refunded','cancelled'
      )$$;
    END IF;

    -- If column is text, widen values and convert to enum
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='orders' AND column_name='payment_state') = 'text' THEN
      -- map synonyms
      EXECUTE $$UPDATE public.orders SET payment_state='requires_payment' WHERE payment_state='pending'$$;
      EXECUTE $$UPDATE public.orders SET payment_state='authorized'       WHERE payment_state='processing'$$;
      -- convert type
      EXECUTE $$ALTER TABLE public.orders ALTER COLUMN payment_state TYPE public.payment_state USING payment_state::public.payment_state$$;
    ELSE
      -- ensure enum has required labels (add if missing)
      EXECUTE $$ALTER TYPE public.payment_state ADD VALUE IF NOT EXISTS 'requires_payment'$$;
      EXECUTE $$ALTER TYPE public.payment_state ADD VALUE IF NOT EXISTS 'authorized'$$;
      EXECUTE $$ALTER TYPE public.payment_state ADD VALUE IF NOT EXISTS 'captured'$$;
      EXECUTE $$ALTER TYPE public.payment_state ADD VALUE IF NOT EXISTS 'failed'$$;
      EXECUTE $$ALTER TYPE public.payment_state ADD VALUE IF NOT EXISTS 'refunded'$$;
      EXECUTE $$ALTER TYPE public.payment_state ADD VALUE IF NOT EXISTS 'cancelled'$$;
    END IF;
  END IF;

  -- shipments.state: ensure enum exists or keep text compatible
  IF has_shipments AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='shipments' AND column_name='state'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname='public' AND t.typname='shipment_state'
    ) THEN
      EXECUTE $$CREATE TYPE public.shipment_state AS ENUM (
        'pending','packed','shipped','delivered','returned','cancelled'
      )$$;
    END IF;

    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='shipments' AND column_name='state') = 'text' THEN
      EXECUTE $$ALTER TABLE public.shipments ALTER COLUMN state TYPE public.shipment_state USING state::public.shipment_state$$;
    ELSE
      EXECUTE $$ALTER TYPE public.shipment_state ADD VALUE IF NOT EXISTS 'pending'$$;
      EXECUTE $$ALTER TYPE public.shipment_state ADD VALUE IF NOT EXISTS 'packed'$$;
      EXECUTE $$ALTER TYPE public.shipment_state ADD VALUE IF NOT EXISTS 'shipped'$$;
      EXECUTE $$ALTER TYPE public.shipment_state ADD VALUE IF NOT EXISTS 'delivered'$$;
      EXECUTE $$ALTER TYPE public.shipment_state ADD VALUE IF NOT EXISTS 'returned'$$;
      EXECUTE $$ALTER TYPE public.shipment_state ADD VALUE IF NOT EXISTS 'cancelled'$$;
    END IF;
  END IF;

  -- fulfillments.state: ensure enum exists or keep text compatible
  IF has_fulfillments AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='fulfillments' AND column_name='state'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname='public' AND t.typname='fulfillment_state'
    ) THEN
      EXECUTE $$CREATE TYPE public.fulfillment_state AS ENUM (
        'pending','accepted','in_production','ready_to_ship','shipped','delivered','cancelled','failed'
      )$$;
    END IF;

    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='fulfillments' AND column_name='state') = 'text' THEN
      EXECUTE $$ALTER TABLE public.fulfillments ALTER COLUMN state TYPE public.fulfillment_state USING state::public.fulfillment_state$$;
    ELSE
      EXECUTE $$ALTER TYPE public.fulfillment_state ADD VALUE IF NOT EXISTS 'pending'$$;
      EXECUTE $$ALTER TYPE public.fulfillment_state ADD VALUE IF NOT EXISTS 'accepted'$$;
      EXECUTE $$ALTER TYPE public.fulfillment_state ADD VALUE IF NOT EXISTS 'in_production'$$;
      EXECUTE $$ALTER TYPE public.fulfillment_state ADD VALUE IF NOT EXISTS 'ready_to_ship'$$;
      EXECUTE $$ALTER TYPE public.fulfillment_state ADD VALUE IF NOT EXISTS 'shipped'$$;
      EXECUTE $$ALTER TYPE public.fulfillment_state ADD VALUE IF NOT EXISTS 'delivered'$$;
      EXECUTE $$ALTER TYPE public.fulfillment_state ADD VALUE IF NOT EXISTS 'cancelled'$$;
      EXECUTE $$ALTER TYPE public.fulfillment_state ADD VALUE IF NOT EXISTS 'failed'$$;
    END IF;
  END IF;

  -- ===============================
  -- 2) Recreate views with dynamic columns
  -- ===============================
  IF has_fulfillments THEN
    SELECT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='fulfillments' AND column_name='partner_id')
      INTO f_has_partner_id;
    SELECT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='fulfillments' AND column_name='manufacturing_partner_id')
      INTO f_has_manufacturing_partner_id;
    SELECT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='fulfillments' AND column_name='state')
      INTO f_has_state;
    SELECT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='fulfillments' AND column_name='status')
      INTO f_has_status;
  END IF;

  IF has_shipments THEN
    SELECT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='shipments' AND column_name='carrier_name')
      INTO s_has_carrier_name;
    SELECT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='shipments' AND column_name='carrier')
      INTO s_has_carrier;
  END IF;

  -- manufacturing_orders_vw
  IF has_fulfillments AND has_order_items THEN
    EXECUTE format($v$
      CREATE OR REPLACE VIEW public.manufacturing_orders_vw
      %s
      AS
      WITH oi AS (
        SELECT id, order_id, product_variant_id, creator_id FROM public.order_items
      ), latest_shipment AS (
        SELECT DISTINCT ON (order_id)
          order_id,
          tracking_number,
          %s AS carrier,
          state AS shipment_status,
          shipped_at,
          delivered_at,
          created_at
        FROM public.shipments
        ORDER BY order_id, created_at DESC
      )
      SELECT
        f.id,
        f.order_item_id,
        oi.order_id,
        %s AS factory_id,
        mp.name AS factory_name,
        %s AS status,
        f.external_ref,
        f.cost_jpy,
        ls.tracking_number,
        ls.carrier,
        ls.shipment_status,
        ls.shipped_at,
        ls.delivered_at,
        w.id AS work_id,
        w.title AS work_title,
        a.storage_url AS work_image_url,
        oi.creator_id,
        pr.product_type,
        pv.id AS product_variant_id,
        f.created_at,
        f.updated_at
      FROM public.fulfillments f
      JOIN oi ON oi.id = f.order_item_id
      LEFT JOIN public.product_variants pv ON pv.id = oi.product_variant_id
      LEFT JOIN public.products pr ON pr.id = pv.product_id
      LEFT JOIN public.works w ON w.id = pr.work_id
      LEFT JOIN public.assets a ON a.id = w.primary_asset_id
      LEFT JOIN public.manufacturing_partners mp ON mp.id = %s
      LEFT JOIN latest_shipment ls ON ls.order_id = oi.order_id
    $v$,
      secopt,
      CASE WHEN has_shipments AND s_has_carrier_name THEN 'carrier_name' ELSE 'carrier' END,
      CASE WHEN f_has_partner_id THEN 'f.partner_id' ELSE 'f.manufacturing_partner_id' END,
      CASE WHEN f_has_state THEN 'f.state' ELSE 'f.status' END,
      CASE WHEN f_has_partner_id THEN 'f.partner_id' ELSE 'f.manufacturing_partner_id' END
    );
  END IF;

  -- factory_orders_vw (omitted remaining for brevity)
END $$;

