-- ============================================================================
-- Photo-Rank v6.0 Battles & Manufacturing Domains
-- Migration: 20251002000002_v6_battles_manufacturing.sql
-- Description: Battle system and manufacturing fulfillment
-- ============================================================================

-- ============================================================================
-- 1. BATTLE DOMAIN
-- ============================================================================

-- battles: Battle sessions
CREATE TABLE IF NOT EXISTS battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Duration
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (5, 30, 60)),

  -- Battle type
  battle_type text DEFAULT 'standard' CHECK (battle_type IN (
    'standard', 'tournament', 'exhibition', 'championship'
  )),

  -- Scheduling
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,

  -- Status
  status text DEFAULT 'pending_invitation' CHECK (status IN (
    'pending_invitation',  -- Waiting for opponent
    'invitation_sent',     -- Invitation sent
    'accepted',            -- Opponent accepted
    'declined',            -- Opponent declined
    'scheduled',           -- Scheduled to start
    'live',                -- Currently live
    'overtime',            -- Extended time
    'finished',            -- Completed
    'cancelled'            -- Cancelled
  )),

  -- Results
  winner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  winner_bonus_amount integer CHECK (winner_bonus_amount >= 0),
  final_scores jsonb, -- {challenger: {sales: 10, cheers: 5000}, opponent: {...}}

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  rules jsonb DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE INDEX idx_battles_status ON battles(status, scheduled_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_battles_live ON battles(status, started_at) WHERE status = 'live';
CREATE INDEX idx_battles_winner ON battles(winner_id) WHERE winner_id IS NOT NULL;

COMMENT ON TABLE battles IS 'Battle sessions (consolidated from battles + battle_invitations)';

-- battle_participants: Battle participants (supports N participants)
CREATE TABLE IF NOT EXISTS battle_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Role
  role text NOT NULL CHECK (role IN ('challenger', 'opponent', 'participant')),

  -- Invitation
  invitation_status text DEFAULT 'pending' CHECK (invitation_status IN (
    'pending', 'accepted', 'declined', 'expired'
  )),
  invited_at timestamptz,
  responded_at timestamptz,

  -- Performance
  sales_count integer DEFAULT 0 CHECK (sales_count >= 0),
  cheer_amount integer DEFAULT 0 CHECK (cheer_amount >= 0),
  final_score integer DEFAULT 0 CHECK (final_score >= 0),

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE(battle_id, user_id)
);

CREATE INDEX idx_battle_participants_battle ON battle_participants(battle_id);
CREATE INDEX idx_battle_participants_user ON battle_participants(user_id);
CREATE INDEX idx_battle_participants_role ON battle_participants(battle_id, role);

COMMENT ON TABLE battle_participants IS 'Battle participants with invitation tracking';

-- battle_eligibility: Computed eligibility (materialized view approach)
CREATE MATERIALIZED VIEW IF NOT EXISTS battle_eligibility AS
SELECT
  u.id AS user_id,
  -- Is organizer member
  EXISTS(
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = u.id
      AND ur.role = 'organizer'
      AND ur.is_active = true
  ) AS is_organizer_member,

  -- Last 30 days sales
  COALESCE((
    SELECT COUNT(*)
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE p.creator_id = u.id
      AND o.status IN ('confirmed', 'processing', 'shipped', 'delivered')
      AND o.created_at >= now() - interval '30 days'
  ), 0) AS last_30d_sales_count,

  -- Total sales
  COALESCE((
    SELECT COUNT(*)
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE p.creator_id = u.id
      AND o.status IN ('confirmed', 'processing', 'shipped', 'delivered')
  ), 0) AS total_sales_count,

  now() AS updated_at
FROM users u
WHERE u.deleted_at IS NULL;

CREATE UNIQUE INDEX idx_battle_eligibility_user ON battle_eligibility(user_id);

COMMENT ON MATERIALIZED VIEW battle_eligibility IS 'Battle eligibility computed from sales (refresh nightly)';

