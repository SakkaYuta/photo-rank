-- ============================================================================
-- Photo-Rank v6.0 Unified Schema - Production Ready
-- Migration: 20251002100000_v6_unified_schema.sql
--
-- Requirements:
-- - JPY currency only (tax-exclusive pricing)
-- - External tax calculation (10% default = 1000bps)
-- - Platform fee 30% (3000bps) on pre-tax amount
-- - Factory-specific shipping by prefecture zone
-- - Digital product support (no shipping, download entitlements)
-- - Fine-grained variants (size, material, frame, etc.)
-- - Battle points system (1 JPY = 1 point default)
-- - Stripe payment only
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE asset_provider AS ENUM (
  'upload', 'url', 'instagram', 'twitter', 'pinterest', 'other'
);

CREATE TYPE ingestion_policy AS ENUM ('allow', 'deny', 'manual');
CREATE TYPE ingestion_status AS ENUM ('pending', 'approved', 'rejected', 'blocked');

CREATE TYPE product_type AS ENUM ('print', 'merch', 'digital', 'other');
CREATE TYPE product_status AS ENUM ('draft', 'pending', 'published', 'disabled');

CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
);

CREATE TYPE payment_state AS ENUM (
  'requires_payment', 'authorized', 'captured', 'failed', 'refunded', 'cancelled'
);

CREATE TYPE shipment_state AS ENUM (
  'pending', 'packed', 'shipped', 'delivered', 'returned', 'cancelled'
);

CREATE TYPE battle_status AS ENUM ('scheduled', 'live', 'finished', 'cancelled');
CREATE TYPE participant_role AS ENUM ('challenger', 'opponent');

CREATE TYPE offer_status AS ENUM ('scheduled', 'live', 'ended', 'cancelled');
CREATE TYPE reservation_state AS ENUM ('active', 'expired', 'converted', 'cancelled');

CREATE TYPE fulfillment_state AS ENUM (
  'pending', 'accepted', 'in_production', 'ready_to_ship',
  'shipped', 'delivered', 'cancelled', 'failed'
);

CREATE TYPE license_state AS ENUM ('active', 'expired', 'revoked');

-- ============================================================================
-- CORE: USERS & PROFILES
-- ============================================================================

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Supabase Auth integration
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  email text NOT NULL UNIQUE,
  phone text,
  is_verified boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_auth ON users(auth_user_id);
CREATE INDEX idx_users_email ON users(email);

COMMENT ON TABLE users IS 'Core user authentication table';

-- user_profiles: Public display information
CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  display_name text NOT NULL,
  bio text,
  avatar_url text,

  -- Public visibility flags
  public_flags jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE user_profiles IS 'Public-facing user profiles';

-- user_roles: Multi-role support
CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN (
    'customer', 'creator', 'organizer', 'partner_admin', 'admin'
  )),

  granted_at timestamptz DEFAULT now(),

  PRIMARY KEY (user_id, role)
);

CREATE INDEX idx_user_roles_role ON user_roles(role);

COMMENT ON TABLE user_roles IS 'Multi-role user permissions';

-- user_settings: Preferences
CREATE TABLE user_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  notification_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  privacy_settings jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- addresses: Shipping/billing addresses
CREATE TABLE addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,

  full_name text NOT NULL,
  postal_code text NOT NULL,
  prefecture text NOT NULL,
  city text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  country_code char(2) NOT NULL DEFAULT 'JP',
  phone text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_addresses_user ON addresses(user_id);
CREATE INDEX idx_addresses_prefecture ON addresses(prefecture);

-- organizer_profiles: Battle organizer metadata
CREATE TABLE organizer_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  organization_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- MANUFACTURING PARTNERS (Factories)
-- ============================================================================

CREATE TABLE manufacturing_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name text NOT NULL,
  contact_email text,
  contact_phone text,
  address jsonb,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_manufacturing_partners_name ON manufacturing_partners(name);

