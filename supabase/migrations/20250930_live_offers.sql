-- Live Offers schema for battle/live-limited perks (signed or limited_design)

-- Create live_offers
CREATE TABLE IF NOT EXISTS public.live_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  live_event_id text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  price_override integer,
  currency text NOT NULL DEFAULT 'jpy',
  stock_total integer NOT NULL,
  stock_reserved integer NOT NULL DEFAULT 0,
  stock_sold integer NOT NULL DEFAULT 0,
  per_user_limit integer DEFAULT 1,
  perks_type text NOT NULL DEFAULT 'none' CHECK (perks_type IN ('none','signed','limited_design')),
  perks jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_preview_path text,
  variant_original_path text,
  variant_preview_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Updated at trigger (if helper exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname='public' AND p.proname='set_updated_at'
  ) THEN
    CREATE TRIGGER trigger_live_offers_updated_at
      BEFORE UPDATE ON public.live_offers
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Live reservations (short TTL to hold before payment)
CREATE TABLE IF NOT EXISTS public.live_offer_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_offer_id uuid NOT NULL REFERENCES public.live_offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(live_offer_id, user_id)
);

-- RLS
ALTER TABLE public.live_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_offer_reservations ENABLE ROW LEVEL SECURITY;

-- Select published + active window or service_role
DROP POLICY IF EXISTS live_offers_public_select ON public.live_offers;
CREATE POLICY live_offers_public_select ON public.live_offers
  FOR SELECT USING (
    (
      status = 'published' AND now() BETWEEN start_at AND end_at
    ) OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- Creator manage own offers (service_role bypasses via above)
DROP POLICY IF EXISTS live_offers_creator_all ON public.live_offers;
CREATE POLICY live_offers_creator_all ON public.live_offers
  FOR ALL USING (creator_id = auth.uid() OR (auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK (creator_id = auth.uid() OR (auth.jwt() ->> 'role') = 'service_role');

-- Reservations: only creator or owner (user) can select own rows; service_role bypasses
DROP POLICY IF EXISTS live_offer_reservations_owner_select ON public.live_offer_reservations;
CREATE POLICY live_offer_reservations_owner_select ON public.live_offer_reservations
  FOR SELECT USING (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS live_offer_reservations_owner_insert ON public.live_offer_reservations;
CREATE POLICY live_offer_reservations_owner_insert ON public.live_offer_reservations
  FOR INSERT WITH CHECK (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS live_offer_reservations_owner_delete ON public.live_offer_reservations;
CREATE POLICY live_offer_reservations_owner_delete ON public.live_offer_reservations
  FOR DELETE USING (user_id = auth.uid() OR (auth.jwt() ->> 'role') = 'service_role');

-- Helper functions for atomic reservations
CREATE OR REPLACE FUNCTION public.reserve_live_offer(
  p_live_offer_id uuid,
  p_user_id uuid,
  p_ttl_seconds integer DEFAULT 300
) RETURNS boolean AS $$
DECLARE
  v_offer public.live_offers%ROWTYPE;
  v_available integer;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_offer FROM public.live_offers WHERE id = p_live_offer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_offer.status <> 'published' OR v_now < v_offer.start_at OR v_now > v_offer.end_at THEN
    RETURN FALSE;
  END IF;

  -- clean expired reservations for this offer + user
  DELETE FROM public.live_offer_reservations
   WHERE live_offer_id = p_live_offer_id AND user_id = p_user_id AND expires_at <= v_now;

  -- enforce per-user limit roughly (count sold for this offer to user)
  IF v_offer.per_user_limit IS NOT NULL AND v_offer.per_user_limit > 0 THEN
    -- best-effort: count existing reservations + purchases by user for this offer if purchases has such link
    IF (
      (SELECT count(*) FROM public.live_offer_reservations r WHERE r.live_offer_id = p_live_offer_id AND r.user_id = p_user_id AND r.expires_at > v_now)
    ) >= v_offer.per_user_limit THEN
      RETURN FALSE;
    END IF;
  END IF;

  v_available := v_offer.stock_total - v_offer.stock_reserved - v_offer.stock_sold;
  IF v_available < 1 THEN RETURN FALSE; END IF;

  -- upsert reservation (extend TTL if exists)
  INSERT INTO public.live_offer_reservations(live_offer_id, user_id, expires_at)
  VALUES (p_live_offer_id, p_user_id, v_now + make_interval(secs => GREATEST(p_ttl_seconds, 60)))
  ON CONFLICT (live_offer_id, user_id) DO UPDATE
    SET expires_at = EXCLUDED.expires_at;

  UPDATE public.live_offers
     SET stock_reserved = stock_reserved + 1,
         updated_at = now()
   WHERE id = p_live_offer_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.release_live_offer(
  p_live_offer_id uuid,
  p_user_id uuid
) RETURNS boolean AS $$
DECLARE
  v_affected integer;
BEGIN
  -- remove one reservation row (if any)
  DELETE FROM public.live_offer_reservations
   WHERE id IN (
     SELECT id FROM public.live_offer_reservations
      WHERE live_offer_id = p_live_offer_id AND user_id = p_user_id
      ORDER BY created_at ASC
      LIMIT 1
   );

  -- decrease reserved but not below 0
  UPDATE public.live_offers
     SET stock_reserved = GREATEST(stock_reserved - 1, 0),
         updated_at = now()
   WHERE id = p_live_offer_id;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete purchase: decrease reserved (if any) and increase sold atomically
CREATE OR REPLACE FUNCTION public.complete_live_offer_purchase(
  p_live_offer_id uuid,
  p_user_id uuid,
  p_payment_intent_id text,
  p_amount integer,
  p_currency text
) RETURNS boolean AS $$
DECLARE
  v_offer public.live_offers%ROWTYPE;
BEGIN
  SELECT * INTO v_offer FROM public.live_offers WHERE id = p_live_offer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- finalize counts
  UPDATE public.live_offers
     SET stock_reserved = GREATEST(stock_reserved - 1, 0),
         stock_sold = stock_sold + 1,
         updated_at = now()
   WHERE id = p_live_offer_id;

  -- remove one reservation by this user if present (best-effort)
  DELETE FROM public.live_offer_reservations
   WHERE id IN (
     SELECT id FROM public.live_offer_reservations
      WHERE live_offer_id = p_live_offer_id AND user_id = p_user_id
      ORDER BY created_at ASC
      LIMIT 1
   );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

