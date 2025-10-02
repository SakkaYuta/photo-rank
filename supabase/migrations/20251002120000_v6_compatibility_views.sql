-- ============================================================================
-- Photo-Rank v6.0 互換ビュー
-- ============================================================================
-- Purpose: v5スキーマとの互換性を保つためのビュー
-- Date: 2025-10-02
-- Note: アプリ側の段階的移行を容易にするための一時的なビュー
-- ============================================================================

BEGIN;

-- ============================================================================
-- purchases_vw: v5の purchases テーブル互換ビュー
-- ============================================================================
-- v6では orders + order_items + payments に分割されているため統合
CREATE OR REPLACE VIEW purchases_vw AS
SELECT
  o.id,
  o.user_id,
  oi.creator_id,
  oi.product_variant_id as product_id,  -- v5では product_id
  oi.quantity,
  oi.unit_price_jpy as price,  -- v5では税込価格
  o.total_payable_jpy as total_amount,
  o.status,
  p.stripe_payment_intent_id,
  p.state as payment_status,
  o.created_at,
  o.updated_at
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN payments p ON p.order_id = o.id;

COMMENT ON VIEW purchases_vw IS 'v5互換: purchases テーブルのビュー。v6では orders/order_items/payments に分割。';

-- ============================================================================
-- works_vw: 作品とアセットを結合したビュー
-- ============================================================================
-- v5では works.image_url だったが、v6では assets テーブルに分離
CREATE OR REPLACE VIEW works_vw AS
SELECT
  w.id,
  w.creator_id,
  w.primary_asset_id,
  w.title,
  w.description,
  w.is_active,
  w.created_at,
  w.updated_at,
  a.storage_url as image_url,  -- v5互換フィールド
  a.width,
  a.height,
  a.mime_type
FROM works w
LEFT JOIN assets a ON a.id = w.primary_asset_id;

COMMENT ON VIEW works_vw IS 'v5互換: works と assets を結合し image_url フィールドを提供。';

-- ============================================================================
-- factory_products_vw: v5の factory_products 互換ビュー
-- ============================================================================
-- v6では partner_products に名称変更
CREATE OR REPLACE VIEW factory_products_vw AS
SELECT
  id,
  partner_id as factory_id,  -- v5では factory_id
  name,
  base_cost_jpy as base_price_jpy,  -- v6では base_cost_jpy
  specs as options,  -- v6では specs
  lead_time_days,
  created_at
FROM partner_products;

COMMENT ON VIEW factory_products_vw IS 'v5互換: partner_products を factory_products として提供。';

-- ============================================================================
-- factory_profiles_vw: v5の factory_profiles 互換ビュー
-- ============================================================================
-- v6では manufacturing_partners に統合
CREATE OR REPLACE VIEW factory_profiles_vw AS
SELECT
  id as factory_id,
  name as factory_name,
  contact_email,
  contact_phone,
  address,
  metadata as capabilities,  -- v6では metadata
  created_at
FROM manufacturing_partners;

COMMENT ON VIEW factory_profiles_vw IS 'v5互換: manufacturing_partners を factory_profiles として提供。';

-- ============================================================================
-- manufacturing_orders_vw: v5の manufacturing_orders 互換ビュー
-- ============================================================================
-- v6では fulfillments (工場向け) と shipments (顧客向け) に分離
CREATE OR REPLACE VIEW manufacturing_orders_vw AS
SELECT
  f.id,
  f.order_item_id,
  f.partner_id as factory_id,
  f.state as status,
  f.external_ref,
  f.cost_jpy,
  s.tracking_number,
  s.carrier_name as carrier,  -- v6では carrier_name
  s.state as shipment_status,
  f.created_at,
  f.updated_at
FROM fulfillments f
LEFT JOIN shipments s ON s.order_id = (
  SELECT order_id FROM order_items WHERE id = f.order_item_id
);

COMMENT ON VIEW manufacturing_orders_vw IS 'v5互換: fulfillments と shipments を統合。';