COMMENT ON TABLE manufacturing_partners IS 'Print factories and manufacturing partners';

-- partner_users: Partner access control
CREATE TABLE partner_users (
  partner_id uuid REFERENCES manufacturing_partners(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',

  PRIMARY KEY (partner_id, user_id)
);

-- ============================================================================
-- ASSETS & CONTENT
-- ============================================================================

CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,

  provider asset_provider NOT NULL DEFAULT 'upload',
  source_url text,
  storage_url text,

  -- Deduplication
  content_hash text NOT NULL UNIQUE,

  -- Metadata
  mime_type text,
  width integer,
  height integer,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_assets_owner ON assets(owner_user_id);
CREATE INDEX idx_assets_hash ON assets(content_hash);

COMMENT ON TABLE assets IS 'Media asset storage with deduplication';

-- asset_ingestions: URL-based ingestion tracking
CREATE TABLE asset_ingestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,

  source_url text NOT NULL,
  provider asset_provider NOT NULL,

  policy ingestion_policy NOT NULL DEFAULT 'manual',
  status ingestion_status NOT NULL DEFAULT 'pending',

  content_hash text NOT NULL,

  created_at timestamptz DEFAULT now(),

  UNIQUE (owner_user_id, content_hash)
);

CREATE INDEX idx_asset_ingestions_owner ON asset_ingestions(owner_user_id);
CREATE INDEX idx_asset_ingestions_status ON asset_ingestions(status);

-- categories: Hierarchical categories
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);

-- works: Art works (content master)
CREATE TABLE works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  title text NOT NULL,
  description text,

  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  primary_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_works_creator_active ON works(creator_id, is_active);
CREATE INDEX idx_works_category ON works(category_id) WHERE is_active = true;

COMMENT ON TABLE works IS 'Art work content (separate from products)';

