-- ============================================================================
-- Photo-Rank v6.0 Configuration & Helper Functions
-- Migration: 20251002100001_v6_config_and_helpers.sql
--
-- Purpose:
-- - System configuration table (tax rates, fees, point conversion)
-- - Helper functions for calculations
-- - RLS policies
-- ============================================================================

-- ============================================================================
-- SYSTEM CONFIGURATION
-- ============================================================================

CREATE TABLE system_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE system_config IS 'System-wide configuration settings';

-- Insert default configuration
INSERT INTO system_config (key, value, description) VALUES
  -- Tax settings
  ('tax_rate_bps', '1000', 'Default consumption tax rate in basis points (1000 = 10%)'),

  -- Platform fee settings
  ('platform_fee_rate_bps', '3000', 'Default platform fee rate in basis points (3000 = 30%)'),

  -- Battle point conversion
  ('battle_point_conversion', '{"jpy_per_point": 1, "min_cheer_jpy": 100}', 'Battle point conversion rules (1 JPY = 1 point)'),

  -- Digital download settings
  ('digital_download_max_count', '3', 'Maximum download count per purchase'),
  ('digital_download_expiry_days', '30', 'Download link expiry in days'),

  -- Live offer settings
  ('live_offer_reservation_ttl_seconds', '300', 'Stock reservation time-to-live (5 minutes)'),
  ('live_offer_max_per_user', '1', 'Maximum purchase quantity per user per offer'),

  -- Shipping settings
  ('shipping_free_threshold_jpy', '5000', 'Free shipping threshold in JPY'),

  -- Order settings
  ('order_cancel_window_hours', '1', 'Hours allowed for user to cancel pending order'),

  -- File upload limits
  ('max_file_size_mb', '50', 'Maximum file upload size in MB'),
  ('max_works_per_creator', '1000', 'Maximum works per creator'),

  -- Battle settings
  ('battle_min_eligibility_sales', '10', 'Minimum sales in last 30 days for battle eligibility'),
  ('battle_organizer_auto_eligible', 'true', 'Organizers are automatically eligible')
ON CONFLICT (key) DO NOTHING;

-- Function to get config value
CREATE OR REPLACE FUNCTION get_config(config_key text)
RETURNS jsonb AS $$
  SELECT value FROM system_config WHERE key = config_key;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_config IS 'Get system configuration value by key';

-- Function to get config as integer
CREATE OR REPLACE FUNCTION get_config_int(config_key text)
RETURNS integer AS $$
  SELECT (value)::text::integer FROM system_config WHERE key = config_key;
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- TAX & FEE CALCULATION HELPERS
-- ============================================================================

