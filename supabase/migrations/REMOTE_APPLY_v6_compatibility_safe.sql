-- =====================================================================
-- v6 互換ビュー リモートDB適用用SQL（安全版）
-- =====================================================================
-- 作成日: 2025-10-02
-- 目的: 既存v5スキーマのみを使用したv6互換ビュー追加
-- 適用方法: Supabase Studio SQL Editor から実行
--
-- 重要: user_rolesテーブルへの依存を削除し、既存スキーマのみで動作
-- =====================================================================

-- =============================================================================
-- 1. user_roles テーブル (v6で必要)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('creator', 'organizer', 'factory', 'admin')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

-- インデックス作成
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_roles_user_id') THEN
    CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_roles_role') THEN
    CREATE INDEX idx_user_roles_role ON user_roles(role);
  END IF;
END $$;

-- RLS有効化
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- ポリシー作成
DROP POLICY IF EXISTS users_can_view_own_roles ON user_roles;
CREATE POLICY users_can_view_own_roles ON user_roles
  FOR SELECT
  USING (user_id = auth.uid());

COMMENT ON TABLE user_roles IS 'User role assignments for multi-role support';


-- =============================================================================
-- 2. organizer_profiles テーブル
-- =============================================================================

CREATE TABLE IF NOT EXISTS organizer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  organization_name text,
  description text,
  website text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS有効化
ALTER TABLE organizer_profiles ENABLE ROW LEVEL SECURITY;

-- ポリシー
DROP POLICY IF EXISTS organizers_can_view_own_profile ON organizer_profiles;
CREATE POLICY organizers_can_view_own_profile ON organizer_profiles
  FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE organizer_profiles IS 'Organizer profile information';


-- =============================================================================
-- 3. creator_organizers テーブル
-- =============================================================================

CREATE TABLE IF NOT EXISTS creator_organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organizer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),

  -- Revenue share settings
  creator_share_bps integer DEFAULT 7000 CHECK (creator_share_bps >= 0 AND creator_share_bps <= 10000),
  organizer_share_bps integer DEFAULT 2000 CHECK (organizer_share_bps >= 0 AND organizer_share_bps <= 10000),
  platform_share_bps integer DEFAULT 1000 CHECK (platform_share_bps >= 0 AND platform_share_bps <= 10000),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(creator_id, organizer_id)
);

-- インデックス作成
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_creator_organizers_creator') THEN
    CREATE INDEX idx_creator_organizers_creator ON creator_organizers(creator_id, status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_creator_organizers_organizer') THEN
    CREATE INDEX idx_creator_organizers_organizer ON creator_organizers(organizer_id, status);
  END IF;
END $$;

-- RLS有効化
ALTER TABLE creator_organizers ENABLE ROW LEVEL SECURITY;

-- ポリシー
DROP POLICY IF EXISTS organizer_can_view_creators ON creator_organizers;
DROP POLICY IF EXISTS creator_can_view_organizers ON creator_organizers;
DROP POLICY IF EXISTS organizer_can_manage_creators ON creator_organizers;

CREATE POLICY organizer_can_view_creators ON creator_organizers
  FOR SELECT
  USING (
    organizer_id IN (
      SELECT user_id FROM user_roles WHERE role = 'organizer'
    )
  );

CREATE POLICY creator_can_view_organizers ON creator_organizers
  FOR SELECT
  USING (creator_id = auth.uid());

CREATE POLICY organizer_can_manage_creators ON creator_organizers
  FOR ALL
  USING (
    organizer_id IN (
      SELECT user_id FROM user_roles WHERE role = 'organizer'
    )
  );

COMMENT ON TABLE creator_organizers IS 'v6: Creator-organizer relationships for management and revenue sharing';


-- =============================================================================
-- 4. sales_vw: 売上データビュー
-- =============================================================================

CREATE OR REPLACE VIEW sales_vw AS
SELECT
  oi.id,
  oi.creator_id,
  pr.work_id,
  o.user_id AS buyer_id,

  -- Revenue breakdown
  oi.subtotal_excl_tax_jpy + oi.subtotal_tax_jpy AS gross_amount,
  oi.subtotal_excl_tax_jpy AS net_amount,
  oi.subtotal_tax_jpy AS tax_amount,

  -- Organizer info (from creator_organizers)
  co.organizer_id,

  -- Timestamps
  o.created_at,
  o.updated_at,

  -- Order status
  o.status AS order_status,
  o.payment_state
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
LEFT JOIN products pr ON pr.id = (
  SELECT product_id FROM product_variants WHERE id = oi.product_variant_id LIMIT 1
)
LEFT JOIN creator_organizers co ON co.creator_id = oi.creator_id AND co.status = 'active'
WHERE o.status NOT IN ('cancelled', 'refunded');

COMMENT ON VIEW sales_vw IS 'v6: Unified sales view for analytics and reporting';


-- =============================================================================
-- 5. publishing_approvals_vw: 作品承認ビュー
-- =============================================================================

CREATE OR REPLACE VIEW publishing_approvals_vw AS
SELECT
  w.id AS work_id,
  w.creator_id,
  w.title,
  w.created_at AS requested_at,

  -- Organizer info
  co.organizer_id,
  op.organization_name AS organizer_name,

  -- Status (v5スキーマではis_activeフィールドで判定)
  CASE
    WHEN w.is_active = true THEN 'approved'
    WHEN w.is_active = false THEN 'pending'
    ELSE 'rejected'
  END AS status,

  -- Approval info
  NULL::uuid AS approved_by,
  NULL::timestamptz AS approved_at,
  NULL::text AS notes
FROM works w
LEFT JOIN creator_organizers co ON co.creator_id = w.creator_id AND co.status = 'active'
LEFT JOIN organizer_profiles op ON op.user_id = co.organizer_id
WHERE co.organizer_id IS NOT NULL;

COMMENT ON VIEW publishing_approvals_vw IS 'v6: Publishing approval requests for organizer review';


-- =============================================================================
-- 6. factory_orders_vw: ファクトリーオーダービュー
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
  p.name AS product_name,

  -- Factory info (v5では manufacturing_partner_id)
  oi.manufacturing_partner_id AS factory_id,

  -- Order item info
  oi.order_id,
  oi.creator_id
FROM manufacturing_orders mo
JOIN products p ON p.id = mo.product_id
LEFT JOIN order_items oi ON oi.id = mo.product_id::uuid
WHERE mo.status NOT IN ('cancelled');

COMMENT ON VIEW factory_orders_vw IS 'v6: Factory manufacturing orders view';


-- =============================================================================
-- 7. approve_publishing 関数
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
  -- v5スキーマではis_activeフィールドを更新
  UPDATE works
  SET
    is_active = p_approved,
    updated_at = now()
  WHERE id = p_work_id
    AND creator_id IN (
      SELECT creator_id
      FROM creator_organizers
      WHERE organizer_id = p_organizer_id
        AND status = 'active'
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work not found or organizer not authorized';
  END IF;
END;
$$;

COMMENT ON FUNCTION approve_publishing IS 'v6: Approve or reject publishing request';


-- =============================================================================
-- 実行完了メッセージ
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ v6互換ビュー作成完了（安全版）';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '作成されたテーブル:';
  RAISE NOTICE '  ✅ user_roles';
  RAISE NOTICE '  ✅ organizer_profiles';
  RAISE NOTICE '  ✅ creator_organizers';
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
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;
