-- =====================================================================
-- v5 → v6 ブリッジSQL（リモートDB用）
-- =====================================================================
-- 作成日: 2025-10-02
-- 目的: 既存v5スキーマを維持したまま、v6互換機能を追加
-- 適用方法: Supabase Studio SQL Editor から実行
--
-- 前提: リモートDBには以下のv5テーブルが存在
--   - users, works, purchases, sales, organizers, organizer_profiles
--   - factory_products, factory_profiles, manufacturing_orders
--   - refund_requests, publishing_approvals
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

COMMENT ON TABLE user_roles IS 'v6: User role assignments';

-- 既存のorganizersテーブルからuser_rolesにデータを移行
INSERT INTO user_roles (user_id, role, created_at)
SELECT user_id, 'organizer', created_at
FROM organizers
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;


-- =============================================================================
-- 2. orders/order_items テーブル作成（v6で必須）
-- =============================================================================

-- ordersテーブル（purchasesから移行）
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
  FOR SELECT
  USING (user_id = auth.uid());

COMMENT ON TABLE orders IS 'v6: Customer orders';

-- order_itemsテーブル（purchasesから移行）
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

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_can_view_order_items ON order_items;
CREATE POLICY users_can_view_order_items ON order_items
  FOR SELECT
  USING (
    order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
    OR creator_id = auth.uid()
  );

COMMENT ON TABLE order_items IS 'v6: Order line items';

-- purchasesからordersとorder_itemsへデータ移行
DO $$
DECLARE
  purchase_rec RECORD;
  new_order_id uuid;
