# Sponsored Events Database Schema

## テーブル構成

### `sponsored_campaigns`
```sql
CREATE TABLE sponsored_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Campaign Info
  title text NOT NULL,
  description text,
  sponsor_name text NOT NULL,
  sponsor_logo_url text,

  -- Duration
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,

  -- Reward Configuration
  threshold_rewards jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Example: [
  --   {"wins": 3, "badge_id": "xxx", "title_id": "yyy"},
  --   {"wins": 5, "badge_id": "zzz", "effect_id": "www"}
  -- ]

  ranking_rewards jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Example: [
  --   {"rank_from": 1, "rank_to": 1, "badge_id": "aaa", "title_id": "bbb"},
  --   {"rank_from": 2, "rank_to": 5, "badge_id": "ccc"}
  -- ]

  -- Battle Configuration
  min_duration_minutes int DEFAULT 5,
  max_duration_minutes int DEFAULT 30,
  allowed_categories text[] DEFAULT ARRAY['portrait', 'landscape', 'food'],

  -- Status
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'ended', 'cancelled')),

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_campaigns_status_dates ON sponsored_campaigns(status, start_at, end_at);
CREATE INDEX idx_campaigns_active ON sponsored_campaigns(status) WHERE status = 'active';
```

### `campaign_participations`
```sql
CREATE TABLE campaign_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  campaign_id uuid NOT NULL REFERENCES sponsored_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Stats
  total_battles int DEFAULT 0,
  total_wins int DEFAULT 0,
  total_losses int DEFAULT 0,

  -- Current Standing
  current_rank int,
  last_rank_update timestamptz,

  -- Rewards Claimed
  threshold_rewards_claimed jsonb DEFAULT '[]'::jsonb,
  -- Example: [{"wins": 3, "claimed_at": "2025-10-01T12:00:00Z"}]

  ranking_rewards_claimed jsonb DEFAULT '[]'::jsonb,

  -- Metadata
  first_battle_at timestamptz,
  last_battle_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  UNIQUE(campaign_id, user_id)
);

-- Indexes
CREATE INDEX idx_participations_campaign ON campaign_participations(campaign_id);
CREATE INDEX idx_participations_user ON campaign_participations(user_id);
CREATE INDEX idx_participations_ranking ON campaign_participations(campaign_id, total_wins DESC, updated_at ASC);
```

### `campaign_battles`
```sql
CREATE TABLE campaign_battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  campaign_id uuid NOT NULL REFERENCES sponsored_campaigns(id) ON DELETE CASCADE,
  battle_id uuid NOT NULL REFERENCES battles(id) ON DELETE CASCADE,

  -- Participants
  challenger_id uuid NOT NULL REFERENCES auth.users(id),
  opponent_id uuid NOT NULL REFERENCES auth.users(id),

  -- Result (denormalized for performance)
  winner_id uuid REFERENCES auth.users(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),

  -- Metadata
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,

  -- Constraints
  UNIQUE(campaign_id, battle_id),
  CHECK (challenger_id != opponent_id)
);

-- Indexes
CREATE INDEX idx_campaign_battles_campaign ON campaign_battles(campaign_id);
CREATE INDEX idx_campaign_battles_battle ON campaign_battles(battle_id);
CREATE INDEX idx_campaign_battles_participants ON campaign_battles(campaign_id, challenger_id, opponent_id);
```

### `user_rewards`
```sql
CREATE TABLE user_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Reward Type
  reward_type text NOT NULL CHECK (reward_type IN ('badge', 'title', 'effect', 'item')),
  reward_id text NOT NULL,

  -- Source
  source_type text NOT NULL CHECK (source_type IN ('campaign_threshold', 'campaign_ranking', 'achievement', 'purchase')),
  source_id uuid, -- campaign_id if from campaign

  -- Display
  name text NOT NULL,
  description text,
  image_url text,

  -- Status
  is_equipped boolean DEFAULT false,

  -- Metadata
  obtained_at timestamptz DEFAULT now(),
  expires_at timestamptz, -- NULL = permanent

  -- Constraints
  UNIQUE(user_id, reward_type, reward_id, source_id)
);

-- Indexes
CREATE INDEX idx_user_rewards_user ON user_rewards(user_id);
CREATE INDEX idx_user_rewards_equipped ON user_rewards(user_id, is_equipped) WHERE is_equipped = true;
CREATE INDEX idx_user_rewards_active ON user_rewards(user_id) WHERE expires_at IS NULL OR expires_at > now();
```

## RPC Functions

### `join_campaign(campaign_id uuid)`
```sql
CREATE OR REPLACE FUNCTION join_campaign(p_campaign_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_campaign record;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();

  -- Check campaign exists and is active
  SELECT * INTO v_campaign FROM sponsored_campaigns
  WHERE id = p_campaign_id AND status = 'active'
    AND start_at <= now() AND end_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found or not active';
  END IF;

  -- Create or get participation
  INSERT INTO campaign_participations (campaign_id, user_id, first_battle_at)
  VALUES (p_campaign_id, v_user_id, now())
  ON CONFLICT (campaign_id, user_id) DO NOTHING;

  v_result := jsonb_build_object(
    'campaign_id', p_campaign_id,
    'user_id', v_user_id,
    'joined_at', now()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

### `record_campaign_battle_result(battle_id uuid)`
```sql
CREATE OR REPLACE FUNCTION record_campaign_battle_result(p_battle_id uuid)
RETURNS void AS $$
DECLARE
  v_campaign_battle record;
  v_battle record;
  v_winner_id uuid;
