-- ============================================================================
-- Photo-Rank v6.0 Data Migration Script
-- ============================================================================
-- Purpose: Migrate existing data from old schema to v6 unified schema
-- Date: 2025-10-02
-- IMPORTANT: Review and test this script in a staging environment first!
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: USERS & PROFILES
-- ============================================================================
-- Assumes old_users table has: id, auth_user_id, email, phone, is_verified,
-- display_name, bio, avatar_url, role

-- Insert users from old schema (if exists)
-- INSERT INTO users (id, auth_user_id, email, phone, is_verified)
-- SELECT id, auth_user_id, email, phone, is_verified
-- FROM old_users
-- ON CONFLICT (id) DO NOTHING;

-- Insert user profiles
-- INSERT INTO user_profiles (user_id, display_name, bio, avatar_url)
-- SELECT id, display_name, bio, avatar_url
-- FROM old_users
-- ON CONFLICT (user_id) DO UPDATE SET
--   display_name = EXCLUDED.display_name,
--   bio = EXCLUDED.bio,
--   avatar_url = EXCLUDED.avatar_url;

-- Insert user roles
-- INSERT INTO user_roles (user_id, role)
-- SELECT id, role
-- FROM old_users
-- WHERE role IS NOT NULL
-- ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================================
-- STEP 2: ASSETS & WORKS
-- ============================================================================
-- Migrate assets (photos/artworks)
-- Assumes old_assets table has: id, creator_id, title, file_url, thumbnail_url,
-- width, height, file_size_bytes, mime_type

-- INSERT INTO assets (
--   id, creator_id, provider, provider_asset_id,
--   title, original_url, thumbnail_url,
--   width_px, height_px, file_size_bytes, mime_type,
--   metadata
-- )
-- SELECT
--   id,
--   creator_id,
--   'local'::asset_provider,
--   id::text,
--   title,
--   file_url,
--   thumbnail_url,
--   width,
--   height,
--   file_size_bytes,
--   mime_type,
--   '{}'::jsonb
-- FROM old_assets
-- ON CONFLICT (id) DO NOTHING;

-- Migrate works (if separate from assets)
-- INSERT INTO works (id, creator_id, asset_id, title, description, is_active)
-- SELECT id, creator_id, asset_id, title, description, is_active
-- FROM old_works
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 3: PRODUCTS & VARIANTS
-- ============================================================================
-- Migrate products with v6 pricing structure
-- Old schema: products(id, work_id, creator_id, price, is_active)
-- New schema: products → product_variants (with tax-exclusive pricing)

-- INSERT INTO products (id, work_id, creator_id, is_active)
-- SELECT id, work_id, creator_id, is_active
-- FROM old_products
-- ON CONFLICT (id) DO NOTHING;

-- Create variants from old product pricing
-- Assumes old products had single price point
-- INSERT INTO product_variants (
--   product_id, sku, kind, price_jpy,
--   manufacturing_partner_id, options, inventory_qty
-- )
-- SELECT
--   id as product_id,
--   'SKU-' || id::text as sku,
--   'physical'::product_type,
--   price as price_jpy,  -- Old price was tax-inclusive, needs adjustment
--   NULL as manufacturing_partner_id,  -- Assign manually later
--   '{}'::jsonb as options,
--   NULL as inventory_qty  -- Set manually based on inventory system
-- FROM old_products
-- ON CONFLICT (sku) DO NOTHING;

-- ============================================================================
-- STEP 4: ORDERS & PAYMENTS
-- ============================================================================
-- Migrate orders with v6 tax/fee structure
-- Old: orders(id, user_id, total_amount, status)
-- New: orders with tax-exclusive pricing and platform fees

-- Note: This requires recalculating tax and fees based on v6 rules
-- INSERT INTO orders (
--   id, user_id, status,
--   subtotal_excl_tax_jpy, tax_total_jpy,
--   shipping_total_jpy, total_payable_jpy
-- )
-- SELECT
--   id,
--   user_id,
--   status::order_status,
--   -- Reverse calculate pre-tax amount (old total was tax-inclusive)
--   ROUND(total_amount / 1.10) as subtotal_excl_tax_jpy,
--   ROUND(total_amount / 1.10 * 0.10) as tax_total_jpy,
--   0 as shipping_total_jpy,  -- Need to recalculate based on shipping zones
--   total_amount as total_payable_jpy
-- FROM old_orders
-- ON CONFLICT (id) DO NOTHING;

-- Migrate order items with proper tax/fee calculation
-- INSERT INTO order_items (
--   id, order_id, product_variant_id, creator_id,
--   quantity, unit_price_jpy,
--   tax_rate_bps, tax_amount_jpy,
--   subtotal_excl_tax_jpy, subtotal_tax_jpy,
--   platform_fee_rate_bps, platform_fee_amount_jpy, creator_earnings_jpy
-- )
-- SELECT
--   old.id,
--   old.order_id,
--   old.product_id as product_variant_id,  -- Assumes 1:1 mapping
--   old.creator_id,
--   old.quantity,
--   ROUND(old.price / 1.10) as unit_price_jpy,  -- Convert to pre-tax
--   1000 as tax_rate_bps,  -- 10%
--   calculate_tax(ROUND(old.price / 1.10), 1000) as tax_amount_jpy,
--   ROUND(old.price / 1.10) * old.quantity as subtotal_excl_tax_jpy,
--   calculate_tax(ROUND(old.price / 1.10) * old.quantity, 1000) as subtotal_tax_jpy,
--   3000 as platform_fee_rate_bps,  -- 30%
--   calculate_platform_fee(ROUND(old.price / 1.10) * old.quantity, 3000) as platform_fee_amount_jpy,
--   calculate_creator_earnings(ROUND(old.price / 1.10) * old.quantity, 3000) as creator_earnings_jpy
-- FROM old_order_items old
-- ON CONFLICT (id) DO NOTHING;

