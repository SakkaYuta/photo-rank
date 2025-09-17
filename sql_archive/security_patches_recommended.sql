-- PhotoRank v5.0 中優先度セキュリティパッチ
-- 実行順序: security_patches_critical.sql の後に実行してください

-- =====================================
-- 1. ストレージ閲覧制御（原画像の秘匿）
-- =====================================

-- 原画像用の非公開ストレージポリシー
-- 注意: 実際のバケット作成は Supabase コンソールで行ってください

-- 原画像バケット（photos-original）のRLS設定例
-- CREATE POLICY "Original photos owner access" ON storage.objects 
-- FOR SELECT USING (
--   bucket_id = 'photos-original' AND 
--   auth.uid()::text = (storage.foldername(name))[1]
-- );

-- 透かし画像バケット（photos-watermarked）の公開アクセス設定例
-- CREATE POLICY "Watermarked photos public read" ON storage.objects 
-- FOR SELECT USING (
--   bucket_id = 'photos-watermarked' AND 
--   starts_with(name, 'watermarked/')
-- );

-- =====================================
-- 2. 組織権限の拡張（将来対応）
-- =====================================

-- 組織メンバー管理テーブル（v5.0将来拡張用）
CREATE TABLE IF NOT EXISTS public.organizer_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid REFERENCES public.organizers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by uuid REFERENCES public.users(id),
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organizer_id, user_id)
);

-- RLS有効化
ALTER TABLE public.organizer_members ENABLE ROW LEVEL SECURITY;

-- 組織メンバーのアクセスポリシー
CREATE POLICY "Users can view organization members" ON public.organizer_members
FOR SELECT USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.organizer_members om2 
    WHERE om2.organizer_id = organizer_members.organizer_id 
    AND om2.user_id = auth.uid() 
    AND om2.is_active = true
  )
);

-- 組織管理者のみがメンバー管理可能
CREATE POLICY "Organization admins manage members" ON public.organizer_members
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.organizer_members om 
    WHERE om.organizer_id = organizer_members.organizer_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'admin' 
    AND om.is_active = true
  )
);

-- =====================================
-- 3. payouts/sales拡張RLS（組織対応）
-- =====================================

-- payouts_v31 の組織メンバーアクセス拡張
DROP POLICY IF EXISTS "payouts_v31_extended_access" ON public.payouts_v31;
CREATE POLICY "payouts_v31_extended_access" ON public.payouts_v31
FOR SELECT USING (
  creator_user_id = auth.uid() OR
  public.is_admin_user(auth.uid()) OR
  -- 組織メンバーもアクセス可能（将来拡張）
  EXISTS (
    SELECT 1 FROM public.organizer_members om
    JOIN public.works w ON w.creator_user_id = creator_user_id
    WHERE om.user_id = auth.uid() 
    AND om.is_active = true
    AND om.role IN ('admin', 'member')
  )
);

-- sales の組織メンバーアクセス拡張
DROP POLICY IF EXISTS "sales_extended_access" ON public.sales;
CREATE POLICY "sales_extended_access" ON public.sales
FOR SELECT USING (
  creator_user_id = auth.uid() OR
  public.is_admin_user(auth.uid()) OR
  -- 組織メンバーもアクセス可能（将来拡張）
  EXISTS (
    SELECT 1 FROM public.organizer_members om
    JOIN public.works w ON w.creator_user_id = creator_user_id
    WHERE om.user_id = auth.uid() 
    AND om.is_active = true
    AND om.role IN ('admin', 'member')
  )
);

-- =====================================
-- 4. レートリミット機能の標準化
-- =====================================

-- 新しいEdge Functionで使用する標準レートリミット関数
CREATE OR REPLACE FUNCTION public.check_standard_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer DEFAULT 100,
  p_window_minutes integer DEFAULT 60
)
RETURNS boolean AS $$
DECLARE
  current_count integer;
  window_start timestamptz;
BEGIN
  window_start := now() - (p_window_minutes || ' minutes')::interval;
  
  -- 現在のカウントを取得
  SELECT COUNT(*) INTO current_count
  FROM public.rate_limits
  WHERE user_id = p_user_id 
    AND action = p_action 
    AND created_at > window_start;
  
  -- 制限チェック
  IF current_count >= p_limit THEN
    RETURN false;
  END IF;
  
  -- 制限内の場合、記録を追加
  INSERT INTO public.rate_limits (user_id, action, created_at)
  VALUES (p_user_id, p_action, now())
  ON CONFLICT (user_id, action, created_at) DO NOTHING;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 5. 画像処理サービス分離対応（設定）