BEGIN
  -- Get campaign battle info
  SELECT * INTO v_campaign_battle FROM campaign_battles
  WHERE battle_id = p_battle_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Get battle result
  SELECT * INTO v_battle FROM battles WHERE id = p_battle_id;
  IF NOT FOUND OR v_battle.status != 'completed' THEN RETURN; END IF;

  v_winner_id := v_battle.winner_id;

  -- Update campaign_battles
  UPDATE campaign_battles SET
    winner_id = v_winner_id,
    status = 'completed',
    completed_at = now()
  WHERE battle_id = p_battle_id;

  -- Update participations for both users
  UPDATE campaign_participations SET
    total_battles = total_battles + 1,
    total_wins = total_wins + CASE WHEN user_id = v_winner_id THEN 1 ELSE 0 END,
    total_losses = total_losses + CASE WHEN user_id != v_winner_id THEN 1 ELSE 0 END,
    last_battle_at = now(),
    updated_at = now()
  WHERE campaign_id = v_campaign_battle.campaign_id
    AND user_id IN (v_campaign_battle.challenger_id, v_campaign_battle.opponent_id);

  -- Trigger reward check
  PERFORM check_and_grant_threshold_rewards(v_campaign_battle.campaign_id, v_winner_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

### `check_and_grant_threshold_rewards(campaign_id uuid, user_id uuid)`
```sql
CREATE OR REPLACE FUNCTION check_and_grant_threshold_rewards(
  p_campaign_id uuid,
  p_user_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_participation record;
  v_campaign record;
  v_reward jsonb;
  v_granted_rewards jsonb[] := ARRAY[]::jsonb[];
BEGIN
  -- Get participation
  SELECT * INTO v_participation FROM campaign_participations
  WHERE campaign_id = p_campaign_id AND user_id = p_user_id;

  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  -- Get campaign
  SELECT * INTO v_campaign FROM sponsored_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  -- Check each threshold reward
  FOR v_reward IN SELECT * FROM jsonb_array_elements(v_campaign.threshold_rewards)
  LOOP
    -- Check if wins threshold met and not already claimed
    IF v_participation.total_wins >= (v_reward->>'wins')::int
       AND NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(v_participation.threshold_rewards_claimed) claimed
         WHERE (claimed->>'wins')::int = (v_reward->>'wins')::int
       )
    THEN
      -- Grant rewards
      IF v_reward ? 'badge_id' THEN
        INSERT INTO user_rewards (user_id, reward_type, reward_id, source_type, source_id, name)
        VALUES (p_user_id, 'badge', v_reward->>'badge_id', 'campaign_threshold', p_campaign_id, v_campaign.sponsor_name || ' Badge')
        ON CONFLICT (user_id, reward_type, reward_id, source_id) DO NOTHING;
      END IF;

      -- Mark as claimed
      UPDATE campaign_participations SET
        threshold_rewards_claimed = threshold_rewards_claimed || jsonb_build_object('wins', v_reward->>'wins', 'claimed_at', now()),
        updated_at = now()
      WHERE campaign_id = p_campaign_id AND user_id = p_user_id;

      v_granted_rewards := array_append(v_granted_rewards, v_reward);
    END IF;
  END LOOP;

  RETURN to_jsonb(v_granted_rewards);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

### `calculate_campaign_rankings(campaign_id uuid)`
```sql
CREATE OR REPLACE FUNCTION calculate_campaign_rankings(p_campaign_id uuid)
RETURNS void AS $$
BEGIN
  -- Update rankings based on total_wins DESC, updated_at ASC (tie-breaker)
  WITH ranked AS (
    SELECT
      user_id,
      ROW_NUMBER() OVER (ORDER BY total_wins DESC, updated_at ASC) as new_rank
    FROM campaign_participations
    WHERE campaign_id = p_campaign_id AND total_wins > 0
  )
  UPDATE campaign_participations p SET
    current_rank = r.new_rank,
    last_rank_update = now()
  FROM ranked r
  WHERE p.campaign_id = p_campaign_id AND p.user_id = r.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

## RLS Policies

```sql
-- sponsored_campaigns: Public read for active campaigns
ALTER TABLE sponsored_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active campaigns"
  ON sponsored_campaigns FOR SELECT
  USING (status = 'active' AND start_at <= now() AND end_at > now());

-- campaign_participations: Users can view their own and public leaderboard
ALTER TABLE campaign_participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own participation"
  ON campaign_participations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Public can view leaderboard"
  ON campaign_participations FOR SELECT
  USING (current_rank IS NOT NULL AND current_rank <= 100);

-- campaign_battles: Users can view their own battles
ALTER TABLE campaign_battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campaign battles"
  ON campaign_battles FOR SELECT
  USING (auth.uid() IN (challenger_id, opponent_id));

-- user_rewards: Users can view their own rewards
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rewards"
  ON user_rewards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their equipped status"
  ON user_rewards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

## Triggers

```sql
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON sponsored_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_participations_updated_at
  BEFORE UPDATE ON campaign_participations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```
