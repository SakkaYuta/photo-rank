-- =====================================================================
-- 安全なv6移行SQL（既存データ保護）
-- =====================================================================
-- 目的: 既存のv5スキーマを保護しながらv6機能を段階的に追加
-- 対象: 本番環境（既にuser_roles, users_vwが存在）
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. user_profilesテーブル作成（存在しない場合のみ）
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON public.user_profiles(display_name);

COMMENT ON TABLE public.user_profiles IS 'v6: User profile information';

-- =====================================================================
-- 2. rate_limit_logsテーブル作成（v6イベントベースレート制限）
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_key_occurred ON public.rate_limit_logs(key, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_occurred ON public.rate_limit_logs(occurred_at DESC);

COMMENT ON TABLE public.rate_limit_logs IS 'v6: Event-based rate limiting logs';

-- =====================================================================
-- 3. upload_attemptsテーブル作成（画像アップロード制限）
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.upload_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address inet,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false,
  file_size bigint,
  mime_type text,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_upload_attempts_user_time ON public.upload_attempts(user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_attempts_ip_time ON public.upload_attempts(ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_attempts_time ON public.upload_attempts(attempted_at DESC);

COMMENT ON TABLE public.upload_attempts IS 'v6: Image upload rate limiting';

-- =====================================================================
-- 4. productsテーブルにwork_idカラム追加（存在しない場合のみ）
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'work_id'
  ) THEN
    ALTER TABLE public.products ADD COLUMN work_id uuid;

    -- 外部キー制約追加
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'works') THEN
      ALTER TABLE public.products
        ADD CONSTRAINT products_work_id_fkey
        FOREIGN KEY (work_id) REFERENCES public.works(id) ON DELETE RESTRICT;

      CREATE INDEX idx_products_work_id ON public.products(work_id);
    END IF;
  END IF;
END $$;

-- =====================================================================
-- 5. RLS有効化（未設定テーブルのみ）
-- =====================================================================
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rate_limit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.upload_attempts ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 6. 基本的なRLSポリシー作成
-- =====================================================================

-- user_profiles: 自分のプロフィールのみ読み書き可能
DROP POLICY IF EXISTS user_profiles_select ON public.user_profiles;
CREATE POLICY user_profiles_select ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_profiles_update ON public.user_profiles;
CREATE POLICY user_profiles_update ON public.user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_profiles_insert ON public.user_profiles;
CREATE POLICY user_profiles_insert ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- rate_limit_logs: サービスロールのみアクセス可能
DROP POLICY IF EXISTS rate_limit_logs_service_role ON public.rate_limit_logs;
CREATE POLICY rate_limit_logs_service_role ON public.rate_limit_logs
  FOR ALL USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
  );

-- upload_attempts: サービスロールのみアクセス可能
DROP POLICY IF EXISTS upload_attempts_service_role ON public.upload_attempts;
CREATE POLICY upload_attempts_service_role ON public.upload_attempts
  FOR ALL USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
  );

-- =====================================================================
-- 7. トリガー設定（updated_at自動更新）
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;

-- =====================================================================
-- 適用後の確認クエリ
-- =====================================================================
-- SELECT
--   EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_profiles') as has_user_profiles,
--   EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='rate_limit_logs') as has_rate_limit_logs,
--   EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='upload_attempts') as has_upload_attempts,
--   EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='work_id') as products_has_work_id;
