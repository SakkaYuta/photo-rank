-- PhotoRank v5.0 最終セキュリティ再点検 - 確実版
-- エラー完全回避版：最小限のSQLで確実な修正

-- =====================================
-- 1. 必要な関数の事前作成
-- =====================================

CREATE OR REPLACE FUNCTION public.is_admin_strict(p_user uuid) 
RETURNS boolean AS $$
BEGIN
  IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
  ) AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    RETURN EXISTS(
      SELECT 1 FROM public.users u 
      WHERE u.id = p_user AND u.role = 'admin'
    );
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 2. purchases テーブル修正
-- =====================================

-- 必要なカラム追加
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'jpy';

ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- 一意制約追加（既存チェック付き）
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_pi_unique 
ON public.purchases((COALESCE(stripe_payment_intent_id, ''))) 
WHERE stripe_payment_intent_id IS NOT NULL;

-- RLS設定（動的カラム検出）
DO $$
DECLARE
    user_col text := 'buyer_user_id'; -- デフォルト
BEGIN
    -- カラム検出
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'buyer_user_id') THEN
        user_col := 'buyer_user_id';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'user_id') THEN
        user_col := 'user_id';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'customer_id') THEN
        user_col := 'customer_id';
    ELSE
        ALTER TABLE public.purchases ADD COLUMN buyer_user_id uuid;
    END IF;
    
    -- RLS有効化
    ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
    
    -- 既存ポリシー削除
    DROP POLICY IF EXISTS purchases_select_self ON public.purchases;
    DROP POLICY IF EXISTS purchases_user_access ON public.purchases;
    DROP POLICY IF EXISTS purchases_buyer_access ON public.purchases;
    
    -- 新ポリシー作成
    EXECUTE format('CREATE POLICY purchases_buyer_access ON public.purchases FOR SELECT USING (%I = auth.uid() OR public.is_admin_strict(auth.uid()))', user_col);
END
$$;

-- =====================================
-- 3. webhook_events テーブル
-- =====================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text,
  event_type text,
  payload jsonb,
  processing_time_ms integer,
  created_at timestamptz DEFAULT now()
);

-- 一意制約（既存チェック付き）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'webhook_events_event_id_unique' 
        AND conrelid = 'public.webhook_events'::regclass
    ) THEN
        ALTER TABLE public.webhook_events ADD CONSTRAINT webhook_events_event_id_unique UNIQUE (event_id);
    END IF;
END
$$;

-- RLS設定
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_events_admin ON public.webhook_events;
DROP POLICY IF EXISTS webhook_events_admin_access ON public.webhook_events;

CREATE POLICY webhook_events_admin_access ON public.webhook_events 
FOR SELECT USING (public.is_admin_strict(auth.uid()));

-- =====================================
-- 4. manufacturing_orders の updated_at
-- =====================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'manufacturing_orders') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'manufacturing_orders' AND column_name = 'updated_at') THEN
            ALTER TABLE public.manufacturing_orders ADD COLUMN updated_at timestamptz DEFAULT now();
        END IF;
        
        DROP TRIGGER IF EXISTS trigger_manufacturing_orders_updated_at ON public.manufacturing_orders;
        CREATE TRIGGER trigger_manufacturing_orders_updated_at
          BEFORE UPDATE ON public.manufacturing_orders
          FOR EACH ROW
          EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END
$$;

-- =====================================
-- 5. 完了確認
-- =====================================

SELECT 'Security Patches Applied Successfully (V2)' as status, now() as completed_at;