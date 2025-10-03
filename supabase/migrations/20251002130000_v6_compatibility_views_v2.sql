-- ============================================================================
-- Photo-Rank v6.0 互換ビュー v2（purchases_vw 拡張）
-- ============================================================================
-- Purpose: ダッシュボード/履歴向けに作品タイトル・画像を提供
-- Date: 2025-10-02
-- ============================================================================

BEGIN;

-- purchases_vw に作品情報を追加
-- - work_id, work_title, work_image_url を提供
-- - 画像URLは works -> assets(primary_asset_id) を結合
-- - LEFT JOIN で非公開/非参照でもNULLで落ちないようにする

-- Drop existing view first to avoid column name conflicts
DROP VIEW IF EXISTS purchases_vw;

CREATE VIEW purchases_vw AS
SELECT
  o.id,
  o.user_id,
  oi.creator_id,
  oi.product_variant_id AS product_id,
  pr.work_id,
  w.title AS work_title,
  a.storage_url AS work_image_url,
  oi.quantity,
  oi.unit_price_jpy AS price,
  o.total_payable_jpy AS total_amount,
  o.status,
  p.stripe_payment_intent_id,
  p.state AS payment_status,
  o.created_at,
  o.updated_at
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN product_variants pv ON pv.id = oi.product_variant_id
LEFT JOIN products pr ON pr.id = pv.product_id
LEFT JOIN works w ON w.id = pr.work_id
LEFT JOIN assets a ON a.id = w.primary_asset_id
LEFT JOIN payments p ON p.order_id = o.id;

COMMENT ON VIEW purchases_vw IS 'v5互換: purchases テーブルのビュー（作品タイトル・画像を含む拡張版）。';

COMMIT;

