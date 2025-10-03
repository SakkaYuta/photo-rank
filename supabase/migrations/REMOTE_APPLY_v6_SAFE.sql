-- =====================================================================
-- v6 完全スキーマSQL（安全版 - テーブル存在チェック付き）
-- =====================================================================
-- 作成日: 2025-10-02
-- 目的: v6完全スキーマ適用（テーブル存在確認、安全な参照）
-- 適用方法: Supabase Studio SQL Editor から実行
-- 特徴: テーブル存在チェック、条件付きビュー作成、既存テーブル対応
-- =====================================================================

-- =============================================================================
-- 0. 拡張機能の有効化
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. user_roles テーブル
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('creator', 'organizer', 'factory', 'admin', 'customer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_can_view_own_roles ON user_roles;
CREATE POLICY users_can_view_own_roles ON user_roles
  FOR SELECT USING (user_id = auth.uid());

COMMENT ON TABLE user_roles IS 'v6: User role assignments';


-- =============================================================================
-- 2. products テーブル
-- =============================================================================

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  product_type text NOT NULL CHECK (product_type IN ('digital', 'physical', 'print')),
  base_price_jpy integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 既存テーブルにis_activeカラムを追加（存在しない場合）
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_viewable_by_all ON products;
CREATE POLICY products_viewable_by_all ON products
  FOR SELECT USING (is_active = true);

COMMENT ON TABLE products IS 'v6: Product catalog';


-- =============================================================================
-- 3. product_variants テーブル
-- =============================================================================

CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku text NOT NULL UNIQUE,
  variant_name text,
  price_jpy integer NOT NULL,
  stock_quantity integer DEFAULT 0,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 既存テーブルにis_availableカラムを追加（存在しない場合）
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_variants_viewable_by_all ON product_variants;
CREATE POLICY product_variants_viewable_by_all ON product_variants
  FOR SELECT USING (is_available = true);

COMMENT ON TABLE product_variants IS 'v6: Product SKU variants';


-- =============================================================================
-- 4. orders テーブル
-- =============================================================================

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_state text CHECK (payment_state IN ('pending', 'processing', 'captured', 'failed', 'refunded')),
  total_amount_jpy integer NOT NULL DEFAULT 0,
  tax_amount_jpy integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_can_view_own_orders ON orders;
CREATE POLICY users_can_view_own_orders ON orders
  FOR SELECT USING (user_id = auth.uid());

COMMENT ON TABLE orders IS 'v6: Customer orders';


-- =============================================================================
-- 5. order_items テーブル
-- =============================================================================

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  creator_id uuid REFERENCES users(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_jpy integer NOT NULL,
  subtotal_excl_tax_jpy integer NOT NULL,
  subtotal_tax_jpy integer NOT NULL,
  is_digital boolean DEFAULT false,
  platform_fee_rate_bps integer DEFAULT 1000,
  platform_fee_amount_jpy integer DEFAULT 0,
  creator_earnings_jpy integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_creator_id ON order_items(creator_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_can_view_order_items ON order_items;
CREATE POLICY users_can_view_order_items ON order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
    OR creator_id = auth.uid()
  );

COMMENT ON TABLE order_items IS 'v6: Order line items';


-- =============================================================================
-- 6. fulfillments テーブル
-- =============================================================================

CREATE TABLE IF NOT EXISTS fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  manufacturing_partner_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_production', 'completed', 'shipped', 'failed')),
  tracking_number text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fulfillments_order_item_id ON fulfillments(order_item_id);
CREATE INDEX IF NOT EXISTS idx_fulfillments_status ON fulfillments(status);
CREATE INDEX IF NOT EXISTS idx_fulfillments_manufacturing_partner_id ON fulfillments(manufacturing_partner_id);

-- manufacturing_partners FK（存在する場合のみ）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='manufacturing_partners'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema='public'
        AND table_name='fulfillments'
        AND constraint_name='fulfillments_manufacturing_partner_id_fkey'
    ) THEN
      ALTER TABLE public.fulfillments
        ADD CONSTRAINT fulfillments_manufacturing_partner_id_fkey
        FOREIGN KEY (manufacturing_partner_id)
        REFERENCES public.manufacturing_partners(id)
        ON DELETE SET NULL
        NOT VALID;

      ALTER TABLE public.fulfillments VALIDATE CONSTRAINT fulfillments_manufacturing_partner_id_fkey;
    END IF;
  END IF;
END$$;

ALTER TABLE fulfillments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_can_view_fulfillments ON fulfillments;
CREATE POLICY users_can_view_fulfillments ON fulfillments
  FOR SELECT USING (
    order_item_id IN (
      SELECT oi.id FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.user_id = auth.uid() OR oi.creator_id = auth.uid()
    )
  );

COMMENT ON TABLE fulfillments IS 'v6: Manufacturing and fulfillment tracking';


-- =============================================================================
-- 7. creator_organizers テーブル
-- =============================================================================

CREATE TABLE IF NOT EXISTS creator_organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organizer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'inactive')),
  creator_share_bps integer DEFAULT 7000,
  organizer_share_bps integer DEFAULT 2000,
  platform_share_bps integer DEFAULT 1000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(creator_id, organizer_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_organizers_creator ON creator_organizers(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_creator_organizers_organizer ON creator_organizers(organizer_id, status);

ALTER TABLE creator_organizers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizer_can_view_creators ON creator_organizers;
DROP POLICY IF EXISTS creator_can_view_organizers ON creator_organizers;

CREATE POLICY organizer_can_view_creators ON creator_organizers
  FOR SELECT USING (organizer_id = auth.uid());

CREATE POLICY creator_can_view_organizers ON creator_organizers
  FOR SELECT USING (creator_id = auth.uid());

COMMENT ON TABLE creator_organizers IS 'v6: Creator-organizer relationships';


-- =============================================================================
-- 8. refunds テーブル
-- =============================================================================

CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid,
  stripe_refund_id text,
  amount_jpy integer NOT NULL,
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE refunds IS 'v6: Refund records';


-- =============================================================================
-- 9. sales_vw: v5 sales + purchases ベース（条件付き作成）
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='sales'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='purchases'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE VIEW sales_vw AS
      SELECT
        s.id,
        s.creator_id,
        s.work_id,
        p.user_id AS buyer_id,
        s.amount AS gross_amount,
        s.net_amount,
        (s.amount - s.net_amount) AS tax_amount,
        s.organizer_id,
        s.created_at,
        s.created_at AS updated_at,
        ''confirmed'' AS order_status,
        ''captured'' AS payment_state
      FROM sales s
      LEFT JOIN purchases p ON p.work_id = s.work_id
    ';

    COMMENT ON VIEW sales_vw IS 'v6 compatible: Sales view based on v5 sales + purchases';
    RAISE NOTICE '  ✅ sales_vw 作成完了';
  ELSE
    RAISE NOTICE '  ⚠️  sales_vw スキップ（sales または purchases テーブルなし）';
  END IF;
END$$;


-- =============================================================================
-- 10. factory_orders_vw: v6 fulfillments ベース（推奨方針B）
-- =============================================================================

CREATE OR REPLACE VIEW factory_orders_vw AS
SELECT
  f.id,
  pr.id AS product_id,
  pr.title AS product_name,
  pv.id AS product_variant_id,
  pr.product_type,
  oi.quantity,
  oi.unit_price_jpy,
  f.manufacturing_partner_id AS factory_id,
  o.id AS order_id,
  o.user_id AS customer_id,
  COALESCE(u.email, 'unknown') AS customer_name,
  oi.creator_id,
  f.status,
  f.created_at,
  f.updated_at
FROM fulfillments f
JOIN order_items oi ON oi.id = f.order_item_id
JOIN orders o ON o.id = oi.order_id
LEFT JOIN users u ON u.id = o.user_id
LEFT JOIN product_variants pv ON pv.id = oi.product_variant_id
LEFT JOIN products pr ON pr.id = pv.product_id;

COMMENT ON VIEW factory_orders_vw IS 'v6: Factory orders with customer-facing product info (fulfillments-based, 推奨方針B)';


-- =============================================================================
-- 11. publishing_approvals_vw: v5 works ベース（条件付き作成）
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='works'
  ) THEN
    -- organizersテーブルの存在確認
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='organizers'
    ) THEN
      EXECUTE '
        CREATE OR REPLACE VIEW publishing_approvals_vw AS
        SELECT
          w.id AS work_id,
          w.creator_id,
          w.title,
          w.organizer_id,
          o.name AS organizer_name,
          CASE
            WHEN w.is_published = true THEN ''approved''
            WHEN w.is_published = false THEN ''pending''
            ELSE ''pending''
          END AS status,
          NULL::uuid AS approved_by,
          w.created_at AS requested_at,
          NULL::timestamptz AS approved_at,
          NULL::text AS notes,
          gen_random_uuid() AS id
        FROM works w
        LEFT JOIN organizers o ON o.id = w.organizer_id
        WHERE w.organizer_id IS NOT NULL
      ';
      RAISE NOTICE '  ✅ publishing_approvals_vw 作成完了（organizers参照あり）';
    ELSE
      EXECUTE '
        CREATE OR REPLACE VIEW publishing_approvals_vw AS
        SELECT
          w.id AS work_id,
          w.creator_id,
          w.title,
          w.organizer_id,
          NULL::text AS organizer_name,
          CASE
            WHEN w.is_published = true THEN ''approved''
            WHEN w.is_published = false THEN ''pending''
            ELSE ''pending''
          END AS status,
          NULL::uuid AS approved_by,
          w.created_at AS requested_at,
          NULL::timestamptz AS approved_at,
          NULL::text AS notes,
          gen_random_uuid() AS id
        FROM works w
        WHERE w.organizer_id IS NOT NULL
      ';
      RAISE NOTICE '  ✅ publishing_approvals_vw 作成完了（organizer_name固定NULL）';
    END IF;

    COMMENT ON VIEW publishing_approvals_vw IS 'v6 compatible: Publishing approvals view';
  ELSE
    RAISE NOTICE '  ⚠️  publishing_approvals_vw スキップ（works テーブルなし）';
  END IF;
