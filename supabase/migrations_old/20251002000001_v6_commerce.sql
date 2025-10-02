-- ============================================================================
-- Photo-Rank v6.0 Commerce Domain
-- Migration: 20251002000001_v6_commerce.sql
-- Description: Products, orders, payments, and fulfillment
-- ============================================================================

-- ============================================================================
-- 1. PRODUCT CATALOG
-- ============================================================================

-- products: Abstract sellable products
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE RESTRICT,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Product information
  product_type text NOT NULL CHECK (product_type IN (
    'print',          -- Standard photo print
    'framed_print',   -- Framed print
    'canvas',         -- Canvas print
    'poster',         -- Poster
    'digital',        -- Digital download
    'merchandise',    -- Other merchandise
    'subscription'    -- Future: Subscription products
  )),

  -- Pricing (fees are now on variants for more flexibility)
  creator_margin_rate decimal(5,2) DEFAULT 30.00 CHECK (creator_margin_rate >= 0 AND creator_margin_rate <= 100),
  platform_fee_rate decimal(5,2) DEFAULT 10.00 CHECK (platform_fee_rate >= 0 AND platform_fee_rate <= 100),

  -- Status
  status text DEFAULT 'draft' CHECK (
    status IN ('draft', 'published', 'archived', 'out_of_stock')
  ),

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  published_at timestamptz,
  deleted_at timestamptz,

  -- Optimistic locking
  version integer DEFAULT 1 NOT NULL
);

CREATE INDEX idx_products_work ON products(work_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_creator ON products(creator_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_status ON products(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_type ON products(product_type) WHERE status = 'published' AND deleted_at IS NULL;

COMMENT ON TABLE products IS 'Abstract product entities (separates from works)';

-- product_variants: SKU-level variants (size, material, etc.)
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Variant identification
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,

  -- Pricing
  price integer NOT NULL CHECK (price >= 0),
  currency text DEFAULT 'jpy' NOT NULL,
  cost_price integer DEFAULT 0 CHECK (cost_price >= 0),

  -- Inventory
  stock_type text DEFAULT 'unlimited' CHECK (
    stock_type IN ('unlimited', 'limited', 'made_to_order')
  ),
  stock_quantity integer CHECK (stock_quantity >= 0),
  stock_reserved integer DEFAULT 0 CHECK (stock_reserved >= 0),
  stock_sold integer DEFAULT 0 CHECK (stock_sold >= 0),

  -- Physical attributes
  weight_g integer CHECK (weight_g > 0),
  dimensions jsonb, -- {width, height, depth} in cm

  -- Variant attributes
  attributes jsonb DEFAULT '{}'::jsonb, -- {size: "A4", material: "matte", color: "white"}

  -- Shipping
  requires_shipping boolean DEFAULT true,

  -- Status
  is_active boolean DEFAULT true,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,

  UNIQUE(product_id, sku)
);

CREATE INDEX idx_product_variants_product ON product_variants(product_id) WHERE is_active = true;
CREATE INDEX idx_product_variants_sku ON product_variants(sku) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_variants_active ON product_variants(is_active) WHERE deleted_at IS NULL;

COMMENT ON TABLE product_variants IS 'Product SKU variants (size, material, color variations)';

-- price_history: Optional price change tracking
CREATE TABLE IF NOT EXISTS price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,

  -- Price change
  old_price integer NOT NULL,
  new_price integer NOT NULL,
  currency text DEFAULT 'jpy' NOT NULL,

  -- Reason
  change_reason text,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Timestamps
  effective_from timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_price_history_variant ON price_history(product_variant_id, effective_from DESC);

COMMENT ON TABLE price_history IS 'Price change history for compliance and analysis';

-- ============================================================================
-- 2. SHOPPING CART
-- ============================================================================

-- carts: Shopping cart (supports multiple carts per user for different devices)
CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,

  -- Cart identification
  session_id text, -- For guest users
  device_id text,

  -- Status
  status text DEFAULT 'active' CHECK (
    status IN ('active', 'abandoned', 'converted', 'merged')
  ),

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  abandoned_at timestamptz,
  converted_at timestamptz,

  CONSTRAINT cart_owner CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE INDEX idx_carts_user ON carts(user_id, status) WHERE status = 'active';
CREATE INDEX idx_carts_session ON carts(session_id) WHERE status = 'active';

COMMENT ON TABLE carts IS 'Shopping carts (supports guest and multi-device)';

-- cart_items: Cart line items
CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,

  -- Quantity
  quantity integer DEFAULT 1 CHECK (quantity > 0),

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE(cart_id, product_variant_id)
);

CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_cart_items_variant ON cart_items(product_variant_id);

COMMENT ON TABLE cart_items IS 'Cart line items';

-- ============================================================================
-- 3. ORDERS
-- ============================================================================

-- orders: Order header
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Order type
  order_type text DEFAULT 'regular' CHECK (order_type IN (
    'regular',        -- Regular purchase
    'special_offer',  -- Live offer or special sale
    'battle_reward',  -- Battle winner reward
    'subscription'    -- Future: Subscription
  )),

  -- Amounts
  subtotal integer NOT NULL CHECK (subtotal >= 0),
  tax_amount integer DEFAULT 0 CHECK (tax_amount >= 0),
  shipping_fee integer DEFAULT 0 CHECK (shipping_fee >= 0),
  discount_amount integer DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount integer NOT NULL CHECK (total_amount >= 0),
  currency text DEFAULT 'jpy' NOT NULL,

  -- Shipping
  requires_shipping boolean DEFAULT true,
  shipping_method text,

  -- Status tracking
  status text DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Created but not confirmed
    'confirmed',    -- Payment confirmed
    'processing',   -- Being prepared
    'shipped',      -- Shipped to customer
    'delivered',    -- Delivered
    'cancelled',    -- Cancelled
    'refunded'      -- Refunded
  )),

  payment_status text DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded'
  )),

  fulfillment_status text DEFAULT 'unfulfilled' CHECK (fulfillment_status IN (
    'unfulfilled', 'partial', 'fulfilled', 'restocked'
  )),

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  notes text,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  deleted_at timestamptz,

  -- Optimistic locking
  version integer DEFAULT 1 NOT NULL
);

CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_status ON orders(status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_payment_status ON orders(payment_status) WHERE deleted_at IS NULL;

COMMENT ON TABLE orders IS 'Order header (consolidates purchases)';

-- order_items: Order line items with snapshot
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Product references (nullable for deleted products)
  product_variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  work_id uuid REFERENCES works(id) ON DELETE SET NULL,

  -- Snapshot (preserve data even if product deleted)
  item_snapshot jsonb NOT NULL,
  -- Example snapshot:
  -- {
  --   "sku": "PRINT-A4-MATTE-001",
  --   "title": "Beautiful Sunset",
  --   "product_type": "print",
  --   "variant_name": "A4 Matte",
  --   "attributes": {"size": "A4", "material": "matte"}
  -- }

  -- Pricing
  unit_price integer NOT NULL CHECK (unit_price >= 0),
  quantity integer DEFAULT 1 CHECK (quantity > 0),
  subtotal integer NOT NULL CHECK (subtotal >= 0),

  -- Fulfillment
  fulfillment_status text DEFAULT 'unfulfilled' CHECK (fulfillment_status IN (
    'unfulfilled', 'fulfilled', 'restocked'
  )),

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_variant ON order_items(product_variant_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

COMMENT ON TABLE order_items IS 'Order line items with product snapshot';

-- order_addresses: Address snapshot at order time
CREATE TABLE IF NOT EXISTS order_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Address type
  address_type text NOT NULL CHECK (address_type IN ('shipping', 'billing')),

  -- Address data (snapshot)
  recipient_name text NOT NULL,
  postal_code text NOT NULL,
  prefecture text NOT NULL,
  city text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  phone text NOT NULL,

  -- Reference to original (if available)
  address_id uuid REFERENCES addresses(id) ON DELETE SET NULL,

  created_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE(order_id, address_type)
);

CREATE INDEX idx_order_addresses_order ON order_addresses(order_id);

COMMENT ON TABLE order_addresses IS 'Address snapshots at order time';

-- order_status_history: Status change tracking
CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Status change
  from_status text,
  to_status text NOT NULL,

  -- Context
  notes text,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,

  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_order_status_history_order ON order_status_history(order_id, created_at DESC);

COMMENT ON TABLE order_status_history IS 'Order status change audit trail';

-- ============================================================================
-- 4. PAYMENTS
-- ============================================================================

-- payments: Payment transactions
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,

  -- Payment method
  payment_method text NOT NULL CHECK (payment_method IN (
    'stripe', 'credit_card', 'bank_transfer', 'wallet', 'cash_on_delivery'
  )),

  -- Amount
  amount integer NOT NULL CHECK (amount >= 0),
  currency text DEFAULT 'jpy' NOT NULL,

  -- Stripe integration
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  stripe_customer_id text,

  -- Status
  status text DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded'
  )),

  -- Failure handling
  failure_reason text,
  failure_code text,
  last_payment_error jsonb,

  -- Idempotency
  idempotency_key text UNIQUE,

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  succeeded_at timestamptz,
  failed_at timestamptz,

  -- Optimistic locking
  version integer DEFAULT 1 NOT NULL
);

