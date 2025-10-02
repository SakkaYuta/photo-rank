-- ============================================================================
-- Photo-Rank v6.0 Security Hardening
-- ============================================================================
-- Purpose: RLS強化、権限の適正化、機密テーブル保護
-- Date: 2025-10-02
-- Priority: CRITICAL - セキュリティ脆弱性の修正
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: 広域GRANT撤回
-- ============================================================================
-- 現在、anon/authenticatedにALL権限が付与されているため、全て撤回

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- ============================================================================
-- STEP 2: 機密テーブルのRLS有効化 + Deny-All
-- ============================================================================

-- Stripe関連（service_roleのみアクセス可能）
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY stripe_events_deny_all ON stripe_webhook_events
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

ALTER TABLE payment_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_failures_deny_all ON payment_failures
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY refunds_deny_all ON refunds
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- 監査ログ（service_roleのみアクセス可能）
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_deny_all ON audit_logs
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- セキュリティ関連
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY idempotency_keys_deny_all ON idempotency_keys
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

ALTER TABLE rate_limit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY rate_limit_logs_deny_all ON rate_limit_logs
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

ALTER TABLE upload_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY upload_attempts_deny_all ON upload_attempts
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- アクティビティイベント（ユーザー自身のみ閲覧可）
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_events_own ON activity_events
  FOR SELECT USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- ============================================================================
-- STEP 3: 公開コンテンツのRLS強化
-- ============================================================================

-- 作品アセット（公開作品のプライマリアセットのみ閲覧可）
DROP POLICY IF EXISTS assets_select ON assets;
CREATE POLICY assets_public_read ON assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM works w
      WHERE w.primary_asset_id = assets.id
      AND w.is_active = true
    )
  );