BEGIN
  -- purchasesテーブルから未移行データを取得
  FOR purchase_rec IN
    SELECT
      p.id AS purchase_id,
      p.user_id,
      p.work_id,
      p.product_id,
      p.quantity,
      p.price_at_purchase_jpy AS unit_price,
      p.total_amount_jpy,
      p.status,
      p.created_at,
      p.updated_at,
      w.creator_id
    FROM purchases p
    LEFT JOIN works w ON w.id = p.work_id
    WHERE NOT EXISTS (
      SELECT 1 FROM order_items oi
      WHERE oi.id = p.id
    )
    LIMIT 1000 -- 一度に1000件まで
  LOOP
    -- ordersレコード作成（同じpurchase_idから既に作成されていない場合）
    IF NOT EXISTS (SELECT 1 FROM orders WHERE id = purchase_rec.purchase_id) THEN
      INSERT INTO orders (
        id,
        user_id,
        status,
        payment_state,
        total_amount_jpy,
        tax_amount_jpy,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        purchase_rec.user_id,
        COALESCE(purchase_rec.status, 'confirmed'),
        'captured',
        COALESCE(purchase_rec.total_amount_jpy, 0),
        FLOOR(COALESCE(purchase_rec.total_amount_jpy, 0) * 0.1), -- 仮の税額（10%）
        purchase_rec.created_at,
        purchase_rec.updated_at
      )
      RETURNING id INTO new_order_id;
    ELSE
      new_order_id := purchase_rec.purchase_id;
    END IF;

    -- order_itemsレコード作成
    INSERT INTO order_items (
      id,
      order_id,
      creator_id,
      product_id,
      quantity,
      unit_price_jpy,
      subtotal_excl_tax_jpy,
      subtotal_tax_jpy,
      is_digital,
      created_at,
      updated_at
    ) VALUES (
      purchase_rec.purchase_id,
      new_order_id,
      purchase_rec.creator_id,
      purchase_rec.product_id,
      COALESCE(purchase_rec.quantity, 1),
      COALESCE(purchase_rec.unit_price, 0),
      FLOOR(COALESCE(purchase_rec.total_amount_jpy, 0) / 1.1), -- 税抜き額
      FLOOR(COALESCE(purchase_rec.total_amount_jpy, 0) * 0.1 / 1.1), -- 税額
      true, -- オンライン資産として扱う
      purchase_rec.created_at,
      purchase_rec.updated_at
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Data migration from purchases to orders/order_items completed';
END $$;


-- =============================================================================
-- 3. creator_organizers テーブル（既存organizersテーブルとの互換性）
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
  FOR SELECT
  USING (organizer_id = auth.uid());

CREATE POLICY creator_can_view_organizers ON creator_organizers
  FOR SELECT
  USING (creator_id = auth.uid());

COMMENT ON TABLE creator_organizers IS 'v6: Creator-organizer relationships';


-- =============================================================================
-- 4. sales_vw: 既存salesテーブルベースのビュー
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

  -- Organizer info
  co.organizer_id,

  -- Timestamps
  s.created_at,
  s.updated_at,

  -- Status（既存purchasesテーブルから取得）
  p.status AS order_status,
  'captured' AS payment_state
FROM sales s
LEFT JOIN purchases p ON p.id = s.id
LEFT JOIN creator_organizers co ON co.creator_id = s.creator_id AND co.status = 'active';

COMMENT ON VIEW sales_vw IS 'v6 compatible: Sales data view based on existing sales table';


-- =============================================================================
-- 5. publishing_approvals_vw: 既存publishing_approvalsベース
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
-- 6. factory_orders_vw: 既存manufacturing_ordersベース
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

  -- Order info (purchasesから取得)
  p.id AS order_id,
  w.creator_id
FROM manufacturing_orders mo
LEFT JOIN factory_products fp ON fp.id = mo.product_id
LEFT JOIN purchases p ON true -- purchasesとの関連を仮定
LEFT JOIN works w ON w.id = p.work_id;

COMMENT ON VIEW factory_orders_vw IS 'v6 compatible: Factory orders view';


-- =============================================================================
-- 7. refunds テーブル（既存refund_requestsとの互換性）
-- =============================================================================

CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid, -- paymentsテーブルが存在する場合

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
-- 8. approve_publishing 関数
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
DECLARE
  orders_count integer;
  order_items_count integer;
  user_roles_count integer;
BEGIN
  SELECT COUNT(*) INTO orders_count FROM orders;
  SELECT COUNT(*) INTO order_items_count FROM order_items;
  SELECT COUNT(*) INTO user_roles_count FROM user_roles;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ v5 → v6 ブリッジSQL適用完了';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '作成されたテーブル:';
  RAISE NOTICE '  ✅ user_roles (% records)', user_roles_count;
  RAISE NOTICE '  ✅ orders (% records)', orders_count;
  RAISE NOTICE '  ✅ order_items (% records)', order_items_count;
  RAISE NOTICE '  ✅ creator_organizers';
  RAISE NOTICE '  ✅ refunds';
  RAISE NOTICE '';
  RAISE NOTICE '作成されたビュー:';
  RAISE NOTICE '  ✅ sales_vw';
  RAISE NOTICE '  ✅ publishing_approvals_vw';
  RAISE NOTICE '  ✅ factory_orders_vw';
  RAISE NOTICE '';
  RAISE NOTICE '作成された関数:';
  RAISE NOTICE '  ✅ approve_publishing()';
  RAISE NOTICE '';
  RAISE NOTICE '動作確認:';
  RAISE NOTICE '  SELECT COUNT(*) FROM sales_vw;';
  RAISE NOTICE '  SELECT COUNT(*) FROM publishing_approvals_vw;';
  RAISE NOTICE '  SELECT COUNT(*) FROM factory_orders_vw;';
  RAISE NOTICE '';
  RAISE NOTICE '既存データ移行:';
  RAISE NOTICE '  ✅ organizers → user_roles';
  RAISE NOTICE '  ✅ purchases → orders + order_items (最大1000件)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  注意: purchasesテーブルに1000件以上データがある場合、';
  RAISE NOTICE '   このSQLを複数回実行して段階的に移行してください。';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;
