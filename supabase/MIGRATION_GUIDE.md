# Photo-Rank v6.0 Database Migration Guide

**Version**: 6.0
**Date**: 2025-10-02
**Status**: Production Ready

---

## 📋 Overview

Complete database redesign with focus on:
- ✅ **JPY-only pricing** (tax-exclusive, 10% consumption tax)
- ✅ **Platform fee 30%** (on pre-tax amount)
- ✅ **Factory-specific shipping** by prefecture zone
- ✅ **Digital product support** (download entitlements)
- ✅ **Fine-grained variants** (size, material, frame, etc.)
- ✅ **Battle points system** (1 JPY = 1 point default)
- ✅ **Stripe payment only**
- ✅ **Normalized schema** (eliminates 40+ redundant tables)

---

## 🗂️ Migration Files

### Core Schema
**`20251002100000_v6_unified_schema.sql`**
- All core tables with proper normalization
- Enums for type safety
- Indexes for performance
- Triggers for automation
- Views and materialized views

### Configuration & Helpers
**`20251002100001_v6_config_and_helpers.sql`**
- System configuration table
- Tax/fee calculation functions
- Battle point conversion
- Shipping calculation
- Order total calculation
- Inventory management
- RLS policies

---

## 💰 Pricing & Fee Structure

### Tax Calculation (External Tax, 10%)
```sql
-- Configuration
tax_rate_bps = 1000  -- 10% (basis points)

-- Calculation per line item
unit_price_jpy = 1000           -- Pre-tax price
tax_amount_jpy = 100            -- 1000 × 0.10 = 100
subtotal_excl_tax_jpy = 1000    -- quantity × unit_price_jpy
subtotal_tax_jpy = 100          -- calculated tax

-- Order totals
orders.subtotal_excl_tax_jpy = SUM(order_items.subtotal_excl_tax_jpy)
orders.tax_total_jpy = SUM(order_items.subtotal_tax_jpy)
orders.total_payable_jpy = subtotal_excl_tax + tax_total + shipping_total
```

### Platform Fee (30% on pre-tax)
```sql
-- Configuration
platform_fee_rate_bps = 3000  -- 30%

-- Calculation
subtotal_excl_tax_jpy = 1000
platform_fee_amount_jpy = 300      -- 1000 × 0.30 = 300
creator_earnings_jpy = 700         -- 1000 - 300 = 700
```

### Shipping Fees (Factory × Prefecture Zone)
```sql
-- Factory A shipping to Tokyo (Zone: 関東)
SELECT get_shipping_fee(
  'factory-a-uuid',  -- manufacturing_partner_id
  '東京都'            -- prefecture
);
-- Returns: 500 JPY

-- Multiple factories = multiple shipments
shipments.shipping_fee_jpy = rate from shipping_rates
orders.shipping_total_jpy = SUM(shipments.shipping_fee_jpy)
```

---

## 🎮 Battle Points System

### Point Conversion (Default: 1 JPY = 1 Point)
```sql
-- Configuration
battle_point_conversion = {
  "jpy_per_point": 1,
  "min_cheer_jpy": 100
}

-- Cheer ticket creation
INSERT INTO cheer_tickets (
  battle_id, supporter_id, creator_id,
  amount_jpy,  -- 500 JPY
  points       -- 500 points (1:1 conversion)
) VALUES (...);

-- Winner determination
SELECT creator_id, SUM(points) AS total_points
FROM cheer_tickets
WHERE battle_id = $1
GROUP BY creator_id
ORDER BY total_points DESC
LIMIT 1;
```

### Battle Eligibility
```sql
-- Criteria (OR condition)
is_eligible = (
  is_organizer_member OR
  last_30d_sales_count >= 10
)

-- Materialized view (refresh nightly)
REFRESH MATERIALIZED VIEW CONCURRENTLY battle_eligibility_mv;
```

---

## 📦 Product Variants & Digital Products