-- work_assets: Work to multiple assets
CREATE TABLE work_assets (
  work_id uuid REFERENCES works(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES assets(id) ON DELETE RESTRICT,

  position integer NOT NULL DEFAULT 1,
  purpose text, -- 'primary', 'gallery', 'preview'

  PRIMARY KEY (work_id, asset_id)
);

CREATE INDEX idx_work_assets_work ON work_assets(work_id, position);

-- tags: Normalized tags
CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

-- work_tags: Work to tag mapping
CREATE TABLE work_tags (
  work_id uuid REFERENCES works(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE RESTRICT,

  PRIMARY KEY (work_id, tag_id)
);

CREATE INDEX idx_work_tags_tag ON work_tags(tag_id);

-- ============================================================================
-- PRODUCTS & VARIANTS
-- ============================================================================

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  work_id uuid REFERENCES works(id) ON DELETE SET NULL,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  title text NOT NULL,
  description text,

  product_type product_type NOT NULL,
  status product_status NOT NULL DEFAULT 'draft',

  -- Platform fee (default 30%)
  platform_fee_rate_bps integer NOT NULL DEFAULT 3000,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_products_creator_status ON products(creator_id, status);
CREATE INDEX idx_products_work ON products(work_id);

COMMENT ON TABLE products IS 'Sellable products (separate from works)';

-- product_variants: SKU-level variants
CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  sku text UNIQUE,
  kind product_type NOT NULL, -- 'digital' = no shipping/inventory

  manufacturing_partner_id uuid REFERENCES manufacturing_partners(id) ON DELETE RESTRICT,

  -- Variant options (size, material, frame, etc.)
  options jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Pricing (JPY, tax-exclusive)
  price_jpy integer NOT NULL CHECK (price_jpy >= 0),

  is_active boolean NOT NULL DEFAULT true,

  -- Inventory (NULL for digital products)
  inventory_qty integer,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_variants_product_active ON product_variants(product_id, is_active);
CREATE INDEX idx_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_variants_partner ON product_variants(manufacturing_partner_id);

COMMENT ON TABLE product_variants IS 'Product variants (SKU level with detailed options)';
COMMENT ON COLUMN product_variants.price_jpy IS 'Tax-exclusive price in JPY';

-- price_history: Price change tracking
CREATE TABLE price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,

  price_jpy integer NOT NULL CHECK (price_jpy >= 0),

  starts_at timestamptz NOT NULL,
  ends_at timestamptz,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_price_history_variant ON price_history(product_variant_id, starts_at DESC);

-- digital_variant_assets: Digital product files
CREATE TABLE digital_variant_assets (
  product_variant_id uuid PRIMARY KEY REFERENCES product_variants(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,

  license_terms jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE digital_variant_assets IS 'Digital download file mapping';

-- ============================================================================
-- FAVORITES
-- ============================================================================

CREATE TABLE favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,

  created_at timestamptz DEFAULT now(),

  PRIMARY KEY (user_id, work_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id, created_at DESC);
CREATE INDEX idx_favorites_work ON favorites(work_id, created_at DESC);

-- ============================================================================
-- SHOPPING CART
-- ============================================================================

CREATE TABLE carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_carts_user ON carts(user_id);

CREATE TABLE cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,

  quantity integer NOT NULL CHECK (quantity > 0),

  UNIQUE (cart_id, product_variant_id)
);

CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);

-- ============================================================================
-- SHIPPING (Japan Prefecture-based Zones)
-- ============================================================================

CREATE TABLE shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,

  created_at timestamptz DEFAULT now()
);

-- Japan prefectures (47 prefectures)
CREATE TABLE jp_prefectures (
  code text PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE shipping_zone_members (
  zone_id uuid NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  prefecture_code text NOT NULL REFERENCES jp_prefectures(code) ON DELETE RESTRICT,

  PRIMARY KEY (zone_id, prefecture_code)
);

-- shipping_rates: Factory × Zone rates
CREATE TABLE shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  manufacturing_partner_id uuid NOT NULL REFERENCES manufacturing_partners(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,

  rate_jpy integer NOT NULL CHECK (rate_jpy >= 0),

  UNIQUE (manufacturing_partner_id, zone_id)
);

CREATE INDEX idx_shipping_rates_partner ON shipping_rates(manufacturing_partner_id);

COMMENT ON TABLE shipping_rates IS 'Factory-specific shipping rates by zone';

-- ============================================================================
-- ORDERS, PAYMENTS, SHIPMENTS
-- ============================================================================

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Status tracking
  status order_status NOT NULL DEFAULT 'pending',
  payment_state payment_state NOT NULL DEFAULT 'requires_payment',
  shipment_state shipment_state,

  -- Amounts (all JPY, tax-exclusive base)
  subtotal_excl_tax_jpy integer NOT NULL DEFAULT 0,
  tax_total_jpy integer NOT NULL DEFAULT 0,
  shipping_total_jpy integer NOT NULL DEFAULT 0,
  discount_total_jpy integer NOT NULL DEFAULT 0,
  platform_fee_total_jpy integer NOT NULL DEFAULT 0,
  total_payable_jpy integer NOT NULL DEFAULT 0,

  notes text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status, created_at DESC);
CREATE INDEX idx_orders_payment_state ON orders(payment_state);

COMMENT ON TABLE orders IS 'Order header with tax-exclusive amounts';
COMMENT ON COLUMN orders.subtotal_excl_tax_jpy IS 'Sum of order items (pre-tax)';
COMMENT ON COLUMN orders.tax_total_jpy IS 'Total tax amount (10% default)';
COMMENT ON COLUMN orders.platform_fee_total_jpy IS 'Platform fee (30% of pre-tax)';

-- order_items: Line items with snapshot
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  product_variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  manufacturing_partner_id uuid REFERENCES manufacturing_partners(id) ON DELETE RESTRICT,

  quantity integer NOT NULL CHECK (quantity > 0),

  -- Pricing (tax-exclusive base)
  unit_price_jpy integer NOT NULL CHECK (unit_price_jpy >= 0),

  -- Tax calculation
  tax_rate_bps integer NOT NULL CHECK (tax_rate_bps >= 0), -- 1000 = 10%
  tax_amount_jpy integer NOT NULL CHECK (tax_amount_jpy >= 0),

  -- Subtotals
  subtotal_excl_tax_jpy integer NOT NULL CHECK (subtotal_excl_tax_jpy >= 0),
  subtotal_tax_jpy integer NOT NULL CHECK (subtotal_tax_jpy >= 0),

  -- Platform fee (on pre-tax amount)
  platform_fee_rate_bps integer NOT NULL DEFAULT 3000, -- 30%
  platform_fee_amount_jpy integer NOT NULL DEFAULT 0,
  creator_earnings_jpy integer NOT NULL DEFAULT 0,

  is_digital boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_creator ON order_items(creator_id);
CREATE INDEX idx_order_items_partner ON order_items(manufacturing_partner_id);

COMMENT ON TABLE order_items IS 'Order line items with tax and fee calculations';
COMMENT ON COLUMN order_items.tax_rate_bps IS 'Tax rate in basis points (1000 = 10%)';
COMMENT ON COLUMN order_items.platform_fee_rate_bps IS 'Platform fee rate (3000 = 30%)';

-- order_addresses: Address snapshot
CREATE TABLE order_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  kind text NOT NULL CHECK (kind IN ('shipping', 'billing')),

  full_name text NOT NULL,
  postal_code text NOT NULL,
  prefecture text NOT NULL,
  city text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  country_code char(2) NOT NULL DEFAULT 'JP',
  phone text
);

