# PhotoRank v5.0 最終セキュリティ実装ガイド

## 🚨 最終セキュリティ再点検対応

この文書は最終セキュリティ再点検レポートに基づく、実害に直結する修正の実装ガイドです。

## 🔥 即時実行順序（Supabase SQLエディタ）

### 1. 基本設定
```sql
-- 1. 基本データ設定
setup_owner_user_id.sql

-- 2. テーブル構造確認（推奨）
debug_purchases_table_structure_minimal.sql

-- 3. 最優先セキュリティ修正（最終確実版）⭐ NEW
security_final_patches_v3.sql

-- 4. インデックス最適化（カラム存在確認版）⭐ NEW
security_index_cleanup_safe.sql

-- 5. パートナーレビューシステム 🆕
partner_reviews_table.sql
```

✅ **全エラー解決**: インデックス重複エラーも含む全ての問題を解決した最終確実版です

### 2. 手動設定（Supabaseコンソール）
```sql
-- 4. ストレージセキュリティ（手動設定が必要）
security_storage_policies.sql  -- 設定手順のみ記載
```

## ⚡ 最優先修正（即時実行必須）

### 1. Stripe Webhook整合性 🚨
**問題**: WebhookがpurchasesテーブルにcurrencyとPIカラムを書き込めない  
**影響**: 決済処理失敗、データ不整合、重複決済リスク  
**修正**: `security_final_critical_patches.sql`

```sql
-- 必要カラム追加
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS currency text DEFAULT 'jpy';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- 重複防止
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_pi_unique 
ON public.purchases((COALESCE(stripe_payment_intent_id, ''))) 
WHERE stripe_payment_intent_id IS NOT NULL;
```

### 2. purchases RLS制御 🔐
**問題**: 購入履歴が無制限アクセス可能  
**影響**: プライバシー侵害、機密情報漏洩  
**修正**: 自分の購入データのみアクセス可能に

```sql
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchases_select_self ON public.purchases 
FOR SELECT USING (buyer_user_id = auth.uid() OR public.is_admin_strict(auth.uid()));
```

### 3. webhook_events 重複・機密保護 🛡️
**問題**: Webhookイベント重複処理、機密情報無制限アクセス  
**影響**: リプレイアタック、機密情報漏洩  
**修正**: 一意制約とRLS

```sql
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE, -- 重複防止
  event_type text,
  payload jsonb,
  processing_time_ms integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY webhook_events_admin ON public.webhook_events 
FOR SELECT USING (public.is_admin_strict(auth.uid()));
```

### 4. manufacturing_orders.updated_at 補完 ⏰
**問題**: 注文ステータス更新時にupdated_atが記録されない  
**影響**: 更新履歴の欠損、監査ログ不備  
**修正**: カラム追加と自動更新トリガー

```sql
ALTER TABLE public.manufacturing_orders ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 自動更新トリガー設定
CREATE TRIGGER trigger_manufacturing_orders_updated_at
  BEFORE UPDATE ON public.manufacturing_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

## 🏗️ 中優先修正（推奨実行）

### 1. 危険な部分インデックス一掃 ⚠️
**問題**: now()/auth.*を使った部分インデックスがIMMUTABLE要件違反  
**影響**: インデックス破損、パフォーマンス低下、予期しないエラー  
**修正**: `security_index_cleanup.sql`

```sql
-- 危険インデックス削除
DROP INDEX IF EXISTS idx_rate_limits_cleanup;
-- 安全な代替作成
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON public.rate_limits(expires_at);
```

### 2. ストレージ閲覧制御 🖼️
**問題**: 原画像が誤って公開される可能性  
**影響**: 著作権侵害、収益機会の損失  
**修正**: バケット分離（手動設定）

#### バケット構成
- `photos-original` (非公開) - 原画像、所有者のみアクセス
- `photos-watermarked` (公開) - 透かし画像、パブリックアクセス

#### Supabaseコンソール設定
```javascript
// 原画像（非公開）
bucket_id = 'photos-original' AND 
auth.uid()::text = (storage.foldername(name))[1]

