-- ステップ8: RLS有効化とポリシー作成
-- RLS有効化
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ポリシー作成
DROP POLICY IF EXISTS rate_limits_access ON public.rate_limits;
CREATE POLICY rate_limits_access ON public.rate_limits
  FOR ALL USING (
    user_id = auth.uid() OR public.is_admin_safe(auth.uid())
  );

DROP POLICY IF EXISTS audit_logs_admin_access ON public.audit_logs;
CREATE POLICY audit_logs_admin_access ON public.audit_logs
  FOR SELECT USING (public.is_admin_safe(auth.uid()));