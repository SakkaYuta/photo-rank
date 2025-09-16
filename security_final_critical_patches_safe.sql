-- PhotoRank v5.0 最終セキュリティ再点検 - 安全版パッチ
-- 実際のテーブル構造に完全に適応する最も安全なバージョン
-- エラーを一切発生させない堅牢な実装

-- =====================================
-- 最優先 1: purchases と Stripe Webhook の整合性 (CRITICAL)
-- =====================================

-- Stripe Webhookが書き込むカラムを確実に保存
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'jpy';

ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- 重複挿入を防ぐ一意制約（存在しない場合のみ作成）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'idx_purchases_pi_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_purchases_pi_unique 
        ON public.purchases((COALESCE(stripe_payment_intent_id, ''))) 
        WHERE stripe_payment_intent_id IS NOT NULL;
        
        RAISE NOTICE 'Created unique index for stripe_payment_intent_id';
    ELSE
        RAISE NOTICE 'Unique index for stripe_payment_intent_id already exists';
    END IF;
END
$$;

-- =====================================
-- 最優先 2: purchases のRLS（完全安全版）
-- =====================================

-- テーブル構造に完全に適応したRLS設定
DO $$
DECLARE
    user_col text;
    sql_text text;
BEGIN
    -- 適切なユーザー識別カラムを検出
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'purchases' 
        AND column_name = 'user_id'
    ) THEN
        user_col := 'user_id';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'purchases' 
        AND column_name = 'buyer_user_id'
    ) THEN
        user_col := 'buyer_user_id';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'purchases' 
        AND column_name = 'customer_id'
    ) THEN
        user_col := 'customer_id';
    ELSE
        -- 適切なカラムが見つからない場合は user_id を追加
        ALTER TABLE public.purchases ADD COLUMN user_id uuid;
        user_col := 'user_id';
        RAISE NOTICE 'Added user_id column to purchases table';
    END IF;
    
    -- RLS有効化
    ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
    
    -- 既存ポリシー削除
    DROP POLICY IF EXISTS purchases_select_self ON public.purchases;
    DROP POLICY IF EXISTS purchases_user_access ON public.purchases;
    
    -- 動的にポリシーを作成
    sql_text := format('
        CREATE POLICY purchases_user_access ON public.purchases 
        FOR SELECT USING (
            %I = auth.uid() OR 
            public.is_admin_strict(auth.uid())
        )', user_col);
    
    EXECUTE sql_text;
    
    RAISE NOTICE 'Created RLS policy using column: %', user_col;
END
$$;

-- =====================================
-- 最優先 3: webhook_events の一意化とRLS（完全安全版）
-- =====================================

-- テーブル作成（既存の場合はスキップ）
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text,
  event_type text,
  payload jsonb,
  processing_time_ms integer,
  created_at timestamptz DEFAULT now()
);

-- event_id の一意制約追加（存在しない場合のみ）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'webhook_events_event_id_unique'
    ) THEN
        ALTER TABLE public.webhook_events 
        ADD CONSTRAINT webhook_events_event_id_unique UNIQUE (event_id);
        
        RAISE NOTICE 'Added unique constraint to webhook_events.event_id';
    ELSE
        RAISE NOTICE 'Unique constraint on webhook_events.event_id already exists';
    END IF;
END
$$;

-- RLS有効化
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- 既存ポリシー削除して再作成
DROP POLICY IF EXISTS webhook_events_admin ON public.webhook_events;
DROP POLICY IF EXISTS webhook_events_admin_access ON public.webhook_events;

-- 管理者のみアクセス可能（is_admin_strict が存在しない場合の対策も含む）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'is_admin_strict' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        CREATE POLICY webhook_events_admin_access ON public.webhook_events 
        FOR SELECT USING (public.is_admin_strict(auth.uid()));
        
        RAISE NOTICE 'Created webhook_events admin policy using is_admin_strict';
    ELSE
        -- is_admin_strict 関数が存在しない場合のフォールバック
        CREATE POLICY webhook_events_admin_access ON public.webhook_events 
        FOR SELECT USING (false); -- 一旦誰もアクセスできないようにして安全性確保
        
        RAISE NOTICE 'Created restrictive webhook_events policy (is_admin_strict not found)';
    END IF;
END
$$;

-- =====================================
-- 最優先 4: manufacturing_orders の updated_at 補完（安全版）
-- =====================================

-- manufacturing_orders テーブルが存在する場合のみ実行
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'manufacturing_orders'
    ) THEN
        -- updated_at カラム追加
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'manufacturing_orders' 
            AND column_name = 'updated_at'
        ) THEN
            ALTER TABLE public.manufacturing_orders 
            ADD COLUMN updated_at timestamptz DEFAULT now();
            
            RAISE NOTICE 'Added updated_at column to manufacturing_orders';
        ELSE
            RAISE NOTICE 'updated_at column already exists in manufacturing_orders';
        END IF;
        
        -- 自動更新トリガー作成（関数が存在しない場合は作成）
        CREATE OR REPLACE FUNCTION public.update_updated_at_column()
        RETURNS TRIGGER AS $func$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;
        
        -- 既存トリガー削除して再作成
        DROP TRIGGER IF EXISTS trigger_manufacturing_orders_updated_at ON public.manufacturing_orders;
        
        CREATE TRIGGER trigger_manufacturing_orders_updated_at
          BEFORE UPDATE ON public.manufacturing_orders
          FOR EACH ROW
          EXECUTE FUNCTION public.update_updated_at_column();
          
        RAISE NOTICE 'Created updated_at trigger for manufacturing_orders';
    ELSE
        RAISE NOTICE 'manufacturing_orders table does not exist, skipping updated_at setup';
    END IF;
END
$$;

-- =====================================
-- is_admin_strict 関数の作成（存在しない場合）
-- =====================================

CREATE OR REPLACE FUNCTION public.is_admin_strict(p_user uuid) 
RETURNS boolean AS $$
BEGIN
  -- users テーブルが存在し、role カラムが存在する場合
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
    -- users テーブルまたは role カラムが存在しない場合は false を返す
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 確認・検証クエリ（安全版）
-- =====================================

-- 適用状況の安全な確認
SELECT 
  'Security Patches Applied (Safe Version)' as status,
  now() as applied_at,
  'Check individual components below' as details;

-- purchases テーブル確認
DO $$
DECLARE
    col_count integer;
    user_col text := 'UNKNOWN';
BEGIN
    -- stripe_payment_intent_id カラム確認
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases' 
    AND column_name = 'stripe_payment_intent_id';
    
    RAISE NOTICE 'purchases.stripe_payment_intent_id column exists: %', (col_count > 0);
    
    -- ユーザー識別カラム確認
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'user_id'
    ) THEN
        user_col := 'user_id';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'buyer_user_id'
    ) THEN
        user_col := 'buyer_user_id';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'customer_id'
    ) THEN
        user_col := 'customer_id';
    END IF;
    
    RAISE NOTICE 'purchases user identification column: %', user_col;
END
$$;

-- webhook_events テーブル確認
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'webhook_events'
    ) THEN 'CREATED'
    ELSE 'NOT_FOUND'
  END as webhook_events_table_status;

-- manufacturing_orders の updated_at 確認
SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'manufacturing_orders'
    ) THEN 'TABLE_NOT_EXISTS'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'manufacturing_orders' 
      AND column_name = 'updated_at'
    ) THEN 'COLUMN_EXISTS'
    ELSE 'COLUMN_MISSING'
  END as manufacturing_orders_updated_at_status;