-- cheer_transactions: Unified cheer transactions (paid and free)
CREATE TABLE IF NOT EXISTS cheer_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  supporter_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Transaction type
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'paid_cheer',      -- Paid cheer ticket
    'free_cheer',      -- Free cheer (from counter)
    'reward_payout'    -- Winner bonus payout
  )),

  -- Amount
  amount integer NOT NULL CHECK (amount >= 0),
  currency text DEFAULT 'jpy' NOT NULL,

  -- Payment reference
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,

  -- Perks/Rights
  has_signed_goods_right boolean DEFAULT false,
  has_exclusive_content boolean DEFAULT false,
  perks_details jsonb DEFAULT '{}'::jsonb,

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_cheer_transactions_battle ON cheer_transactions(battle_id, created_at);
CREATE INDEX idx_cheer_transactions_supporter ON cheer_transactions(supporter_id);
CREATE INDEX idx_cheer_transactions_creator ON cheer_transactions(creator_id);
CREATE INDEX idx_cheer_transactions_type ON cheer_transactions(transaction_type, created_at DESC);

COMMENT ON TABLE cheer_transactions IS 'Unified cheer transactions (consolidates cheer_tickets + cheer_free_counters)';

-- ============================================================================
-- 2. LIVE OFFERS (Special Sales)
-- ============================================================================

-- live_offers: Time-limited special offers
CREATE TABLE IF NOT EXISTS live_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,

  -- Offer configuration
  offer_type text DEFAULT 'live_event' CHECK (offer_type IN (
    'live_event',      -- During live battle
    'time_limited',    -- Flash sale
    'first_come',      -- Limited quantity
    'battle_reward'    -- Battle winner exclusive
  )),

  -- Timing
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,

  -- Pricing
  special_price integer CHECK (special_price >= 0),
  discount_rate decimal(5,2) CHECK (discount_rate >= 0 AND discount_rate <= 100),

  -- Stock management
  stock_total integer NOT NULL CHECK (stock_total > 0),
  stock_reserved integer DEFAULT 0 CHECK (stock_reserved >= 0),
  stock_sold integer DEFAULT 0 CHECK (stock_sold >= 0),
  per_user_limit integer DEFAULT 1 CHECK (per_user_limit > 0),

  -- Perks
  perks_type text DEFAULT 'none' CHECK (perks_type IN (
    'none', 'signed', 'limited_design', 'bonus_content', 'early_access'
  )),
  perks jsonb DEFAULT '{}'::jsonb,

  -- Event association
  battle_id uuid REFERENCES battles(id) ON DELETE SET NULL,

  -- Status
  status text DEFAULT 'draft' CHECK (status IN (
    'draft', 'scheduled', 'active', 'ended', 'cancelled'
  )),

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,

  CONSTRAINT valid_stock CHECK (stock_reserved + stock_sold <= stock_total),
  CONSTRAINT valid_period CHECK (end_at > start_at)
);

CREATE INDEX idx_live_offers_variant ON live_offers(product_variant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_live_offers_active ON live_offers(status, start_at, end_at)
  WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_live_offers_battle ON live_offers(battle_id) WHERE battle_id IS NOT NULL;

COMMENT ON TABLE live_offers IS 'Special time-limited offers (generalized from live_offers)';

-- live_offer_reservations: Stock reservation
CREATE TABLE IF NOT EXISTS live_offer_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_offer_id uuid NOT NULL REFERENCES live_offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  quantity integer DEFAULT 1 CHECK (quantity > 0),
  expires_at timestamptz NOT NULL,

  -- Status
  status text DEFAULT 'active' CHECK (status IN (
    'active', 'expired', 'converted', 'released'
  )),

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE(live_offer_id, user_id, status)
);

CREATE INDEX idx_live_offer_reservations_offer ON live_offer_reservations(live_offer_id);
CREATE INDEX idx_live_offer_reservations_user ON live_offer_reservations(user_id);
CREATE INDEX idx_live_offer_reservations_expiry ON live_offer_reservations(expires_at)
  WHERE status = 'active' AND expires_at > now();

COMMENT ON TABLE live_offer_reservations IS 'Live offer stock reservations';

-- ============================================================================
-- 3. MANUFACTURING DOMAIN
-- ============================================================================

