-- =====================================================================
-- v6 互換ビュー リモートDB適用用SQL
-- =====================================================================
-- 作成日: 2025-10-02
-- 目的: 既存v5スキーマを維持したまま、v6互換ビューを追加
-- 適用方法: Supabase Studio SQL Editor から実行
--
-- 重要: このSQLは既存テーブルに影響を与えず、ビューと関数のみを追加します
-- =====================================================================

-- =============================================================================
-- 1. creator_organizers テーブル (存在しない場合のみ作成)
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

-- インデックス作成 (存在しない場合のみ)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_creator_organizers_creator') THEN
    CREATE INDEX idx_creator_organizers_creator ON creator_organizers(creator_id, status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_creator_organizers_organizer') THEN
    CREATE INDEX idx_creator_organizers_organizer ON creator_organizers(organizer_id, status);
  END IF;
END $$;

COMMENT ON TABLE creator_organizers IS 'v6: Creator-organizer relationships for management and revenue sharing';


-- =============================================================================
-- 2. RLS Policies for creator_organizers
-- =============================================================================

ALTER TABLE creator_organizers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS organizer_can_view_creators ON creator_organizers;
DROP POLICY IF EXISTS creator_can_view_organizers ON creator_organizers;
DROP POLICY IF EXISTS organizer_can_manage_creators ON creator_organizers;

-- Organizers can view their creators
CREATE POLICY organizer_can_view_creators ON creator_organizers
  FOR SELECT
  USING (
    organizer_id IN (
      SELECT user_id FROM user_roles WHERE role = 'organizer'
    )
  );

-- Creators can view their organizer relationships
CREATE POLICY creator_can_view_organizers ON creator_organizers
  FOR SELECT
  USING (
    creator_id = auth.uid()
  );

-- Organizers can manage their creator relationships
CREATE POLICY organizer_can_manage_creators ON creator_organizers
  FOR ALL
  USING (
    organizer_id IN (
      SELECT user_id FROM user_roles WHERE role = 'organizer'
    )
  );


-- =============================================================================
-- 3. sales_vw: 売上データビュー
-- =============================================================================

CREATE OR REPLACE VIEW sales_vw AS
SELECT
  oi.id,
  oi.creator_id,
  pr.work_id,
  o.user_id AS buyer_id,

  -- Revenue breakdown (tax-inclusive for backward compat)
  oi.subtotal_excl_tax_jpy + oi.subtotal_tax_jpy AS gross_amount,
  oi.subtotal_excl_tax_jpy AS net_amount,
  oi.subtotal_tax_jpy AS tax_amount,

  -- Organizer relationship (via creator's organizer_profile)
  op.organizer_id,

  -- Timestamps
  o.created_at,
  o.updated_at,

  -- Order status for filtering
  o.status AS order_status,
  o.payment_state
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
LEFT JOIN products pr ON pr.id = (
  SELECT product_id FROM product_variants WHERE id = oi.product_variant_id LIMIT 1
)
LEFT JOIN creator_organizers co ON co.creator_id = oi.creator_id AND co.status = 'active'
LEFT JOIN organizer_profiles op ON op.user_id = co.organizer_id
WHERE o.status NOT IN ('cancelled', 'refunded');

-- インデックス作成
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sales_vw_creator') THEN
    CREATE INDEX idx_sales_vw_creator ON order_items(creator_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sales_vw_work') THEN
    CREATE INDEX idx_sales_vw_work ON order_items(product_variant_id);
  END IF;
END $$;

COMMENT ON VIEW sales_vw IS 'v6 compatibility: Sales data from orders+order_items for organizer dashboard';


-- =============================================================================
-- 4. publishing_approvals_vw: 作品承認ワークフロービュー
-- =============================================================================

CREATE OR REPLACE VIEW publishing_approvals_vw AS
SELECT
  w.id,
  w.id AS work_id,
  w.creator_id,

  -- Approval status derived from is_active
  CASE
    WHEN w.is_active = true THEN 'approved'::text
    ELSE 'pending'::text
  END AS status,

  -- Organizer relationship
  co.organizer_id,
  co.status AS creator_status,

  -- Timestamps
  w.created_at AS requested_at,
  w.updated_at AS reviewed_at,

  -- Work details for approval UI
  w.title,
  w.description,
  w.primary_asset_id
FROM works w
LEFT JOIN creator_organizers co ON co.creator_id = w.creator_id
WHERE co.status = 'active' OR co.status = 'pending';

COMMENT ON VIEW publishing_approvals_vw IS 'v6 compatibility: Work approval workflow for organizer dashboard';


-- =============================================================================
-- 5. factory_orders_vw: ファクトリーダッシュボードビュー
-- =============================================================================

CREATE OR REPLACE VIEW factory_orders_vw AS
SELECT
  f.id AS fulfillment_id,
  f.order_item_id,
  oi.order_id,
  f.partner_id,
  f.state AS fulfillment_state,
  f.external_ref,
  f.cost_jpy,

  -- Order info
  o.status AS order_status,
  o.user_id AS customer_id,
  o.created_at AS order_created_at,
  o.total_payable_jpy,

  -- Product info
  oi.product_variant_id,
  pv.sku,
  pp.id AS partner_product_id,
  pp.name AS product_name,
  pp.base_price_jpy,

  -- Item details
  oi.quantity,
  oi.unit_price_jpy,

  -- Work info (for display)
  pr.work_id,
  w.title AS work_title,

  -- Timestamps
  f.created_at AS fulfillment_created_at,
  f.updated_at AS fulfillment_updated_at

FROM fulfillments f
JOIN order_items oi ON oi.id = f.order_item_id
JOIN orders o ON o.id = oi.order_id
LEFT JOIN product_variants pv ON pv.id = oi.product_variant_id
LEFT JOIN products pr ON pr.id = pv.product_id
LEFT JOIN works w ON w.id = pr.work_id
LEFT JOIN partner_products pp ON pp.id = pv.partner_product_id
WHERE o.status NOT IN ('cancelled');

COMMENT ON VIEW factory_orders_vw IS 'v6 compatibility: Simplified factory order view for partner dashboard';


-- =============================================================================
-- 6. approve_publishing(): 作品承認関数
-- =============================================================================

CREATE OR REPLACE FUNCTION approve_publishing(
  p_work_id uuid,
  p_organizer_id uuid,
  p_approved boolean,
  p_reviewer_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify organizer has permission for this work's creator
  IF NOT EXISTS (
    SELECT 1 FROM works w
    JOIN creator_organizers co ON co.creator_id = w.creator_id
    WHERE w.id = p_work_id
      AND co.organizer_id = p_organizer_id
      AND co.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Organizer does not manage this creator';
  END IF;

  -- Update work activation status
  UPDATE works
  SET
    is_active = p_approved,
    updated_at = now()
  WHERE id = p_work_id;
END;
$$;

COMMENT ON FUNCTION approve_publishing IS 'v6 compatibility: Approve or reject work publishing for organizers';


-- =============================================================================
-- 完了メッセージ
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ v6互換ビューの適用が完了しました';
  RAISE NOTICE '作成されたオブジェクト:';
  RAISE NOTICE '  - creator_organizers テーブル (IF NOT EXISTS)';
  RAISE NOTICE '  - sales_vw ビュー';
  RAISE NOTICE '  - publishing_approvals_vw ビュー';
  RAISE NOTICE '  - factory_orders_vw ビュー';
  RAISE NOTICE '  - approve_publishing() 関数';
  RAISE NOTICE '';
  RAISE NOTICE '次のステップ: アプリケーションコードをデプロイしてください';
END $$;