CREATE INDEX idx_order_addresses_order ON order_addresses(order_id);

-- payments: Stripe-only payment tracking
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  provider text NOT NULL DEFAULT 'stripe' CHECK (provider = 'stripe'),
  stripe_payment_intent_id text UNIQUE,

  amount_jpy integer NOT NULL CHECK (amount_jpy >= 0),
  state payment_state NOT NULL,

  error_code text,
  error_message text,

  authorized_at timestamptz,
  captured_at timestamptz,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_intent ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_state ON payments(state);

COMMENT ON TABLE payments IS 'Stripe payment tracking';

-- refunds: Refund processing
CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,

  amount_jpy integer NOT NULL CHECK (amount_jpy > 0),
  state text NOT NULL CHECK (state IN (
    'requested', 'approved', 'processed', 'failed', 'cancelled'
  )),

  reason text,
  stripe_refund_id text,

  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_state ON refunds(state);

-- shipments: Shipment tracking (factory-specific)
CREATE TABLE shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  manufacturing_partner_id uuid REFERENCES manufacturing_partners(id) ON DELETE SET NULL,

  state shipment_state NOT NULL,

  carrier_name text,
  tracking_number text,

  shipped_at timestamptz,
  delivered_at timestamptz,

  shipping_fee_jpy integer NOT NULL DEFAULT 0,

  created_at timestamptz DEFAULT now(),

  UNIQUE (carrier_name, tracking_number)
);

CREATE INDEX idx_shipments_order ON shipments(order_id);
CREATE INDEX idx_shipments_partner_state ON shipments(manufacturing_partner_id, state);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number) WHERE tracking_number IS NOT NULL;

-- shipment_items: What's in each shipment
CREATE TABLE shipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,

  quantity integer NOT NULL CHECK (quantity > 0),

  UNIQUE (shipment_id, order_item_id)
);

CREATE INDEX idx_shipment_items_shipment ON shipment_items(shipment_id);

-- ============================================================================
-- FULFILLMENT TO PARTNERS
-- ============================================================================

CREATE TABLE partner_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES manufacturing_partners(id) ON DELETE CASCADE,

  name text NOT NULL,
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,

  base_cost_jpy integer NOT NULL CHECK (base_cost_jpy >= 0),
  lead_time_days integer,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_partner_products_partner ON partner_products(partner_id);

