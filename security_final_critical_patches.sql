-- PhotoRank v5.0 最終セキュリティ再点検 - 最優先修正パッチ
-- 実行順序: setup_owner_user_id.sql の直後に実行してください
-- 実害に直結するものから優先度順に配列

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
-- 最優先 2: purchases のRLS（クライアント閲覧制御）
-- =====================================

-- 自分の購入データのみ閲覧可能に（WebhookはサービスロールでRLSをバイパス）
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchases_select_self ON public.purchases;

-- purchasesテーブルの実際のカラム名を確認して修正
-- buyer_user_id カラムを使用（実際のテーブル構造に基づく）
CREATE POLICY purchases_select_self ON public.purchases 
FOR SELECT USING (
  buyer_user_id = auth.uid() OR 
  public.is_admin_strict(auth.uid())
);

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
-- 高優先 4: manufacturing_orders の updated_at 欠落を補完
-- =====================================

-- フロントから更新時（updateOrderStatus）に updated_at を正しく記録
ALTER TABLE public.manufacturing_orders 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- updated_at 自動更新トリガー
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
-- 確認・検証クエリ
-- =====================================

-- 最優先修正の適用確認
SELECT 
  'Final Critical Security Patches Applied' as status,
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
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'purchases';