END$$;


-- =============================================================================
-- 12. purchases_vw: v5 purchases テーブル（条件付き作成）
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='purchases'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE VIEW purchases_vw AS
      SELECT
        p.id,
        p.user_id,
        p.work_id,
        NULL::uuid AS product_id,
        1 AS quantity,
        p.price AS price_at_purchase_jpy,
        p.amount AS total_amount_jpy,
        p.status,
        p.stripe_payment_intent_id AS payment_intent_id,
        p.purchased_at AS created_at,
        p.purchased_at AS updated_at,
        w.creator_id,
        w.title AS work_title
      FROM purchases p
      LEFT JOIN works w ON w.id = p.work_id
    ';

    COMMENT ON VIEW purchases_vw IS 'v6 compatible: Purchases view';
    RAISE NOTICE '  ✅ purchases_vw 作成完了';
  ELSE
    RAISE NOTICE '  ⚠️  purchases_vw スキップ（purchases テーブルなし）';
  END IF;
END$$;


-- =============================================================================
-- 13. works_vw: v5 works テーブル（条件付き作成）
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='works'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE VIEW works_vw AS
      SELECT
        w.id,
        w.creator_id,
        w.title,
        w.description,
        w.image_url,
        NULL::integer AS width,
        NULL::integer AS height,
        NULL::text AS mime_type,
        true AS is_active,
        w.created_at,
        w.updated_at,
        NULL::uuid AS primary_asset_id
      FROM works w
    ';

    COMMENT ON VIEW works_vw IS 'v6 compatible: Works view';
    RAISE NOTICE '  ✅ works_vw 作成完了';
  ELSE
    RAISE NOTICE '  ⚠️  works_vw スキップ（works テーブルなし）';
  END IF;
