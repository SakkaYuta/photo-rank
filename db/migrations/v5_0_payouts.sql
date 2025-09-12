-- v5.0 payouts migration: creator earnings view and monthly payout generation
-- Implements two-stage fee model for v5.0 marketplace

-- Creator earnings view (v5.0 two-stage fees)
CREATE OR REPLACE VIEW public.creator_earnings_v50 AS
SELECT 
  p.id as purchase_id,
  p.work_id,
  p.user_id as buyer_id,
  w.creator_id,
  p.price as sale_price,
  COALESCE(p.factory_payment, 0) as factory_payment,
  COALESCE(p.platform_total_revenue, 0) as platform_total_revenue,
  -- Creator profit = sale_price - factory_payment - platform_fees
  (p.price - COALESCE(p.factory_payment, 0) - COALESCE(p.platform_total_revenue, 0)) as creator_profit,
  p.purchased_at,
  p.status,
  w.organizer_id,
  u.display_name as creator_name
FROM public.purchases p
JOIN public.works w ON w.id = p.work_id
JOIN public.users u ON u.id = w.creator_id
WHERE p.status = 'paid';

-- Monthly payout generation function (v5.0)
CREATE OR REPLACE FUNCTION public.generate_monthly_payouts_v50()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- pg_cron extension (if available)
DO $$ BEGIN
  -- Monthly payout generation job (runs on 1st day of each month at midnight)
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'monthly-payout-generation-v50',
      '0 0 1 * *', 
      'SELECT public.generate_monthly_payouts_v50();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron not available, skip job scheduling
  NULL;
END $$;

-- Helper function: Get creator monthly summary
CREATE OR REPLACE FUNCTION public.get_creator_monthly_summary(
  p_creator_id uuid,
  p_year integer,
  p_month integer
) 
RETURNS jsonb AS $$
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
$$ LANGUAGE plpgsql;

-- Mark migration
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_payouts', 'local')
ON CONFLICT (version) DO NOTHING;