-- =====================================================================
-- v6 完全スキーマSQL（最新版）
-- =====================================================================
-- 作成日: 2025-10-02
-- 目的: v6完全スキーマ適用（fulfillments, products, product_variants ベース）
-- 適用方法: Supabase Studio SQL Editor から実行
-- =====================================================================

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
  work_id uuid,
  title text NOT NULL,
  description text,
  product_type text NOT NULL CHECK (product_type IN ('digital', 'physical', 'print')),
  base_price_jpy integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_work_id ON products(work_id);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);

-- 外部キー制約を安全に追加（worksテーブルが存在する場合のみ）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='works'
  ) THEN
    -- 既に同名制約があればスキップ
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema='public'
        AND table_name='products'
        AND constraint_name='products_work_id_fkey'
    ) THEN
      ALTER TABLE public.products
        ADD CONSTRAINT products_work_id_fkey
        FOREIGN KEY (work_id)
        REFERENCES public.works(id)
        ON DELETE RESTRICT
        NOT VALID;

      -- 既存データを検証
      ALTER TABLE public.products VALIDATE CONSTRAINT products_work_id_fkey;
    END IF;
  END IF;
END$$;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_viewable_by_all ON products;
CREATE POLICY products_viewable_by_all ON products
  FOR SELECT USING (is_active = true);

