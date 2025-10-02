-- Fix function search_path security warnings
-- Sets immutable search_path for SECURITY DEFINER functions to prevent privilege escalation

-- 1. Fix finalize_live_offer_transaction
CREATE OR REPLACE FUNCTION public.finalize_live_offer_transaction(
  p_live_offer_id uuid,
  p_user_id uuid,
  p_payment_intent_id text,
  p_amount integer,
  p_currency text DEFAULT 'jpy'
) RETURNS TABLE(purchase_id uuid) AS $$
DECLARE
  v_offer public.live_offers%ROWTYPE;
  v_user_purchases integer := 0;
  v_price integer := COALESCE(p_amount, 0);
  v_purchase_id uuid;
BEGIN
  -- Lock offer row
  SELECT * INTO v_offer FROM public.live_offers WHERE id = p_live_offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer not found'; END IF;

  -- Active window + published check
  IF v_offer.status <> 'published' OR now() < v_offer.start_at OR now() > v_offer.end_at THEN
    RAISE EXCEPTION 'offer not active';
  END IF;

  -- Per-user limit strict check (using purchases.live_offer_id if present)
  BEGIN
    IF v_offer.per_user_limit IS NOT NULL AND v_offer.per_user_limit > 0 THEN
      SELECT COUNT(*) INTO v_user_purchases
        FROM public.purchases pu
        WHERE pu.user_id = p_user_id
          AND (pu.live_offer_id = p_live_offer_id OR pu.work_id = v_offer.work_id); -- fallback by work
      IF v_user_purchases >= v_offer.per_user_limit THEN
        RAISE EXCEPTION 'per_user_limit reached';
      END IF;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    -- fallback: skip strict check
    NULL;
  END;

  -- Ensure availability
  IF (v_offer.stock_total - v_offer.stock_reserved - v_offer.stock_sold) < 1 THEN
    RAISE EXCEPTION 'sold out';
  END IF;

  -- Insert purchase row
  INSERT INTO public.purchases (
    user_id, work_id, price, purchased_at, status, stripe_payment_intent_id, amount, created_at, live_offer_id
  ) VALUES (
    p_user_id, v_offer.work_id, v_price, now(), 'confirmed', p_payment_intent_id, p_amount, now(), p_live_offer_id
  ) RETURNING id INTO v_purchase_id;

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

  purchase_id := v_purchase_id;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Fix decrement_reserved_safely
CREATE OR REPLACE FUNCTION public.decrement_reserved_safely(
  p_live_offer_id uuid,
  p_count integer
) RETURNS void AS $$
BEGIN
  UPDATE public.live_offers
     SET stock_reserved = GREATEST(stock_reserved - GREATEST(p_count, 0), 0),
         updated_at = now()
   WHERE id = p_live_offer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Enable leaked password protection in Auth settings
-- Note: This must be enabled via Supabase Dashboard or API
-- Dashboard: Authentication > Providers > Email > Password Protection
-- Or via SQL (if supported):
-- UPDATE auth.config SET leaked_password_protection = true WHERE key = 'password_protection';
