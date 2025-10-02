-- Enforce per_user_limit on finalize and provide safe decrement RPC

-- Safe decrement helper
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Strengthen finalize with per_user_limit check (best-effort with purchases table)
CREATE OR REPLACE FUNCTION public.complete_live_offer_purchase(
  p_live_offer_id uuid,
  p_user_id uuid,
  p_payment_intent_id text,
  p_amount integer,
  p_currency text
) RETURNS boolean AS $$
DECLARE
  v_offer public.live_offers%ROWTYPE;
  v_user_purchases integer := 0;
BEGIN
  SELECT * INTO v_offer FROM public.live_offers WHERE id = p_live_offer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- optional: enforce per-user limit using purchases table if available
  BEGIN
    IF v_offer.per_user_limit IS NOT NULL AND v_offer.per_user_limit > 0 THEN
      -- Count previous purchases for same work by user (best-effort proxy)
      SELECT COUNT(*) INTO v_user_purchases
        FROM public.purchases pu
        WHERE pu.user_id = p_user_id AND pu.work_id = v_offer.work_id;
      IF v_user_purchases >= v_offer.per_user_limit THEN
        RETURN FALSE;
      END IF;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    -- purchases table not present; skip strict check
    NULL;
  END;

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