-- ============================================================================
-- refund_requests_vw: v5の refund_requests 互換ビュー
-- ============================================================================
-- v6では refunds テーブルに統合（状態管理込み）
CREATE OR REPLACE VIEW refund_requests_vw AS
SELECT
  id,
  payment_id,
  amount_jpy as requested_amount,
  reason,
  state as status,
  stripe_refund_id,
  processed_at,
  created_at
FROM refunds;

COMMENT ON VIEW refund_requests_vw IS 'v5互換: refunds を refund_requests として提供。';

-- ============================================================================
-- users_vw: ユーザーとプロフィールを結合
-- ============================================================================
-- v5では users.display_name だったが、v6では user_profiles.display_name
CREATE OR REPLACE VIEW users_vw AS
SELECT
  u.id,
  u.auth_user_id,
  u.email,
  u.phone,
  u.is_verified,
  u.created_at,
  u.updated_at,
  up.display_name,  -- v5互換フィールド
  up.bio,
  up.avatar_url
FROM users u
LEFT JOIN user_profiles up ON up.user_id = u.id;

COMMENT ON VIEW users_vw IS 'v5互換: users と user_profiles を結合し display_name を提供。';

-- ============================================================================
-- cheer_free_counters_vw: 無料応援カウンター（v6で削除されたテーブル）
-- ============================================================================
-- v6では cheer_tickets に統合（amount_jpy=0 の場合が無料応援）
CREATE OR REPLACE VIEW cheer_free_counters_vw AS
SELECT
  id,
  battle_id,
  supporter_id,
  creator_id,
  created_at
FROM cheer_tickets
WHERE amount_jpy = 0;

COMMENT ON VIEW cheer_free_counters_vw IS 'v5互換: 無料応援チケット（amount_jpy=0）を抽出。';

-- ============================================================================
-- ビューへのRLSポリシー設定
-- ============================================================================
-- ビューは基底テーブルのRLSポリシーを継承するため、
-- 追加のポリシーは不要（security_invoker オプションで制御可能）

-- ============================================================================
-- 互換関数: complete_purchase_transaction (v5互換)
-- ============================================================================
-- Stripe Webhookで使用していた関数の互換版
CREATE OR REPLACE FUNCTION complete_purchase_transaction(
  p_payment_intent_id text,
  p_amount_jpy integer DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_payment_id uuid;
  v_order_id uuid;
  v_result jsonb;
BEGIN
  -- paymentsテーブルを更新
  UPDATE payments
  SET
    state = 'captured',
    captured_at = now()
  WHERE stripe_payment_intent_id = p_payment_intent_id
  RETURNING id, order_id INTO v_payment_id, v_order_id;

  IF v_payment_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment not found'
    );
  END IF;

  -- 注文ステータスを更新
  UPDATE orders
  SET
    payment_state = 'captured',
    status = 'confirmed',
    updated_at = now()
  WHERE id = v_order_id;

  -- デジタル商品の場合、ダウンロード権限を発行
  INSERT INTO download_entitlements (
    order_item_id,
    product_variant_id,
    max_downloads,
    expires_at
  )
  SELECT
    oi.id,
    oi.product_variant_id,
    get_config_int('digital_download_max_count'),
    now() + (get_config_int('digital_download_expiry_days') || ' days')::interval
  FROM order_items oi
  JOIN product_variants pv ON pv.id = oi.product_variant_id
  WHERE oi.order_id = v_order_id
    AND pv.kind = 'digital'
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'order_id', v_order_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION complete_purchase_transaction IS 'v5互換: 購入トランザクション完了処理（Stripe Webhook用）';

-- ============================================================================
-- 互換関数: finalize_live_offer_transaction (v5互換)
-- ============================================================================
CREATE OR REPLACE FUNCTION finalize_live_offer_transaction(
  p_payment_intent_id text
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- 基本的な支払い完了処理を実行
  v_result := complete_purchase_transaction(p_payment_intent_id);

  -- ライブオファー予約の解放（完了時に自動解放）
  -- reserve_live_offerで設定されたTTLにより自動的に解放されるため、
  -- 明示的な処理は不要

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION finalize_live_offer_transaction IS 'v5互換: ライブオファー購入完了処理';

COMMIT;
