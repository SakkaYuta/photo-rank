-- ============================================================================
-- v6 互換ビュー v3: 工場/製造ビューの拡張
-- ============================================================================
-- - factory_products_vw: 旧列互換（product_type, minimum_quantity, maximum_quantity, is_active）を付与
-- - manufacturing_orders_vw: 出荷/作品情報などを結合
-- ============================================================================

BEGIN;

-- factory_products_vw 拡張
CREATE OR REPLACE VIEW factory_products_vw AS
SELECT
  pp.id,
  pp.partner_id AS factory_id,
  pp.name,
  pp.base_cost_jpy AS base_price_jpy,
  pp.specs AS options,
  pp.lead_time_days,
  -- 旧列互換
  COALESCE((pp.specs->>'product_type'), pp.name) AS product_type,
  COALESCE((pp.specs->>'minimum_quantity')::int, 1) AS minimum_quantity,
  COALESCE((pp.specs->>'maximum_quantity')::int, 1000) AS maximum_quantity,
  COALESCE((pp.specs->>'is_active')::boolean, true) AS is_active,
  pp.created_at
FROM partner_products pp;

COMMENT ON VIEW factory_products_vw IS 'v5互換: partner_products を factory_products として提供（互換列付き）。';

-- manufacturing_orders_vw 拡張
CREATE OR REPLACE VIEW manufacturing_orders_vw AS
WITH oi AS (
  SELECT id, order_id, product_variant_id, creator_id FROM order_items
)
SELECT
  f.id,
  f.order_item_id,
  oi.order_id,
  f.partner_id AS factory_id,
  mp.name AS factory_name,
  f.state AS status,
  f.external_ref,
  f.cost_jpy,
  s.tracking_number,
  s.carrier_name AS carrier,
  s.state AS shipment_status,
  s.shipped_at,
  s.delivered_at,
  w.id AS work_id,
  w.title AS work_title,
  a.storage_url AS work_image_url,
  oi.creator_id,
  pr.product_type,
  pv.id AS product_variant_id,
  f.created_at,
  f.updated_at
FROM fulfillments f
JOIN oi ON oi.id = f.order_item_id
LEFT JOIN product_variants pv ON pv.id = oi.product_variant_id
LEFT JOIN products pr ON pr.id = pv.product_id
LEFT JOIN works w ON w.id = pr.work_id
LEFT JOIN assets a ON a.id = w.primary_asset_id
LEFT JOIN manufacturing_partners mp ON mp.id = f.partner_id
LEFT JOIN LATERAL (
  SELECT sh.*
  FROM shipments sh
  WHERE sh.order_id = oi.order_id
  ORDER BY sh.created_at DESC
  LIMIT 1
) s ON TRUE;

COMMENT ON VIEW manufacturing_orders_vw IS 'v5互換: fulfillments と関連情報を統合（出荷/作品/パートナー情報含む）。';

COMMIT;