### Physical Products
```sql
INSERT INTO product_variants (
  product_id, sku, kind,
  manufacturing_partner_id,
  options,  -- {"size": "A4", "material": "matte", "frame": "black"}
  price_jpy,
  inventory_qty
) VALUES (...);
```

### Digital Products (No Shipping/Inventory)
```sql
-- Create digital variant
INSERT INTO product_variants (
  product_id, sku,
  kind = 'digital',  -- No manufacturing_partner_id needed
  options,
  price_jpy,
  inventory_qty = NULL  -- Unlimited
) VALUES (...);

-- Link digital file
INSERT INTO digital_variant_assets (
  product_variant_id, asset_id, license_terms
) VALUES (...);

-- After purchase: Grant download entitlement
INSERT INTO download_entitlements (
  order_item_id, product_variant_id,
  max_downloads = 3,
  expires_at = NOW() + INTERVAL '30 days'
) VALUES (...);

-- Generate temporary download token
INSERT INTO download_tokens (
  token, entitlement_id,
  expires_at = NOW() + INTERVAL '1 hour'
) VALUES (...);
```

---

## 🚚 Shipping Zones (Japan Prefectures)

### Zone Configuration
```sql
-- Create zones
INSERT INTO shipping_zones (id, name) VALUES
  (uuid1, '関東'),
  (uuid2, '関西'),
  (uuid3, '北海道・沖縄');

-- Assign prefectures to zones
INSERT INTO shipping_zone_members (zone_id, prefecture_code) VALUES
  (uuid1, '13'),  -- Tokyo → 関東
  (uuid1, '14'),  -- Kanagawa → 関東
  (uuid2, '27'),  -- Osaka → 関西
  (uuid3, '01');  -- Hokkaido → 北海道・沖縄

-- Set rates per factory × zone
INSERT INTO shipping_rates (
  manufacturing_partner_id, zone_id, rate_jpy
) VALUES
  ('factory-a-uuid', uuid1, 500),   -- Factory A → 関東: 500円
  ('factory-a-uuid', uuid2, 700),   -- Factory A → 関西: 700円
  ('factory-b-uuid', uuid1, 600);   -- Factory B → 関東: 600円
```

---

## 🔐 Security & Access Control

### Row Level Security (RLS)
All tables have RLS enabled with policies:

```sql
-- Users can only see their own data
CREATE POLICY users_own ON orders
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Public content is visible to all
CREATE POLICY works_public ON works
  FOR SELECT USING (is_active = true);

-- Creators can manage their works/products
CREATE POLICY products_creator ON products
  FOR ALL USING (
    creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );
```

### Multi-Role Support
```sql
-- Check user roles
SELECT role FROM user_roles WHERE user_id = $1;

-- Common roles
'customer'       -- Regular buyer
'creator'        -- Content creator
'organizer'      -- Battle organizer
'partner_admin'  -- Factory admin
'admin'          -- Platform admin
```

---

## 🛠️ Helper Functions

### Tax & Fee Calculations
```sql
-- Calculate tax
SELECT calculate_tax(1000, 1000);  -- Returns: 100 (10%)

-- Calculate platform fee
SELECT calculate_platform_fee(1000, 3000);  -- Returns: 300 (30%)

-- Calculate creator earnings
SELECT calculate_creator_earnings(1000, 3000);  -- Returns: 700
```

### Battle Functions
```sql
-- Convert JPY to points
SELECT jpy_to_points(500);  -- Returns: 500 (1:1 default)

-- Determine battle winner
SELECT determine_battle_winner('battle-uuid');
-- Returns: winner_user_id
```

### Inventory & Live Offers
```sql
-- Check inventory availability
SELECT reserve_inventory('variant-uuid', 5);
-- Returns: true/false

-- Reserve live offer stock
SELECT reserve_live_offer('offer-uuid', 'user-uuid', 1);
-- Returns: true/false (with TTL)

-- Release expired reservations (cron job)
SELECT release_expired_reservations();
-- Returns: count of released reservations
```