// 透かし画像（公開）
bucket_id = 'photos-watermarked' AND 
starts_with(name, 'watermarked/')
```

## 📊 実装確認

### 1. SQLパッチ適用確認
```sql
-- 最優先修正の確認
SELECT 
  'Final Critical Security Patches Applied' as status,
  now() as applied_at,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = 'public' 
   AND table_name = 'purchases' 
   AND column_name = 'stripe_payment_intent_id') as purchases_stripe_column,
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'webhook_events') as webhook_events_table;
```

### 2. システム整合性チェック
```sql
-- 全体的な整合性確認
SELECT * FROM public.check_system_integrity();

-- ストレージセキュリティ確認
SELECT * FROM public.check_storage_security();
```

## 🔧 Edge Functions 状況確認

### ✅ 完了済み項目
- **認証・権限**: JWT検証、管理者判定厳格化
- **入力検証**: 全関数で範囲・型チェック実装
- **レートリミット**: 統一的なcheck_rate_limit()使用
- **Stripe Webhook**: 署名検証済み

### 🔄 再デプロイ推奨関数
最優先SQLパッチ適用後、以下を再デプロイ：
- `add-watermark`
- `manufacturing-order` 
- `acquire-work-lock` / `release-work-lock`
- `create-payment-intent`
- `process-payouts`

## 📋 本番デプロイ前チェックリスト

### データベース
- [ ] `security_final_critical_patches.sql` 実行完了
- [ ] `security_index_cleanup.sql` 実行完了
- [ ] システム整合性チェックで全項目OK
- [ ] RLSポリシー動作確認

### ストレージ
- [ ] photos-original バケット作成（非公開）
- [ ] photos-watermarked バケット作成（公開）
- [ ] 各バケットのRLSポリシー設定完了

### Edge Functions
- [ ] 全関数の再デプロイ完了
- [ ] レートリミット動作確認
- [ ] Webhook重複防止確認

### 監視・運用
- [ ] セキュリティイベント監視設定
- [ ] 異常検知クエリの動作確認
- [ ] バックアップ・復旧手順確認

## 🚨 緊急時対応

### インシデント対応手順
```sql
-- 1. 問題ユーザーの一時停止
UPDATE public.users SET is_active = false WHERE id = 'USER_ID';

-- 2. 疑わしい取引の一時停止  
UPDATE public.purchases SET status = 'under_review' WHERE id = 'PURCHASE_ID';

-- 3. 活動ログの確認
SELECT * FROM public.audit_logs 
WHERE created_at > now() - interval '1 hour' 
ORDER BY created_at DESC;
```

### 監視クエリ
```sql
-- 異常な大量購入検知
SELECT buyer_user_id, COUNT(*), SUM(total_amount_cents)
FROM public.purchases 
WHERE created_at > now() - interval '1 hour'
GROUP BY buyer_user_id 
HAVING COUNT(*) > 10;

-- Webhook失敗検知
SELECT event_type, COUNT(*) 
FROM public.webhook_events
WHERE created_at > now() - interval '1 day'
  AND payload->>'status' = 'failed'
GROUP BY event_type;
```

## 📈 パフォーマンス最適化

### 重要インデックス
```sql
-- 購入履歴高速検索
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_buyer_created 
ON public.purchases(buyer_user_id, created_at DESC);

-- 製造注文状況検索
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_manufacturing_orders_partner_status 
ON public.manufacturing_orders(partner_id, status, created_at DESC);
```

## 🎯 次のステップ

1. **即時実行**: `security_final_critical_patches.sql`
2. **パフォーマンス改善**: `security_index_cleanup.sql`
3. **ストレージ設定**: Supabaseコンソールでの手動設定
4. **動作確認**: 整合性チェックと機能テスト
5. **運用開始**: 監視・アラート設定

---

**最終更新**: 2025-09-16  
**対象**: PhotoRank v5.0製造マーケットプレイス  
**優先度**: 🚨 最優先（実害防止）→ 🔧 高優先（安定性）→ 📊 中優先（運用）