-- Migrate payments (Stripe only in v6)
-- INSERT INTO payments (
--   id, order_id, user_id,
--   provider, payment_intent_id,
--   amount_jpy, status
-- )
-- SELECT
--   id,
--   order_id,
--   user_id,
--   'stripe'::payment_provider,
--   stripe_payment_intent_id,
--   amount,
--   status::payment_status
-- FROM old_payments
-- WHERE provider = 'stripe'  -- Only migrate Stripe payments
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 5: BATTLES & CHEER TICKETS
-- ============================================================================
-- Migrate battles
-- INSERT INTO battles (
--   id, organizer_id, title, description,
--   start_at, end_at, status
-- )
-- SELECT
--   id, organizer_id, title, description,
--   start_at, end_at, status::battle_status
-- FROM old_battles
-- ON CONFLICT (id) DO NOTHING;

-- Migrate cheer tickets with point conversion
-- Old schema might have had different point calculation
-- INSERT INTO cheer_tickets (
--   id, battle_id, supporter_id, creator_id,
--   amount_jpy, points
-- )
-- SELECT
--   id,
--   battle_id,
--   supporter_id,
--   creator_id,
--   amount_jpy,
--   jpy_to_points(amount_jpy) as points  -- Use v6 conversion (1:1 default)
-- FROM old_cheer_tickets
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 6: MANUFACTURING PARTNERS & SHIPPING
-- ============================================================================
-- Create default manufacturing partner if migrating from old system
-- INSERT INTO manufacturing_partners (id, name, contact_email)
-- VALUES (
--   gen_random_uuid(),
--   'Default Factory',
--   'factory@example.com'
-- )
-- ON CONFLICT DO NOTHING
-- RETURNING id;

-- Update product variants to link to manufacturing partner
-- UPDATE product_variants
-- SET manufacturing_partner_id = (
--   SELECT id FROM manufacturing_partners LIMIT 1
-- )
-- WHERE kind = 'physical' AND manufacturing_partner_id IS NULL;

-- Create default shipping zones if not exist
-- (Already created in migration, but can add custom zones here)

-- ============================================================================
-- STEP 7: FAVORITES & ACTIVITY
-- ============================================================================
-- Migrate favorites
-- INSERT INTO favorites (user_id, work_id)
-- SELECT user_id, work_id
-- FROM old_favorites
-- ON CONFLICT (user_id, work_id) DO NOTHING;

-- Migrate activity events (if tracking exists)
-- INSERT INTO activity_events (user_id, event_type, entity_type, entity_id, payload)
-- SELECT user_id, event_type, entity_type, entity_id, payload
-- FROM old_activity_events
-- ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 8: VALIDATION QUERIES
-- ============================================================================
-- Run these queries to verify migration success

-- Check user count
SELECT 'Users migrated' as check_name, COUNT(*) as count FROM users;

-- Check products and variants
SELECT 'Products migrated' as check_name, COUNT(*) as count FROM products;
SELECT 'Variants created' as check_name, COUNT(*) as count FROM product_variants;

-- Check orders and items
SELECT 'Orders migrated' as check_name, COUNT(*) as count FROM orders;
SELECT 'Order items migrated' as check_name, COUNT(*) as count FROM order_items;

-- Verify tax calculations are correct
SELECT
  'Tax calculation check' as check_name,
  COUNT(*) as mismatches
FROM order_items
WHERE tax_amount_jpy != calculate_tax(unit_price_jpy, tax_rate_bps);

-- Verify platform fee calculations
SELECT
  'Platform fee check' as check_name,
  COUNT(*) as mismatches
FROM order_items
WHERE platform_fee_amount_jpy != calculate_platform_fee(subtotal_excl_tax_jpy, platform_fee_rate_bps);

-- Check battle points conversion
SELECT
  'Battle points check' as check_name,
  COUNT(*) as correct
FROM cheer_tickets
WHERE points = jpy_to_points(amount_jpy);

-- ============================================================================
-- STEP 9: MANUAL TASKS CHECKLIST
-- ============================================================================
/*
After running this script, complete these manual tasks:

1. [ ] Assign manufacturing partners to product variants
2. [ ] Configure shipping rates for each factory × prefecture zone
3. [ ] Set inventory quantities for physical products
4. [ ] Link digital variant assets for digital products
5. [ ] Verify all order totals match original data
6. [ ] Update creator earnings for historical orders
7. [ ] Configure battle eligibility for all creators
8. [ ] Set up download entitlements for digital purchases
9. [ ] Migrate any custom address data to new addresses table
10. [ ] Update application code to use new schema
11. [ ] Test all API endpoints with new schema
12. [ ] Update frontend to use new TypeScript types
*/

COMMIT;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- If migration fails, run: ROLLBACK;
-- Then restore from backup: supabase/backups/backup_pre_v6.sql
