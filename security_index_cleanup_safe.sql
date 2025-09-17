-- PhotoRank v5.0 危険な部分インデックス一掃パッチ（安全版）
-- IMMUTABLE要件違反（now()/auth.*使用）のインデックス対策
-- エラー回避：カラム存在確認後にインデックス作成

-- =====================================
-- 1. 危険な部分インデックスの検出・削除
-- =====================================

-- 危険インデックス削除（存在しない場合はスキップ）
DROP INDEX IF EXISTS idx_rate_limits_cleanup;
DROP INDEX IF EXISTS idx_rate_limits_active;
DROP INDEX IF EXISTS idx_rate_limits_window;
DROP INDEX IF EXISTS idx_audit_logs_recent;
DROP INDEX IF EXISTS idx_audit_logs_current_user;
DROP INDEX IF EXISTS idx_works_recent_published;
DROP INDEX IF EXISTS idx_purchases_recent;
DROP INDEX IF EXISTS idx_manufacturing_orders_recent;

-- =====================================
-- 2. 安全な代替インデックスを作成（カラム存在確認付き）
-- =====================================

-- rate_limits テーブル用インデックス
DO $$
BEGIN
    -- rate_limits テーブルが存在する場合のみ
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'rate_limits'
    ) THEN
        -- expires_at カラムが存在する場合
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'rate_limits' AND column_name = 'expires_at'
        ) THEN
            CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at 
            ON public.rate_limits(expires_at) 
            WHERE expires_at IS NOT NULL;
        END IF;
        
        -- user_id, action, created_at が存在する場合
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rate_limits' AND column_name = 'user_id')
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rate_limits' AND column_name = 'action')
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rate_limits' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action 
            ON public.rate_limits(user_id, action, created_at DESC);
        END IF;
    END IF;
END
$$;

-- audit_logs テーブル用インデックス
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        -- created_at カラムが存在する場合
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
            ON public.audit_logs(created_at DESC);
        END IF;
        
        -- table_name, operation, created_at が存在する場合
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'table_name')
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'operation')
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_audit_logs_table_operation 
            ON public.audit_logs(table_name, operation, created_at DESC);
        END IF;
    END IF;
END
$$;

-- works テーブル用インデックス
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'works') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'works' AND column_name = 'is_published')
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'works' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_works_published_created 
            ON public.works(created_at DESC) 
            WHERE is_published = true;
        END IF;
    END IF;
END
$$;

-- purchases テーブル用インデックス
DO $$
DECLARE
    user_col text;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchases') THEN
        -- ユーザー識別カラムを検出
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'buyer_user_id') THEN
            user_col := 'buyer_user_id';
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'user_id') THEN
            user_col := 'user_id';
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'customer_id') THEN
            user_col := 'customer_id';
        END IF;
        
        -- created_at カラムが存在し、ユーザーカラムも存在する場合
        IF user_col IS NOT NULL 
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'created_at') THEN
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_purchases_buyer_created ON public.purchases(%I, created_at DESC)', user_col);
        END IF;
    END IF;
END
$$;

-- manufacturing_orders テーブル用インデックス
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'manufacturing_orders') THEN
        -- status, created_at カラムが存在する場合
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'manufacturing_orders' AND column_name = 'status')
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'manufacturing_orders' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_manufacturing_orders_status_created 
            ON public.manufacturing_orders(status, created_at DESC);
        END IF;
        
        -- partner_id, status, created_at が存在する場合
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'manufacturing_orders' AND column_name = 'partner_id')
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'manufacturing_orders' AND column_name = 'status')
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'manufacturing_orders' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_manufacturing_orders_partner_status 
            ON public.manufacturing_orders(partner_id, status, created_at DESC);
        END IF;
    END IF;
END
$$;

-- =====================================
-- 3. 作成されたインデックスの確認
-- =====================================

-- 作成されたインデックスの一覧表示
SELECT 
  'Index Cleanup Completed (Safe Version)' as status,
  schemaname,
  tablename,
  indexname
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
  AND tablename IN ('rate_limits', 'audit_logs', 'works', 'purchases', 'manufacturing_orders')
ORDER BY tablename, indexname;