COMMENT ON TABLE products IS 'v6: Product catalog (work_id references works with ON DELETE RESTRICT)';


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
  manufacturing_partner_id uuid REFERENCES manufacturing_partners(id) ON DELETE SET NULL,
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
  manufacturing_partner_id uuid REFERENCES manufacturing_partners(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_production', 'completed', 'shipped', 'failed')),
  tracking_number text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fulfillments_order_item_id ON fulfillments(order_item_id);
CREATE INDEX IF NOT EXISTS idx_fulfillments_status ON fulfillments(status);

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
-- 9. sales_vw: v5 sales + purchases ベース（v6互換）
-- =============================================================================

CREATE OR REPLACE VIEW sales_vw AS
SELECT
  s.id,
  s.creator_id,
  s.work_id,
  p.user_id AS buyer_id,

  -- Revenue
  s.amount AS gross_amount,
  s.net_amount,
  (s.amount - s.net_amount) AS tax_amount,

  -- Organizer info
  s.organizer_id,

  -- Timestamps
  s.created_at,
  s.created_at AS updated_at,

  -- Status
  'confirmed' AS order_status,
  'captured' AS payment_state
FROM sales s
LEFT JOIN purchases p ON p.work_id = s.work_id;

COMMENT ON VIEW sales_vw IS 'v6 compatible: Sales view based on v5 sales + purchases';


-- =============================================================================
-- 10. factory_orders_vw: v6 fulfillments ベース（推奨方針B）
-- =============================================================================

CREATE OR REPLACE VIEW factory_orders_vw AS
SELECT
  f.id,

  -- Product info (products由来)
  pr.id AS product_id,
  pr.title AS product_name,
  pv.id AS product_variant_id,
  pr.product_type,

  -- Order item info
  oi.quantity,
  oi.unit_price_jpy,

  -- Factory info
  f.manufacturing_partner_id AS factory_id,

  -- Order info
  o.id AS order_id,

  -- Customer info
  o.user_id AS customer_id,
  COALESCE(upp.display_name, u.email) AS customer_name,

  -- Creator info
  oi.creator_id,

  -- Status and timestamps
  f.status,
  f.created_at,
  f.updated_at

FROM fulfillments f
JOIN order_items oi ON oi.id = f.order_item_id
JOIN orders o ON o.id = oi.order_id
LEFT JOIN users u ON u.id = o.user_id
LEFT JOIN user_public_profiles upp ON upp.user_id = u.id
LEFT JOIN product_variants pv ON pv.id = oi.product_variant_id
LEFT JOIN products pr ON pr.id = pv.product_id;

COMMENT ON VIEW factory_orders_vw IS 'v6: Factory orders with customer-facing product info (fulfillments-based)';


-- =============================================================================
-- 11. publishing_approvals_vw: v5 works ベース
-- =============================================================================

CREATE OR REPLACE VIEW publishing_approvals_vw AS
SELECT
  w.id AS work_id,
  w.creator_id,
  w.title,
  w.organizer_id,
  o.name AS organizer_name,

  -- Status (v5 worksテーブルから判定)
  CASE
    WHEN w.is_published = true THEN 'approved'
    WHEN w.is_published = false THEN 'pending'
    ELSE 'pending'
  END AS status,

  -- Approval info
  NULL::uuid AS approved_by,
  w.created_at AS requested_at,
  NULL::timestamptz AS approved_at,
  NULL::text AS notes,

  gen_random_uuid() AS id
FROM works w
LEFT JOIN organizers o ON o.id = w.organizer_id
WHERE w.organizer_id IS NOT NULL;

COMMENT ON VIEW publishing_approvals_vw IS 'v6 compatible: Publishing approvals view';


-- =============================================================================
-- 12. purchases_vw: v5 purchases テーブル
-- =============================================================================

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

  -- Works情報
  w.creator_id,
  w.title AS work_title
FROM purchases p
LEFT JOIN works w ON w.id = p.work_id;

COMMENT ON VIEW purchases_vw IS 'v6 compatible: Purchases view';


-- =============================================================================
-- 13. works_vw: v5 works テーブル
-- =============================================================================

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
  w.is_active,
  w.created_at,
  w.updated_at,
  NULL::uuid AS primary_asset_id
FROM works w;

COMMENT ON VIEW works_vw IS 'v6 compatible: Works view';


-- =============================================================================
-- 14. users_vw: v5 users + user_public_profiles
-- =============================================================================

CREATE OR REPLACE VIEW users_vw AS
SELECT
  u.id,
  u.email,
  u.created_at,
  u.updated_at,

  -- user_public_profilesから取得
  upp.display_name,
  upp.avatar_url,
  upp.bio,
  upp.website,

  -- v6用の追加フィールド
  NULL::text AS phone,
  false AS is_verified
FROM users u
LEFT JOIN user_public_profiles upp ON upp.user_id = u.id;

COMMENT ON VIEW users_vw IS 'v6 compatible: Users view';


-- =============================================================================
-- 15. refund_requests_vw: v5 refund_requests テーブル
-- =============================================================================

CREATE OR REPLACE VIEW refund_requests_vw AS
SELECT
  rr.id,
  rr.purchase_id AS payment_id,
  rr.reason,
  rr.status,
  rr.requested_amount,
  rr.stripe_refund_id,
  rr.created_at,
  rr.processed_at
FROM refund_requests rr;

COMMENT ON VIEW refund_requests_vw IS 'v6 compatible: Refund requests view';


-- =============================================================================
-- 16. approve_publishing 関数
-- =============================================================================

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
AS $$
BEGIN
  -- v5 worksテーブルのis_publishedを更新
  UPDATE works
  SET
    is_published = p_approved,
    is_active = p_approved,
    updated_at = now()
  WHERE id = p_work_id
    AND organizer_id = p_organizer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work not found or organizer not authorized';
  END IF;
END;
$$;

COMMENT ON FUNCTION approve_publishing IS 'v6 compatible: Approve or reject publishing request';


-- =============================================================================
-- 実行完了メッセージ
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ v6 完全スキーマSQL適用完了';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '作成されたテーブル:';
  RAISE NOTICE '  ✅ user_roles';
  RAISE NOTICE '  ✅ products (v6 新規)';
  RAISE NOTICE '  ✅ product_variants (v6 新規)';
  RAISE NOTICE '  ✅ orders';
  RAISE NOTICE '  ✅ order_items';
  RAISE NOTICE '  ✅ fulfillments (v6 新規)';
  RAISE NOTICE '  ✅ creator_organizers';
  RAISE NOTICE '  ✅ refunds';
  RAISE NOTICE '';
  RAISE NOTICE '作成されたビュー:';
  RAISE NOTICE '  ✅ sales_vw (v5 sales + purchases ベース)';
  RAISE NOTICE '  ✅ factory_orders_vw (v6 fulfillments ベース - 推奨方針B)';
  RAISE NOTICE '  ✅ publishing_approvals_vw (v5 works ベース)';
  RAISE NOTICE '  ✅ purchases_vw (v5 purchases ベース)';
  RAISE NOTICE '  ✅ works_vw (v5 works ベース)';
  RAISE NOTICE '  ✅ users_vw (v5 users + profiles ベース)';
  RAISE NOTICE '  ✅ refund_requests_vw (v5 refund_requests ベース)';
  RAISE NOTICE '';
  RAISE NOTICE '作成された関数:';
  RAISE NOTICE '  ✅ approve_publishing() (v5 works ベース)';
  RAISE NOTICE '';
  RAISE NOTICE '動作確認:';
  RAISE NOTICE '  SELECT COUNT(*) FROM sales_vw;';
  RAISE NOTICE '  SELECT COUNT(*) FROM factory_orders_vw;';
  RAISE NOTICE '  SELECT COUNT(*) FROM purchases_vw;';
  RAISE NOTICE '  SELECT COUNT(*) FROM works_vw;';
  RAISE NOTICE '  SELECT COUNT(*) FROM users_vw;';
  RAISE NOTICE '';
  RAISE NOTICE '✅ v6完全スキーマ適用完了！';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;