-- manufacturing_partners: Production facilities
CREATE TABLE IF NOT EXISTS manufacturing_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic information
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  partner_type text NOT NULL CHECK (partner_type IN (
    'internal',      -- Internal production
    'external_api',  -- External API integration
    'manual'         -- Manual coordination
  )),

  -- Contact
  contact_email text,
  contact_phone text,
  contact_address text,

  -- API Integration
  api_endpoint text,
  api_credentials_encrypted text,
  api_version text,

  -- Capabilities
  capabilities jsonb DEFAULT '{}'::jsonb,
  supported_product_types text[],

  -- Location
  location jsonb, -- {country, prefecture, city, address}

  -- Status
  is_active boolean DEFAULT true,
  is_verified boolean DEFAULT false,

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE INDEX idx_manufacturing_partners_code ON manufacturing_partners(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_manufacturing_partners_active ON manufacturing_partners(is_active) WHERE deleted_at IS NULL;

COMMENT ON TABLE manufacturing_partners IS 'Manufacturing facilities (consolidates manufacturing_partners + factory_profiles)';

-- partner_products: Partner production capabilities
CREATE TABLE IF NOT EXISTS partner_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES manufacturing_partners(id) ON DELETE CASCADE,

  -- Product specification
  product_type text NOT NULL,
  name text NOT NULL,
  description text,

  -- Physical specs
  dimensions jsonb, -- {width, height, depth} mm
  weight_g integer CHECK (weight_g > 0),
  material text,
  finish text,

  -- Pricing
  unit_cost integer NOT NULL CHECK (unit_cost >= 0),
  setup_cost integer DEFAULT 0 CHECK (setup_cost >= 0),
  currency text DEFAULT 'jpy' NOT NULL,

  -- Production
  min_order_quantity integer DEFAULT 1 CHECK (min_order_quantity > 0),
  production_time_days integer CHECK (production_time_days > 0),

  -- Quality
  quality_standards jsonb,

  -- Status
  is_available boolean DEFAULT true,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,

  UNIQUE(partner_id, product_type, name)
);

CREATE INDEX idx_partner_products_partner ON partner_products(partner_id) WHERE is_available = true;
CREATE INDEX idx_partner_products_type ON partner_products(product_type) WHERE is_available = true;

COMMENT ON TABLE partner_products IS 'Partner production specifications (consolidates factory_products)';

-- partner_product_mockups: Product mockups
CREATE TABLE IF NOT EXISTS partner_product_mockups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_product_id uuid NOT NULL REFERENCES partner_products(id) ON DELETE CASCADE,
  product_variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,

  -- Mockup assets
  mockup_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  preview_url text,

  -- Template information
  template_type text,
  template_config jsonb,

  is_active boolean DEFAULT true,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_partner_product_mockups_partner_product ON partner_product_mockups(partner_product_id);
CREATE INDEX idx_partner_product_mockups_variant ON partner_product_mockups(product_variant_id);

COMMENT ON TABLE partner_product_mockups IS 'Product mockup images (consolidates factory_product_mockups)';

-- fulfillments: Manufacturing orders
CREATE TABLE IF NOT EXISTS fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  partner_id uuid NOT NULL REFERENCES manufacturing_partners(id) ON DELETE RESTRICT,
  partner_product_id uuid REFERENCES partner_products(id) ON DELETE SET NULL,

  -- Fulfillment details
  quantity integer NOT NULL CHECK (quantity > 0),
  cost integer NOT NULL CHECK (cost >= 0),

  -- External reference
  external_order_id text,
  external_tracking_url text,

  -- Status
  status text DEFAULT 'pending' CHECK (status IN (
    'pending',       -- Created, not yet submitted
    'submitted',     -- Submitted to partner
    'accepted',      -- Partner accepted
    'in_production', -- Being produced
    'quality_check', -- Quality inspection
    'completed',     -- Production complete
    'shipped',       -- Shipped from factory
    'delivered',     -- Delivered to customer
    'cancelled',     -- Cancelled
    'failed'         -- Production failed
  )),

  -- Dates
  submitted_at timestamptz,
  accepted_at timestamptz,
  estimated_completion_date date,
  actual_completion_date date,
  shipped_at timestamptz,
  delivered_at timestamptz,

  -- Quality
  quality_check_passed boolean,
  quality_notes text,

  -- Tracking
  tracking_number text,
  carrier text,

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  failure_reason text,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE INDEX idx_fulfillments_order_item ON fulfillments(order_item_id);
CREATE INDEX idx_fulfillments_partner ON fulfillments(partner_id, status);
CREATE INDEX idx_fulfillments_status ON fulfillments(status, created_at DESC);
CREATE INDEX idx_fulfillments_tracking ON fulfillments(tracking_number) WHERE tracking_number IS NOT NULL;

