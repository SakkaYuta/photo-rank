-- PhotoRank v0.5 functions

-- Acquire work lock
CREATE OR REPLACE FUNCTION public.acquire_work_lock(p_work_id uuid, p_user_id uuid)
RETURNS boolean AS $$
DECLARE v_locked boolean;
BEGIN
  UPDATE public.work_availability
  SET locked_until = now() + interval '5 minutes', updated_at = now()
  WHERE work_id = p_work_id
    AND is_available = true
    AND (locked_until IS NULL OR locked_until < now())
    AND (max_sales IS NULL OR current_sales < max_sales)
  RETURNING true INTO v_locked;

  RETURN COALESCE(v_locked, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Release work lock
CREATE OR REPLACE FUNCTION public.release_work_lock(p_work_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.work_availability
  SET locked_until = NULL, updated_at = now()
  WHERE work_id = p_work_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Confirm work sale (increments current_sales and closes availability if reached)
CREATE OR REPLACE FUNCTION public.confirm_work_sale(p_work_id uuid, p_amount integer)
RETURNS boolean AS $$
DECLARE v_ok boolean;
BEGIN
  UPDATE public.work_availability wa
  SET current_sales = wa.current_sales + 1,
      is_available = CASE
        WHEN wa.max_sales IS NOT NULL AND (wa.current_sales + 1) >= wa.max_sales THEN false
        ELSE wa.is_available
      END,
      locked_until = NULL,
      updated_at = now()
  WHERE wa.work_id = p_work_id
    AND (wa.max_sales IS NULL OR wa.current_sales < wa.max_sales)
  RETURNING true INTO v_ok;

  RETURN COALESCE(v_ok, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Handle new user (profile bootstrap)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Monthly payouts generation (simplified)
CREATE OR REPLACE FUNCTION public.generate_monthly_payouts()
RETURNS void AS $$
DECLARE v_user RECORD; v_rev RECORD; v_month date;
BEGIN
  v_month := date_trunc('month', CURRENT_DATE - interval '1 month');
  FOR v_user IN
    SELECT DISTINCT u.id FROM public.users u
    WHERE EXISTS (SELECT 1 FROM public.payout_accounts pa WHERE pa.user_id = u.id AND pa.is_verified = true)
  LOOP
    SELECT COALESCE(SUM(price),0) AS gross INTO v_rev
    FROM public.purchases p
    JOIN public.works w ON w.id = p.work_id AND w.creator_id = v_user.id
    WHERE p.status = 'paid' AND p.purchased_at >= v_month AND p.purchased_at < (v_month + interval '1 month');

    IF COALESCE(v_rev.gross,0) > 5000 THEN
      INSERT INTO public.payouts (
        user_id, period_start, period_end, gross_amount, platform_fee, net_amount, status
      ) VALUES (
        v_user.id,
        v_month,
        (date_trunc('month', CURRENT_DATE) - interval '1 day')::date,
        v_rev.gross,
        ROUND(v_rev.gross * 0.15),
        v_rev.gross - ROUND(v_rev.gross * 0.15),
        'pending'
      );
    END IF;
  END LOOP;
END; $$ LANGUAGE plpgsql;

-- GDPR deletion (simplified anonymization)
CREATE OR REPLACE FUNCTION public.process_data_deletion()
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET display_name = 'Deleted User', avatar_url = NULL
  WHERE id IN (
    SELECT user_id FROM public.data_deletion_requests
    WHERE scheduled_for <= now() AND status = 'verified'
  );
END; $$ LANGUAGE plpgsql;
