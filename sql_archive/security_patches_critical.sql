-- PhotoRank v5.0 高優先度セキュリティパッチ
-- 実行順序: setup_owner_user_id.sql の後に実行してください

-- =====================================
-- 1. Stripe Webhook整合性修正 (CRITICAL)
-- =====================================

-- purchases テーブルにStripe Webhookで必要なカラムを追加
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'jpy';

ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Stripe Payment Intent IDの重複を防ぐ一意制約
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_pi_unique 
ON public.purchases((COALESCE(stripe_payment_intent_id, ''))) 
WHERE stripe_payment_intent_id IS NOT NULL;

-- =====================================
-- 2. Webhook Events重複/機密情報保護 (CRITICAL)
-- =====================================

-- Webhook イベントログテーブルを作成（重複防止＋RLS）
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE, -- Stripe event IDによる重複防止
  event_type text,
  payload jsonb, -- 機密情報含む可能性があるため管理者のみアクセス
  processing_time_ms integer,
  created_at timestamptz DEFAULT now()
);

-- RLS有効化（管理者のみ閲覧可能）
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- 厳格な管理者判定関数
CREATE OR REPLACE FUNCTION public.is_admin_strict(p_user uuid) 
RETURNS boolean AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.users u 
    WHERE u.id = p_user AND u.role = 'admin'
  );
$$ LANGUAGE sql STABLE;

-- 管理者のみアクセス可能なポリシー
DROP POLICY IF EXISTS webhook_events_admin ON public.webhook_events;
CREATE POLICY webhook_events_admin ON public.webhook_events 
FOR SELECT USING (public.is_admin_strict(auth.uid()));

-- =====================================
-- 3. データ保管期間ポリシー (推奨)
-- =====================================

-- Webhook イベントログの自動クリーンアップ（30日）
-- 注意: pg_cronが利用可能な場合のみ有効
-- DELETE FROM public.webhook_events WHERE created_at < now() - interval '30 days';

-- =====================================
-- 4. 既存データの整合性確認
-- =====================================

-- purchases テーブルの既存データチェック用ビュー
CREATE OR REPLACE VIEW public.purchases_integrity_check AS
SELECT 
  id,
  work_id,
  buyer_user_id,
  total_amount_cents,
  currency,
  stripe_payment_intent_id,
  created_at,
  CASE 
    WHEN currency IS NULL THEN 'Missing currency'
    WHEN stripe_payment_intent_id IS NULL THEN 'Missing payment intent ID'
    ELSE 'OK'
  END as integrity_status
FROM public.purchases
ORDER BY created_at DESC;

-- =====================================
-- 5. 監査ログの強化
-- =====================================

-- purchases テーブルの変更を監査ログに記録するトリガー
CREATE OR REPLACE FUNCTION public.log_purchases_changes()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      table_name, 
      operation, 
      record_id, 
      user_id, 
      new_data
    ) VALUES (
      'purchases', 
      'INSERT', 
      NEW.id::text, 
      COALESCE(auth.uid(), NEW.buyer_user_id),
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      table_name, 
      operation, 
      record_id, 
      user_id, 
      old_data,
      new_data
    ) VALUES (
      'purchases', 
      'UPDATE', 
      NEW.id::text, 
      COALESCE(auth.uid(), NEW.buyer_user_id),
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- purchases テーブルに監査トリガーを追加
DROP TRIGGER IF EXISTS trigger_purchases_audit ON public.purchases;
CREATE TRIGGER trigger_purchases_audit
  AFTER INSERT OR UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.log_purchases_changes();

-- =====================================
-- パッチ適用完了確認
-- =====================================

-- パッチ適用状況の確認用クエリ
SELECT 
  'Critical Security Patches Applied' as status,
  now() as applied_at,
  version() as database_version;