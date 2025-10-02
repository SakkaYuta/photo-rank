-- ============================================================================
-- Photo-Rank v6.0 Supporting Domain
-- Migration: 20251002000003_v6_supporting.sql
-- Description: Notifications, audit logs, webhooks, and utility tables
-- ============================================================================

-- ============================================================================
-- 1. NOTIFICATIONS
-- ============================================================================

-- notifications: Unified notification system
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Notification type
  notification_type text NOT NULL CHECK (notification_type IN (
    -- Order notifications
    'order_confirmed', 'order_shipped', 'order_delivered', 'order_cancelled',
    -- Payment notifications
    'payment_succeeded', 'payment_failed', 'refund_processed',
    -- Battle notifications
    'battle_invitation', 'battle_accepted', 'battle_declined',
    'battle_starting_soon', 'battle_started', 'battle_ended',
    'battle_won', 'battle_lost',
    -- Cheer notifications
    'cheer_received', 'signed_goods_available',
    -- Work notifications
    'work_published', 'work_approved', 'work_rejected',
    'work_favorited', 'work_sold',
    -- System notifications
    'system_announcement', 'maintenance_scheduled',
    'account_verification', 'security_alert',
    -- Marketing
    'promotional_offer', 'newsletter'
  )),

  -- Content
  title text NOT NULL,
  message text,

  -- Related entity
  related_entity_type text, -- 'order', 'battle', 'work', 'payment', etc.
  related_entity_id uuid,
  action_url text,

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Delivery channels
  channels text[] DEFAULT ARRAY['in_app'], -- ['in_app', 'email', 'push']

  -- Read status
  is_read boolean DEFAULT false,
  read_at timestamptz,

  -- Priority
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Expiration
  expires_at timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_type ON notifications(notification_type, created_at DESC);
CREATE INDEX idx_notifications_entity ON notifications(related_entity_type, related_entity_id);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id, is_read, priority)
  WHERE is_read = false AND deleted_at IS NULL;

COMMENT ON TABLE notifications IS 'Unified notification system (consolidates user_notifications + partner_notifications)';

-- ============================================================================
-- 2. AUDIT & EVENTS
-- ============================================================================

-- audit_events: Comprehensive audit trail
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event classification
  event_type text NOT NULL, -- 'create', 'update', 'delete', 'login', 'payment', etc.
  event_category text, -- 'security', 'commerce', 'content', 'admin'

  -- Entity
  entity_type text NOT NULL, -- Table name
  entity_id uuid,

  -- Actor
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_type text DEFAULT 'user' CHECK (actor_type IN (
    'user', 'system', 'admin', 'api', 'service', 'partner'
  )),

  -- Changes
  changes jsonb, -- {before: {...}, after: {...}}

  -- Context
  ip_address inet,
  user_agent text,
  request_id text,
  session_id text,

  -- Result
  status text DEFAULT 'success' CHECK (status IN (
    'success', 'failure', 'partial', 'pending'
  )),
  error_message text,

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now() NOT NULL
);

-- Partitioning by month for performance (example for future implementation)
CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_events_actor ON audit_events(actor_id, created_at DESC);
CREATE INDEX idx_audit_events_type ON audit_events(event_type, event_category, created_at DESC);
CREATE INDEX idx_audit_events_created ON audit_events(created_at DESC);
CREATE INDEX idx_audit_events_ip ON audit_events(ip_address, created_at DESC);

COMMENT ON TABLE audit_events IS 'Comprehensive audit trail (consolidates audit_logs)';

-- ============================================================================
-- 3. WEBHOOKS & EXTERNAL EVENTS
-- ============================================================================

-- webhook_events: Incoming webhook events
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider
  provider text NOT NULL, -- 'stripe', 'factory_api', 'payment_gateway', etc.
  event_type text NOT NULL,
  event_id text, -- External event ID

  -- Payload
  raw_payload jsonb NOT NULL,
  headers jsonb,

  -- Processing
  processing_status text DEFAULT 'pending' CHECK (processing_status IN (
    'pending', 'processing', 'processed', 'failed', 'ignored', 'duplicate'
  )),
  processing_attempts integer DEFAULT 0,
  last_error text,

  -- Idempotency
  idempotency_key text UNIQUE,

  -- Stripe specific
  stripe_event_id text UNIQUE,
  stripe_signature text,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  processed_at timestamptz,
  next_retry_at timestamptz
);

CREATE INDEX idx_webhook_events_provider ON webhook_events(provider, event_type, created_at DESC);
CREATE INDEX idx_webhook_events_status ON webhook_events(processing_status, next_retry_at)
  WHERE processing_status IN ('pending', 'failed');