-- オーナー自身のアセットは全て閲覧・管理可能
CREATE POLICY assets_owner_manage ON assets
  FOR ALL USING (
    owner_user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- 作品（公開作品のみ閲覧、クリエイターは自分の作品を管理）
DROP POLICY IF EXISTS works_select ON works;
DROP POLICY IF EXISTS works_manage ON works;

CREATE POLICY works_public_read ON works
  FOR SELECT USING (is_active = true);

CREATE POLICY works_creator_manage ON works
  FOR ALL USING (
    creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- ============================================================================
-- STEP 4: 商品・バリアントのRLS強化
-- ============================================================================

-- 商品（公開商品のみ閲覧、クリエイターは自分の商品を管理）
DROP POLICY IF EXISTS products_select ON products;
DROP POLICY IF EXISTS products_manage ON products;

CREATE POLICY products_public_read ON products
  FOR SELECT USING (status = 'published');

CREATE POLICY products_creator_manage ON products
  FOR ALL USING (
    creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- 商品バリアント（公開商品の有効なバリアントのみ閲覧）
DROP POLICY IF EXISTS product_variants_select ON product_variants;

CREATE POLICY product_variants_public_read ON product_variants
  FOR SELECT USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_variants.product_id
      AND p.status = 'published'
    )
  );

CREATE POLICY product_variants_creator_manage ON product_variants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_variants.product_id
      AND p.creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- ============================================================================
-- STEP 5: 注文・支払いのRLS強化
-- ============================================================================

-- 注文（ユーザー自身の注文のみ閲覧・管理）
DROP POLICY IF EXISTS orders_own ON orders;

CREATE POLICY orders_user_read ON orders
  FOR SELECT USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY orders_user_manage ON orders
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- クリエイターは自分の商品を含む注文を閲覧可能
CREATE POLICY orders_creator_read ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM order_items oi
      WHERE oi.order_id = orders.id
      AND oi.creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- 注文明細（注文と同じポリシー）
DROP POLICY IF EXISTS order_items_select ON order_items;

CREATE POLICY order_items_user_read ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY order_items_creator_read ON order_items
  FOR SELECT USING (
    creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- 支払い（ユーザー自身の注文の支払いのみ閲覧）
DROP POLICY IF EXISTS payments_select ON payments;

CREATE POLICY payments_user_read ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = payments.order_id
      AND o.user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- ============================================================================
-- STEP 6: バトル関連のRLS強化
-- ============================================================================

-- バトル（公開バトルのみ閲覧）
-- Note: バトルの管理はbattle_participantsテーブル経由で制御
DROP POLICY IF EXISTS battles_select ON battles;

CREATE POLICY battles_public_read ON battles
  FOR SELECT USING (
    status IN ('scheduled', 'live', 'finished')
  );

-- 応援チケット（バトル参加者・サポーターは閲覧可）
DROP POLICY IF EXISTS cheer_tickets_select ON cheer_tickets;

CREATE POLICY cheer_tickets_read ON cheer_tickets
  FOR SELECT USING (
    supporter_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY cheer_tickets_supporter_insert ON cheer_tickets
  FOR INSERT WITH CHECK (
    supporter_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- ============================================================================
-- STEP 7: ライブオファー関連のRLS
-- ============================================================================

-- ライブオファー（ライブ・予定のもののみ公開）
DROP POLICY IF EXISTS live_offers_select ON live_offers;

CREATE POLICY live_offers_public_read ON live_offers
  FOR SELECT USING (
    status IN ('live', 'scheduled')
  );

-- Note: live_offersにcreator_idがないため、product_variant経由で制御
CREATE POLICY live_offers_variant_creator_manage ON live_offers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.id = live_offers.product_variant_id
      AND p.creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- ライブオファー予約（ユーザー自身の予約のみ閲覧・管理）
ALTER TABLE live_offer_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY live_offer_reservations_user ON live_offer_reservations
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- ============================================================================
-- STEP 8: お気に入り・カート
-- ============================================================================

-- お気に入り（ユーザー自身のみ）
DROP POLICY IF EXISTS favorites_own ON favorites;

CREATE POLICY favorites_user_manage ON favorites
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- カート（ユーザー自身のみ）
DROP POLICY IF EXISTS carts_select ON carts;

CREATE POLICY carts_user_manage ON carts
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS cart_items_select ON cart_items;

CREATE POLICY cart_items_user_manage ON cart_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM carts c
      WHERE c.id = cart_items.cart_id
      AND c.user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- ============================================================================
-- STEP 9: 配送関連のRLS
-- ============================================================================

-- 配送（ユーザー自身の配送のみ閲覧）
DROP POLICY IF EXISTS shipments_select ON shipments;

CREATE POLICY shipments_user_read ON shipments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = shipments.order_id
      AND o.user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- クリエイターは自分の商品の配送を閲覧可能
CREATE POLICY shipments_creator_read ON shipments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shipment_items si
      JOIN order_items oi ON oi.id = si.order_item_id
      WHERE si.shipment_id = shipments.id
      AND oi.creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- ============================================================================
-- STEP 10: デジタル商品のRLS
-- ============================================================================

-- ダウンロード権限（ユーザー自身の権限のみ閲覧）
DROP POLICY IF EXISTS download_entitlements_select ON download_entitlements;

CREATE POLICY download_entitlements_user_read ON download_entitlements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = download_entitlements.order_item_id
      AND o.user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- ダウンロードトークン（認証済みユーザーのみ使用可能）
ALTER TABLE download_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY download_tokens_authenticated ON download_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM download_entitlements de
      JOIN order_items oi ON oi.id = de.order_item_id
      JOIN orders o ON o.id = oi.order_id
      WHERE de.id = download_tokens.entitlement_id
      AND o.user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- デジタルアセット（service_roleのみ）
ALTER TABLE digital_variant_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY digital_variant_assets_deny_all ON digital_variant_assets
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- ============================================================================
-- STEP 11: マスターデータ・参照テーブル
-- ============================================================================

-- 都道府県（全員読み取り可）
ALTER TABLE jp_prefectures ENABLE ROW LEVEL SECURITY;
CREATE POLICY jp_prefectures_public_read ON jp_prefectures
  FOR SELECT TO PUBLIC USING (true);

-- 配送ゾーン（全員読み取り可）
ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipping_zones_public_read ON shipping_zones
  FOR SELECT TO PUBLIC USING (true);

ALTER TABLE shipping_zone_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipping_zone_members_public_read ON shipping_zone_members
  FOR SELECT TO PUBLIC USING (true);

-- 配送料金（全員読み取り可）
ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipping_rates_public_read ON shipping_rates
  FOR SELECT TO PUBLIC USING (true);

-- カテゴリ・タグ（全員読み取り可）
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_public_read ON categories
  FOR SELECT TO PUBLIC USING (true);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tags_public_read ON tags
  FOR SELECT TO PUBLIC USING (true);

-- ============================================================================
-- STEP 12: 工場・パートナー関連
-- ============================================================================

-- 製造パートナー（全員読み取り可）
ALTER TABLE manufacturing_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY manufacturing_partners_public_read ON manufacturing_partners
  FOR SELECT TO PUBLIC USING (true);

-- パートナー商品（全員読み取り可）
ALTER TABLE partner_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_products_public_read ON partner_products
  FOR SELECT TO PUBLIC USING (true);

-- パートナーモックアップ（全員読み取り可）
ALTER TABLE partner_product_mockups ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_product_mockups_public_read ON partner_product_mockups
  FOR SELECT TO PUBLIC USING (true);

-- フルフィルメント（工場ユーザーのみ管理）
ALTER TABLE fulfillments ENABLE ROW LEVEL SECURITY;
CREATE POLICY fulfillments_partner_manage ON fulfillments
  FOR ALL USING (
    partner_id IN (
      SELECT partner_id FROM partner_users
      WHERE user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- クリエイターは自分の商品のフルフィルメントを閲覧可能
CREATE POLICY fulfillments_creator_read ON fulfillments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM order_items oi
      WHERE oi.id = fulfillments.order_item_id
      AND oi.creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- ============================================================================
-- STEP 13: 内部管理テーブル（全てservice_role限定）
-- ============================================================================

-- 配送明細
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipment_items_deny_all ON shipment_items
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- フルフィルメントイベント
ALTER TABLE fulfillment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY fulfillment_events_deny_all ON fulfillment_events
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- 注文住所（内部管理）
ALTER TABLE order_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_addresses_deny_all ON order_addresses
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- 価格履歴（内部管理）
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY price_history_deny_all ON price_history
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- アセット取り込み
ALTER TABLE asset_ingestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY asset_ingestions_deny_all ON asset_ingestions
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- 作品アセット（work_assets）
ALTER TABLE work_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY work_assets_deny_all ON work_assets
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- 作品タグ
ALTER TABLE work_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY work_tags_public_read ON work_tags
  FOR SELECT TO PUBLIC USING (true);

-- バトル招待
ALTER TABLE battle_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY battle_invitations_deny_all ON battle_invitations
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- バトル参加者
ALTER TABLE battle_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY battle_participants_deny_all ON battle_participants
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- 主催者プロフィール
ALTER TABLE organizer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizer_profiles_public_read ON organizer_profiles
  FOR SELECT TO PUBLIC USING (true);

-- パートナー通知
ALTER TABLE partner_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_notifications_deny_all ON partner_notifications
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- パートナーユーザー
ALTER TABLE partner_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_users_deny_all ON partner_users
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- バトル適格性（materialized view - v6スキーマには存在しない）
-- Note: 必要に応じて後で追加

-- ============================================================================
-- STEP 14: 読み取り専用関数への権限付与
-- ============================================================================

-- 計算関数（全員実行可能）
GRANT EXECUTE ON FUNCTION calculate_tax TO anon, authenticated;
GRANT EXECUTE ON FUNCTION calculate_platform_fee TO anon, authenticated;
GRANT EXECUTE ON FUNCTION calculate_creator_earnings TO anon, authenticated;
GRANT EXECUTE ON FUNCTION jpy_to_points TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_shipping_fee TO anon, authenticated;
GRANT EXECUTE ON FUNCTION calculate_order_totals TO anon, authenticated;

-- 設定取得関数（全員実行可能）
GRANT EXECUTE ON FUNCTION get_config TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_config_int TO anon, authenticated;

-- バトル関連関数（認証済みユーザーのみ）
GRANT EXECUTE ON FUNCTION determine_battle_winner TO authenticated;

-- 更新系関数（service_roleのみ - デフォルトで制限されているため明示的な設定不要）
-- reserve_inventory, reserve_live_offer, release_expired_reservations, cleanup_expired_data

COMMIT;
