-- Basic webhook and notification infrastructure for testing

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Stripe webhook events table
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for webhook events
CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_events_event_id
ON stripe_webhook_events(stripe_event_id);

CREATE INDEX IF NOT EXISTS idx_stripe_events_processed
ON stripe_webhook_events(processed, type, created_at);

-- Basic partner notifications table (standalone, no dependencies)
CREATE TABLE IF NOT EXISTS partner_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'retry')),
  priority TEXT DEFAULT 'normal'
    CHECK (priority IN ('high', 'normal', 'low')),
  attempts INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  response_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for partner notifications
CREATE INDEX IF NOT EXISTS idx_partner_notifications_partner
ON partner_notifications(partner_id);

CREATE INDEX IF NOT EXISTS idx_partner_notifications_status
ON partner_notifications(status, next_retry_at);

-- Payment failures table
CREATE TABLE IF NOT EXISTS payment_failures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  work_id UUID,
  payment_intent_id TEXT,
  error_code TEXT,
  error_message TEXT,
  amount INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for payment failures
CREATE INDEX IF NOT EXISTS idx_payment_failures_user
ON payment_failures(user_id);

CREATE INDEX IF NOT EXISTS idx_payment_failures_intent
ON payment_failures(payment_intent_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_stripe_webhook_events_updated_at
  BEFORE UPDATE ON stripe_webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partner_notifications_updated_at
  BEFORE UPDATE ON partner_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_failures ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role access" ON stripe_webhook_events
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY "Service role access" ON partner_notifications
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY "Users can view own failures" ON payment_failures
  FOR SELECT USING (auth.uid() = user_id);