### Order Calculations
```sql
-- Calculate complete order totals
SELECT * FROM calculate_order_totals('order-uuid');
-- Returns: {
--   subtotal_excl_tax_jpy,
--   tax_total_jpy,
--   shipping_total_jpy,
--   platform_fee_total_jpy,
--   total_payable_jpy
-- }
```

---

## 📊 Key Views & Materialized Views

### battle_points (View)
Aggregate points per creator in battle
```sql
SELECT * FROM battle_points WHERE battle_id = $1;
-- Returns: {battle_id, creator_id, total_points}
```

### battle_eligibility_mv (Materialized View)
Pre-computed eligibility (refresh nightly)
```sql
SELECT * FROM battle_eligibility_mv WHERE user_id = $1;
-- Returns: {user_id, last_month_sales_count, is_eligible}

-- Refresh (run via cron)
REFRESH MATERIALIZED VIEW CONCURRENTLY battle_eligibility_mv;
```

---

## 🔄 Migration Strategy

### Phase 1: Test Environment (Week 1)
1. **Backup existing database**
   ```bash
   pg_dump -h $HOST -U $USER $DB > backup_pre_v6.sql
   ```

2. **Run migrations in test environment**
   ```bash
   psql -h $TEST_HOST -U $USER $TEST_DB < 20251002100000_v6_unified_schema.sql
   psql -h $TEST_HOST -U $USER $TEST_DB < 20251002100001_v6_config_and_helpers.sql
   ```

3. **Verify schema**
   ```sql
   SELECT * FROM schema_migrations;
   -- v6_unified_schema
   -- v6_config_and_helpers
   ```

### Phase 2: Data Migration Script (Week 2)
Create ETL script to migrate existing data:

```sql
-- Example: Migrate users
INSERT INTO users (id, auth_user_id, email, phone, is_verified)
SELECT id, auth_user_id, email, phone, is_verified
FROM old_users
ON CONFLICT (id) DO NOTHING;

-- Migrate user profiles
INSERT INTO user_profiles (user_id, display_name, bio, avatar_url)
SELECT id, display_name, bio, avatar_url
FROM old_users
ON CONFLICT (user_id) DO NOTHING;

-- Migrate products with tax/fee calculation
INSERT INTO order_items (
  order_id, product_variant_id, creator_id,
  quantity, unit_price_jpy,
  tax_rate_bps, tax_amount_jpy,
  subtotal_excl_tax_jpy, subtotal_tax_jpy,
  platform_fee_rate_bps, platform_fee_amount_jpy,
  creator_earnings_jpy
)
SELECT
  old.order_id,
  old.product_id,
  old.creator_id,
  old.quantity,
  old.price AS unit_price_jpy,
  1000 AS tax_rate_bps,
  calculate_tax(old.price, 1000) AS tax_amount_jpy,
  old.price * old.quantity AS subtotal_excl_tax_jpy,
  calculate_tax(old.price * old.quantity, 1000) AS subtotal_tax_jpy,
  3000 AS platform_fee_rate_bps,
  calculate_platform_fee(old.price * old.quantity, 3000) AS platform_fee_amount_jpy,
  calculate_creator_earnings(old.price * old.quantity, 3000) AS creator_earnings_jpy
FROM old_purchases old;
```

### Phase 3: Validation (Week 3)
```sql
-- Verify data integrity
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM order_items;

-- Verify calculations
SELECT
  order_id,
  subtotal_excl_tax_jpy,
  tax_total_jpy,
  total_payable_jpy,
  -- Compare with calculated totals
  (SELECT * FROM calculate_order_totals(order_id))
FROM orders
LIMIT 10;

-- Check foreign key constraints
SELECT * FROM pg_constraint WHERE contype = 'f';
```

### Phase 4: Production Deployment (Week 4)
1. **Schedule maintenance window**
2. **Set application to read-only mode**
3. **Final backup**
4. **Run migrations**
5. **Run data migration**
6. **Verify integrity**
7. **Deploy updated application code**
8. **Enable write mode**
9. **Monitor for 24-48 hours**