CREATE INDEX idx_webhook_events_stripe ON webhook_events(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;
CREATE INDEX idx_webhook_events_idempotency ON webhook_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON TABLE webhook_events IS 'Incoming webhook events (consolidates stripe_webhook_events)';

-- ============================================================================
-- 4. RATE LIMITING & ABUSE PREVENTION
-- ============================================================================

-- rate_limits: Rate limiting tracking
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  ip_address inet,
  identifier text, -- API key, session ID, etc.

  -- Limit type
  limit_type text NOT NULL, -- 'upload', 'api_call', 'battle_invitation', 'order_creation'

  -- Counter
  request_count integer DEFAULT 1 CHECK (request_count >= 0),
  blocked_count integer DEFAULT 0 CHECK (blocked_count >= 0),

  -- Window
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  window_duration interval,

  -- Status
  is_blocked boolean DEFAULT false,
  blocked_until timestamptz,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT at_least_one_identifier CHECK (
    user_id IS NOT NULL OR ip_address IS NOT NULL OR identifier IS NOT NULL
  )
);

CREATE INDEX idx_rate_limits_user ON rate_limits(user_id, limit_type, window_end);
CREATE INDEX idx_rate_limits_ip ON rate_limits(ip_address, limit_type, window_end);
CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier, limit_type, window_end);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_end) WHERE window_end > now();
CREATE INDEX idx_rate_limits_blocked ON rate_limits(is_blocked, blocked_until)
  WHERE is_blocked = true AND blocked_until > now();

COMMENT ON TABLE rate_limits IS 'Rate limiting tracker (consolidates rate_limit_logs + upload_attempts)';

-- ============================================================================
-- 5. IDEMPOTENCY & DEDUPLICATION
-- ============================================================================

-- idempotency_keys: Request idempotency
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key text PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,

  -- Operation
  operation_type text NOT NULL, -- 'payment', 'order', 'cheer', 'upload'
  request_hash text,

  -- Response
  response_status integer,
  response_body jsonb,

  -- Expiration
  expires_at timestamptz NOT NULL,

  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_idempotency_keys_user ON idempotency_keys(user_id, created_at DESC);
CREATE INDEX idx_idempotency_keys_expiry ON idempotency_keys(expires_at)
  WHERE expires_at > now();
CREATE INDEX idx_idempotency_keys_operation ON idempotency_keys(operation_type, created_at DESC);

COMMENT ON TABLE idempotency_keys IS 'Idempotency key tracking for duplicate prevention';

-- ============================================================================
-- 6. ACTIVITY TRACKING
-- ============================================================================

-- favorites: User favorites
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,

  created_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE(user_id, work_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id, created_at DESC);
CREATE INDEX idx_favorites_work ON favorites(work_id, created_at DESC);

COMMENT ON TABLE favorites IS 'User work favorites';

-- activity_events: Future activity tracking
CREATE TABLE IF NOT EXISTS activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,

  -- Activity type
  activity_type text NOT NULL CHECK (activity_type IN (
    'work_view', 'work_favorite', 'work_unfavorite', 'work_share',
    'product_view', 'cart_add', 'cart_remove',
    'search', 'profile_view', 'follow', 'unfollow'
  )),

  -- Target
  target_type text, -- 'work', 'product', 'user', 'search_query'
  target_id uuid,

  -- Context
  metadata jsonb DEFAULT '{}'::jsonb,
  referrer text,
  ip_address inet,
  user_agent text,

  created_at timestamptz DEFAULT now() NOT NULL
);

-- Partition by month for performance
CREATE INDEX idx_activity_events_user ON activity_events(user_id, created_at DESC);
CREATE INDEX idx_activity_events_type ON activity_events(activity_type, created_at DESC);
CREATE INDEX idx_activity_events_target ON activity_events(target_type, target_id, created_at DESC);
CREATE INDEX idx_activity_events_created ON activity_events(created_at DESC);

COMMENT ON TABLE activity_events IS 'User activity tracking for analytics';

-- ============================================================================
-- 7. SYSTEM UTILITIES
-- ============================================================================

-- schema_migrations: Migration tracking (if not exists)
CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  checksum text,
  executed_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE schema_migrations IS 'Database migration version tracking';

-- feature_flags: Feature toggle system
CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Feature identification
  feature_name text UNIQUE NOT NULL,
  description text,

  -- Status
  is_enabled boolean DEFAULT false,
  enabled_for_all boolean DEFAULT false,

  -- Rollout
  rollout_percentage integer DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  enabled_user_ids uuid[],
  enabled_roles text[],

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  enabled_at timestamptz,
  disabled_at timestamptz
);

CREATE INDEX idx_feature_flags_enabled ON feature_flags(is_enabled);
CREATE INDEX idx_feature_flags_name ON feature_flags(feature_name);

COMMENT ON TABLE feature_flags IS 'Feature flag/toggle system';

-- ============================================================================
-- 8. HELPER FUNCTIONS
-- ============================================================================

-- Function: Check if feature is enabled for user
CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_feature_name text,
  p_user_id uuid DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
  v_flag feature_flags%ROWTYPE;
  v_user_roles text[];
