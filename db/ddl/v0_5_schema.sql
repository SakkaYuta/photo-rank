-- PhotoRank v0.5 schema (DDL)
-- Schemas & Extensions
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS security;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Extensions (note: availability depends on Supabase project settings)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Organizer / Contracts
CREATE TABLE IF NOT EXISTS public.organizer_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id),
  company_name text,
  company_type text CHECK (company_type IN ('individual','corporation','llc')),
  tax_id text,
  representative_name text,
  contact_email text,
  contact_phone text,
  address jsonb,
  website_url text,
  description text,
  max_creators integer DEFAULT 50,
  is_verified boolean DEFAULT false,
  verified_at timestamptz,
  contract_signed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_organizer_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES public.users(id) NOT NULL,
  organizer_id uuid REFERENCES public.users(id) NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','active','terminated')),
  commission_rate numeric(5,2) DEFAULT 10.00,
  contract_terms jsonb,
  start_date date NOT NULL,
  end_date date,
  terminated_at timestamptz,
  termination_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (creator_id, organizer_id, status)
);

-- Security / Ops
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  action_type text NOT NULL,
  count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON public.rate_limits(user_id, action_type, window_start);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  action text NOT NULL,
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version text PRIMARY KEY,
  executed_at timestamptz DEFAULT now(),
  checksum text NOT NULL
);

-- Works availability & sales integrity
CREATE TABLE IF NOT EXISTS public.work_availability (
  work_id uuid PRIMARY KEY REFERENCES public.works(id),
  is_available boolean DEFAULT true,
  max_sales integer,
  current_sales integer DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Payout accounts & payouts
CREATE TABLE IF NOT EXISTS public.payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) NOT NULL,
  account_type text CHECK (account_type IN ('bank','stripe_connect','paypal')),
  is_default boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  bank_name text,
  branch_name text,
  account_type_jp text CHECK (account_type_jp IN ('\u666e\u901a','\u5f53\u5ea7','\u8caf\u84c4')),
  account_number_encrypted text,
  account_holder_name text,
  account_holder_name_kana text,
  swift_code text,
  stripe_account_id text,
  stripe_verification_status text,
  paypal_email text,
  verification_documents jsonb,
  verified_at timestamptz,
  verified_by uuid REFERENCES public.users(id),
  last_4_digits text,
  encryption_key_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_per_user ON public.payout_accounts(user_id) WHERE is_default = true;

CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) NOT NULL,
  payout_account_id uuid REFERENCES public.payout_accounts(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_amount integer NOT NULL,
  platform_fee integer NOT NULL,
  organizer_fee integer DEFAULT 0,
  processing_fee integer DEFAULT 0,
  tax_amount integer DEFAULT 0,
  net_amount integer NOT NULL,
  currency text DEFAULT 'JPY',
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','processing','completed','failed','cancelled')),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.users(id),
  processed_at timestamptz,
  completed_at timestamptz,
  transaction_id text,
  transaction_receipt_url text,
  failure_reason text,
  breakdown jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payouts_user_period ON public.payouts(user_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status) WHERE status <> 'completed';

-- Privacy
CREATE TABLE IF NOT EXISTS public.personal_data_handling (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  data_type text NOT NULL,
  encryption_key_id text,
  is_encrypted boolean DEFAULT false,
  retention_days integer DEFAULT 730,
  deletion_scheduled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  request_type text CHECK (request_type IN ('gdpr','ccpa','voluntary')),
  requested_at timestamptz DEFAULT now(),
  scheduled_for timestamptz DEFAULT (now() + interval '30 days'),
  completed_at timestamptz,
  status text DEFAULT 'pending',
  verification_token text,
  ip_address inet
);

-- Experiments & pricing
CREATE TABLE IF NOT EXISTS public.ab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  feature text NOT NULL,
  variants jsonb NOT NULL,
  traffic_allocation jsonb,
  start_date timestamptz,
  end_date timestamptz,
  winning_variant text,
  is_active boolean DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.ab_test_assignments (
  user_id uuid REFERENCES public.users(id),
  test_id uuid REFERENCES public.ab_tests(id),
  variant text NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, test_id)
);

CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rule_type text NOT NULL,
  conditions jsonb NOT NULL,
  actions jsonb NOT NULL,
  priority integer DEFAULT 0,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean DEFAULT true
);

-- i18n
CREATE TABLE IF NOT EXISTS public.translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  language_code text NOT NULL,
  field_name text NOT NULL,
  translated_text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Behavior & recommendations
CREATE TABLE IF NOT EXISTS public.user_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  work_id uuid REFERENCES public.works(id),
  interaction_type text,
  duration_seconds integer,
  context jsonb,
  created_at timestamptz DEFAULT now()
);

-- Battle extension
CREATE TABLE IF NOT EXISTS public.gift_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon_url text NOT NULL,
  price integer NOT NULL,
  effect_type text NOT NULL,
  effect_duration integer DEFAULT 3000,
  animation_data jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gift_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) NOT NULL,
  sender_id uuid REFERENCES public.users(id) NOT NULL,
  recipient_creator_id uuid REFERENCES public.users(id) NOT NULL,
  gift_item_id uuid REFERENCES public.gift_items(id) NOT NULL,
  quantity integer DEFAULT 1,
  total_amount integer NOT NULL,
  message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) NOT NULL,
  creator_id uuid REFERENCES public.users(id) NOT NULL,
  purchase_id uuid REFERENCES public.purchases(id) NOT NULL,
  amount integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) NOT NULL,
  work_id uuid REFERENCES public.works(id) NOT NULL,
  creator_id uuid REFERENCES public.users(id) NOT NULL,
  display_order integer DEFAULT 0,
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (event_id, work_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_works_published_created ON public.works(is_published, created_at DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_purchases_user ON public.purchases(user_id, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_organizer ON public.users(organizer_id) WHERE organizer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_sales_event ON public.event_sales(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gift_tx_event ON public.gift_transactions(event_id, created_at);

-- Revenue summary (materialized view)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.creator_revenue_summary AS
SELECT 
  c.id AS creator_id,
  c.display_name,
  c.organizer_id,
  DATE_TRUNC('month', p.purchased_at) AS month,
  COUNT(DISTINCT p.id) AS total_sales,
  SUM(p.price) AS gross_revenue
FROM public.users c
JOIN public.works w ON w.creator_id = c.id
JOIN public.purchases p ON p.work_id = w.id AND COALESCE(p.status,'paid') = 'paid'
GROUP BY c.id, c.display_name, c.organizer_id, month;

-- Idempotency helpers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_purchases_pi_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_purchases_pi_unique ON public.purchases((COALESCE(stripe_payment_intent_id,''))) WHERE stripe_payment_intent_id IS NOT NULL;
  END IF;
END $$;

-- Webhook events log (for monitoring/debugging)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE,
  event_type text,
  payload jsonb,
  processing_time_ms integer,
  created_at timestamptz DEFAULT now()
);