---

## 🧹 Maintenance & Cron Jobs

### Daily Cleanup (Recommended: 3 AM JST)
```sql
-- Run cleanup function
SELECT cleanup_expired_data();
-- Returns: {
--   expired_reservations: 42,
--   deleted_idempotency_keys: 1203,
--   deleted_download_tokens: 89,
--   deleted_activity_events: 5621,
--   refreshed_battle_eligibility: true
-- }
```

### Configure pg_cron
```sql
-- Install pg_cron extension
CREATE EXTENSION pg_cron;

-- Schedule daily cleanup at 3 AM JST
SELECT cron.schedule(
  'cleanup-expired-data',
  '0 3 * * *',  -- 3 AM daily
  'SELECT cleanup_expired_data()'
);

-- Schedule live offer reservation cleanup (every 5 minutes)
SELECT cron.schedule(
  'release-expired-reservations',
  '*/5 * * * *',  -- Every 5 minutes
  'SELECT release_expired_reservations()'
);
```

---

## 📈 Performance Optimization

### Index Coverage
All common query patterns are indexed:
- User lookups: `idx_users_email`, `idx_users_auth`
- Product searches: `idx_products_creator_status`, `idx_variants_product_active`
- Order tracking: `idx_orders_user_created`, `idx_payments_intent`
- Battle queries: `idx_cheer_tickets_battle_creator`, `idx_battles_status`

### Query Performance Tips
```sql
-- Use indexes effectively
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC;

-- Avoid N+1 queries with joins
SELECT o.*, array_agg(oi.*) AS items
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE o.user_id = $1
GROUP BY o.id;

-- Use materialized views for expensive queries
SELECT * FROM battle_eligibility_mv WHERE user_id = $1;
-- Much faster than computing eligibility on each request
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue: Tax calculation mismatch**
```sql
-- Check order item calculations
SELECT
  id,
  unit_price_jpy,
  tax_rate_bps,
  tax_amount_jpy,
  calculate_tax(unit_price_jpy, tax_rate_bps) AS expected_tax
FROM order_items
WHERE tax_amount_jpy != calculate_tax(unit_price_jpy, tax_rate_bps);
```

**Issue: Shipping fee not found**
```sql
-- Check zone membership
SELECT * FROM shipping_zone_members szm
JOIN jp_prefectures jp ON jp.code = szm.prefecture_code
WHERE jp.name = '東京都';

-- Check rates
SELECT * FROM shipping_rates
WHERE manufacturing_partner_id = $1;
```

**Issue: Live offer reservation expired**
```sql
-- Manual cleanup
SELECT release_expired_reservations();

-- Check reservation status
SELECT * FROM live_offer_reservations
WHERE user_id = $1 AND state = 'active';
```

---

## 📚 Additional Resources

- **Schema Design**: `/supabase/SCHEMA_REDESIGN.md`
- **Original Files**:
  - Foundation: `20251002000000_v6_schema_foundation.sql`
  - Commerce: `20251002000001_v6_commerce.sql`
  - Battles/Manufacturing: `20251002000002_v6_battles_manufacturing.sql`
  - Supporting: `20251002000003_v6_supporting.sql`

---

## ✅ Migration Checklist

- [ ] Backup production database
- [ ] Test migrations in staging environment
- [ ] Verify all foreign key constraints
- [ ] Test tax/fee calculations
- [ ] Verify shipping zone configuration
- [ ] Test battle point conversion
- [ ] Verify digital product download flow
- [ ] Test RLS policies with different user roles
- [ ] Configure cron jobs for cleanup
- [ ] Monitor query performance
- [ ] Update application code for new schema
- [ ] Deploy to production during maintenance window
- [ ] Post-deployment validation
- [ ] 24-hour monitoring period

---

**Questions or Issues?**
Contact: Development Team