-- Function: Calculate tax amount
CREATE OR REPLACE FUNCTION calculate_tax(
  amount_excl_tax_jpy integer,
  tax_rate_bps integer DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  v_rate_bps integer;
BEGIN
  -- Use provided rate or default from config
  v_rate_bps := COALESCE(tax_rate_bps, get_config_int('tax_rate_bps'));

  -- Calculate: amount * rate / 10000, rounded
  RETURN ROUND(amount_excl_tax_jpy * v_rate_bps::numeric / 10000);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_tax IS 'Calculate tax amount from pre-tax amount and rate in bps';

-- Function: Calculate platform fee
CREATE OR REPLACE FUNCTION calculate_platform_fee(
  amount_excl_tax_jpy integer,
  fee_rate_bps integer DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  v_rate_bps integer;
BEGIN
  -- Use provided rate or default from config
  v_rate_bps := COALESCE(fee_rate_bps, get_config_int('platform_fee_rate_bps'));

  -- Calculate: amount * rate / 10000, rounded
  RETURN ROUND(amount_excl_tax_jpy * v_rate_bps::numeric / 10000);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_platform_fee IS 'Calculate platform fee from pre-tax amount and rate in bps';

-- Function: Calculate creator earnings
CREATE OR REPLACE FUNCTION calculate_creator_earnings(
  amount_excl_tax_jpy integer,
  platform_fee_rate_bps integer DEFAULT NULL
)
RETURNS integer AS $$
BEGIN
  RETURN amount_excl_tax_jpy - calculate_platform_fee(amount_excl_tax_jpy, platform_fee_rate_bps);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_creator_earnings IS 'Calculate creator earnings after platform fee';

-- ============================================================================
-- BATTLE POINT CONVERSION
-- ============================================================================

-- Function: Convert JPY to battle points
CREATE OR REPLACE FUNCTION jpy_to_points(amount_jpy integer)
RETURNS integer AS $$
DECLARE
  v_conversion jsonb;
  v_jpy_per_point numeric;
BEGIN
  v_conversion := get_config('battle_point_conversion');
  v_jpy_per_point := (v_conversion->>'jpy_per_point')::numeric;

  -- Default: 1 JPY = 1 point
  RETURN ROUND(amount_jpy / v_jpy_per_point);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION jpy_to_points IS 'Convert JPY amount to battle points (default: 1 JPY = 1 point)';

-- Function: Convert points to JPY
CREATE OR REPLACE FUNCTION points_to_jpy(points integer)
RETURNS integer AS $$
DECLARE
  v_conversion jsonb;
  v_jpy_per_point numeric;
BEGIN
  v_conversion := get_config('battle_point_conversion');
  v_jpy_per_point := (v_conversion->>'jpy_per_point')::numeric;

  RETURN ROUND(points * v_jpy_per_point);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION points_to_jpy IS 'Convert battle points to JPY amount';

-- ============================================================================
-- SHIPPING CALCULATION
-- ============================================================================

-- Function: Get shipping fee for order
CREATE OR REPLACE FUNCTION get_shipping_fee(
  p_manufacturing_partner_id uuid,
  p_prefecture text
)
RETURNS integer AS $$
DECLARE
  v_zone_id uuid;
  v_rate_jpy integer;
BEGIN
  -- Find zone for prefecture
  SELECT zone_id INTO v_zone_id
  FROM shipping_zone_members szm
  JOIN jp_prefectures jp ON jp.code = szm.prefecture_code
  WHERE jp.name = p_prefecture OR jp.code = p_prefecture
  LIMIT 1;

  IF v_zone_id IS NULL THEN
    RAISE EXCEPTION 'No shipping zone found for prefecture: %', p_prefecture;
  END IF;

  -- Get rate for factory + zone
  SELECT rate_jpy INTO v_rate_jpy
  FROM shipping_rates
  WHERE manufacturing_partner_id = p_manufacturing_partner_id
    AND zone_id = v_zone_id;

  RETURN COALESCE(v_rate_jpy, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_shipping_fee IS 'Get shipping fee for factory and prefecture';

-- ============================================================================
-- ORDER TOTAL CALCULATION
-- ============================================================================

-- Function: Calculate order totals
CREATE OR REPLACE FUNCTION calculate_order_totals(p_order_id uuid)
RETURNS TABLE (
  subtotal_excl_tax_jpy integer,
  tax_total_jpy integer,
  shipping_total_jpy integer,
  platform_fee_total_jpy integer,
  total_payable_jpy integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    SUM(oi.subtotal_excl_tax_jpy)::integer AS subtotal_excl_tax_jpy,
    SUM(oi.subtotal_tax_jpy)::integer AS tax_total_jpy,
    COALESCE(
      (SELECT SUM(s.shipping_fee_jpy) FROM shipments s WHERE s.order_id = p_order_id),
      0
    )::integer AS shipping_total_jpy,
    SUM(oi.platform_fee_amount_jpy)::integer AS platform_fee_total_jpy,
    (
      SUM(oi.subtotal_excl_tax_jpy) +
      SUM(oi.subtotal_tax_jpy) +
      COALESCE(
        (SELECT SUM(s.shipping_fee_jpy) FROM shipments s WHERE s.order_id = p_order_id),
        0
      )
    )::integer AS total_payable_jpy
  FROM order_items oi
  WHERE oi.order_id = p_order_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_order_totals IS 'Calculate order totals from order items and shipments';

-- ============================================================================
-- INVENTORY MANAGEMENT
-- ============================================================================

-- Function: Check and reserve inventory
CREATE OR REPLACE FUNCTION reserve_inventory(
  p_variant_id uuid,
  p_quantity integer
)
RETURNS boolean AS $$
DECLARE
  v_available integer;
BEGIN
  -- Lock row for update
  SELECT
    COALESCE(inventory_qty, 999999) - COALESCE(
      (SELECT SUM(quantity) FROM cart_items WHERE product_variant_id = p_variant_id),
      0
    )
  INTO v_available
  FROM product_variants
  WHERE id = p_variant_id
  FOR UPDATE;

  -- Check availability
  IF v_available < p_quantity THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reserve_inventory IS 'Check inventory availability (does not modify)';

-- ============================================================================
-- LIVE OFFER RESERVATION
-- ============================================================================

-- Function: Reserve live offer stock
CREATE OR REPLACE FUNCTION reserve_live_offer(
  p_offer_id uuid,
  p_user_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS boolean AS $$
DECLARE
  v_offer live_offers%ROWTYPE;
  v_available integer;
  v_ttl_seconds integer;
  v_max_per_user integer;
  v_user_total integer;
BEGIN
  -- Get config
  v_ttl_seconds := get_config_int('live_offer_reservation_ttl_seconds');
  v_max_per_user := get_config_int('live_offer_max_per_user');

  -- Lock offer row
  SELECT * INTO v_offer
  FROM live_offers
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check offer status and time
  IF v_offer.status != 'live' THEN
    RETURN false;
  END IF;

  -- Calculate available stock
  v_available := v_offer.stock_qty - v_offer.reserved_qty;

  IF v_available < p_quantity THEN
    RETURN false;
  END IF;

  -- Check per-user limit
  SELECT COUNT(*) INTO v_user_total
  FROM live_offer_reservations
  WHERE offer_id = p_offer_id
    AND user_id = p_user_id
    AND state = 'active'
    AND expires_at > now();

  IF v_user_total >= v_max_per_user THEN
    RETURN false;
  END IF;

  -- Create reservation
  INSERT INTO live_offer_reservations (
    offer_id, user_id, quantity, expires_at
  ) VALUES (
    p_offer_id, p_user_id, p_quantity, now() + (v_ttl_seconds || ' seconds')::interval
  );

  -- Update reserved quantity
  UPDATE live_offers
  SET reserved_qty = reserved_qty + p_quantity
  WHERE id = p_offer_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reserve_live_offer IS 'Reserve live offer stock for user (with TTL)';

-- Function: Release expired reservations
CREATE OR REPLACE FUNCTION release_expired_reservations()
RETURNS integer AS $$
DECLARE
  v_released integer;
BEGIN
  -- Expire old reservations
  UPDATE live_offer_reservations
  SET state = 'expired'
  WHERE state = 'active'
    AND expires_at < now();

  GET DIAGNOSTICS v_released = ROW_COUNT;

  -- Release reserved stock
  UPDATE live_offers lo
  SET reserved_qty = GREATEST(
    reserved_qty - COALESCE(
      (
        SELECT SUM(r.quantity)
        FROM live_offer_reservations r
        WHERE r.offer_id = lo.id
          AND r.state = 'expired'
      ),
      0
    ),
    0
  )
  WHERE id IN (
    SELECT DISTINCT offer_id
    FROM live_offer_reservations
    WHERE state = 'expired'
  );

  RETURN v_released;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION release_expired_reservations IS 'Expire old reservations and release stock (run via cron)';

-- ============================================================================
-- BATTLE WINNER DETERMINATION
-- ============================================================================

-- Function: Determine battle winner
CREATE OR REPLACE FUNCTION determine_battle_winner(p_battle_id uuid)
RETURNS uuid AS $$
DECLARE
  v_winner_id uuid;
  v_max_points integer;
BEGIN
  -- Get creator with highest points
  SELECT creator_id, total_points INTO v_winner_id, v_max_points
  FROM battle_points
  WHERE battle_id = p_battle_id
  ORDER BY total_points DESC, creator_id
  LIMIT 1;

  -- Update battle
  IF v_winner_id IS NOT NULL THEN
    UPDATE battles
    SET
      winner_id = v_winner_id,
      status = 'finished',
      ended_at = now()
    WHERE id = p_battle_id;
  END IF;

  RETURN v_winner_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION determine_battle_winner IS 'Determine battle winner based on total points';

-- ============================================================================
-- CLEANUP & MAINTENANCE
-- ============================================================================

-- Function: Cleanup expired data
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS jsonb AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_count integer;
BEGIN
  -- Release expired live offer reservations
  SELECT release_expired_reservations() INTO v_count;
  v_result := jsonb_set(v_result, '{expired_reservations}', to_jsonb(v_count));

  -- Delete old idempotency keys
  DELETE FROM idempotency_keys WHERE expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{deleted_idempotency_keys}', to_jsonb(v_count));

  -- Delete old download tokens
  DELETE FROM download_tokens WHERE expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{deleted_download_tokens}', to_jsonb(v_count));

  -- Delete old activity events (older than 90 days)
  DELETE FROM activity_events WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := jsonb_set(v_result, '{deleted_activity_events}', to_jsonb(v_count));

  -- Refresh battle eligibility materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY battle_eligibility_mv;
  v_result := jsonb_set(v_result, '{refreshed_battle_eligibility}', 'true'::jsonb);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_data IS 'Cleanup expired data (run daily via cron)';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE works ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheer_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Users: Own profile and admins
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users
  FOR SELECT USING (
    auth.uid() = auth_user_id OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = users.id AND role = 'admin')
  );

DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth.uid() = auth_user_id);

-- User Profiles: Public read, own update
DROP POLICY IF EXISTS user_profiles_select ON user_profiles;
CREATE POLICY user_profiles_select ON user_profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS user_profiles_update ON user_profiles;
CREATE POLICY user_profiles_update ON user_profiles
  FOR UPDATE USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Works: Published public, own all access
DROP POLICY IF EXISTS works_select ON works;
CREATE POLICY works_select ON works
  FOR SELECT USING (
    is_active = true OR
    creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS works_manage ON works;
CREATE POLICY works_manage ON works
  FOR ALL USING (
    creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Products: Published public, creator manage
DROP POLICY IF EXISTS products_select ON products;
CREATE POLICY products_select ON products
  FOR SELECT USING (
    status = 'published' OR
    creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS products_manage ON products;
CREATE POLICY products_manage ON products
  FOR ALL USING (
    creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Orders: Own orders only
DROP POLICY IF EXISTS orders_own ON orders;
CREATE POLICY orders_own ON orders
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Battles: Participants can view
DROP POLICY IF EXISTS battles_select ON battles;
CREATE POLICY battles_select ON battles
  FOR SELECT USING (
    status IN ('live', 'finished') OR
    id IN (
      SELECT battle_id FROM battle_participants
      WHERE user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- Favorites: Own only
DROP POLICY IF EXISTS favorites_own ON favorites;
CREATE POLICY favorites_own ON favorites
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- System Config: Public read, admin write
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_config_read ON system_config;
CREATE POLICY system_config_read ON system_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS system_config_admin_write ON system_config;
CREATE POLICY system_config_admin_write ON system_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN users u ON u.id = ur.user_id
      WHERE u.auth_user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Mark migration complete
INSERT INTO schema_migrations (version) VALUES ('v6_config_and_helpers')
ON CONFLICT (version) DO NOTHING;
