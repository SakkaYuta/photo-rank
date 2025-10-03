-- =====================================================================
-- v6 最小構成SQL（超安全版）
-- =====================================================================
-- 作成日: 2025-10-02
-- 目的: エラー解決のために必要最小限のテーブルのみ作成
-- 適用方法: Supabase Studio SQL Editor から実行
--
-- 重要: ビュー作成は行わず、必須テーブルのみ作成
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

DROP POLICY IF EXISTS users_can_insert_own_roles ON user_roles;
CREATE POLICY users_can_insert_own_roles ON user_roles
  FOR INSERT WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE user_roles IS 'v6: User role assignments';


-- =============================================================================
-- 2. orders テーブル
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
-- 3. order_items テーブル
-- =============================================================================

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
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
    OR creator_id = auth.uid()
  );

COMMENT ON TABLE order_items IS 'v6: Order line items';


-- =============================================================================
-- 4. creator_organizers テーブル
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
-- 5. refunds テーブル
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
-- 実行完了メッセージ
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ v6 最小構成SQL適用完了';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '作成されたテーブル:';
  RAISE NOTICE '  ✅ user_roles (空テーブル)';
  RAISE NOTICE '  ✅ orders (空テーブル)';
  RAISE NOTICE '  ✅ order_items (空テーブル)';
  RAISE NOTICE '  ✅ creator_organizers (空テーブル)';
  RAISE NOTICE '  ✅ refunds (空テーブル)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  注意:';
  RAISE NOTICE '  - ビューは作成していません';
  RAISE NOTICE '  - 既存のv5テーブル（purchases, sales等）を引き続き使用してください';
  RAISE NOTICE '  - アプリケーションコードでエラーが発生する場合、';
  RAISE NOTICE '    v5テーブルを直接参照するように修正が必要です';
  RAISE NOTICE '';
  RAISE NOTICE '次のステップ:';
  RAISE NOTICE '  1. CHECK_V5_TABLES.sql を実行して既存テーブル構造を確認';
  RAISE NOTICE '  2. 確認結果に基づいてビューを個別に作成';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;