-- partner_product_mockups: Preview images
CREATE TABLE partner_product_mockups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_product_id uuid NOT NULL REFERENCES partner_products(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,

  created_at timestamptz DEFAULT now(),

  UNIQUE (partner_product_id, asset_id)
);

-- fulfillments: Manufacturing orders to partners
CREATE TABLE fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES manufacturing_partners(id) ON DELETE RESTRICT,

  state fulfillment_state NOT NULL DEFAULT 'pending',

  external_ref text,
  cost_jpy integer CHECK (cost_jpy >= 0),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_fulfillments_order_item ON fulfillments(order_item_id);
CREATE INDEX idx_fulfillments_partner_state ON fulfillments(partner_id, state);

-- fulfillment_events: State change log
CREATE TABLE fulfillment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id uuid NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,

  state fulfillment_state NOT NULL,
  message text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_fulfillment_events_fulfillment ON fulfillment_events(fulfillment_id, created_at DESC);

-- partner_notifications: Partner alerts
CREATE TABLE partner_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES manufacturing_partners(id) ON DELETE CASCADE,

  type text NOT NULL,
  payload jsonb NOT NULL,

  unread boolean NOT NULL DEFAULT true,
  dedupe_key text,

  created_at timestamptz DEFAULT now(),

  UNIQUE (partner_id, dedupe_key)
);

CREATE INDEX idx_partner_notifications_partner_unread ON partner_notifications(partner_id, unread);

-- ============================================================================
-- LIVE OFFERS
-- ============================================================================

CREATE TABLE live_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,

  stock_qty integer NOT NULL CHECK (stock_qty >= 0),
  reserved_qty integer NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),

  start_at timestamptz,
  end_at timestamptz,

  status offer_status NOT NULL DEFAULT 'scheduled',

  created_at timestamptz DEFAULT now(),

  UNIQUE (product_variant_id, start_at, end_at)
);

CREATE INDEX idx_live_offers_variant ON live_offers(product_variant_id);
CREATE INDEX idx_live_offers_status_time ON live_offers(status, start_at, end_at);

-- live_offer_reservations: Stock reservations
CREATE TABLE live_offer_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES live_offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  quantity integer NOT NULL CHECK (quantity > 0),
  state reservation_state NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_reservations_offer_state ON live_offer_reservations(offer_id, state, expires_at);
CREATE INDEX idx_reservations_user ON live_offer_reservations(user_id);

-- ============================================================================
-- DIGITAL DELIVERY
-- ============================================================================

CREATE TABLE download_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  product_variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,

  state license_state NOT NULL DEFAULT 'active',

  max_downloads integer NOT NULL DEFAULT 3,
  expires_at timestamptz,

  created_at timestamptz DEFAULT now(),

  UNIQUE (order_item_id)
);

CREATE INDEX idx_download_entitlements_order_item ON download_entitlements(order_item_id);
CREATE INDEX idx_download_entitlements_variant ON download_entitlements(product_variant_id);

-- download_tokens: Temporary download tokens
CREATE TABLE download_tokens (
  token text PRIMARY KEY,
  entitlement_id uuid NOT NULL REFERENCES download_entitlements(id) ON DELETE CASCADE,

  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_download_tokens_entitlement ON download_tokens(entitlement_id);
CREATE INDEX idx_download_tokens_expires ON download_tokens(expires_at);

-- ============================================================================
-- BATTLES (Point-based competition)
-- ============================================================================

CREATE TABLE battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  duration_minutes integer NOT NULL CHECK (duration_minutes IN (5, 30, 60)),
  status battle_status NOT NULL DEFAULT 'scheduled',

  winner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  winner_bonus_amount_jpy integer DEFAULT 0 CHECK (winner_bonus_amount_jpy >= 0),

  started_at timestamptz,
  ended_at timestamptz,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_battles_status ON battles(status);
CREATE INDEX idx_battles_started ON battles(started_at) WHERE status = 'live';

-- battle_participants: N participants per battle
CREATE TABLE battle_participants (
  battle_id uuid NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  role participant_role NOT NULL,

  PRIMARY KEY (battle_id, user_id)
);

CREATE INDEX idx_battle_participants_user ON battle_participants(user_id);

-- battle_invitations: Invitation tracking
CREATE TABLE battle_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES battles(id) ON DELETE CASCADE,

  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  status text NOT NULL CHECK (status IN (
    'pending', 'accepted', 'declined', 'cancelled'
  )),

  created_at timestamptz DEFAULT now(),

  UNIQUE (battle_id, to_user_id)
);