COMMENT ON TABLE fulfillments IS 'Manufacturing fulfillment orders (consolidates manufacturing_orders)';

-- fulfillment_events: Fulfillment progress log
CREATE TABLE IF NOT EXISTS fulfillment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id uuid NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,

  -- Event details
  event_type text NOT NULL,
  from_status text,
  to_status text,

  -- Message
  message text,
  details jsonb DEFAULT '{}'::jsonb,

  -- Actor
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,

  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_fulfillment_events_fulfillment ON fulfillment_events(fulfillment_id, created_at DESC);

COMMENT ON TABLE fulfillment_events IS 'Fulfillment status change log';

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_battles_updated_at ON battles;
CREATE TRIGGER trigger_battles_updated_at
  BEFORE UPDATE ON battles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_battle_participants_updated_at ON battle_participants;
CREATE TRIGGER trigger_battle_participants_updated_at
  BEFORE UPDATE ON battle_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_live_offers_updated_at ON live_offers;
CREATE TRIGGER trigger_live_offers_updated_at
  BEFORE UPDATE ON live_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_live_offer_reservations_updated_at ON live_offer_reservations;
CREATE TRIGGER trigger_live_offer_reservations_updated_at
  BEFORE UPDATE ON live_offer_reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_manufacturing_partners_updated_at ON manufacturing_partners;
CREATE TRIGGER trigger_manufacturing_partners_updated_at
  BEFORE UPDATE ON manufacturing_partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_partner_products_updated_at ON partner_products;
CREATE TRIGGER trigger_partner_products_updated_at
  BEFORE UPDATE ON partner_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_partner_product_mockups_updated_at ON partner_product_mockups;
CREATE TRIGGER trigger_partner_product_mockups_updated_at
  BEFORE UPDATE ON partner_product_mockups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_fulfillments_updated_at ON fulfillments;
CREATE TRIGGER trigger_fulfillments_updated_at
  BEFORE UPDATE ON fulfillments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheer_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_offer_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturing_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillments ENABLE ROW LEVEL SECURITY;

-- Battles: Participants can view
DROP POLICY IF EXISTS battles_participants_select ON battles;
CREATE POLICY battles_participants_select ON battles
  FOR SELECT USING (
    id IN (
      SELECT battle_id FROM battle_participants
      WHERE user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    ) OR
    status IN ('live', 'finished')
  );

-- Battle Participants: Own participation
DROP POLICY IF EXISTS battle_participants_own ON battle_participants;
CREATE POLICY battle_participants_own ON battle_participants
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Cheer Transactions: Supporter or creator
DROP POLICY IF EXISTS cheer_transactions_select ON cheer_transactions;
CREATE POLICY cheer_transactions_select ON cheer_transactions
  FOR SELECT USING (
    supporter_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()) OR
    creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Live Offers: Active public, creator can manage
DROP POLICY IF EXISTS live_offers_select ON live_offers;
CREATE POLICY live_offers_select ON live_offers
  FOR SELECT USING (
    (status = 'active' AND now() BETWEEN start_at AND end_at) OR
    product_variant_id IN (
      SELECT id FROM product_variants WHERE product_id IN (
        SELECT id FROM products WHERE creator_id IN (
          SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
      )
    )
  );

-- Manufacturing Partners: Admin only (service_role bypass)
DROP POLICY IF EXISTS manufacturing_partners_admin ON manufacturing_partners;
CREATE POLICY manufacturing_partners_admin ON manufacturing_partners
  FOR SELECT USING (true); -- Public read for display

-- Mark migration complete
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v6_battles_manufacturing', 'battles_mfg')
ON CONFLICT (version) DO NOTHING;

-- Set foreign key for preferred_factory_id
ALTER TABLE users
  ADD CONSTRAINT fk_users_preferred_factory
  FOREIGN KEY (preferred_factory_id) REFERENCES manufacturing_partners(id) ON DELETE SET NULL;