BEGIN
  -- Get feature flag
  SELECT * INTO v_flag FROM feature_flags WHERE feature_name = p_feature_name;

  -- Feature doesn't exist or is disabled
  IF v_flag IS NULL OR v_flag.is_enabled = false THEN
    RETURN false;
  END IF;

  -- Enabled for all
  IF v_flag.enabled_for_all = true THEN
    RETURN true;
  END IF;

  -- No user context
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user is in enabled list
  IF p_user_id = ANY(v_flag.enabled_user_ids) THEN
    RETURN true;
  END IF;

  -- Check user roles
  IF v_flag.enabled_roles IS NOT NULL AND array_length(v_flag.enabled_roles, 1) > 0 THEN
    SELECT array_agg(role) INTO v_user_roles
    FROM user_roles
    WHERE user_id = p_user_id AND is_active = true;

    IF v_user_roles && v_flag.enabled_roles THEN
      RETURN true;
    END IF;
  END IF;

  -- Rollout percentage (simple hash-based)
  IF v_flag.rollout_percentage > 0 THEN
    IF (hashtext(p_user_id::text) % 100) < v_flag.rollout_percentage THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_feature_enabled IS 'Check if a feature flag is enabled for a user';

-- Function: Clean expired data (run via cron)
CREATE OR REPLACE FUNCTION clean_expired_data() RETURNS void AS $$
BEGIN
  -- Clean expired idempotency keys
  DELETE FROM idempotency_keys WHERE expires_at < now();

  -- Clean expired rate limit windows
  DELETE FROM rate_limits WHERE window_end < now() - interval '7 days';

  -- Clean expired live offer reservations
  UPDATE live_offer_reservations
  SET status = 'expired'
  WHERE status = 'active' AND expires_at < now();

  -- Clean old activity events (optional, keep last 90 days)
  DELETE FROM activity_events WHERE created_at < now() - interval '90 days';

  -- Refresh battle eligibility materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY battle_eligibility;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION clean_expired_data IS 'Clean expired data (run daily via cron)';

-- ============================================================================
-- 9. TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_rate_limits_updated_at ON rate_limits;
CREATE TRIGGER trigger_rate_limits_updated_at
  BEFORE UPDATE ON rate_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_feature_flags_updated_at ON feature_flags;
CREATE TRIGGER trigger_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update user profile stats on work creation/deletion
CREATE OR REPLACE FUNCTION update_user_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE user_profiles
    SET works_count = works_count + 1
    WHERE user_id = NEW.creator_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE user_profiles
    SET works_count = GREATEST(works_count - 1, 0)
    WHERE user_id = OLD.creator_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    -- Soft delete
    UPDATE user_profiles
    SET works_count = GREATEST(works_count - 1, 0)
    WHERE user_id = OLD.creator_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    -- Undelete
    UPDATE user_profiles
    SET works_count = works_count + 1
    WHERE user_id = NEW.creator_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_works_update_stats ON works;
CREATE TRIGGER trigger_works_update_stats
  AFTER INSERT OR UPDATE OR DELETE ON works
  FOR EACH ROW EXECUTE FUNCTION update_user_profile_stats();

-- Auto-update favorite count
CREATE OR REPLACE FUNCTION update_work_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE works
    SET favorite_count = favorite_count + 1
    WHERE id = NEW.work_id;

    UPDATE user_profiles
    SET total_sales_count = total_sales_count + 1
    WHERE user_id = (SELECT creator_id FROM works WHERE id = NEW.work_id);
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE works
    SET favorite_count = GREATEST(favorite_count - 1, 0)
    WHERE id = OLD.work_id;

    UPDATE user_profiles
    SET total_sales_count = GREATEST(total_sales_count - 1, 0)
    WHERE user_id = (SELECT creator_id FROM works WHERE id = OLD.work_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_favorites_update_count ON favorites;
CREATE TRIGGER trigger_favorites_update_count
  AFTER INSERT OR DELETE ON favorites
  FOR EACH ROW EXECUTE FUNCTION update_work_favorite_count();

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Notifications: Own notifications
DROP POLICY IF EXISTS notifications_own ON notifications;
CREATE POLICY notifications_own ON notifications
  FOR ALL USING (recipient_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (recipient_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Audit Events: Admin only (service_role bypass)
DROP POLICY IF EXISTS audit_events_admin ON audit_events;
CREATE POLICY audit_events_admin ON audit_events
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'admin' AND is_active = true
    )
  );

-- Webhook Events: Service role only
-- (RLS enabled but no policies - only service_role can access)

-- Favorites: Own favorites
DROP POLICY IF EXISTS favorites_own ON favorites;
CREATE POLICY favorites_own ON favorites
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Feature Flags: Public read
DROP POLICY IF EXISTS feature_flags_public ON feature_flags;
CREATE POLICY feature_flags_public ON feature_flags
  FOR SELECT USING (true);

-- ============================================================================
-- 11. INITIAL DATA
-- ============================================================================

-- Insert default feature flags
INSERT INTO feature_flags (feature_name, description, is_enabled) VALUES
  ('battles_enabled', 'Enable creator battles feature', true),
  ('live_offers_enabled', 'Enable live limited offers', true),
  ('digital_downloads', 'Enable digital download products', false),
  ('subscriptions', 'Enable subscription products', false),
  ('affiliate_program', 'Enable affiliate/referral program', false)
ON CONFLICT (feature_name) DO NOTHING;

-- Mark migration complete
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v6_supporting', 'supporting')
ON CONFLICT (version) DO NOTHING;
