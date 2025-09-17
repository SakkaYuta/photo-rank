-- PhotoRank v5.0 最終セキュリティ再点検 - 最優先修正パッチ（修正版）
-- 実行順序: setup_owner_user_id.sql の直後に実行してください
-- カラム名エラーを修正した最終版

-- =====================================
-- 最優先 1: purchases と Stripe Webhook の整合性 (CRITICAL)
-- =====================================

-- Stripe Webhookが書き込むカラムを確実に保存
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'jpy';

ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- 重複挿入を防ぐ一意制約
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_pi_unique 
ON public.purchases((COALESCE(stripe_payment_intent_id, ''))) 
WHERE stripe_payment_intent_id IS NOT NULL;

-- =====================================
-- 最優先 2: purchases のRLS（クライアント閲覧制御）修正版
-- =====================================

-- purchasesテーブルの実際のカラム構造を確認
-- まず既存のカラム名を調べる
DO $$
DECLARE
    col_exists boolean;
BEGIN
    -- user_id カラムの存在確認
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'purchases' 
        AND column_name = 'user_id'
    ) INTO col_exists;
    
    IF col_exists THEN
        -- user_id カラムが存在する場合
        ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS purchases_select_self ON public.purchases;
        
        -- user_id カラムを使用
        EXECUTE 'CREATE POLICY purchases_select_self ON public.purchases 
        FOR SELECT USING (
            user_id = auth.uid() OR 
            public.is_admin_strict(auth.uid())
        )';
        
        RAISE NOTICE 'purchases RLS policy created using user_id column';
    ELSE
        -- buyer_user_id カラムの存在確認
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'purchases' 
            AND column_name = 'buyer_user_id'
        ) INTO col_exists;
        
        IF col_exists THEN
            ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
            
            DROP POLICY IF EXISTS purchases_select_self ON public.purchases;
            
            -- buyer_user_id カラムを使用
            EXECUTE 'CREATE POLICY purchases_select_self ON public.purchases 
            FOR SELECT USING (
                buyer_user_id = auth.uid() OR 
                public.is_admin_strict(auth.uid())
            )';
            
            RAISE NOTICE 'purchases RLS policy created using buyer_user_id column';
        ELSE
            -- 購入者を特定するカラムを手動で追加
            ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS user_id uuid;
            ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
            
            DROP POLICY IF EXISTS purchases_select_self ON public.purchases;
            
            EXECUTE 'CREATE POLICY purchases_select_self ON public.purchases 
            FOR SELECT USING (
                user_id = auth.uid() OR 
                public.is_admin_strict(auth.uid())
            )';
            
            RAISE NOTICE 'purchases table: user_id column added and RLS policy created';
        END IF;
    END IF;
END
$$;

-- =====================================
-- 最優先 3: webhook_events の一意化とRLS（重複・機密保護）
-- =====================================

-- リプレイ・再試行での重複を防止。閲覧は管理者限定。
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE, -- Stripe event IDによる重複防止
  event_type text,
  payload jsonb, -- 機密情報含む可能性
  processing_time_ms integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_events_admin ON public.webhook_events;

-- 管理者のみアクセス可能
CREATE POLICY webhook_events_admin ON public.webhook_events 
FOR SELECT USING (public.is_admin_strict(auth.uid()));

-- =====================================
-- 最優先 4: manufacturing_orders の updated_at 欠落を補完
-- =====================================

-- フロントから更新時（updateOrderStatus）に updated_at を正しく記録
ALTER TABLE public.manufacturing_orders 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- updated_at 自動更新関数（既存の可能性があるため置き換え）
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_manufacturing_orders_updated_at ON public.manufacturing_orders;

CREATE TRIGGER trigger_manufacturing_orders_updated_at
  BEFORE UPDATE ON public.manufacturing_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================
-- 確認・検証クエリ（修正版）
-- =====================================

-- purchasesテーブルの構造確認
SELECT 
  'Purchases Table Structure Check' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'purchases'
ORDER BY ordinal_position;

-- 最優先修正の適用確認
SELECT 
  'Final Critical Security Patches Applied (Corrected)' as status,
  now() as applied_at,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = 'public' 
   AND table_name = 'purchases' 
   AND column_name = 'stripe_payment_intent_id') as purchases_stripe_column,
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'webhook_events') as webhook_events_table,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = 'public' 
   AND table_name = 'manufacturing_orders' 
   AND column_name = 'updated_at') as manufacturing_updated_at_column;

-- purchases RLS ポリシー確認
SELECT 
  'RLS Policies Check' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'purchases';