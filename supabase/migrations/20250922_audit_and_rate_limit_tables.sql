-- 監査ログとレート制限テーブル
-- セキュリティとコンプライアンスのためのログシステム

-- 監査ログテーブル
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- レート制限ログテーブル
CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 監査ログのインデックス（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource);

-- レート制限のインデックス
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_key ON public.rate_limit_logs(key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_created_at ON public.rate_limit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_expires_at ON public.rate_limit_logs(expires_at);

-- 古いレート制限ログを自動削除する関数
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rate_limit_logs
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 定期的なクリーンアップ（必要に応じてcronで実行）
-- SELECT cron.schedule('cleanup-rate-limits', '*/5 * * * *', 'SELECT cleanup_expired_rate_limits();');

-- RLS設定（管理者のみアクセス可能）
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- 監査ログポリシー（サービスロールと管理者のみ）
DROP POLICY IF EXISTS "audit_logs_service_role_all" ON public.audit_logs;
CREATE POLICY "audit_logs_service_role_all" ON public.audit_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- レート制限ログポリシー（サービスロールのみ）
DROP POLICY IF EXISTS "rate_limit_logs_service_role_all" ON public.rate_limit_logs;
CREATE POLICY "rate_limit_logs_service_role_all" ON public.rate_limit_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 監査ログビュー（管理者用）
CREATE OR REPLACE VIEW public.audit_summary AS
SELECT
  action,
  resource,
  COUNT(*) as event_count,
  COUNT(CASE WHEN success = false THEN 1 END) as failure_count,
  MAX(created_at) as last_occurrence
FROM public.audit_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY action, resource
ORDER BY event_count DESC;

-- セキュリティアラート用のビュー
CREATE OR REPLACE VIEW public.security_alerts AS
SELECT
  user_id,
  ip_address,
  action,
  COUNT(*) as failure_count,
  MAX(created_at) as last_failure
FROM public.audit_logs
WHERE
  success = false
  AND created_at >= NOW() - INTERVAL '1 hour'
GROUP BY user_id, ip_address, action
HAVING COUNT(*) >= 3  -- 1時間に3回以上の失敗
ORDER BY failure_count DESC;

-- コメント追加
COMMENT ON TABLE public.audit_logs IS 'セキュリティ監査ログ - すべてのセンシティブな操作を記録';
COMMENT ON TABLE public.rate_limit_logs IS 'レート制限ログ - API呼び出し頻度の制御';
COMMENT ON VIEW public.audit_summary IS '24時間以内の監査ログサマリー';
COMMENT ON VIEW public.security_alerts IS 'セキュリティアラート - 短時間での失敗の検知';