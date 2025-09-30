-- Create battle_invitations table (idempotent) + RLS
CREATE TABLE IF NOT EXISTS public.battle_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid REFERENCES public.battles(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired','cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.battle_invitations ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_battle_invitations_updated ON public.battle_invitations;
CREATE TRIGGER trg_battle_invitations_updated BEFORE UPDATE ON public.battle_invitations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS policies
DROP POLICY IF EXISTS battle_invitations_owner_select ON public.battle_invitations;
CREATE POLICY battle_invitations_owner_select ON public.battle_invitations
  FOR SELECT USING (inviter_id = auth.uid() OR opponent_id = auth.uid());

DROP POLICY IF EXISTS battle_invitations_owner_insert ON public.battle_invitations;
CREATE POLICY battle_invitations_owner_insert ON public.battle_invitations
  FOR INSERT WITH CHECK (inviter_id = auth.uid());

DROP POLICY IF EXISTS battle_invitations_owner_update ON public.battle_invitations;
CREATE POLICY battle_invitations_owner_update ON public.battle_invitations
  FOR UPDATE USING (inviter_id = auth.uid() OR opponent_id = auth.uid());

-- Service role bypass
DROP POLICY IF EXISTS battle_invitations_service_all ON public.battle_invitations;
CREATE POLICY battle_invitations_service_all ON public.battle_invitations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_battle_invitations_inviter ON public.battle_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_battle_invitations_opponent ON public.battle_invitations(opponent_id);
CREATE INDEX IF NOT EXISTS idx_battle_invitations_battle ON public.battle_invitations(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_invitations_status ON public.battle_invitations(status);