END$$;


-- =============================================================================
-- 14. users_vw: v5 users + user_public_profiles（条件付き作成）
-- =============================================================================

DO $$
DECLARE
  has_user_public_profiles boolean;
  join_column text;
  display_name_col text;
  avatar_url_col text;
  bio_col text;
  website_col text;
BEGIN
  -- user_public_profilesテーブルの存在確認
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='user_public_profiles'
  ) INTO has_user_public_profiles;

  IF has_user_public_profiles THEN
    -- JOINキーとなるカラムを確認（user_id または id）
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public'
            AND table_name='user_public_profiles'
            AND column_name='user_id'
        ) THEN 'user_id'
        ELSE 'id'
      END INTO join_column;

    -- 各カラムの存在確認
    SELECT
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='user_public_profiles' AND column_name='display_name'
      ) THEN 'upp.display_name' ELSE 'NULL::text' END INTO display_name_col;

    SELECT
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='user_public_profiles' AND column_name='avatar_url'
      ) THEN 'upp.avatar_url' ELSE 'NULL::text' END INTO avatar_url_col;

    SELECT
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='user_public_profiles' AND column_name='bio'
      ) THEN 'upp.bio' ELSE 'NULL::text' END INTO bio_col;

    SELECT
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='user_public_profiles' AND column_name='website'
      ) THEN 'upp.website' ELSE 'NULL::text' END INTO website_col;

    -- user_public_profilesを参照するビュー（存在するカラムのみ）
    EXECUTE format('
      CREATE OR REPLACE VIEW users_vw AS
      SELECT
        u.id,
        u.email,
        u.created_at,
        u.updated_at,
        %s AS display_name,
        %s AS avatar_url,
        %s AS bio,
        %s AS website,
        NULL::text AS phone,
        false AS is_verified
      FROM users u
      LEFT JOIN user_public_profiles upp ON upp.%I = u.id
    ', display_name_col, avatar_url_col, bio_col, website_col, join_column);
    RAISE NOTICE '  ✅ users_vw 作成完了（user_public_profiles参照、JOINキー: %）', join_column;
  ELSE
    -- user_public_profilesなしのビュー
    EXECUTE '
      CREATE OR REPLACE VIEW users_vw AS
      SELECT
        u.id,
        u.email,
        u.created_at,
        u.updated_at,
        NULL::text AS display_name,
        NULL::text AS avatar_url,
        NULL::text AS bio,
        NULL::text AS website,
        NULL::text AS phone,
        false AS is_verified
      FROM users u
    ';
    RAISE NOTICE '  ✅ users_vw 作成完了（プロフィール列固定NULL）';
  END IF;

  COMMENT ON VIEW users_vw IS 'v6 compatible: Users view';
END$$;


-- =============================================================================
-- 15. refund_requests_vw: v5 refund_requests テーブル（条件付き作成）
-- =============================================================================

DO $$
DECLARE
  purchase_id_col text;
  requested_amount_col text;
  stripe_refund_id_col text;
  processed_at_col text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='refund_requests'
  ) THEN
    -- 各カラムの存在確認
    SELECT
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='refund_requests' AND column_name='purchase_id'
      ) THEN 'rr.purchase_id' ELSE 'NULL::uuid' END INTO purchase_id_col;

    SELECT
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='refund_requests' AND column_name='requested_amount'
      ) THEN 'rr.requested_amount' ELSE 'NULL::integer' END INTO requested_amount_col;

    SELECT
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='refund_requests' AND column_name='stripe_refund_id'
      ) THEN 'rr.stripe_refund_id' ELSE 'NULL::text' END INTO stripe_refund_id_col;

    SELECT
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='refund_requests' AND column_name='processed_at'
      ) THEN 'rr.processed_at' ELSE 'NULL::timestamptz' END INTO processed_at_col;

    -- 存在するカラムのみ参照するビュー
    EXECUTE format('
      CREATE OR REPLACE VIEW refund_requests_vw AS
      SELECT
        rr.id,
        %s AS payment_id,
        rr.reason,
        rr.status,
        %s AS requested_amount,
        %s AS stripe_refund_id,
        rr.created_at,
        %s AS processed_at
      FROM refund_requests rr
    ', purchase_id_col, requested_amount_col, stripe_refund_id_col, processed_at_col);

    COMMENT ON VIEW refund_requests_vw IS 'v6 compatible: Refund requests view';
    RAISE NOTICE '  ✅ refund_requests_vw 作成完了';
  ELSE
    RAISE NOTICE '  ⚠️  refund_requests_vw スキップ（refund_requests テーブルなし）';
  END IF;
END$$;


-- =============================================================================
-- 16. approve_publishing 関数（条件付き作成）
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='works'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION approve_publishing(
        p_work_id uuid,
        p_organizer_id uuid,
        p_approved boolean,
        p_approved_by uuid,
        p_notes text DEFAULT NULL
      )
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO pg_catalog, public
      AS $func$
      BEGIN
        UPDATE works
        SET
          is_published = p_approved,
          updated_at = now()
        WHERE id = p_work_id
          AND organizer_id = p_organizer_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION ''Work not found or organizer not authorized'';
        END IF;
      END;
      $func$
    ';

    COMMENT ON FUNCTION approve_publishing IS 'v6 compatible: Approve or reject publishing request';
    RAISE NOTICE '  ✅ approve_publishing() 作成完了';
  ELSE
    RAISE NOTICE '  ⚠️  approve_publishing() スキップ（works テーブルなし）';
  END IF;
END$$;


-- =============================================================================
-- 実行完了メッセージ
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ v6 完全スキーマSQL適用完了（安全版）';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '作成されたテーブル:';
  RAISE NOTICE '  ✅ user_roles';
  RAISE NOTICE '  ✅ products';
  RAISE NOTICE '  ✅ product_variants';
  RAISE NOTICE '  ✅ orders';
  RAISE NOTICE '  ✅ order_items';
  RAISE NOTICE '  ✅ fulfillments';
  RAISE NOTICE '  ✅ creator_organizers';
  RAISE NOTICE '  ✅ refunds';
  RAISE NOTICE '';
  RAISE NOTICE '作成されたビュー（環境依存）:';
  RAISE NOTICE '  ✅ factory_orders_vw (v6 fulfillments - 推奨方針B)';
  RAISE NOTICE '  ※ 以下は該当テーブルが存在する場合のみ作成:';
  RAISE NOTICE '     - sales_vw (sales + purchases必要)';
  RAISE NOTICE '     - publishing_approvals_vw (works必要)';
  RAISE NOTICE '     - purchases_vw (purchases必要)';
  RAISE NOTICE '     - works_vw (works必要)';
  RAISE NOTICE '     - users_vw (user_public_profiles任意)';
  RAISE NOTICE '     - refund_requests_vw (refund_requests必要)';
  RAISE NOTICE '';
  RAISE NOTICE '動作確認:';
  RAISE NOTICE '  SELECT COUNT(*) FROM products;';
  RAISE NOTICE '  SELECT COUNT(*) FROM fulfillments;';
  RAISE NOTICE '  SELECT COUNT(*) FROM factory_orders_vw;';
  RAISE NOTICE '';
  RAISE NOTICE '✅ v6完全スキーマ適用完了（安全版）！';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;
