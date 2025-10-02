
\restrict e3ThSMxI2Q0Cg8IKZwkz8aPfkcgajQBxPyHOlYjzMMFmHXBvLKYn3yn219kpYSY


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'Ensure function search_path hardened for security-sensitive functions';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_rate_limit_safe"("p_user_id" "uuid", "p_action" "text", "p_limit" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_current_hour integer;
  v_current_count integer := 0;
  v_stored_hour integer := 0;
BEGIN
  -- 現在の時間を数値化
  v_current_hour := EXTRACT(epoch FROM CURRENT_TIMESTAMP)::integer / 3600;
  
  -- 現在のレコード取得
  SELECT request_count, window_hour 
  INTO v_current_count, v_stored_hour
  FROM public.rate_limits
  WHERE user_id = p_user_id AND action_type = p_action;
  
  -- レコードが存在しないか、時間窓が違う場合はリセット
  IF v_stored_hour IS NULL OR v_stored_hour != v_current_hour THEN
    INSERT INTO public.rate_limits (
      user_id, action_type, request_count, window_hour, last_reset
    ) VALUES (
      p_user_id, p_action, 1, v_current_hour, CURRENT_TIMESTAMP
    ) ON CONFLICT (user_id, action_type) DO UPDATE SET
      request_count = 1,
      window_hour = v_current_hour,
      last_reset = CURRENT_TIMESTAMP;
    RETURN true;
  END IF;
  
  -- 制限チェック
  IF v_current_count >= p_limit THEN
    RETURN false;
  END IF;
  
  -- カウント増加
  UPDATE public.rate_limits
  SET request_count = request_count + 1
  WHERE user_id = p_user_id AND action_type = p_action;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."check_rate_limit_safe"("p_user_id" "uuid", "p_action" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_live_offer_purchase"("p_live_offer_id" "uuid", "p_user_id" "uuid", "p_payment_intent_id" "text", "p_amount" integer, "p_currency" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_offer public.live_offers%rowtype;
begin
  select * into v_offer from public.live_offers where id = p_live_offer_id for update;
  if not found then return false; end if;

  -- finalize counts
  update public.live_offers
     set stock_reserved = greatest(stock_reserved - 1, 0),
         stock_sold = stock_sold + 1,
         updated_at = now()
   where id = p_live_offer_id;

  -- remove one reservation by this user if present (best-effort)
  delete from public.live_offer_reservations
   where id in (
     select id from public.live_offer_reservations
      where live_offer_id = p_live_offer_id and user_id = p_user_id
      order by created_at asc
      limit 1
   );

  return true;
end;
$$;


ALTER FUNCTION "public"."complete_live_offer_purchase"("p_live_offer_id" "uuid", "p_user_id" "uuid", "p_payment_intent_id" "text", "p_amount" integer, "p_currency" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_purchase_transaction"("p_payment_intent_id" "text", "p_user_id" "uuid", "p_work_id" "uuid", "p_amount" integer, "p_currency" "text" DEFAULT 'jpy'::"text", "p_order_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_purchase_id UUID;
  v_order_number TEXT;
  v_use_amount BOOLEAN;
BEGIN
  -- カラムの存在確認（amountかpriceか）
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchases' AND column_name = 'amount'
  ) INTO v_use_amount;
  
  -- 冪等性チェック
  SELECT id INTO v_purchase_id
  FROM purchases
  WHERE stripe_payment_intent_id = p_payment_intent_id;
  
  IF v_purchase_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'purchase_id', v_purchase_id, 
      'already_exists', true
    );
  END IF;

  -- 購入記録を作成（amountまたはpriceを使用）
  IF v_use_amount THEN
    INSERT INTO purchases (
      user_id,
      work_id,
      amount,
      currency,
      status,
      stripe_payment_intent_id,
      created_at
    ) VALUES (
      p_user_id,
      p_work_id,
      p_amount,
      p_currency,
      'completed',
      p_payment_intent_id,
      NOW()
    )
    RETURNING id INTO v_purchase_id;
  ELSE
    -- 旧スキーマの場合はpriceカラムを使用
    INSERT INTO purchases (
      user_id,
      work_id,
      price,
      status,
      stripe_payment_intent_id,
      created_at
    ) VALUES (
      p_user_id,
      p_work_id,
      p_amount,
      'completed',
      p_payment_intent_id,
      NOW()
    )
    RETURNING id INTO v_purchase_id;
  END IF;

  -- 在庫を確定（既存のRPC関数を呼び出し）
  PERFORM confirm_work_sale(p_work_id, p_user_id);

  -- 製造発注のステータス更新（存在する場合）
  IF p_order_id IS NOT NULL THEN
    UPDATE manufacturing_orders
    SET 
      status = 'accepted',
      assigned_at = NOW(),
      payment_confirmed_at = NOW()
    WHERE id = p_order_id
      AND status = 'submitted'
    RETURNING order_number INTO v_order_number;
  END IF;

  -- 成功を返す
  RETURN json_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'order_updated', p_order_id IS NOT NULL,
    'order_number', v_order_number
  );
END;
$$;


