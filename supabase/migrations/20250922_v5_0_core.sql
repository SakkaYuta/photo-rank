-- v5.0 core tables for URL-ingestion, products, and battles

-- online_assets: store user-ingested online data (URL-based)
CREATE TABLE IF NOT EXISTS public.online_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  provider text,
  title text,
  author text,
  content_hash text UNIQUE,
  policy text CHECK (policy IN ('allow','deny','manual')) DEFAULT 'manual',
  status text CHECK (status IN ('pending','approved','rejected','blocked')) DEFAULT 'pending',
  preview_path text,
  original_path text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_online_assets_owner ON public.online_assets(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_online_assets_hash ON public.online_assets(content_hash);
CREATE INDEX IF NOT EXISTS idx_online_assets_provider_status ON public.online_assets(provider, status);

ALTER TABLE public.online_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS online_assets_owner_rw ON public.online_assets;
CREATE POLICY online_assets_owner_rw ON public.online_assets
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- asset_policies: domain/provider rules
CREATE TABLE IF NOT EXISTS public.asset_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text UNIQUE NOT NULL, -- domain or provider identifier or URL pattern
  rule text CHECK (rule IN ('allow','deny','manual')) NOT NULL,
  notes text,
  updated_by uuid REFERENCES public.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.asset_policies ENABLE ROW LEVEL SECURITY;

-- Block regular users; service role (Edge Functions) can bypass RLS
DROP POLICY IF EXISTS asset_policies_locked ON public.asset_policies;
CREATE POLICY asset_policies_locked ON public.asset_policies
  USING (false)
  WITH CHECK (false);

-- asset_approvals: manual review trail
CREATE TABLE IF NOT EXISTS public.asset_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.online_assets(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.users(id),
  decision text CHECK (decision IN ('approved','rejected','revoked')) NOT NULL,
  reason text,
  reviewed_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_asset_approvals_asset ON public.asset_approvals(asset_id, reviewed_at DESC);

ALTER TABLE public.asset_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asset_approvals_locked ON public.asset_approvals;
CREATE POLICY asset_approvals_locked ON public.asset_approvals
  USING (false)
  WITH CHECK (false);

-- products: normalized product entity
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  product_type text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  creator_margin integer DEFAULT 0 CHECK (creator_margin >= 0),
  platform_fee integer DEFAULT 0 CHECK (platform_fee >= 0),
  status text DEFAULT 'draft' CHECK (status IN ('draft','pending','published','disabled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_creator ON public.products(creator_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_public_or_owner_select ON public.products;
CREATE POLICY products_public_or_owner_select ON public.products
  FOR SELECT USING (
    status = 'published' OR creator_id = auth.uid()
  );

DROP POLICY IF EXISTS products_owner_write ON public.products;
CREATE POLICY products_owner_write ON public.products
  FOR ALL USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

-- battle_eligibility: derived eligibility state (must be before battles table)
CREATE TABLE IF NOT EXISTS public.battle_eligibility (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  is_organizer_member boolean DEFAULT false,
  last_month_sales_count integer DEFAULT 0,
  is_eligible boolean GENERATED ALWAYS AS (
    is_organizer_member OR last_month_sales_count >= 10
  ) STORED,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.battle_eligibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS battle_eligibility_self_select ON public.battle_eligibility;
CREATE POLICY battle_eligibility_self_select ON public.battle_eligibility
  FOR SELECT USING (user_id = auth.uid());

-- battles: core battle session entity
CREATE TABLE IF NOT EXISTS public.battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (5,30,60)),
  start_time timestamptz,
  end_time timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','finished','cancelled')),
  winner_id uuid REFERENCES public.users(id),
  winner_bonus_amount integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_battles_participants ON public.battles(challenger_id, opponent_id);

ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS battles_participants_select ON public.battles;
CREATE POLICY battles_participants_select ON public.battles
  FOR SELECT USING (
    auth.uid() IN (challenger_id, opponent_id)
  );

DROP POLICY IF EXISTS battles_insert_eligible ON public.battles;
CREATE POLICY battles_insert_eligible ON public.battles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.battle_eligibility e WHERE e.user_id = auth.uid() AND e.is_eligible = true
    )
  );

DROP POLICY IF EXISTS battles_owner_update ON public.battles;
CREATE POLICY battles_owner_update ON public.battles
  FOR UPDATE USING (
    auth.uid() IN (challenger_id, opponent_id)
  ) WITH CHECK (true);

-- cheer_tickets: support tickets for battles
CREATE TABLE IF NOT EXISTS public.cheer_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  supporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.users(id),
  amount integer NOT NULL DEFAULT 100 CHECK (amount > 0),
  has_signed_goods_right boolean DEFAULT true,
  has_exclusive_options boolean DEFAULT true,
  exclusive_options jsonb,
  expires_at timestamptz,
  purchased_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cheer_tickets_battle ON public.cheer_tickets(battle_id);
CREATE INDEX IF NOT EXISTS idx_cheer_tickets_supporter ON public.cheer_tickets(supporter_id);

ALTER TABLE public.cheer_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cheer_tickets_self_select ON public.cheer_tickets;
CREATE POLICY cheer_tickets_self_select ON public.cheer_tickets
  FOR SELECT USING (
    supporter_id = auth.uid()
  );

DROP POLICY IF EXISTS cheer_tickets_insert_self ON public.cheer_tickets;
CREATE POLICY cheer_tickets_insert_self ON public.cheer_tickets
  FOR INSERT WITH CHECK (supporter_id = auth.uid());

-- optional helper: update updated_at on change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_online_assets_updated ON public.online_assets;
CREATE TRIGGER trg_online_assets_updated BEFORE UPDATE ON public.online_assets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated ON public.products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- mark migration
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_core', 'local')
ON CONFLICT (version) DO NOTHING;