CREATE INDEX idx_battle_invitations_battle ON battle_invitations(battle_id);
CREATE INDEX idx_battle_invitations_to_user ON battle_invitations(to_user_id, status);

-- cheer_tickets: Point-based cheering (1 JPY = 1 point default)
CREATE TABLE cheer_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES battles(id) ON DELETE CASCADE,

  supporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  amount_jpy integer NOT NULL CHECK (amount_jpy >= 100),
  points integer NOT NULL CHECK (points >= 0),

  has_signed_goods_right boolean NOT NULL DEFAULT false,
  exclusive_options jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_cheer_tickets_battle_creator ON cheer_tickets(battle_id, creator_id);
CREATE INDEX idx_cheer_tickets_supporter ON cheer_tickets(supporter_id);

COMMENT ON TABLE cheer_tickets IS 'Battle cheering with points (default: 1 JPY = 1 point)';
COMMENT ON COLUMN cheer_tickets.points IS 'Points awarded (conversion rule in app config)';

-- ============================================================================
-- NOTIFICATIONS & LOGS
-- ============================================================================

CREATE TABLE user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  read_at timestamptz,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_user_notifications_user_unread ON user_notifications(user_id, read_at)
  WHERE read_at IS NULL;

-- stripe_webhook_events: Stripe webhook log
CREATE TABLE stripe_webhook_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,

  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL
);

CREATE INDEX idx_stripe_webhook_events_type ON stripe_webhook_events(event_type, received_at DESC);

-- payment_failures: Payment error tracking
CREATE TABLE payment_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  payment_intent_id text,

  reason text,
  payload jsonb,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_payment_failures_payment ON payment_failures(payment_id);
CREATE INDEX idx_payment_failures_intent ON payment_failures(payment_intent_id);

-- audit_logs: System audit trail
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,

  entity_type text NOT NULL,
  entity_id uuid,

  diff jsonb,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id, created_at DESC);

-- rate_limit_logs: API rate limiting
CREATE TABLE rate_limit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  key text NOT NULL,

  occurred_at timestamptz NOT NULL DEFAULT now(),
  status integer NOT NULL,

  UNIQUE (user_id, endpoint, key, occurred_at)
);

CREATE INDEX idx_rate_limit_logs_user_endpoint ON rate_limit_logs(user_id, endpoint, occurred_at DESC);

-- idempotency_keys: Request deduplication
CREATE TABLE idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  key text NOT NULL,
  scope text NOT NULL,
  request_hash text NOT NULL,

  response jsonb,

  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,

  UNIQUE (key, scope)
);

CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys(expires_at)
  WHERE expires_at > now();

-- upload_attempts: Upload tracking
CREATE TABLE upload_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target text,
  outcome text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_upload_attempts_user ON upload_attempts(user_id, created_at DESC);

-- activity_events: User activity tracking
CREATE TABLE activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,

  entity_type text,
  entity_id uuid,

  payload jsonb,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_activity_events_user ON activity_events(user_id, created_at DESC);
CREATE INDEX idx_activity_events_type ON activity_events(event_type, created_at DESC);