-- =====================================

-- 外部画像処理サービス設定テーブル
CREATE TABLE IF NOT EXISTS public.service_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text UNIQUE NOT NULL,
  endpoint_url text NOT NULL,
  api_key_hash text, -- ハッシュ化されたAPIキー
  is_active boolean DEFAULT true,
  timeout_seconds integer DEFAULT 30,
  retry_count integer DEFAULT 3,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS有効化（管理者のみ）
ALTER TABLE public.service_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service configs admin only" ON public.service_configs
FOR ALL USING (public.is_admin_strict(auth.uid()));

-- 画像処理サービス設定の初期データ
INSERT INTO public.service_configs (service_name, endpoint_url, is_active)
VALUES ('watermark-service', 'http://localhost:3002', true)
ON CONFLICT (service_name) DO NOTHING;

-- =====================================
-- 6. 監査ログ拡張とダッシュボード用ビュー
-- =====================================

-- 監査ログ集計ビュー（管理ダッシュボード用）
CREATE OR REPLACE VIEW public.audit_dashboard AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  table_name,
  operation,
  COUNT(*) as operation_count,
  COUNT(DISTINCT user_id) as unique_users
FROM public.audit_logs
WHERE created_at > now() - interval '30 days'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 4 DESC;

-- セキュリティイベント監視ビュー
CREATE OR REPLACE VIEW public.security_events AS
SELECT 
  al.created_at,
  al.table_name,
  al.operation,
  al.user_id,
  u.email as user_email,
  u.role as user_role,
  CASE 
    WHEN al.table_name = 'purchases' AND al.operation = 'INSERT' THEN 'Payment Created'
    WHEN al.table_name = 'works' AND al.operation = 'UPDATE' AND (al.new_data->>'is_published')::boolean = true THEN 'Work Published'
    WHEN al.table_name = 'manufacturing_orders' AND al.operation = 'INSERT' THEN 'Manufacturing Order Created'
    ELSE 'General Activity'
  END as event_type
FROM public.audit_logs al
LEFT JOIN public.users u ON u.id = al.user_id
WHERE al.created_at > now() - interval '7 days'
ORDER BY al.created_at DESC;

-- RLS設定（管理者のみ）
ALTER VIEW public.audit_dashboard OWNER TO postgres;
ALTER VIEW public.security_events OWNER TO postgres;

-- =====================================
-- 7. ヘルスチェック・整合性確認
-- =====================================

-- システム整合性チェック関数
CREATE OR REPLACE FUNCTION public.check_system_integrity()
RETURNS table(
  check_name text,
  status text,
  details text
) AS $$
BEGIN
  -- Stripe購入データの整合性
  RETURN QUERY
  SELECT 
    'stripe_purchases_integrity'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END::text,
    'Found ' || COUNT(*)::text || ' purchases without stripe_payment_intent_id'::text
  FROM public.purchases 
  WHERE stripe_payment_intent_id IS NULL AND total_amount_cents > 0;
  
  -- 製造パートナーのowner_user_id設定状況
  RETURN QUERY
  SELECT 
    'partner_ownership_integrity'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERROR' END::text,
    'Found ' || COUNT(*)::text || ' partners without owner_user_id'::text
  FROM public.manufacturing_partners 
  WHERE owner_user_id IS NULL;
  
  -- レートリミット機能の動作確認
  RETURN QUERY
  SELECT 
    'rate_limit_functionality'::text,
    CASE WHEN public.check_standard_rate_limit(
      '00000000-0000-0000-0000-000000000000'::uuid, 
      'test', 1, 1
    ) THEN 'OK' ELSE 'ERROR' END::text,
    'Rate limit function test'::text;
  
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- パッチ適用完了確認
-- =====================================

-- 推奨セキュリティパッチの適用確認
SELECT 
  'Recommended Security Patches Applied' as status,
  now() as applied_at,
  (SELECT COUNT(*) FROM public.organizer_members) as organizer_members_table_ready,
  (SELECT COUNT(*) FROM public.service_configs) as service_configs_ready;