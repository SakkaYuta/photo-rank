-- =====================================================================
-- v5 → v6 ブリッジSQL（安全版・データ移行なし）
-- =====================================================================
-- 作成日: 2025-10-02
-- 目的: 既存v5スキーマを維持したまま、v6互換機能を追加
-- 適用方法: Supabase Studio SQL Editor から実行
--
-- 重要: データ移行は行わず、新規テーブル・ビュー作成のみ
-- =====================================================================

-- =============================================================================
-- 1. user_roles テーブル作成（v6で必須）
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
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS users_can_insert_own_roles ON user_roles;
CREATE POLICY users_can_insert_own_roles ON user_roles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE user_roles IS 'v6: User role assignments';


-- =============================================================================
-- 2. orders/order_items テーブル作成（v6で必須）
-- =============================================================================

-- ordersテーブル
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
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_can_view_own_orders ON orders;
CREATE POLICY users_can_view_own_orders ON orders
  FOR SELECT
  USING (user_id = auth.uid());

COMMENT ON TABLE orders IS 'v6: Customer orders';

-- order_itemsテーブル
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  creator_id uuid REFERENCES users(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_variant_id uuid,

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
  FOR SELECT
  USING (
    order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
    OR creator_id = auth.uid()
  );

COMMENT ON TABLE order_items IS 'v6: Order line items';


-- =============================================================================
-- 3. creator_organizers テーブル
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
DROP POLICY IF EXISTS organizer_can_manage_creators ON creator_organizers;

CREATE POLICY organizer_can_view_creators ON creator_organizers
  FOR SELECT
  USING (organizer_id = auth.uid());

CREATE POLICY creator_can_view_organizers ON creator_organizers
  FOR SELECT
  USING (creator_id = auth.uid());

CREATE POLICY organizer_can_manage_creators ON creator_organizers
  FOR ALL
  USING (organizer_id = auth.uid());

COMMENT ON TABLE creator_organizers IS 'v6: Creator-organizer relationships';


-- =============================================================================
-- 4. refunds テーブル
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
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE refunds IS 'v6: Refund records';


-- =============================================================================
-- 5. sales_vw: 既存salesテーブルベースのビュー
-- =============================================================================

CREATE OR REPLACE VIEW sales_vw AS
SELECT
  s.id,
  s.creator_id,
  s.work_id,
  s.buyer_id,

  -- Revenue
  s.gross_amount,
  s.net_amount,
  s.tax_amount,

  -- Organizer info (creator_organizersから取得)
  co.organizer_id,

  -- Timestamps
  s.created_at,
  s.updated_at,

  -- Status
  'confirmed' AS order_status,
  'captured' AS payment_state
FROM sales s
LEFT JOIN creator_organizers co ON co.creator_id = s.creator_id AND co.status = 'active';

COMMENT ON VIEW sales_vw IS 'v6 compatible: Sales data view based on existing sales table';


-- =============================================================================
-- 6. publishing_approvals_vw: 既存publishing_approvalsベース
-- =============================================================================

CREATE OR REPLACE VIEW publishing_approvals_vw AS
SELECT
  pa.id,
  pa.work_id,
  w.creator_id,
  w.title,
  pa.organizer_id,
  op.organization_name AS organizer_name,
  pa.status,
  pa.approved_by,
  pa.created_at AS requested_at,
  pa.approved_at,
  pa.notes
FROM publishing_approvals pa
JOIN works w ON w.id = pa.work_id
LEFT JOIN organizer_profiles op ON op.user_id = pa.organizer_id;

COMMENT ON VIEW publishing_approvals_vw IS 'v6 compatible: Publishing approvals view';


-- =============================================================================
-- 7. factory_orders_vw: 既存manufacturing_ordersベース
-- =============================================================================

CREATE OR REPLACE VIEW factory_orders_vw AS
SELECT
  mo.id,
  mo.product_id,
  mo.quantity,
  mo.status,
  mo.created_at,
  mo.updated_at,

  -- Product info
  fp.name AS product_name,

  -- Factory info
  mo.manufacturing_partner_id AS factory_id,

  -- Note: order_id と creator_id はダミー値
  NULL::uuid AS order_id,
  NULL::uuid AS creator_id
FROM manufacturing_orders mo
LEFT JOIN factory_products fp ON fp.id = mo.product_id;

COMMENT ON VIEW factory_orders_vw IS 'v6 compatible: Factory orders view';


-- =============================================================================
-- 8. purchases_vw: 既存purchasesテーブルのビュー
-- =============================================================================

CREATE OR REPLACE VIEW purchases_vw AS
SELECT
  p.id,
  p.user_id,
  p.work_id,
  p.product_id,
  p.quantity,
  p.price_at_purchase_jpy,
  p.total_amount_jpy,
  p.status,
  p.payment_intent_id,
  p.created_at,
  p.updated_at,

  -- Works情報
  w.creator_id,
  w.title AS work_title
FROM purchases p
LEFT JOIN works w ON w.id = p.work_id;

COMMENT ON VIEW purchases_vw IS 'v6 compatible: Purchases view with work information';


-- =============================================================================
-- 9. works_vw: 既存worksテーブルのビュー
-- =============================================================================

CREATE OR REPLACE VIEW works_vw AS
SELECT
  w.id,
  w.creator_id,
  w.title,
  w.description,
  w.image_url,
  w.width,
  w.height,
  w.mime_type,
  w.is_active,
  w.created_at,
  w.updated_at,
  w.primary_asset_id
FROM works w;

COMMENT ON VIEW works_vw IS 'v6 compatible: Works view';


-- =============================================================================
-- 10. users_vw: 既存usersテーブルのビュー
-- =============================================================================

CREATE OR REPLACE VIEW users_vw AS
SELECT
  u.id,
  u.email,
  u.created_at,
  u.updated_at,

  -- user_public_profilesから追加情報
  upp.display_name,
  upp.avatar_url,
  upp.bio,
  upp.website,

  -- 電話番号（存在する場合）
  NULL::text AS phone,

  -- 検証状態
  false AS is_verified
FROM users u
LEFT JOIN user_public_profiles upp ON upp.user_id = u.id;

COMMENT ON VIEW users_vw IS 'v6 compatible: Users view with profile information';


-- =============================================================================
-- 11. approve_publishing 関数
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
  -- publishing_approvalsテーブルを更新
  UPDATE publishing_approvals
  SET
    status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
    approved_by = p_approved_by,
    approved_at = now(),
    notes = p_notes,
    updated_at = now()
  WHERE work_id = p_work_id
    AND organizer_id = p_organizer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Publishing approval not found';
  END IF;

  -- worksテーブルのis_activeも更新
  IF p_approved THEN
    UPDATE works
    SET is_active = true, updated_at = now()
    WHERE id = p_work_id;
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
  RAISE NOTICE '✅ v5 → v6 ブリッジSQL適用完了（安全版）';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '作成されたテーブル:';
  RAISE NOTICE '  ✅ user_roles';
  RAISE NOTICE '  ✅ orders';
  RAISE NOTICE '  ✅ order_items';
  RAISE NOTICE '  ✅ creator_organizers';
  RAISE NOTICE '  ✅ refunds';
  RAISE NOTICE '';
  RAISE NOTICE '作成されたビュー:';
  RAISE NOTICE '  ✅ sales_vw';
  RAISE NOTICE '  ✅ publishing_approvals_vw';
  RAISE NOTICE '  ✅ factory_orders_vw';
  RAISE NOTICE '  ✅ purchases_vw';
  RAISE NOTICE '  ✅ works_vw';
  RAISE NOTICE '  ✅ users_vw';
  RAISE NOTICE '';
  RAISE NOTICE '作成された関数:';
  RAISE NOTICE '  ✅ approve_publishing()';
  RAISE NOTICE '';
  RAISE NOTICE '動作確認:';
  RAISE NOTICE '  SELECT COUNT(*) FROM sales_vw;';
  RAISE NOTICE '  SELECT COUNT(*) FROM publishing_approvals_vw;';
  RAISE NOTICE '  SELECT COUNT(*) FROM purchases_vw;';
  RAISE NOTICE '  SELECT COUNT(*) FROM works_vw;';
  RAISE NOTICE '  SELECT COUNT(*) FROM users_vw;';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  注意: このSQLはデータ移行を行いません。';
  RAISE NOTICE '   新規データはorders/order_itemsテーブルに直接追加してください。';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;