-- ============================================================================
-- VIEWS & MATERIALIZED VIEWS
-- ============================================================================

-- battle_points: Aggregate points per creator in battle
CREATE VIEW battle_points AS
SELECT
  battle_id,
  creator_id,
  SUM(points) AS total_points
FROM cheer_tickets
GROUP BY battle_id, creator_id;

COMMENT ON VIEW battle_points IS 'Aggregate battle points (1 JPY = 1 point default)';

-- battle_eligibility_mv: Precomputed eligibility (refresh nightly)
CREATE MATERIALIZED VIEW battle_eligibility_mv AS
SELECT
  u.id AS user_id,
  COALESCE(sales.sales_count, 0) AS last_month_sales_count,
  (
    EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'organizer')
    OR COALESCE(sales.sales_count, 0) >= 10
  ) AS is_eligible
FROM users u
LEFT JOIN (
  SELECT
    oi.creator_id AS user_id,
    SUM(oi.quantity) AS sales_count
  FROM order_items oi
  JOIN payments p ON p.order_id = oi.order_id AND p.state = 'captured'
  WHERE
    p.captured_at >= date_trunc('month', now()) - INTERVAL '1 month'
    AND p.captured_at < date_trunc('month', now())
  GROUP BY oi.creator_id
) sales ON sales.user_id = u.id;

CREATE UNIQUE INDEX idx_battle_eligibility_mv_user ON battle_eligibility_mv(user_id);

COMMENT ON MATERIALIZED VIEW battle_eligibility_mv IS 'Battle eligibility (organizer OR 10+ sales last month)';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_organizer_profiles_updated_at
  BEFORE UPDATE ON organizer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_manufacturing_partners_updated_at
  BEFORE UPDATE ON manufacturing_partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_works_updated_at
  BEFORE UPDATE ON works
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_carts_updated_at
  BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_fulfillments_updated_at
  BEFORE UPDATE ON fulfillments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert Japan prefectures
INSERT INTO jp_prefectures (code, name) VALUES
  ('01', '北海道'), ('02', '青森県'), ('03', '岩手県'), ('04', '宮城県'),
  ('05', '秋田県'), ('06', '山形県'), ('07', '福島県'), ('08', '茨城県'),
  ('09', '栃木県'), ('10', '群馬県'), ('11', '埼玉県'), ('12', '千葉県'),
  ('13', '東京都'), ('14', '神奈川県'), ('15', '新潟県'), ('16', '富山県'),
  ('17', '石川県'), ('18', '福井県'), ('19', '山梨県'), ('20', '長野県'),
  ('21', '岐阜県'), ('22', '静岡県'), ('23', '愛知県'), ('24', '三重県'),
  ('25', '滋賀県'), ('26', '京都府'), ('27', '大阪府'), ('28', '兵庫県'),
  ('29', '奈良県'), ('30', '和歌山県'), ('31', '鳥取県'), ('32', '島根県'),
  ('33', '岡山県'), ('34', '広島県'), ('35', '山口県'), ('36', '徳島県'),
  ('37', '香川県'), ('38', '愛媛県'), ('39', '高知県'), ('40', '福岡県'),
  ('41', '佐賀県'), ('42', '長崎県'), ('43', '熊本県'), ('44', '大分県'),
  ('45', '宮崎県'), ('46', '鹿児島県'), ('47', '沖縄県')
ON CONFLICT (code) DO NOTHING;

-- Insert default shipping zones
INSERT INTO shipping_zones (id, name) VALUES
  (gen_random_uuid(), '関東'),
  (gen_random_uuid(), '関西'),
  (gen_random_uuid(), '北海道・沖縄'),
  (gen_random_uuid(), 'その他')
ON CONFLICT DO NOTHING;

-- Mark migration complete
CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  executed_at timestamptz DEFAULT now()
);

INSERT INTO schema_migrations (version) VALUES ('v6_unified_schema')
ON CONFLICT (version) DO NOTHING;