ALTER FUNCTION "public"."complete_purchase_transaction"("p_payment_intent_id" "text", "p_user_id" "uuid", "p_work_id" "uuid", "p_amount" integer, "p_currency" "text", "p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_role_is_service_role"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
SELECT coalesce(current_setting('request.jwt.claims', true)::jsonb ->>
'role','') = 'service_role'
$$;


ALTER FUNCTION "public"."current_role_is_service_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_reserved_safely"("p_live_offer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  update public.live_offers
     set stock_reserved = greatest(stock_reserved - 1, 0),
         updated_at = now()
   where id = p_live_offer_id;
end;
$$;


ALTER FUNCTION "public"."decrement_reserved_safely"("p_live_offer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_reserved_safely"("p_live_offer_id" "uuid", "p_count" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  UPDATE public.live_offers
     SET stock_reserved = GREATEST(stock_reserved - GREATEST(p_count, 0), 0),
         updated_at = now()
   WHERE id = p_live_offer_id;
END;
$$;


ALTER FUNCTION "public"."decrement_reserved_safely"("p_live_offer_id" "uuid", "p_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_public_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  DELETE FROM public.user_public_profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."delete_user_public_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_rate_limit"("p_key" "text", "p_limit" integer, "p_window_seconds" integer, "p_cost" integer DEFAULT 1) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_now timestamptz := now();
  v_allowed boolean := false;
  v_row public.rate_limits;
begin
  if p_limit is null or p_limit <= 0 then
    return true; -- unlimited
  end if;

  -- Lock row if present to avoid races
  perform 1 from public.rate_limits where key = p_key for update;

  select * into v_row from public.rate_limits where key = p_key;

  if v_row is null then
    insert into public.rate_limits(key, count, window_started_at, updated_at)
      values (p_key, p_cost, v_now, v_now);
    v_allowed := true;
  else
    if v_row.window_started_at + make_interval(secs := p_window_seconds) <= v_now then
      update public.rate_limits
        set count = p_cost,
            window_started_at = v_now,
            updated_at = v_now
        where key = p_key;
      v_allowed := true;
    else
      if v_row.count + p_cost <= p_limit then
        update public.rate_limits
          set count = v_row.count + p_cost,
              updated_at = v_now
          where key = p_key;
        v_allowed := true;
      else
        update public.rate_limits set updated_at = v_now where key = p_key;
        v_allowed := false;
      end if;
    end if;
  end if;

  return v_allowed;
end;
$$;


ALTER FUNCTION "public"."enforce_rate_limit"("p_key" "text", "p_limit" integer, "p_window_seconds" integer, "p_cost" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_storage_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
INSERT INTO public.storage_cleanup_queue(scope, bucket, prefix)
VALUES ('work', 'photos-original', 'works/' || OLD.creator_id || '/' ||
OLD.id);

INSERT INTO public.storage_cleanup_queue(scope, bucket, prefix)
VALUES ('work', 'photos-watermarked', 'works/' || OLD.creator_id || '/' ||
OLD.id);

INSERT INTO public.storage_cleanup_queue(scope, bucket, prefix)
VALUES ('work', 'product-derivatives', 'thumbnails/works/' || OLD.id);

RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."enqueue_storage_cleanup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_partner_shipping_info"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
DECLARE
  s jsonb;
  fee_txt text;
BEGIN
  -- Fetch partner's shipping_info
  SELECT shipping_info INTO s
  FROM public.manufacturing_partners
  WHERE id = NEW.partner_id;

  -- Basic presence checks
  IF s IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'shipping_info must be set on manufacturing_partners before registering products.';
  END IF;

  -- Required text fields: method_title, carrier_name
  IF NULLIF(COALESCE(s->>'method_title',''), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'shipping_info.method_title is required.';
  END IF;
  IF NULLIF(COALESCE(s->>'carrier_name',''), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'shipping_info.carrier_name is required.';
  END IF;

  -- Required numeric field: fee_general_jpy (non-negative integer)
  IF NOT (s ? 'fee_general_jpy') THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'shipping_info.fee_general_jpy is required.';
  END IF;
  fee_txt := s->>'fee_general_jpy';
  IF fee_txt IS NULL OR NOT (fee_txt ~ '^[0-9]+$') OR fee_txt::bigint < 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'shipping_info.fee_general_jpy must be a non-negative integer.';
  END IF;

  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."ensure_partner_shipping_info"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ensure_partner_shipping_info"() IS 'Blocks factory_products insert/update when partner.shipping_info (method_title, carrier_name, fee_general_jpy) is missing or invalid.';



CREATE OR REPLACE FUNCTION "public"."finalize_live_offer_transaction"("p_live_offer_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_offer public.live_offers%rowtype;
begin
  select * into v_offer from public.live_offers where id = p_live_offer_id for update;
  if not found then return false; end if;

  update public.live_offers
     set stock_reserved = greatest(stock_reserved - 1, 0),
         stock_sold = stock_sold + 1,
         updated_at = now()
   where id = p_live_offer_id;

  delete from public.live_offer_reservations
   where id in (
     select id from public.live_offer_reservations
      where live_offer_id = p_live_offer_id and user_id = p_user_id
      order by created_at asc
      limit 1
   );

  return true;
end;
$$;


ALTER FUNCTION "public"."finalize_live_offer_transaction"("p_live_offer_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_live_offer_transaction"("p_live_offer_id" "uuid", "p_user_id" "uuid", "p_payment_intent_id" "text", "p_amount" integer, "p_currency" "text" DEFAULT 'jpy'::"text") RETURNS TABLE("purchase_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."finalize_live_offer_transaction"("p_live_offer_id" "uuid", "p_user_id" "uuid", "p_payment_intent_id" "text", "p_amount" integer, "p_currency" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_monthly_payouts_v50"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE 
  v_user RECORD; 
  v_earnings RECORD; 
  v_month_start date;
  v_month_end date;
  v_gross_amount integer;
  v_organizer_fee integer := 0;
  v_transfer_fee integer := 250; -- 振込手数料
  v_net_amount integer;
  v_min_threshold integer := 5000; -- 最低支払額
BEGIN
  -- 前月の期間設定
  v_month_start := date_trunc('month', CURRENT_DATE - interval '1 month')::date;
  v_month_end := (date_trunc('month', CURRENT_DATE) - interval '1 day')::date;
  
  -- 支払い条件を満たすクリエイター毎に処理
  FOR v_user IN
    SELECT DISTINCT 
      ce.creator_id,
      ce.organizer_id,
      u.display_name as creator_name
    FROM public.creator_earnings_v50 ce
    JOIN public.users u ON u.id = ce.creator_id
    WHERE ce.purchased_at >= v_month_start 
      AND ce.purchased_at <= v_month_end
      AND ce.creator_profit > 0
      AND EXISTS (
        SELECT 1 FROM public.payout_accounts pa 
        WHERE pa.user_id = ce.creator_id 
          AND pa.is_verified = true 
          AND pa.is_default = true
      )
  LOOP
    -- 月間売上集計
    SELECT 
      COALESCE(SUM(creator_profit), 0) as gross_amount
    INTO v_earnings
    FROM public.creator_earnings_v50 ce
    WHERE ce.creator_id = v_user.creator_id
      AND ce.purchased_at >= v_month_start 
      AND ce.purchased_at <= v_month_end;

    v_gross_amount := v_earnings.gross_amount;
    
    -- オーガナイザー手数料計算（所属クリエイターの場合）
    IF v_user.organizer_id IS NOT NULL THEN
      SELECT COALESCE(commission_rate, 10.0) INTO v_organizer_fee
      FROM public.creator_organizer_contracts coc
      WHERE coc.creator_id = v_user.creator_id 
        AND coc.organizer_id = v_user.organizer_id
        AND coc.status = 'active'
      LIMIT 1;
      
      v_organizer_fee := ROUND(v_gross_amount * (v_organizer_fee / 100.0));
    END IF;
    
    v_net_amount := v_gross_amount - v_organizer_fee - v_transfer_fee;
    
    -- 最低支払額チェック
    IF v_net_amount >= v_min_threshold THEN
      -- payouts_v31テーブルに挿入
      INSERT INTO public.payouts_v31 (
        recipient_id,
        recipient_type,
        period_start,
        period_end,
        gross_revenue,
        organizer_fee,
        transfer_fee,
        final_payout,
        status,
        scheduled_date,
        breakdown,
        created_at
      ) VALUES (
        v_user.creator_id,
        CASE WHEN v_user.organizer_id IS NOT NULL THEN 'creator_org' ELSE 'creator' END,
        v_month_start,
        v_month_end,
        v_gross_amount,
        v_organizer_fee,
        v_transfer_fee,
        v_net_amount,
        'scheduled',
        -- 翌々月末支払い
        (date_trunc('month', CURRENT_DATE + interval '2 months') + interval '1 month - 1 day')::date,
        jsonb_build_object(
          'creator_id', v_user.creator_id,
          'creator_name', v_user.creator_name,
          'organizer_id', v_user.organizer_id,
          'month', v_month_start,
          'sales_count', (
            SELECT COUNT(*) FROM public.creator_earnings_v50 ce
            WHERE ce.creator_id = v_user.creator_id
              AND ce.purchased_at >= v_month_start 
              AND ce.purchased_at <= v_month_end
          )
        ),
        now()
      ) ON CONFLICT (recipient_id, period_start) DO NOTHING; -- 重複防止
      
      -- オーガナイザー分の支払いも生成
      IF v_user.organizer_id IS NOT NULL AND v_organizer_fee > v_transfer_fee THEN
        INSERT INTO public.payouts_v31 (
          recipient_id,
          recipient_type,
          period_start,
          period_end,
          gross_revenue,
          organizer_fee,
          transfer_fee,
          final_payout,
          status,
          scheduled_date,
          breakdown,
          created_at
        ) VALUES (
          v_user.organizer_id,
          'organizer',
          v_month_start,
          v_month_end,
          v_organizer_fee, -- オーガナイザーの粗利＝手数料
          0, -- オーガナイザー自体に追加手数料なし
          v_transfer_fee,
          v_organizer_fee - v_transfer_fee,
          'scheduled',
          (date_trunc('month', CURRENT_DATE + interval '2 months') + interval '1 month - 1 day')::date,
          jsonb_build_object(
            'organizer_id', v_user.organizer_id,
            'creator_id', v_user.creator_id,
            'creator_name', v_user.creator_name,
            'month', v_month_start,
            'commission_rate', v_organizer_fee
          ),
          now()
        ) ON CONFLICT (recipient_id, period_start) DO NOTHING;
      END IF;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."generate_monthly_payouts_v50"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_creator_monthly_summary"("p_creator_id" "uuid", "p_year" integer, "p_month" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_result jsonb;
  v_start_date date;
  v_end_date date;
BEGIN
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (date_trunc('month', v_start_date) + interval '1 month - 1 day')::date;
  
  SELECT jsonb_build_object(
    'creator_id', p_creator_id,
    'year', p_year,
    'month', p_month,
    'total_sales', COUNT(*),
    'gross_revenue', COALESCE(SUM(creator_profit), 0),
    'factory_payments', COALESCE(SUM(factory_payment), 0),
    'platform_fees', COALESCE(SUM(platform_total_revenue), 0),
    'works_sold', COUNT(DISTINCT work_id)
  ) INTO v_result
  FROM public.creator_earnings_v50
  WHERE creator_id = p_creator_id
    AND purchased_at >= v_start_date
    AND purchased_at <= v_end_date;
    
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_creator_monthly_summary"("p_creator_id" "uuid", "p_year" integer, "p_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_type"("user_uuid" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT user_type INTO result FROM users WHERE id = user_uuid;
  RETURN COALESCE(result, 'general');
END;
$$;


ALTER FUNCTION "public"."get_user_type"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("p_user" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
SELECT EXISTS(
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user
      AND (
        COALESCE(u.role, '') = 'admin'
        OR COALESCE(u.user_type, '') = 'admin'
      )
);
$$;


ALTER FUNCTION "public"."is_admin"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_safe"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = p_user_id AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin_safe"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_strict"("p_user" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_user
      AND (
        u.user_type = 'admin'
        OR (u.metadata ->> 'is_admin')::boolean IS TRUE
      )
)
$$;


ALTER FUNCTION "public"."is_admin_strict"("p_user" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin_strict"("p_user" "uuid") IS 'App-level admin check from
users.user_type/metadata';



CREATE OR REPLACE FUNCTION "public"."is_user_factory"("user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT is_factory INTO result FROM users WHERE id = user_uuid;
  RETURN COALESCE(result, false);
END;
$$;


ALTER FUNCTION "public"."is_user_factory"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_live_offer"("p_live_offer_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_affected integer;
begin
  -- remove one reservation row (if any)
  delete from public.live_offer_reservations
   where id in (
     select id from public.live_offer_reservations
      where live_offer_id = p_live_offer_id and user_id = p_user_id
      order by created_at asc
      limit 1
   );

  -- decrease reserved but not below 0
  update public.live_offers
     set stock_reserved = greatest(stock_reserved - 1, 0),
         updated_at = now()
   where id = p_live_offer_id;
  get diagnostics v_affected = row_count;
  return v_affected > 0;
end;
$$;


ALTER FUNCTION "public"."release_live_offer"("p_live_offer_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_live_offer"("p_live_offer_id" "uuid", "p_user_id" "uuid", "p_ttl_seconds" integer DEFAULT 300) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_offer public.live_offers%rowtype;
  v_available integer;
  v_now timestamptz := now();
begin
  select * into v_offer from public.live_offers where id = p_live_offer_id for update;
  if not found then return false; end if;
  if v_offer.status <> 'published' or v_now < v_offer.start_at or v_now > v_offer.end_at then
    return false;
  end if;

  -- clean expired reservations for this offer + user
  delete from public.live_offer_reservations
   where live_offer_id = p_live_offer_id and user_id = p_user_id and expires_at <= v_now;

  -- enforce per-user limit roughly (count sold for this offer to user)
  if v_offer.per_user_limit is not null and v_offer.per_user_limit > 0 then
    if (
      (select count(*) from public.live_offer_reservations r where r.live_offer_id = p_live_offer_id and r.user_id = p_user_id and r.expires_at > v_now)
    ) >= v_offer.per_user_limit then
      return false;
    end if;
  end if;

  v_available := v_offer.stock_total - v_offer.stock_reserved - v_offer.stock_sold;
  if v_available < 1 then return false; end if;

  -- upsert reservation (extend TTL if exists)
  insert into public.live_offer_reservations(live_offer_id, user_id, expires_at)
  values (p_live_offer_id, p_user_id, v_now + make_interval(secs => greatest(p_ttl_seconds, 60)))
  on conflict (live_offer_id, user_id) do update
    set expires_at = excluded.expires_at;

  update public.live_offers
     set stock_reserved = stock_reserved + 1,
         updated_at = now()
   where id = p_live_offer_id;

  return true;
end;
$$;


ALTER FUNCTION "public"."reserve_live_offer"("p_live_offer_id" "uuid", "p_user_id" "uuid", "p_ttl_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_work_availability"("p_work_id" "uuid", "p_quantity" integer DEFAULT 1) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  -- work_availabilityテーブルが存在する場合
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'work_availability'
  ) THEN
    UPDATE work_availability
    SET 
      available_quantity = available_quantity + p_quantity,
      updated_at = NOW()
    WHERE work_id = p_work_id;
  END IF;
  
  -- worksテーブルも更新
  UPDATE works
  SET 
    available_quantity = available_quantity + p_quantity,
    updated_at = NOW()
  WHERE id = p_work_id;
END;
$$;


ALTER FUNCTION "public"."restore_work_availability"("p_work_id" "uuid", "p_quantity" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sanitize_xml_safe"("p_text" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN '';
  END IF;
  
  RETURN replace(replace(replace(replace(replace(
    p_text,
    '&', '&amp;'),
    '<', '&lt;'),
    '>', '&gt;'),
    '"', '&quot;'),
    '''', '&apos;'
  );
END;
$$;


ALTER FUNCTION "public"."sanitize_xml_safe"("p_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_factory_preference"("p_category" "text", "p_partner_id" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  current jsonb;
  next jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT metadata INTO current FROM public.users WHERE id = uid;
  IF current IS NULL THEN current := '{}'::jsonb; END IF;

  next := jsonb_set(current, ARRAY['factory_preferences', p_category], to_jsonb(p_partner_id::text), true);

  UPDATE public.users SET metadata = next, updated_at = now() WHERE id = uid;
END;
$$;


ALTER FUNCTION "public"."set_factory_preference"("p_category" "text", "p_partner_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."simple_rate_check"("p_user_id" "uuid", "p_action" "text", "p_limit" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_current_count integer := 0;
  v_reset_time timestamptz;
BEGIN
  -- 現在のカウントと期限を取得
  SELECT request_count, reset_time 
  INTO v_current_count, v_reset_time
  FROM public.simple_rate_limits
  WHERE user_id = p_user_id AND action_type = p_action;
  
  -- レコードが存在しないか期限切れの場合
  IF v_reset_time IS NULL OR v_reset_time < CURRENT_TIMESTAMP THEN
    INSERT INTO public.simple_rate_limits (user_id, action_type, request_count, reset_time)
    VALUES (p_user_id, p_action, 1, CURRENT_TIMESTAMP + interval '1 hour')
    ON CONFLICT (user_id, action_type) DO UPDATE SET
      request_count = 1,
      reset_time = CURRENT_TIMESTAMP + interval '1 hour';
    RETURN true;
  END IF;
  
  -- 制限チェック
  IF v_current_count >= p_limit THEN
    RETURN false;
  END IF;
  
  -- カウント増加
  UPDATE public.simple_rate_limits
  SET request_count = request_count + 1
  WHERE user_id = p_user_id AND action_type = p_action;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."simple_rate_check"("p_user_id" "uuid", "p_action" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_public_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  INSERT INTO public.user_public_profiles (id, display_name, avatar_url, updated_at)
  VALUES (NEW.id, NEW.display_name, NEW.avatar_url, now())
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_public_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."use_free_cheer"("p_user_id" "uuid", "p_battle_id" "uuid", "p_limit" integer DEFAULT 30, "p_window_minutes" integer DEFAULT 60) RETURNS TABLE("allowed" boolean, "remaining" integer, "reset_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_used integer;
BEGIN
  IF p_limit <= 0 THEN
    RETURN QUERY SELECT false, 0, now() + (p_window_minutes || ' minutes')::interval;
    RETURN;
  END IF;

  v_window_start := date_trunc('minute', CURRENT_TIMESTAMP) - 
    (EXTRACT(minute FROM CURRENT_TIMESTAMP)::int % p_window_minutes) * interval '1 minute';
  v_reset_at := v_window_start + (p_window_minutes || ' minutes')::interval;

  LOOP
    -- Try insert a new window row
    BEGIN
      INSERT INTO public.cheer_free_counters(user_id, battle_id, window_start, window_minutes, used_count, reset_at)
      VALUES (p_user_id, p_battle_id, v_window_start, p_window_minutes, 1, v_reset_at);
      RETURN QUERY SELECT true, GREATEST(0, p_limit - 1), v_reset_at;
      RETURN;
    EXCEPTION WHEN unique_violation THEN
      -- Row exists; try to increment if below limit
      UPDATE public.cheer_free_counters
      SET used_count = used_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = p_user_id AND battle_id = p_battle_id AND window_start = v_window_start AND used_count < p_limit;
      IF FOUND THEN
        SELECT used_count INTO v_used FROM public.cheer_free_counters
        WHERE user_id = p_user_id AND battle_id = p_battle_id AND window_start = v_window_start;
        RETURN QUERY SELECT true, GREATEST(0, p_limit - v_used), v_reset_at;
        RETURN;
      ELSE
        -- Already at or over limit
        SELECT used_count INTO v_used FROM public.cheer_free_counters
        WHERE user_id = p_user_id AND battle_id = p_battle_id AND window_start = v_window_start;
        RETURN QUERY SELECT false, 0, v_reset_at;
        RETURN;
      END IF;
    END;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."use_free_cheer"("p_user_id" "uuid", "p_battle_id" "uuid", "p_limit" integer, "p_window_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_image_mime_safe"("p_content_type" "text", "p_file_signature" "bytea") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_signature_hex text;
BEGIN
  -- Content typeチェック
  IF p_content_type NOT IN ('image/jpeg', 'image/png', 'image/webp') THEN
    RETURN false;
  END IF;
  
  -- ファイル署名チェック
  v_signature_hex := encode(p_file_signature, 'hex');
  
  RETURN CASE p_content_type
    WHEN 'image/jpeg' THEN v_signature_hex LIKE 'ffd8ff%'
    WHEN 'image/png' THEN v_signature_hex LIKE '89504e47%'
    WHEN 'image/webp' THEN v_signature_hex LIKE '52494646%'
    ELSE false
  END;
END;
$$;


ALTER FUNCTION "public"."validate_image_mime_safe"("p_content_type" "text", "p_file_signature" "bytea") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."asset_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "decision" "text" NOT NULL,
    "reason" "text",
    "reviewed_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    CONSTRAINT "asset_approvals_decision_check" CHECK (("decision" = ANY (ARRAY['approved'::"text", 'rejected'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."asset_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asset_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pattern" "text" NOT NULL,
    "rule" "text" NOT NULL,
    "notes" "text",
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "asset_policies_rule_check" CHECK (("rule" = ANY (ARRAY['allow'::"text", 'deny'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."asset_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "table_name" "text",
    "record_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "severity" "text" DEFAULT 'info'::"text",
    "risk_score" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."battle_eligibility" (
    "user_id" "uuid" NOT NULL,
    "is_organizer_member" boolean DEFAULT false,
    "last_month_sales_count" integer DEFAULT 0,
    "is_eligible" boolean GENERATED ALWAYS AS (("is_organizer_member" OR ("last_month_sales_count" >= 10))) STORED,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."battle_eligibility" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."battle_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "battle_id" "uuid",
    "inviter_id" "uuid" NOT NULL,
    "opponent_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "battle_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."battle_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."battles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "challenger_id" "uuid" NOT NULL,
    "opponent_id" "uuid" NOT NULL,
    "duration_minutes" integer NOT NULL,
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "winner_id" "uuid",
    "winner_bonus_amount" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "overtime_count" integer DEFAULT 0,
    "title" "text",
    "description" "text",
    "visibility" "text" DEFAULT 'public'::"text",
    "requested_start_at" timestamp with time zone,
    "opponent_accepted" boolean,
    "opponent_response_reason" "text",
    "opponent_response_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancel_reason" "text",
    CONSTRAINT "battles_duration_minutes_check" CHECK (("duration_minutes" = ANY (ARRAY[5, 30, 60]))),
    CONSTRAINT "battles_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'live'::"text", 'finished'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "battles_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."battles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "work_id" "uuid",
    "quantity" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cart_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."cart_items" IS 'RLS enabled - users can only access their own cart items';



CREATE TABLE IF NOT EXISTS "public"."cheer_free_counters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "battle_id" "uuid" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "window_minutes" integer DEFAULT 60 NOT NULL,
    "used_count" integer DEFAULT 0 NOT NULL,
    "reset_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cheer_free_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cheer_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "battle_id" "uuid" NOT NULL,
    "supporter_id" "uuid" NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "amount" integer DEFAULT 100 NOT NULL,
    "has_signed_goods_right" boolean DEFAULT true,
    "has_exclusive_options" boolean DEFAULT true,
    "exclusive_options" "jsonb",
    "expires_at" timestamp with time zone,
    "purchased_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "cheer_tickets_amount_check" CHECK (("amount" > 0))
);


ALTER TABLE "public"."cheer_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "work_id" "uuid" NOT NULL,
    "price" integer NOT NULL,
    "status" "text" DEFAULT 'paid'::"text",
    "purchased_at" timestamp with time zone DEFAULT "now"(),
    "factory_payment" integer,
    "platform_markup" integer,
    "platform_sales_fee" integer,
    "platform_total_revenue" integer,
    "currency" "text" DEFAULT 'jpy'::"text",
    "stripe_payment_intent_id" "text",
    "amount" integer,
    "refunded_at" timestamp with time zone,
    "refund_amount" integer,
    "payment_method" "text",
    "payment_status" "text" DEFAULT 'requires_payment'::"text",
    "konbini_voucher_number" "text",
    "konbini_store" "text",
    "payment_due_at" timestamp with time zone,
    "payment_instructions" "jsonb",
    "refund_status" "text",
    "refund_requested_at" timestamp with time zone,
    "refund_processed_at" timestamp with time zone,
    "live_offer_id" "uuid",
    CONSTRAINT "purchases_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['requires_payment'::"text", 'processing'::"text", 'succeeded'::"text", 'canceled'::"text", 'failed'::"text", 'refunded'::"text"]))),
    CONSTRAINT "purchases_refund_status_check" CHECK (("refund_status" = ANY (ARRAY['requested'::"text", 'processing'::"text", 'refunded'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."purchases" OWNER TO "postgres";


COMMENT ON TABLE "public"."purchases" IS 'RLS enabled - users can only view their own purchases';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "role" "text" DEFAULT 'user'::"text",
    "organizer_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_creator" boolean DEFAULT false,
    "user_type" "text" DEFAULT 'general'::"text",
    "is_factory" boolean DEFAULT false,
    "email" "text",
    "is_verified" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "users_user_type_check" CHECK (("user_type" = ANY (ARRAY['general'::"text", 'creator'::"text", 'factory'::"text", 'organizer'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'Users table - Schema fixed for email column compatibility';



CREATE TABLE IF NOT EXISTS "public"."works" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "organizer_id" "uuid",
    "title" "text",
    "image_url" "text",
    "price" integer DEFAULT 0,
    "is_published" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT false,
    "category" "text",
    "description" "text",
    "tags" "text"[],
    "factory_id" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "sale_start_at" timestamp with time zone,
    "sale_end_at" timestamp with time zone,
    "image_urls" "jsonb",
    CONSTRAINT "sale_period_max_1y" CHECK ((("sale_start_at" IS NULL) OR ("sale_end_at" IS NULL) OR ("sale_end_at" <= ("sale_start_at" + '365 days'::interval)))),
    CONSTRAINT "works_image_urls_max10" CHECK ((("image_urls" IS NULL) OR (("jsonb_typeof"("image_urls") = 'array'::"text") AND ("jsonb_array_length"("image_urls") <= 10)))),
    CONSTRAINT "works_price_positive" CHECK (("price" > 0)),
    CONSTRAINT "works_sale_period_max_365d" CHECK ((("sale_start_at" IS NULL) OR ("sale_end_at" IS NULL) OR ("sale_end_at" <= ("sale_start_at" + '365 days'::interval))))
);


ALTER TABLE "public"."works" OWNER TO "postgres";


COMMENT ON TABLE "public"."works" IS 'Works table - Schema fixed for description and other columns compatibility';



COMMENT ON COLUMN "public"."works"."sale_start_at" IS 'Optional: sales start datetime';



COMMENT ON COLUMN "public"."works"."sale_end_at" IS 'Optional: sales end datetime';



COMMENT ON COLUMN "public"."works"."image_urls" IS 'Optional gallery of additional image URLs (max 10). Order is respected.';



CREATE OR REPLACE VIEW "public"."creator_earnings_v50" WITH ("security_invoker"='on') AS
 SELECT "p"."id" AS "purchase_id",
    "p"."work_id",
    "p"."user_id" AS "buyer_id",
    "w"."creator_id",
    "p"."price" AS "sale_price",
    COALESCE("p"."factory_payment", 0) AS "factory_payment",
    COALESCE("p"."platform_total_revenue", 0) AS "platform_total_revenue",
    (("p"."price" - COALESCE("p"."factory_payment", 0)) - COALESCE("p"."platform_total_revenue", 0)) AS "creator_profit",
    "p"."purchased_at",
    "p"."status",
    "w"."organizer_id",
    "u"."display_name" AS "creator_name"
   FROM (("public"."purchases" "p"
     JOIN "public"."works" "w" ON (("w"."id" = "p"."work_id")))
     JOIN "public"."users" "u" ON (("u"."id" = "w"."creator_id")))
  WHERE ("p"."status" = 'paid'::"text");


ALTER VIEW "public"."creator_earnings_v50" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."factory_product_mockups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "factory_product_id" "uuid" NOT NULL,
    "label" "text",
    "image_url" "text" NOT NULL,
    "geometry" "jsonb",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."factory_product_mockups" OWNER TO "postgres";


COMMENT ON TABLE "public"."factory_product_mockups" IS 'Factory-supplied base photos with geometry for product mockups';



COMMENT ON COLUMN "public"."factory_product_mockups"."geometry" IS 'JSON: {x,y,width,rotation,skewX,skewY,opacity,blendMode,maskUrl}';



CREATE TABLE IF NOT EXISTS "public"."factory_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid" NOT NULL,
    "product_type" "text" NOT NULL,
    "base_cost" integer NOT NULL,
    "lead_time_days" integer DEFAULT 7,
    "min_order_qty" integer DEFAULT 1,
    "options" "jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "minimum_quantity" integer DEFAULT 1,
    "maximum_quantity" integer DEFAULT 1000
);


ALTER TABLE "public"."factory_products" OWNER TO "postgres";


COMMENT ON TABLE "public"."factory_products" IS 'Factory products for partner listings (options jsonb holds merch attributes)';



COMMENT ON COLUMN "public"."factory_products"."options" IS 'JSONB: display_name, category, description, image_url, production_time, sizes[], colors[], materials, print_area, features[], is_recommended, discount_rate';



CREATE TABLE IF NOT EXISTS "public"."factory_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "company_name" "text" NOT NULL,
    "company_address" "text",
    "contact_person" "text",
    "business_license" "text",
    "production_capacity" integer,
    "specialties" "text"[],
    "min_order_quantity" integer,
    "lead_time_days" integer,
    "quality_certifications" "text"[],
    "equipment_list" "text"[],
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."factory_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "work_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


COMMENT ON TABLE "public"."favorites" IS 'RLS enabled - users can only access their own favorites';



CREATE TABLE IF NOT EXISTS "public"."idempotency_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "key" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval)
);


ALTER TABLE "public"."idempotency_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."live_offer_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "live_offer_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."live_offer_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."live_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_id" "uuid" NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "live_event_id" "text",
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "price_override" integer,
    "currency" "text" DEFAULT 'jpy'::"text" NOT NULL,
    "stock_total" integer NOT NULL,
    "stock_reserved" integer DEFAULT 0 NOT NULL,
    "stock_sold" integer DEFAULT 0 NOT NULL,
    "per_user_limit" integer DEFAULT 1,
    "perks_type" "text" DEFAULT 'none'::"text" NOT NULL,
    "perks" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "image_preview_path" "text",
    "variant_original_path" "text",
    "variant_preview_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "live_offers_perks_type_check" CHECK (("perks_type" = ANY (ARRAY['none'::"text", 'signed'::"text", 'limited_design'::"text"]))),
    CONSTRAINT "live_offers_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."live_offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manufacturing_order_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "manufacturing_order_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "manufacturing_order_status_history_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'accepted'::"text", 'in_production'::"text", 'shipped'::"text", 'cancelled'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."manufacturing_order_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manufacturing_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "text" NOT NULL,
    "partner_id" "uuid",
    "partner_order_id" "text",
    "request_payload" "jsonb",
    "response_payload" "jsonb",
    "status" "text" DEFAULT 'submitted'::"text",
    "assigned_at" timestamp with time zone,
    "shipped_at" timestamp with time zone,
    "tracking_number" "text",
    "creator_user_id" "uuid",
    "work_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "payment_confirmed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "refunded_at" timestamp with time zone,
    "factory_product_id" "uuid",
    "purchase_id" "uuid",
    CONSTRAINT "manufacturing_orders_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'accepted'::"text", 'in_production'::"text", 'shipped'::"text", 'cancelled'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."manufacturing_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."manufacturing_orders" IS 'RLS enabled - partner-based access control';



CREATE TABLE IF NOT EXISTS "public"."manufacturing_partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "company_name" "text",
    "contact_email" "text" NOT NULL,
    "contact_phone" "text",
    "address" "jsonb",
    "website_url" "text",
    "description" "text",
    "capabilities" "jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    "avg_rating" numeric(3,2) DEFAULT 0.0,
    "ratings_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "owner_user_id" "uuid",
    "webhook_url" "text",
    "webhook_secret" "text",
    "shipping_info" "jsonb",
    CONSTRAINT "manufacturing_partners_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."manufacturing_partners" OWNER TO "postgres";


COMMENT ON COLUMN "public"."manufacturing_partners"."shipping_info" IS 'JSONB: method_title, per_order_note, carrier_name, fee_general_jpy, fee_okinawa_jpy, eta_text, cautions[], split_title, split_desc, split_cautions[]';



CREATE TABLE IF NOT EXISTS "public"."online_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "source_url" "text" NOT NULL,
    "provider" "text",
    "title" "text",
    "author" "text",
    "content_hash" "text",
    "policy" "text" DEFAULT 'manual'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "preview_path" "text",
    "original_path" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "online_assets_policy_check" CHECK (("policy" = ANY (ARRAY['allow'::"text", 'deny'::"text", 'manual'::"text"]))),
    CONSTRAINT "online_assets_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."online_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_id" "uuid",
    "status" "text" NOT NULL,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "order_status_history_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'processing'::"text", 'shipped'::"text", 'delivered'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."order_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizer_leave_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "reason" "text",
    "effective_date" "date",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "organizer_leave_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."organizer_leave_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."organizer_leave_requests" IS 'Organizer-initiated requests to remove a creator; default effective at month-end.';



CREATE TABLE IF NOT EXISTS "public"."organizer_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "organization_name" "text" NOT NULL,
    "organization_type" "text",
    "website_url" "text",
    "social_media" "jsonb",
    "past_events" "text"[],
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organizer_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "company_type" "text",
    "tax_id" "text",
    "representative_name" "text",
    "contact_email" "text",
    "approval_mode" "text" DEFAULT 'manual'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organizers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partner_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "payload" "jsonb",
    "status" "text" DEFAULT 'queued'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sent_at" timestamp with time zone,
    "priority" "text" DEFAULT 'normal'::"text",
    "attempts" integer DEFAULT 0,
    "next_retry_at" timestamp with time zone,
    "response_code" integer,
    "response_body" "text",
    "error_message" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "partner_notifications_priority_check" CHECK (("priority" = ANY (ARRAY['high'::"text", 'normal'::"text", 'low'::"text"]))),
    CONSTRAINT "partner_notifications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'retry'::"text"])))
);


ALTER TABLE "public"."partner_notifications" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."partner_orders_view" WITH ("security_invoker"='on') AS
 SELECT "mo"."id",
    "mo"."order_id",
    "mo"."partner_id",
    "mo"."status",
    "mo"."created_at",
    "mo"."assigned_at",
    "mo"."shipped_at",
    "mo"."tracking_number",
    "mo"."factory_product_id",
    "mo"."work_id",
    "mo"."purchase_id",
    "fp"."product_type",
    "fp"."product_type" AS "product_name",
    "w"."title" AS "work_title",
    "w"."image_url" AS "work_image_url",
    "w"."creator_id",
    "cu"."display_name" AS "creator_name",
    "cu"."avatar_url" AS "creator_avatar",
    "p"."user_id" AS "customer_id",
    "uu"."display_name" AS "customer_name",
    "uu"."avatar_url" AS "customer_avatar"
   FROM ((((("public"."manufacturing_orders" "mo"
     LEFT JOIN "public"."factory_products" "fp" ON (("fp"."id" = "mo"."factory_product_id")))
     LEFT JOIN "public"."works" "w" ON (("w"."id" = "mo"."work_id")))
     LEFT JOIN "public"."users" "cu" ON (("cu"."id" = "w"."creator_id")))
     LEFT JOIN "public"."purchases" "p" ON (("p"."id" = "mo"."purchase_id")))
     LEFT JOIN "public"."users" "uu" ON (("uu"."id" = "p"."user_id")));


ALTER VIEW "public"."partner_orders_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partner_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid" NOT NULL,
    "author_user_id" "uuid" NOT NULL,
    "manufacturing_order_id" "uuid",
    "rating" integer NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "partner_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."partner_reviews" OWNER TO "postgres";


COMMENT ON TABLE "public"."partner_reviews" IS 'RLS enabled - authors can manage, public can view';



CREATE TABLE IF NOT EXISTS "public"."payment_failures" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "work_id" "uuid",
    "payment_intent_id" "text",
    "error_code" "text",
    "error_message" "text",
    "amount" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_failures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_status" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "payment_intent_id" "text" NOT NULL,
    "user_id" "uuid",
    "status" "text" NOT NULL,
    "client_secret" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payment_status_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'requires_action'::"text", 'succeeded'::"text", 'failed'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."payment_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payouts_v31" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_type" "text" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "gross_amount" integer NOT NULL,
    "platform_fee" integer NOT NULL,
    "net_amount" integer NOT NULL,
    "bank_transfer_fee" integer DEFAULT 250,
    "final_payout" integer NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text",
    "scheduled_date" "date" NOT NULL,
    "transaction_id" "text",
    "notes" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payouts_v31_recipient_type_check" CHECK (("recipient_type" = ANY (ARRAY['creator'::"text", 'organizer'::"text"])))
);


ALTER TABLE "public"."payouts_v31" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "factory_product_id" "uuid" NOT NULL,
    "old_base_cost" integer,
    "new_base_cost" integer NOT NULL,
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."price_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "product_type" "text" NOT NULL,
    "price" integer NOT NULL,
    "creator_margin" integer DEFAULT 0,
    "platform_fee" integer DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "products_creator_margin_check" CHECK (("creator_margin" >= 0)),
    CONSTRAINT "products_platform_fee_check" CHECK (("platform_fee" >= 0)),
    CONSTRAINT "products_price_check" CHECK (("price" >= 0)),
    CONSTRAINT "products_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'published'::"text", 'disabled'::"text"])))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."publishing_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_id" "uuid" NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "reviewer_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "rejection_reason" "text",
    "reviewed_at" timestamp with time zone,
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "publishing_approvals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."publishing_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "key" "text" NOT NULL,
    "count" integer DEFAULT 0 NOT NULL,
    "window_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


COMMENT ON TABLE "public"."rate_limits" IS 'Rate limit counters per arbitrary key (e.g., user:action)';



CREATE TABLE IF NOT EXISTS "public"."stripe_webhook_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "stripe_event_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "processed" boolean DEFAULT false,
    "processed_at" timestamp with time zone,
    "error" "text",
    "idempotency_key" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stripe_webhook_events" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."realtime_metrics" WITH ("security_invoker"='on') AS
 SELECT ( SELECT "count"(*) AS "count"
           FROM "public"."purchases"
          WHERE ("purchases"."purchased_at" >= ("now"() - '01:00:00'::interval))) AS "hourly_purchases",
    ( SELECT COALESCE("sum"("purchases"."price"), (0)::bigint) AS "coalesce"
           FROM "public"."purchases"
          WHERE ("purchases"."purchased_at" >= ("now"() - '01:00:00'::interval))) AS "hourly_revenue",
    NULL::bigint AS "active_locks",
    NULL::bigint AS "expired_locks",
    ( SELECT "count"(*) AS "count"
           FROM "public"."stripe_webhook_events"
          WHERE ("stripe_webhook_events"."created_at" >= ("now"() - '01:00:00'::interval))) AS "hourly_webhooks";


ALTER VIEW "public"."realtime_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refund_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "reason" "text",
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "admin_note" "text",
    CONSTRAINT "refund_requests_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'processing'::"text", 'refunded'::"text", 'rejected'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."refund_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_id" "uuid" NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "organizer_id" "uuid",
    "amount" integer NOT NULL,
    "platform_fee" integer NOT NULL,
    "net_amount" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schema_migrations" (
    "version" "text" NOT NULL,
    "executed_at" timestamp with time zone DEFAULT "now"(),
    "checksum" "text"
);


ALTER TABLE "public"."schema_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."simple_rate_limits" (
    "user_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "request_count" integer DEFAULT 1,
    "reset_time" timestamp with time zone DEFAULT (CURRENT_TIMESTAMP + '01:00:00'::interval)
);


ALTER TABLE "public"."simple_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."storage_access_logs" (
    "id" bigint NOT NULL,
    "at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "bucket" "text" NOT NULL,
    "path" "text" NOT NULL,
    "ip" "text",
    "user_agent" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."storage_access_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."storage_access_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."storage_access_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."storage_access_logs_id_seq" OWNED BY "public"."storage_access_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."storage_cleanup_queue" (
    "id" bigint NOT NULL,
    "scope" "text" NOT NULL,
    "bucket" "text" NOT NULL,
    "prefix" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."storage_cleanup_queue" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."storage_cleanup_queue_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."storage_cleanup_queue_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."storage_cleanup_queue_id_seq" OWNED BY "public"."storage_cleanup_queue"."id";



CREATE TABLE IF NOT EXISTS "public"."user_account_extra" (
    "user_id" "uuid" NOT NULL,
    "gender" "text",
    "birthday" "date",
    "reasons" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_account_extra" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "postal_code" "text" NOT NULL,
    "prefecture" "text",
    "city" "text",
    "address1" "text" NOT NULL,
    "address2" "text",
    "phone" "text",
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_bank_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "bank_name" "text" NOT NULL,
    "branch_code" "text" NOT NULL,
    "account_number" "text" NOT NULL,
    "account_type" "text" NOT NULL,
    "account_holder_kana" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_bank_accounts_account_type_check" CHECK (("account_type" = ANY (ARRAY['普通'::"text", '当座'::"text"])))
);


ALTER TABLE "public"."user_bank_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_identities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_name" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name_kana" "text" NOT NULL,
    "first_name_kana" "text" NOT NULL,
    "birthday" "date" NOT NULL,
    "postal_code" "text",
    "prefecture" "text",
    "city" "text",
    "address1" "text",
    "address2" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_identities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_mfa" (
    "user_id" "uuid" NOT NULL,
    "secret" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "secret_enc" "text"
);


ALTER TABLE "public"."user_mfa" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notification_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email_notifications" boolean DEFAULT true,
    "order_updates" boolean DEFAULT true,
    "marketing_emails" boolean DEFAULT false,
    "push_notifications" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text",
    "message" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_privacy_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "profile_visibility" "text" DEFAULT 'public'::"text",
    "show_purchase_history" boolean DEFAULT false,
    "show_favorites" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_privacy_settings_profile_visibility_check" CHECK (("profile_visibility" = ANY (ARRAY['public'::"text", 'private'::"text", 'friends'::"text"])))
);


ALTER TABLE "public"."user_privacy_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_public_profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_public_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."works_metadata_backup" (
    "work_id" "uuid" NOT NULL,
    "metadata" "jsonb" NOT NULL,
    "backed_up_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."works_metadata_backup" OWNER TO "postgres";


COMMENT ON TABLE "public"."works_metadata_backup" IS 'Backup of works.metadata before removing deprecated model-related keys (product_model_id, variants, product_specs, shipping_profile).';



ALTER TABLE ONLY "public"."storage_access_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."storage_access_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."storage_cleanup_queue" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."storage_cleanup_queue_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."asset_approvals"
    ADD CONSTRAINT "asset_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asset_policies"
    ADD CONSTRAINT "asset_policies_pattern_key" UNIQUE ("pattern");



ALTER TABLE ONLY "public"."asset_policies"
    ADD CONSTRAINT "asset_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."battle_eligibility"
    ADD CONSTRAINT "battle_eligibility_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."battle_invitations"
    ADD CONSTRAINT "battle_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."battles"
    ADD CONSTRAINT "battles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_user_id_work_id_key" UNIQUE ("user_id", "work_id");



ALTER TABLE ONLY "public"."cheer_free_counters"
    ADD CONSTRAINT "cheer_free_counters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cheer_tickets"
    ADD CONSTRAINT "cheer_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."factory_product_mockups"
    ADD CONSTRAINT "factory_product_mockups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."factory_products"
    ADD CONSTRAINT "factory_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."factory_profiles"
    ADD CONSTRAINT "factory_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."factory_profiles"
    ADD CONSTRAINT "factory_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_work_id_key" UNIQUE ("user_id", "work_id");



ALTER TABLE ONLY "public"."idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_offer_reservations"
    ADD CONSTRAINT "live_offer_reservations_live_offer_id_user_id_key" UNIQUE ("live_offer_id", "user_id");



ALTER TABLE ONLY "public"."live_offer_reservations"
    ADD CONSTRAINT "live_offer_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_offers"
    ADD CONSTRAINT "live_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manufacturing_order_status_history"
    ADD CONSTRAINT "manufacturing_order_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manufacturing_orders"
    ADD CONSTRAINT "manufacturing_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manufacturing_partners"
    ADD CONSTRAINT "manufacturing_partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."online_assets"
    ADD CONSTRAINT "online_assets_content_hash_key" UNIQUE ("content_hash");



ALTER TABLE ONLY "public"."online_assets"
    ADD CONSTRAINT "online_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizer_leave_requests"
    ADD CONSTRAINT "organizer_leave_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizer_profiles"
    ADD CONSTRAINT "organizer_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizer_profiles"
    ADD CONSTRAINT "organizer_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."organizers"
    ADD CONSTRAINT "organizers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_notifications"
    ADD CONSTRAINT "partner_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_reviews"
    ADD CONSTRAINT "partner_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_failures"
    ADD CONSTRAINT "payment_failures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_status"
    ADD CONSTRAINT "payment_status_payment_intent_id_key" UNIQUE ("payment_intent_id");



ALTER TABLE ONLY "public"."payment_status"
    ADD CONSTRAINT "payment_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payouts_v31"
    ADD CONSTRAINT "payouts_v31_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."publishing_approvals"
    ADD CONSTRAINT "publishing_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "public"."simple_rate_limits"
    ADD CONSTRAINT "simple_rate_limits_pkey" PRIMARY KEY ("user_id", "action_type");



ALTER TABLE ONLY "public"."storage_access_logs"
    ADD CONSTRAINT "storage_access_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."storage_cleanup_queue"
    ADD CONSTRAINT "storage_cleanup_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_stripe_event_id_key" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."user_account_extra"
    ADD CONSTRAINT "user_account_extra_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_addresses"
    ADD CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_bank_accounts"
    ADD CONSTRAINT "user_bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_identities"
    ADD CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_mfa"
    ADD CONSTRAINT "user_mfa_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_notification_settings"
    ADD CONSTRAINT "user_notification_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_privacy_settings"
    ADD CONSTRAINT "user_privacy_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_public_profiles"
    ADD CONSTRAINT "user_public_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."works_metadata_backup"
    ADD CONSTRAINT "works_metadata_backup_pkey" PRIMARY KEY ("work_id");



ALTER TABLE ONLY "public"."works"
    ADD CONSTRAINT "works_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_asset_approvals_asset" ON "public"."asset_approvals" USING "btree" ("asset_id", "reviewed_at" DESC);



CREATE INDEX "idx_audit_logs_created" ON "public"."audit_logs" USING "btree" ("created_at");



CREATE INDEX "idx_audit_logs_severity" ON "public"."audit_logs" USING "btree" ("severity");



CREATE INDEX "idx_audit_logs_user" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_battle_invitations_battle" ON "public"."battle_invitations" USING "btree" ("battle_id");



CREATE INDEX "idx_battle_invitations_inviter" ON "public"."battle_invitations" USING "btree" ("inviter_id");



CREATE INDEX "idx_battle_invitations_opponent" ON "public"."battle_invitations" USING "btree" ("opponent_id");



CREATE INDEX "idx_battle_invitations_status" ON "public"."battle_invitations" USING "btree" ("status");



CREATE INDEX "idx_battles_participants" ON "public"."battles" USING "btree" ("challenger_id", "opponent_id");



CREATE INDEX "idx_battles_requested_start" ON "public"."battles" USING "btree" ("requested_start_at");



CREATE INDEX "idx_battles_start_time" ON "public"."battles" USING "btree" ("start_time");



CREATE INDEX "idx_battles_status" ON "public"."battles" USING "btree" ("status");



CREATE INDEX "idx_battles_status_start" ON "public"."battles" USING "btree" ("status", "start_time");



CREATE INDEX "idx_cart_items_user_id" ON "public"."cart_items" USING "btree" ("user_id");



CREATE INDEX "idx_cheer_free_counters_reset" ON "public"."cheer_free_counters" USING "btree" ("reset_at");



CREATE INDEX "idx_cheer_tickets_battle" ON "public"."cheer_tickets" USING "btree" ("battle_id");



CREATE INDEX "idx_cheer_tickets_supporter" ON "public"."cheer_tickets" USING "btree" ("supporter_id");



CREATE INDEX "idx_factory_products_partner" ON "public"."factory_products" USING "btree" ("partner_id", "is_active");



CREATE INDEX "idx_factory_products_partner_active" ON "public"."factory_products" USING "btree" ("partner_id", "is_active");



CREATE INDEX "idx_factory_profiles_user_id" ON "public"."factory_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_favorites_user_id" ON "public"."favorites" USING "btree" ("user_id");



CREATE INDEX "idx_fpm_active" ON "public"."factory_product_mockups" USING "btree" ("is_active");



CREATE INDEX "idx_fpm_factory" ON "public"."factory_product_mockups" USING "btree" ("factory_product_id");



CREATE INDEX "idx_idempotency_keys_expires" ON "public"."idempotency_keys" USING "btree" ("expires_at");



CREATE INDEX "idx_manufacturing_orders_partner" ON "public"."manufacturing_orders" USING "btree" ("partner_id");



CREATE INDEX "idx_manufacturing_orders_status" ON "public"."manufacturing_orders" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['submitted'::"text", 'accepted'::"text"]));



CREATE INDEX "idx_manufacturing_orders_work" ON "public"."manufacturing_orders" USING "btree" ("work_id");



CREATE INDEX "idx_mo_factory_product" ON "public"."manufacturing_orders" USING "btree" ("factory_product_id");



CREATE INDEX "idx_mo_partner" ON "public"."manufacturing_orders" USING "btree" ("partner_id");



CREATE INDEX "idx_mo_purchase" ON "public"."manufacturing_orders" USING "btree" ("purchase_id");



CREATE INDEX "idx_mo_work" ON "public"."manufacturing_orders" USING "btree" ("work_id");



CREATE INDEX "idx_mosh_order" ON "public"."manufacturing_order_status_history" USING "btree" ("manufacturing_order_id", "created_at");



CREATE INDEX "idx_online_assets_hash" ON "public"."online_assets" USING "btree" ("content_hash");



CREATE INDEX "idx_online_assets_owner" ON "public"."online_assets" USING "btree" ("owner_user_id");



CREATE INDEX "idx_online_assets_provider_status" ON "public"."online_assets" USING "btree" ("provider", "status");



CREATE INDEX "idx_order_status_history_purchase_id" ON "public"."order_status_history" USING "btree" ("purchase_id");



CREATE INDEX "idx_organizer_profiles_user_id" ON "public"."organizer_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_partner_reviews_author" ON "public"."partner_reviews" USING "btree" ("author_user_id");



CREATE INDEX "idx_partner_reviews_partner" ON "public"."partner_reviews" USING "btree" ("partner_id");



CREATE INDEX "idx_payment_failures_intent" ON "public"."payment_failures" USING "btree" ("payment_intent_id");



CREATE INDEX "idx_payment_failures_user" ON "public"."payment_failures" USING "btree" ("user_id");



CREATE INDEX "idx_payment_status_intent" ON "public"."payment_status" USING "btree" ("payment_intent_id");



CREATE INDEX "idx_payment_status_user" ON "public"."payment_status" USING "btree" ("user_id", "status");



CREATE INDEX "idx_payouts_v31_sched" ON "public"."payouts_v31" USING "btree" ("scheduled_date", "status");



CREATE INDEX "idx_products_creator" ON "public"."products" USING "btree" ("creator_id");



CREATE INDEX "idx_products_status" ON "public"."products" USING "btree" ("status");



CREATE INDEX "idx_purchases_live_offer_id" ON "public"."purchases" USING "btree" ("live_offer_id");



CREATE INDEX "idx_purchases_payment_intent" ON "public"."purchases" USING "btree" ("stripe_payment_intent_id");



CREATE UNIQUE INDEX "idx_purchases_payment_intent_unique" ON "public"."purchases" USING "btree" ("stripe_payment_intent_id") WHERE ("stripe_payment_intent_id" IS NOT NULL);



CREATE INDEX "idx_purchases_payment_status" ON "public"."purchases" USING "btree" ("payment_status");



CREATE UNIQUE INDEX "idx_purchases_pi_unique" ON "public"."purchases" USING "btree" (COALESCE("stripe_payment_intent_id", ''::"text")) WHERE ("stripe_payment_intent_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_purchases_pi_unique" IS 'Guarantees at most one purchase row per Stripe Payment Intent (NULLs allowed multiple times).';



CREATE INDEX "idx_purchases_user_id" ON "public"."purchases" USING "btree" ("user_id");



CREATE INDEX "idx_rate_limits_updated_at" ON "public"."rate_limits" USING "btree" ("updated_at");



CREATE INDEX "idx_refund_requests_user" ON "public"."refund_requests" USING "btree" ("user_id");



CREATE INDEX "idx_sales_created" ON "public"."sales" USING "btree" ("created_at");



CREATE UNIQUE INDEX "idx_stripe_events_event_id" ON "public"."stripe_webhook_events" USING "btree" ("stripe_event_id");



CREATE INDEX "idx_stripe_events_processed" ON "public"."stripe_webhook_events" USING "btree" ("processed", "type", "created_at");



CREATE INDEX "idx_stripe_events_type" ON "public"."stripe_webhook_events" USING "btree" ("type") WHERE ("processed" = false);



CREATE INDEX "idx_uba_user" ON "public"."user_bank_accounts" USING "btree" ("user_id");



CREATE INDEX "idx_uid_user" ON "public"."user_identities" USING "btree" ("user_id");



CREATE INDEX "idx_upp_updated_at" ON "public"."user_public_profiles" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_user_addresses_user_id" ON "public"."user_addresses" USING "btree" ("user_id");



CREATE INDEX "idx_user_notification_settings_user_id" ON "public"."user_notification_settings" USING "btree" ("user_id");



CREATE INDEX "idx_user_notifications_user" ON "public"."user_notifications" USING "btree" ("user_id", "read", "created_at" DESC);



CREATE INDEX "idx_user_privacy_settings_user_id" ON "public"."user_privacy_settings" USING "btree" ("user_id");



CREATE INDEX "idx_users_created_at" ON "public"."users" USING "btree" ("created_at");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_is_creator" ON "public"."users" USING "btree" ("is_creator");



CREATE INDEX "idx_users_is_factory" ON "public"."users" USING "btree" ("is_factory");



CREATE INDEX "idx_users_metadata" ON "public"."users" USING "gin" ("metadata");



CREATE INDEX "idx_users_user_type" ON "public"."users" USING "btree" ("user_type");



CREATE INDEX "idx_works_category" ON "public"."works" USING "btree" ("category");



CREATE INDEX "idx_works_created_at" ON "public"."works" USING "btree" ("created_at");



CREATE INDEX "idx_works_creator_id" ON "public"."works" USING "btree" ("creator_id");



CREATE INDEX "idx_works_is_active" ON "public"."works" USING "btree" ("is_active");



CREATE INDEX "idx_works_is_active_true" ON "public"."works" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_works_metadata" ON "public"."works" USING "gin" ("metadata");



CREATE INDEX "idx_works_price" ON "public"."works" USING "btree" ("price");



CREATE INDEX "idx_works_sale_end_at" ON "public"."works" USING "btree" ("sale_end_at");



CREATE INDEX "idx_works_sale_start_at" ON "public"."works" USING "btree" ("sale_start_at");



CREATE INDEX "idx_works_tags" ON "public"."works" USING "gin" ("tags");



CREATE INDEX "idx_works_title_trgm" ON "public"."works" USING "gin" ("title" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_works_updated_at" ON "public"."works" USING "btree" ("updated_at");



CREATE UNIQUE INDEX "uniq_cheer_free_counters_user_battle_window" ON "public"."cheer_free_counters" USING "btree" ("user_id", "battle_id", "window_start");



CREATE UNIQUE INDEX "uniq_favorites_user_work" ON "public"."favorites" USING "btree" ("user_id", "work_id");



CREATE UNIQUE INDEX "uniq_idempotency_keys_key_scope" ON "public"."idempotency_keys" USING "btree" ("key", "scope");



CREATE UNIQUE INDEX "ux_user_addresses_default_one_per_user" ON "public"."user_addresses" USING "btree" ("user_id") WHERE ("is_default" = true);



CREATE OR REPLACE TRIGGER "factory_products_require_shipping_info" BEFORE INSERT OR UPDATE ON "public"."factory_products" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_partner_shipping_info"();



CREATE OR REPLACE TRIGGER "set_refund_requests_updated_at" BEFORE UPDATE ON "public"."refund_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_fpm" BEFORE UPDATE ON "public"."factory_product_mockups" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_battle_invitations_updated" BEFORE UPDATE ON "public"."battle_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cleanup_work" AFTER DELETE ON "public"."works" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_storage_cleanup"();



CREATE OR REPLACE TRIGGER "trg_factory_products_updated" BEFORE UPDATE ON "public"."factory_products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_manufacturing_partners_updated" BEFORE UPDATE ON "public"."manufacturing_partners" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_online_assets_updated" BEFORE UPDATE ON "public"."online_assets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_products_updated" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_uba_updated" BEFORE UPDATE ON "public"."user_bank_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_uid_updated" BEFORE UPDATE ON "public"."user_identities" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_users_delete_public_profile" AFTER DELETE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."delete_user_public_profile"();



CREATE OR REPLACE TRIGGER "trg_users_sync_public_profile" AFTER INSERT OR UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_public_profile"();



CREATE OR REPLACE TRIGGER "trigger_live_offers_updated_at" BEFORE UPDATE ON "public"."live_offers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_manufacturing_orders_updated_at" BEFORE UPDATE ON "public"."manufacturing_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cart_items_updated_at" BEFORE UPDATE ON "public"."cart_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_factory_profiles_updated_at" BEFORE UPDATE ON "public"."factory_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organizer_profiles_updated_at" BEFORE UPDATE ON "public"."organizer_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_partner_notifications_updated_at" BEFORE UPDATE ON "public"."partner_notifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_payment_status_updated_at" BEFORE UPDATE ON "public"."payment_status" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stripe_webhook_events_updated_at" BEFORE UPDATE ON "public"."stripe_webhook_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_notification_settings_updated_at" BEFORE UPDATE ON "public"."user_notification_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_privacy_settings_updated_at" BEFORE UPDATE ON "public"."user_privacy_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_works_updated_at" BEFORE UPDATE ON "public"."works" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."asset_approvals"
    ADD CONSTRAINT "asset_approvals_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."online_assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asset_approvals"
    ADD CONSTRAINT "asset_approvals_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."asset_policies"
    ADD CONSTRAINT "asset_policies_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."battle_eligibility"
    ADD CONSTRAINT "battle_eligibility_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."battle_invitations"
    ADD CONSTRAINT "battle_invitations_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."battle_invitations"
    ADD CONSTRAINT "battle_invitations_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."battle_invitations"
    ADD CONSTRAINT "battle_invitations_opponent_id_fkey" FOREIGN KEY ("opponent_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."battles"
    ADD CONSTRAINT "battles_challenger_id_fkey" FOREIGN KEY ("challenger_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."battles"
    ADD CONSTRAINT "battles_opponent_id_fkey" FOREIGN KEY ("opponent_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."battles"
    ADD CONSTRAINT "battles_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cheer_free_counters"
    ADD CONSTRAINT "cheer_free_counters_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cheer_free_counters"
    ADD CONSTRAINT "cheer_free_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cheer_tickets"
    ADD CONSTRAINT "cheer_tickets_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cheer_tickets"
    ADD CONSTRAINT "cheer_tickets_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."cheer_tickets"
    ADD CONSTRAINT "cheer_tickets_supporter_id_fkey" FOREIGN KEY ("supporter_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."factory_product_mockups"
    ADD CONSTRAINT "factory_product_mockups_factory_product_id_fkey" FOREIGN KEY ("factory_product_id") REFERENCES "public"."factory_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."factory_products"
    ADD CONSTRAINT "factory_products_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."manufacturing_partners"("id");



ALTER TABLE ONLY "public"."factory_profiles"
    ADD CONSTRAINT "factory_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."live_offer_reservations"
    ADD CONSTRAINT "live_offer_reservations_live_offer_id_fkey" FOREIGN KEY ("live_offer_id") REFERENCES "public"."live_offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_offer_reservations"
    ADD CONSTRAINT "live_offer_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_offers"
    ADD CONSTRAINT "live_offers_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_offers"
    ADD CONSTRAINT "live_offers_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manufacturing_order_status_history"
    ADD CONSTRAINT "manufacturing_order_status_history_manufacturing_order_id_fkey" FOREIGN KEY ("manufacturing_order_id") REFERENCES "public"."manufacturing_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manufacturing_orders"
    ADD CONSTRAINT "manufacturing_orders_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."manufacturing_orders"
    ADD CONSTRAINT "manufacturing_orders_factory_product_id_fkey" FOREIGN KEY ("factory_product_id") REFERENCES "public"."factory_products"("id");



ALTER TABLE ONLY "public"."manufacturing_orders"
    ADD CONSTRAINT "manufacturing_orders_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."manufacturing_partners"("id");



ALTER TABLE ONLY "public"."manufacturing_orders"
    ADD CONSTRAINT "manufacturing_orders_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id");



ALTER TABLE ONLY "public"."manufacturing_orders"
    ADD CONSTRAINT "manufacturing_orders_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id");



ALTER TABLE ONLY "public"."manufacturing_partners"
    ADD CONSTRAINT "manufacturing_partners_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."online_assets"
    ADD CONSTRAINT "online_assets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_leave_requests"
    ADD CONSTRAINT "organizer_leave_requests_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_leave_requests"
    ADD CONSTRAINT "organizer_leave_requests_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_profiles"
    ADD CONSTRAINT "organizer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_notifications"
    ADD CONSTRAINT "partner_notifications_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."manufacturing_partners"("id");



ALTER TABLE ONLY "public"."partner_reviews"
    ADD CONSTRAINT "partner_reviews_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."partner_reviews"
    ADD CONSTRAINT "partner_reviews_manufacturing_order_id_fkey" FOREIGN KEY ("manufacturing_order_id") REFERENCES "public"."manufacturing_orders"("id");



ALTER TABLE ONLY "public"."partner_reviews"
    ADD CONSTRAINT "partner_reviews_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."manufacturing_partners"("id");



ALTER TABLE ONLY "public"."payment_failures"
    ADD CONSTRAINT "payment_failures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payment_failures"
    ADD CONSTRAINT "payment_failures_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id");



ALTER TABLE ONLY "public"."payment_status"
    ADD CONSTRAINT "payment_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_factory_product_id_fkey" FOREIGN KEY ("factory_product_id") REFERENCES "public"."factory_products"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."publishing_approvals"
    ADD CONSTRAINT "publishing_approvals_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id");



ALTER TABLE ONLY "public"."publishing_approvals"
    ADD CONSTRAINT "publishing_approvals_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."publishing_approvals"
    ADD CONSTRAINT "publishing_approvals_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_live_offer_id_fkey" FOREIGN KEY ("live_offer_id") REFERENCES "public"."live_offers"("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id");



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id");



ALTER TABLE ONLY "public"."user_account_extra"
    ADD CONSTRAINT "user_account_extra_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_addresses"
    ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_bank_accounts"
    ADD CONSTRAINT "user_bank_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_identities"
    ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_mfa"
    ADD CONSTRAINT "user_mfa_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notification_settings"
    ADD CONSTRAINT "user_notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_privacy_settings"
    ADD CONSTRAINT "user_privacy_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."works"
    ADD CONSTRAINT "works_creator_fk" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."works"
    ADD CONSTRAINT "works_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id");



CREATE POLICY "Admin only" ON "public"."partner_notifications" USING ("public"."is_admin_strict"("auth"."uid"()));



CREATE POLICY "Admin only" ON "public"."stripe_webhook_events" USING ("public"."is_admin_strict"("auth"."uid"()));



CREATE POLICY "Allow system idempotency keys" ON "public"."idempotency_keys" USING (("user_id" IS NULL));



CREATE POLICY "Creators can view own orders" ON "public"."manufacturing_orders" FOR SELECT USING ((("creator_user_id" = "auth"."uid"()) OR "public"."is_admin_strict"("auth"."uid"())));



CREATE POLICY "Factory users can manage their own profile" ON "public"."factory_profiles" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Organizer users can manage their own profile" ON "public"."organizer_profiles" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Partner owner can view notifications" ON "public"."partner_notifications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."manufacturing_partners" "mp"
  WHERE (("mp"."id" = "partner_notifications"."partner_id") AND ("mp"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Partners can update own orders" ON "public"."manufacturing_orders" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."manufacturing_partners" "mp"
  WHERE (("mp"."id" = "manufacturing_orders"."partner_id") AND ("mp"."owner_user_id" = "auth"."uid"())))) OR "public"."is_admin_strict"("auth"."uid"()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."manufacturing_partners" "mp"
  WHERE (("mp"."id" = "manufacturing_orders"."partner_id") AND ("mp"."owner_user_id" = "auth"."uid"())))) OR "public"."is_admin_strict"("auth"."uid"())));



CREATE POLICY "Partners can view own orders" ON "public"."manufacturing_orders" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."manufacturing_partners" "mp"
  WHERE (("mp"."id" = "manufacturing_orders"."partner_id") AND ("mp"."owner_user_id" = "auth"."uid"())))) OR "public"."is_admin_strict"("auth"."uid"())));



CREATE POLICY "Public can view verified factory profiles" ON "public"."factory_profiles" FOR SELECT USING (("verified" = true));



CREATE POLICY "Public can view verified organizer profiles" ON "public"."organizer_profiles" FOR SELECT USING (("verified" = true));



CREATE POLICY "Service role can manage rate limits" ON "public"."rate_limits" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "System can insert order status history" ON "public"."order_status_history" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can delete their own addresses" ON "public"."user_addresses" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own notification settings" ON "public"."user_notification_settings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own privacy settings" ON "public"."user_privacy_settings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own addresses" ON "public"."user_addresses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own cheer counters" ON "public"."cheer_free_counters" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own idempotency keys" ON "public"."idempotency_keys" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own notification settings" ON "public"."user_notification_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own privacy settings" ON "public"."user_privacy_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own addresses" ON "public"."user_addresses" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own cheer counters" ON "public"."cheer_free_counters" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notification settings" ON "public"."user_notification_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own privacy settings" ON "public"."user_privacy_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view order status for their purchases" ON "public"."order_status_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."purchases"
  WHERE (("purchases"."id" = "order_status_history"."purchase_id") AND ("purchases"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own failures" ON "public"."payment_failures" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own status" ON "public"."payment_status" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own addresses" ON "public"."user_addresses" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own cheer counters" ON "public"."cheer_free_counters" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own idempotency keys" ON "public"."idempotency_keys" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notification settings" ON "public"."user_notification_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own privacy settings" ON "public"."user_privacy_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."asset_approvals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "asset_approvals_locked" ON "public"."asset_approvals" USING (false) WITH CHECK (false);



ALTER TABLE "public"."asset_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "asset_policies_locked" ON "public"."asset_policies" USING (false) WITH CHECK (false);



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_admin_access" ON "public"."audit_logs" FOR SELECT USING ("public"."is_admin_safe"("auth"."uid"()));



ALTER TABLE "public"."battle_eligibility" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "battle_eligibility_self_select" ON "public"."battle_eligibility" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."battle_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "battle_invitations_owner_insert" ON "public"."battle_invitations" FOR INSERT WITH CHECK (("inviter_id" = "auth"."uid"()));



CREATE POLICY "battle_invitations_owner_select" ON "public"."battle_invitations" FOR SELECT USING ((("inviter_id" = "auth"."uid"()) OR ("opponent_id" = "auth"."uid"())));



CREATE POLICY "battle_invitations_owner_update" ON "public"."battle_invitations" FOR UPDATE USING ((("inviter_id" = "auth"."uid"()) OR ("opponent_id" = "auth"."uid"())));



CREATE POLICY "battle_invitations_service_all" ON "public"."battle_invitations" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



ALTER TABLE "public"."battles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "battles_insert_eligible" ON "public"."battles" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."battle_eligibility" "e"
  WHERE (("e"."user_id" = "auth"."uid"()) AND ("e"."is_eligible" = true)))));



CREATE POLICY "battles_owner_update" ON "public"."battles" FOR UPDATE USING ((("auth"."uid"() = "challenger_id") OR ("auth"."uid"() = "opponent_id"))) WITH CHECK (true);



CREATE POLICY "battles_participants_select" ON "public"."battles" FOR SELECT USING ((("auth"."uid"() = "challenger_id") OR ("auth"."uid"() = "opponent_id")));



ALTER TABLE "public"."cart_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cart_items_owner_all" ON "public"."cart_items" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."cheer_free_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cheer_tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cheer_tickets_insert_self" ON "public"."cheer_tickets" FOR INSERT WITH CHECK (("supporter_id" = "auth"."uid"()));



CREATE POLICY "cheer_tickets_self_select" ON "public"."cheer_tickets" FOR SELECT USING (("supporter_id" = "auth"."uid"()));



ALTER TABLE "public"."factory_product_mockups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."factory_products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "factory_products_owner_manage" ON "public"."factory_products" USING ((EXISTS ( SELECT 1
   FROM "public"."manufacturing_partners" "mp"
  WHERE (("mp"."id" = "factory_products"."partner_id") AND ("mp"."owner_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."manufacturing_partners" "mp"
  WHERE (("mp"."id" = "factory_products"."partner_id") AND ("mp"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "factory_products_public_select" ON "public"."factory_products" FOR SELECT USING (true);



CREATE POLICY "factory_products_view" ON "public"."factory_products" FOR SELECT USING ((("is_active" = true) OR (EXISTS ( SELECT 1
   FROM "public"."manufacturing_partners" "mp"
  WHERE (("mp"."id" = "factory_products"."partner_id") AND (("mp"."owner_user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())))))));



CREATE POLICY "factory_products_write" ON "public"."factory_products" USING ((EXISTS ( SELECT 1
   FROM "public"."manufacturing_partners" "mp"
  WHERE (("mp"."id" = "factory_products"."partner_id") AND (("mp"."owner_user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."manufacturing_partners" "mp"
  WHERE (("mp"."id" = "factory_products"."partner_id") AND (("mp"."owner_user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"()))))));



ALTER TABLE "public"."factory_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "favorites_owner_all" ON "public"."favorites" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "fpm_partner_manage" ON "public"."factory_product_mockups" USING ((EXISTS ( SELECT 1
   FROM ("public"."factory_products" "fp"
     JOIN "public"."manufacturing_partners" "mp" ON (("mp"."id" = "fp"."partner_id")))
  WHERE (("fp"."id" = "factory_product_mockups"."factory_product_id") AND (((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'service_role'::"text") OR ((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'sub'::"text") = ("mp"."owner_user_id")::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."factory_products" "fp"
     JOIN "public"."manufacturing_partners" "mp" ON (("mp"."id" = "fp"."partner_id")))
  WHERE (("fp"."id" = "factory_product_mockups"."factory_product_id") AND (((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'service_role'::"text") OR ((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'sub'::"text") = ("mp"."owner_user_id")::"text"))))));



CREATE POLICY "fpm_public_select" ON "public"."factory_product_mockups" FOR SELECT USING (true);



ALTER TABLE "public"."idempotency_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."live_offer_reservations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "live_offer_reservations_owner_delete" ON "public"."live_offer_reservations" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "live_offer_reservations_owner_insert" ON "public"."live_offer_reservations" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "live_offer_reservations_owner_select" ON "public"."live_offer_reservations" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



ALTER TABLE "public"."live_offers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "live_offers_creator_all" ON "public"."live_offers" USING ((("creator_id" = "auth"."uid"()) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"))) WITH CHECK ((("creator_id" = "auth"."uid"()) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "live_offers_public_select" ON "public"."live_offers" FOR SELECT USING (((("status" = 'published'::"text") AND (("now"() >= "start_at") AND ("now"() <= "end_at"))) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "logs_admin_only" ON "public"."storage_access_logs" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."manufacturing_order_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manufacturing_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manufacturing_orders_service_manage" ON "public"."manufacturing_orders" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



ALTER TABLE "public"."manufacturing_partners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mo_status_admin_all" ON "public"."manufacturing_order_status_history" TO "authenticated" USING (((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'service_role'::"text")) WITH CHECK (((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "morders_view_safe" ON "public"."manufacturing_orders" FOR SELECT USING ((
CASE
    WHEN (EXISTS ( SELECT 1
       FROM "information_schema"."columns"
      WHERE ((("columns"."table_schema")::"name" = 'public'::"name") AND (("columns"."table_name")::"name" = 'manufacturing_orders'::"name") AND (("columns"."column_name")::"name" = 'creator_user_id'::"name")))) THEN ("creator_user_id" = "auth"."uid"())
    ELSE false
END OR (EXISTS ( SELECT 1
   FROM "public"."manufacturing_partners" "mp"
  WHERE (("mp"."id" = "manufacturing_orders"."partner_id") AND ("mp"."owner_user_id" = "auth"."uid"())))) OR ((EXISTS ( SELECT 1
   FROM ("pg_proc" "p"
     JOIN "pg_namespace" "n" ON (("n"."oid" = "p"."pronamespace")))
  WHERE (("n"."nspname" = 'public'::"name") AND ("p"."proname" = 'is_admin_strict'::"name")))) AND "public"."is_admin_strict"("auth"."uid"()))));



COMMENT ON POLICY "morders_view_safe" ON "public"."manufacturing_orders" IS 'Restrict SELECT to creator, partner owner, or admin';



CREATE POLICY "olr_admin_all" ON "public"."organizer_leave_requests" USING (((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "olr_organizer_rw" ON "public"."organizer_leave_requests" USING (("organizer_id" = "auth"."uid"())) WITH CHECK (("organizer_id" = "auth"."uid"()));



ALTER TABLE "public"."online_assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "online_assets_owner_rw" ON "public"."online_assets" USING (("owner_user_id" = "auth"."uid"())) WITH CHECK (("owner_user_id" = "auth"."uid"()));



ALTER TABLE "public"."order_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizer_leave_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizer_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizers_view" ON "public"."organizers" FOR SELECT USING (true);



CREATE POLICY "organizers_write" ON "public"."organizers" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "papprovals_view" ON "public"."publishing_approvals" FOR SELECT USING (("public"."is_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."works" "w"
  WHERE (("w"."id" = "publishing_approvals"."work_id") AND ("w"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "papprovals_write" ON "public"."publishing_approvals" FOR UPDATE USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."partner_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "partner_reviews_author_all" ON "public"."partner_reviews" USING (("author_user_id" = "auth"."uid"())) WITH CHECK (("author_user_id" = "auth"."uid"()));



CREATE POLICY "partner_reviews_public_select" ON "public"."partner_reviews" FOR SELECT USING (true);



CREATE POLICY "partners_owner_write" ON "public"."manufacturing_partners" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"()))) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "partners_public_view" ON "public"."manufacturing_partners" FOR SELECT USING ((("status" = 'approved'::"text") OR ("owner_user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



ALTER TABLE "public"."payment_failures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payouts_v31" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payouts_view" ON "public"."payouts_v31" FOR SELECT USING (((("recipient_type" = 'creator'::"text") AND ("recipient_id" = "auth"."uid"())) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "phistory_insert" ON "public"."price_history" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."factory_products" "fp"
     JOIN "public"."manufacturing_partners" "mp" ON (("mp"."id" = "fp"."partner_id")))
  WHERE (("fp"."id" = "price_history"."factory_product_id") AND (("mp"."owner_user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"()))))));



CREATE POLICY "phistory_view" ON "public"."price_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."factory_products" "fp"
     JOIN "public"."manufacturing_partners" "mp" ON (("mp"."id" = "fp"."partner_id")))
  WHERE (("fp"."id" = "price_history"."factory_product_id") AND (("mp"."owner_user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"()))))));



CREATE POLICY "previews_public" ON "public"."partner_reviews" FOR SELECT USING (true);



CREATE POLICY "previews_update_own" ON "public"."partner_reviews" FOR UPDATE USING ((("author_user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"()))) WITH CHECK ((("author_user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "previews_write" ON "public"."partner_reviews" FOR INSERT WITH CHECK (("author_user_id" = "auth"."uid"()));



ALTER TABLE "public"."price_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_owner_write" ON "public"."products" USING (("creator_id" = "auth"."uid"())) WITH CHECK (("creator_id" = "auth"."uid"()));



CREATE POLICY "products_public_or_owner_select" ON "public"."products" FOR SELECT USING ((("status" = 'published'::"text") OR ("creator_id" = "auth"."uid"())));



ALTER TABLE "public"."publishing_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchases_admin_select" ON "public"."purchases" FOR SELECT USING ("public"."is_admin_strict"("auth"."uid"()));



CREATE POLICY "purchases_buyer_access" ON "public"."purchases" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin_strict"("auth"."uid"())));



CREATE POLICY "purchases_buyer_or_creator_read" ON "public"."purchases" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."works" "w"
  WHERE (("w"."id" = "purchases"."work_id") AND ("w"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "purchases_owner_select" ON "public"."purchases" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "purchases_system_insert" ON "public"."purchases" FOR INSERT WITH CHECK (((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text") OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."refund_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refund_requests_admin_all" ON "public"."refund_requests" USING ("public"."is_admin_strict"("auth"."uid"())) WITH CHECK ("public"."is_admin_strict"("auth"."uid"()));



CREATE POLICY "refund_requests_owner_rw" ON "public"."refund_requests" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_view" ON "public"."sales" FOR SELECT USING ((("creator_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



ALTER TABLE "public"."schema_migrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schema_migrations_deny_all" ON "public"."schema_migrations" USING (false) WITH CHECK (false);



CREATE POLICY "select_own_user_notifications" ON "public"."user_notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "service_role_bypass_cart_items" ON "public"."cart_items" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_bypass_factory_products" ON "public"."factory_products" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_bypass_favorites" ON "public"."favorites" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_bypass_partner_reviews" ON "public"."partner_reviews" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_bypass_purchases" ON "public"."purchases" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "service_role_bypass_users" ON "public"."users" USING ("public"."current_role_is_service_role"()) WITH CHECK ("public"."current_role_is_service_role"());



CREATE POLICY "service_role_bypass_works" ON "public"."works" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



COMMENT ON POLICY "service_role_bypass_works" ON "public"."works" IS 'Service role bypass for admin operations';



ALTER TABLE "public"."simple_rate_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "simple_rate_limits_deny_all" ON "public"."simple_rate_limits" USING (false) WITH CHECK (false);



ALTER TABLE "public"."storage_access_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "storage_cleanup_deny_all" ON "public"."storage_cleanup_queue" USING (false) WITH CHECK (false);



ALTER TABLE "public"."storage_cleanup_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_webhook_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "uae_owner_all" ON "public"."user_account_extra" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "uba_owner_all" ON "public"."user_bank_accounts" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "uid_owner_all" ON "public"."user_identities" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "update_own_user_notifications" ON "public"."user_notifications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "upp_no_delete" ON "public"."user_public_profiles" FOR DELETE USING (false);



CREATE POLICY "upp_no_insert" ON "public"."user_public_profiles" FOR INSERT WITH CHECK (false);



CREATE POLICY "upp_no_update" ON "public"."user_public_profiles" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "upp_read_all" ON "public"."user_public_profiles" FOR SELECT USING (true);



ALTER TABLE "public"."user_account_extra" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_bank_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_mfa" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_mfa_owner_all" ON "public"."user_mfa" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_privacy_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_public_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_admin_all" ON "public"."users" USING ("public"."is_admin_strict"("auth"."uid"())) WITH CHECK ("public"."is_admin_strict"("auth"."uid"()));



CREATE POLICY "users_admin_delete" ON "public"."users" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM ("pg_proc" "p"
     JOIN "pg_namespace" "n" ON (("n"."oid" = "p"."pronamespace")))
  WHERE (("n"."nspname" = 'public'::"name") AND ("p"."proname" = 'is_admin_strict'::"name")))) AND "public"."is_admin_strict"("auth"."uid"())));



COMMENT ON POLICY "users_admin_delete" ON "public"."users" IS 'Only admins can delete user rows';



CREATE POLICY "users_self_insert" ON "public"."users" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "users_self_modify" ON "public"."users" FOR UPDATE USING ((("id" = "auth"."uid"()) OR ((EXISTS ( SELECT 1
   FROM ("pg_proc" "p"
     JOIN "pg_namespace" "n" ON (("n"."oid" = "p"."pronamespace")))
  WHERE (("n"."nspname" = 'public'::"name") AND ("p"."proname" = 'is_admin_strict'::"name")))) AND "public"."is_admin_strict"("auth"."uid"())))) WITH CHECK ((("id" = "auth"."uid"()) OR ((EXISTS ( SELECT 1
   FROM ("pg_proc" "p"
     JOIN "pg_namespace" "n" ON (("n"."oid" = "p"."pronamespace")))
  WHERE (("n"."nspname" = 'public'::"name") AND ("p"."proname" = 'is_admin_strict'::"name")))) AND "public"."is_admin_strict"("auth"."uid"()))));



COMMENT ON POLICY "users_self_modify" ON "public"."users" IS 'Users can update their own profile; admins can update all';



CREATE POLICY "users_self_select" ON "public"."users" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "users_self_update" ON "public"."users" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."works" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "works_creator_manage" ON "public"."works" USING (("creator_id" = "auth"."uid"())) WITH CHECK (("creator_id" = "auth"."uid"()));



CREATE POLICY "works_insert_policy" ON "public"."works" FOR INSERT WITH CHECK ((("creator_id" = "auth"."uid"()) AND (("is_active" = false) OR ("is_active" IS NULL))));



ALTER TABLE "public"."works_metadata_backup" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "works_metadata_backup_deny_all" ON "public"."works_metadata_backup" USING (false) WITH CHECK (false);



COMMENT ON POLICY "works_metadata_backup_deny_all" ON "public"."works_metadata_backup" IS 'Deny-all policy for backup table; access via service role/scripts only';



CREATE POLICY "works_owner_all" ON "public"."works" USING (("creator_id" = "auth"."uid"())) WITH CHECK (("creator_id" = "auth"."uid"()));



COMMENT ON POLICY "works_owner_all" ON "public"."works" IS 'Owner (creator_id/user_id) can manage own works';



CREATE POLICY "works_public_read" ON "public"."works" FOR SELECT USING (((COALESCE("is_published", false) = true) OR (COALESCE("is_active", false) = true) OR ("creator_id" = "auth"."uid"())));



CREATE POLICY "works_public_select" ON "public"."works" FOR SELECT USING (("is_active" = true));



COMMENT ON POLICY "works_public_select" ON "public"."works" IS 'Public can view active/published works';



CREATE POLICY "works_select_policy" ON "public"."works" FOR SELECT USING ((("is_active" = true) OR ("creator_id" = "auth"."uid"())));



CREATE POLICY "works_update_policy" ON "public"."works" FOR UPDATE USING (("creator_id" = "auth"."uid"())) WITH CHECK ((("creator_id" = "auth"."uid"()) AND (("is_active" = "is_active") AND ("is_active" = false))));



CREATE POLICY "works_user_policy" ON "public"."works" USING ((("auth"."uid"() = "creator_id") OR ("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."user_type" = ANY (ARRAY['organizer'::"text", 'factory'::"text"])))))) WITH CHECK ((("auth"."uid"() = "creator_id") OR ("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."user_type" = ANY (ARRAY['organizer'::"text", 'factory'::"text"]))))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































































































































GRANT ALL ON FUNCTION "public"."check_rate_limit_safe"("p_user_id" "uuid", "p_action" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit_safe"("p_user_id" "uuid", "p_action" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit_safe"("p_user_id" "uuid", "p_action" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_live_offer_purchase"("p_live_offer_id" "uuid", "p_user_id" "uuid", "p_payment_intent_id" "text", "p_amount" integer, "p_currency" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_live_offer_purchase"("p_live_offer_id" "uuid", "p_user_id" "uuid", "p_payment_intent_id" "text", "p_amount" integer, "p_currency" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_live_offer_purchase"("p_live_offer_id" "uuid", "p_user_id" "uuid", "p_payment_intent_id" "text", "p_amount" integer, "p_currency" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_purchase_transaction"("p_payment_intent_id" "text", "p_user_id" "uuid", "p_work_id" "uuid", "p_amount" integer, "p_currency" "text", "p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_purchase_transaction"("p_payment_intent_id" "text", "p_user_id" "uuid", "p_work_id" "uuid", "p_amount" integer, "p_currency" "text", "p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_purchase_transaction"("p_payment_intent_id" "text", "p_user_id" "uuid", "p_work_id" "uuid", "p_amount" integer, "p_currency" "text", "p_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_role_is_service_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_role_is_service_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_role_is_service_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_reserved_safely"("p_live_offer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_reserved_safely"("p_live_offer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_reserved_safely"("p_live_offer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_reserved_safely"("p_live_offer_id" "uuid", "p_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_reserved_safely"("p_live_offer_id" "uuid", "p_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_reserved_safely"("p_live_offer_id" "uuid", "p_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_public_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_public_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_public_profile"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_rate_limit"("p_key" "text", "p_limit" integer, "p_window_seconds" integer, "p_cost" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_rate_limit"("p_key" "text", "p_limit" integer, "p_window_seconds" integer, "p_cost" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_rate_limit"("p_key" "text", "p_limit" integer, "p_window_seconds" integer, "p_cost" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_rate_limit"("p_key" "text", "p_limit" integer, "p_window_seconds" integer, "p_cost" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_storage_cleanup"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_storage_cleanup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_storage_cleanup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_partner_shipping_info"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_partner_shipping_info"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_partner_shipping_info"() TO "service_role";



GRANT ALL ON FUNCTION "public"."finalize_live_offer_transaction"("p_live_offer_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."finalize_live_offer_transaction"("p_live_offer_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_live_offer_transaction"("p_live_offer_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."finalize_live_offer_transaction"("p_live_offer_id" "uuid", "p_user_id" "uuid", "p_payment_intent_id" "text", "p_amount" integer, "p_currency" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."finalize_live_offer_transaction"("p_live_offer_id" "uuid", "p_user_id" "uuid", "p_payment_intent_id" "text", "p_amount" integer, "p_currency" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_live_offer_transaction"("p_live_offer_id" "uuid", "p_user_id" "uuid", "p_payment_intent_id" "text", "p_amount" integer, "p_currency" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_monthly_payouts_v50"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_monthly_payouts_v50"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_monthly_payouts_v50"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_creator_monthly_summary"("p_creator_id" "uuid", "p_year" integer, "p_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_creator_monthly_summary"("p_creator_id" "uuid", "p_year" integer, "p_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_creator_monthly_summary"("p_creator_id" "uuid", "p_year" integer, "p_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_type"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_type"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_type"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("p_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("p_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_safe"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_safe"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_safe"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_strict"("p_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_strict"("p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_strict"("p_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_factory"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_factory"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_factory"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."release_live_offer"("p_live_offer_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."release_live_offer"("p_live_offer_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_live_offer"("p_live_offer_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_live_offer"("p_live_offer_id" "uuid", "p_user_id" "uuid", "p_ttl_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_live_offer"("p_live_offer_id" "uuid", "p_user_id" "uuid", "p_ttl_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_live_offer"("p_live_offer_id" "uuid", "p_user_id" "uuid", "p_ttl_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_work_availability"("p_work_id" "uuid", "p_quantity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."restore_work_availability"("p_work_id" "uuid", "p_quantity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_work_availability"("p_work_id" "uuid", "p_quantity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sanitize_xml_safe"("p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sanitize_xml_safe"("p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sanitize_xml_safe"("p_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_factory_preference"("p_category" "text", "p_partner_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_factory_preference"("p_category" "text", "p_partner_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_factory_preference"("p_category" "text", "p_partner_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."simple_rate_check"("p_user_id" "uuid", "p_action" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."simple_rate_check"("p_user_id" "uuid", "p_action" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."simple_rate_check"("p_user_id" "uuid", "p_action" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_public_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_public_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_public_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."use_free_cheer"("p_user_id" "uuid", "p_battle_id" "uuid", "p_limit" integer, "p_window_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."use_free_cheer"("p_user_id" "uuid", "p_battle_id" "uuid", "p_limit" integer, "p_window_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."use_free_cheer"("p_user_id" "uuid", "p_battle_id" "uuid", "p_limit" integer, "p_window_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_image_mime_safe"("p_content_type" "text", "p_file_signature" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_image_mime_safe"("p_content_type" "text", "p_file_signature" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_image_mime_safe"("p_content_type" "text", "p_file_signature" "bytea") TO "service_role";


















GRANT ALL ON TABLE "public"."asset_approvals" TO "anon";
GRANT ALL ON TABLE "public"."asset_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."asset_policies" TO "anon";
GRANT ALL ON TABLE "public"."asset_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_policies" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."battle_eligibility" TO "anon";
GRANT ALL ON TABLE "public"."battle_eligibility" TO "authenticated";
GRANT ALL ON TABLE "public"."battle_eligibility" TO "service_role";



GRANT ALL ON TABLE "public"."battle_invitations" TO "anon";
GRANT ALL ON TABLE "public"."battle_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."battle_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."battles" TO "anon";
GRANT ALL ON TABLE "public"."battles" TO "authenticated";
GRANT ALL ON TABLE "public"."battles" TO "service_role";



GRANT ALL ON TABLE "public"."cart_items" TO "anon";
GRANT ALL ON TABLE "public"."cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cart_items" TO "service_role";



GRANT ALL ON TABLE "public"."cheer_free_counters" TO "anon";
GRANT ALL ON TABLE "public"."cheer_free_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."cheer_free_counters" TO "service_role";



GRANT ALL ON TABLE "public"."cheer_tickets" TO "anon";
GRANT ALL ON TABLE "public"."cheer_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."cheer_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."purchases" TO "anon";
GRANT ALL ON TABLE "public"."purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."purchases" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."works" TO "anon";
GRANT ALL ON TABLE "public"."works" TO "authenticated";
GRANT ALL ON TABLE "public"."works" TO "service_role";



GRANT ALL ON TABLE "public"."creator_earnings_v50" TO "anon";
GRANT ALL ON TABLE "public"."creator_earnings_v50" TO "authenticated";
GRANT ALL ON TABLE "public"."creator_earnings_v50" TO "service_role";



GRANT ALL ON TABLE "public"."factory_product_mockups" TO "anon";
GRANT ALL ON TABLE "public"."factory_product_mockups" TO "authenticated";
GRANT ALL ON TABLE "public"."factory_product_mockups" TO "service_role";



GRANT ALL ON TABLE "public"."factory_products" TO "anon";
GRANT ALL ON TABLE "public"."factory_products" TO "authenticated";
GRANT ALL ON TABLE "public"."factory_products" TO "service_role";



GRANT ALL ON TABLE "public"."factory_profiles" TO "anon";
GRANT ALL ON TABLE "public"."factory_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."factory_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."idempotency_keys" TO "anon";
GRANT ALL ON TABLE "public"."idempotency_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."idempotency_keys" TO "service_role";



GRANT ALL ON TABLE "public"."live_offer_reservations" TO "anon";
GRANT ALL ON TABLE "public"."live_offer_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."live_offer_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."live_offers" TO "anon";
GRANT ALL ON TABLE "public"."live_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."live_offers" TO "service_role";



GRANT ALL ON TABLE "public"."manufacturing_order_status_history" TO "anon";
GRANT ALL ON TABLE "public"."manufacturing_order_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."manufacturing_order_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."manufacturing_orders" TO "anon";
GRANT ALL ON TABLE "public"."manufacturing_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."manufacturing_orders" TO "service_role";



GRANT ALL ON TABLE "public"."manufacturing_partners" TO "anon";
GRANT ALL ON TABLE "public"."manufacturing_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."manufacturing_partners" TO "service_role";



GRANT ALL ON TABLE "public"."online_assets" TO "anon";
GRANT ALL ON TABLE "public"."online_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."online_assets" TO "service_role";



GRANT ALL ON TABLE "public"."order_status_history" TO "anon";
GRANT ALL ON TABLE "public"."order_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."order_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."organizer_leave_requests" TO "anon";
GRANT ALL ON TABLE "public"."organizer_leave_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."organizer_leave_requests" TO "service_role";



GRANT ALL ON TABLE "public"."organizer_profiles" TO "anon";
GRANT ALL ON TABLE "public"."organizer_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."organizer_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."organizers" TO "anon";
GRANT ALL ON TABLE "public"."organizers" TO "authenticated";
GRANT ALL ON TABLE "public"."organizers" TO "service_role";



GRANT ALL ON TABLE "public"."partner_notifications" TO "anon";
GRANT ALL ON TABLE "public"."partner_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."partner_orders_view" TO "anon";
GRANT ALL ON TABLE "public"."partner_orders_view" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_orders_view" TO "service_role";



GRANT ALL ON TABLE "public"."partner_reviews" TO "anon";
GRANT ALL ON TABLE "public"."partner_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."payment_failures" TO "anon";
GRANT ALL ON TABLE "public"."payment_failures" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_failures" TO "service_role";



GRANT ALL ON TABLE "public"."payment_status" TO "anon";
GRANT ALL ON TABLE "public"."payment_status" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_status" TO "service_role";



GRANT ALL ON TABLE "public"."payouts_v31" TO "anon";
GRANT ALL ON TABLE "public"."payouts_v31" TO "authenticated";
GRANT ALL ON TABLE "public"."payouts_v31" TO "service_role";



GRANT ALL ON TABLE "public"."price_history" TO "anon";
GRANT ALL ON TABLE "public"."price_history" TO "authenticated";
GRANT ALL ON TABLE "public"."price_history" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."publishing_approvals" TO "anon";
GRANT ALL ON TABLE "public"."publishing_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."publishing_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."realtime_metrics" TO "anon";
GRANT ALL ON TABLE "public"."realtime_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."realtime_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."refund_requests" TO "anon";
GRANT ALL ON TABLE "public"."refund_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."refund_requests" TO "service_role";



GRANT ALL ON TABLE "public"."sales" TO "anon";
GRANT ALL ON TABLE "public"."sales" TO "authenticated";
GRANT ALL ON TABLE "public"."sales" TO "service_role";



GRANT ALL ON TABLE "public"."schema_migrations" TO "anon";
GRANT ALL ON TABLE "public"."schema_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."schema_migrations" TO "service_role";



GRANT ALL ON TABLE "public"."simple_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."simple_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."simple_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."storage_access_logs" TO "anon";
GRANT ALL ON TABLE "public"."storage_access_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."storage_access_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."storage_access_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."storage_access_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."storage_access_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."storage_cleanup_queue" TO "anon";
GRANT ALL ON TABLE "public"."storage_cleanup_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."storage_cleanup_queue" TO "service_role";



GRANT ALL ON SEQUENCE "public"."storage_cleanup_queue_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."storage_cleanup_queue_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."storage_cleanup_queue_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_account_extra" TO "anon";
GRANT ALL ON TABLE "public"."user_account_extra" TO "authenticated";
GRANT ALL ON TABLE "public"."user_account_extra" TO "service_role";



GRANT ALL ON TABLE "public"."user_addresses" TO "anon";
GRANT ALL ON TABLE "public"."user_addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."user_addresses" TO "service_role";



GRANT ALL ON TABLE "public"."user_bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."user_bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."user_bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."user_identities" TO "anon";
GRANT ALL ON TABLE "public"."user_identities" TO "authenticated";
GRANT ALL ON TABLE "public"."user_identities" TO "service_role";



GRANT ALL ON TABLE "public"."user_mfa" TO "anon";
GRANT ALL ON TABLE "public"."user_mfa" TO "authenticated";
GRANT ALL ON TABLE "public"."user_mfa" TO "service_role";



GRANT ALL ON TABLE "public"."user_notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notification_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_notifications" TO "anon";
GRANT ALL ON TABLE "public"."user_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."user_privacy_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_privacy_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_privacy_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_public_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_public_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_public_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."works_metadata_backup" TO "anon";
GRANT ALL ON TABLE "public"."works_metadata_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."works_metadata_backup" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























\unrestrict e3ThSMxI2Q0Cg8IKZwkz8aPfkcgajQBxPyHOlYjzMMFmHXBvLKYn3yn219kpYSY

RESET ALL;