CREATE INDEX idx_payments_user ON payments(user_id, created_at DESC);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status, created_at DESC);
CREATE INDEX idx_payments_stripe_pi ON payments(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX idx_payments_idempotency ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;

COMMENT ON TABLE payments IS 'Payment transactions (consolidates payment tracking)';

-- payment_methods: Saved payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Method type
  method_type text NOT NULL CHECK (method_type IN (
    'credit_card', 'debit_card', 'bank_account', 'wallet'
  )),

  -- Stripe integration
  stripe_payment_method_id text UNIQUE,

  -- Card information (masked/encrypted)
  card_brand text,
  card_last4 text,
  card_exp_month integer CHECK (card_exp_month BETWEEN 1 AND 12),
  card_exp_year integer CHECK (card_exp_year >= 2024),

  -- Flags
  is_default boolean DEFAULT false,
  is_verified boolean DEFAULT false,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE INDEX idx_payment_methods_user ON payment_methods(user_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_payment_methods_one_default
  ON payment_methods(user_id)
  WHERE is_default = true AND deleted_at IS NULL;

COMMENT ON TABLE payment_methods IS 'Saved payment methods';

-- refunds: Refund transactions
CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,

  -- Refund details
  amount integer NOT NULL CHECK (amount > 0),
  currency text DEFAULT 'jpy' NOT NULL,
  reason text NOT NULL,

  -- Stripe integration
  stripe_refund_id text UNIQUE,

  -- Status
  status text DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'succeeded', 'failed', 'cancelled'
  )),

  -- Approval workflow
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  admin_notes text,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  approved_at timestamptz,
  processed_at timestamptz
);

CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_order ON refunds(order_id);
CREATE INDEX idx_refunds_status ON refunds(status);

COMMENT ON TABLE refunds IS 'Refund transactions (consolidates refund_requests)';

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_products_updated_at ON products;
CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_product_variants_updated_at ON product_variants;
CREATE TRIGGER trigger_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_carts_updated_at ON carts;
CREATE TRIGGER trigger_carts_updated_at
  BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_cart_items_updated_at ON cart_items;
CREATE TRIGGER trigger_cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_order_items_updated_at ON order_items;
CREATE TRIGGER trigger_order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_payments_updated_at ON payments;
CREATE TRIGGER trigger_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER trigger_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_refunds_updated_at ON refunds;
CREATE TRIGGER trigger_refunds_updated_at
  BEFORE UPDATE ON refunds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Products: Published public, creator can manage
DROP POLICY IF EXISTS products_select ON products;
CREATE POLICY products_select ON products
  FOR SELECT USING (
    (status = 'published' AND deleted_at IS NULL) OR
    creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS products_creator_manage ON products;
CREATE POLICY products_creator_manage ON products
  FOR ALL USING (creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Product Variants: Inherit from products
DROP POLICY IF EXISTS product_variants_select ON product_variants;
CREATE POLICY product_variants_select ON product_variants
  FOR SELECT USING (
    (is_active = true AND deleted_at IS NULL AND product_id IN (
      SELECT id FROM products WHERE status = 'published'
    )) OR
    product_id IN (
      SELECT id FROM products WHERE creator_id IN (
        SELECT id FROM users WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Carts: Own carts only
DROP POLICY IF EXISTS carts_own ON carts;
CREATE POLICY carts_own ON carts
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Cart Items: Own cart items
DROP POLICY IF EXISTS cart_items_own ON cart_items;
CREATE POLICY cart_items_own ON cart_items
  FOR ALL USING (cart_id IN (
    SELECT id FROM carts WHERE user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  ))
  WITH CHECK (cart_id IN (
    SELECT id FROM carts WHERE user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  ));

-- Orders: Own orders
DROP POLICY IF EXISTS orders_own ON orders;
CREATE POLICY orders_own ON orders
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Order Items: Via orders
DROP POLICY IF EXISTS order_items_own ON order_items;
CREATE POLICY order_items_own ON order_items
  FOR SELECT USING (order_id IN (
    SELECT id FROM orders WHERE user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  ));

-- Payments: Own payments
DROP POLICY IF EXISTS payments_own ON payments;
CREATE POLICY payments_own ON payments
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Payment Methods: Own methods
DROP POLICY IF EXISTS payment_methods_own ON payment_methods;
CREATE POLICY payment_methods_own ON payment_methods
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Mark migration complete
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v6_commerce', 'commerce')
ON CONFLICT (version) DO NOTHING;
