# 運用手順書 v5.0 - 製造マーケットプレイス

v5.0 マーケットプレイス型システムの日常運用手順書

## 目次
1. [日次運用](#日次運用)
2. [月次運用](#月次運用)
3. [パートナー管理](#パートナー管理)
4. [支払い処理](#支払い処理)
5. [監視・アラート](#監視アラート)
6. [トラブルシューティング](#トラブルシューティング)

## 日次運用

### 1. システム稼働確認
```bash
# 基本ヘルスチェック
curl -f https://your-app.com/api/health

# データベース接続確認
psql $SUPABASE_DB_URL -c "SELECT COUNT(*) FROM manufacturing_partners;"
```

### 2. 注文処理状況確認
```sql
-- 処理待ち注文数
SELECT 
  status,
  COUNT(*) as count
FROM manufacturing_orders
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY status
ORDER BY status;

-- 長期間未処理の注文（24時間以上）
SELECT 
  id,
  order_id,
  status,
  created_at,
  EXTRACT(epoch FROM (now() - created_at))/3600 as hours_since_created
FROM manufacturing_orders
WHERE status IN ('submitted', 'accepted')
  AND created_at < (now() - interval '24 hours')
ORDER BY created_at;
```

### 3. パートナー活動状況
```sql
-- 本日の新規パートナー登録
SELECT COUNT(*) as new_partners_today
FROM manufacturing_partners
WHERE DATE(created_at) = CURRENT_DATE;

-- 本日の商品追加/更新
SELECT COUNT(*) as products_updated_today
FROM factory_products
WHERE DATE(updated_at) = CURRENT_DATE;
```

## 月次運用

### 1. 支払い生成処理（月初実行）
```bash
# Edge Function経由で支払い処理実行（要管理者権限）
curl -X POST https://your-supabase-project.supabase.co/functions/v1/process-payouts \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json"

# または直接SQL実行
psql $SUPABASE_DB_URL -c "SELECT public.generate_monthly_payouts_v50();"
```

### 2. 支払い状況確認
```sql
-- 今月の支払い生成状況
SELECT 
  status,
  COUNT(*) as count,
  SUM(final_payout) as total_amount
FROM payouts_v31
WHERE DATE_TRUNC('month', scheduled_date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY status;

-- ready_for_transfer状態の支払い一覧
SELECT 
  id,
  recipient_id,
  recipient_type,
  final_payout,
  breakdown->>'creator_name' as creator_name
FROM payouts_v31
WHERE status = 'ready_for_transfer'
ORDER BY final_payout DESC;
```

### 3. 月次レポート生成
```sql
-- 月間取引サマリー
SELECT 
  DATE_TRUNC('month', purchased_at) as month,
  COUNT(*) as total_sales,
  SUM(creator_profit) as total_creator_profit,
  SUM(platform_total_revenue) as total_platform_revenue
FROM creator_earnings_v50
WHERE purchased_at >= DATE_TRUNC('month', CURRENT_DATE - interval '1 month')
GROUP BY DATE_TRUNC('month', purchased_at)
ORDER BY month;
```

## パートナー管理

### 1. 新規パートナー審査
```sql
-- 審査待ちパートナー一覧
SELECT 
  id,
  name,
  company_name,
  contact_email,
  created_at,
  description
FROM manufacturing_partners
WHERE status = 'pending'
ORDER BY created_at;

-- パートナー承認
UPDATE manufacturing_partners 
SET 
  status = 'approved',
  updated_at = now()
WHERE id = 'partner-id-here';

-- パートナー拒否/停止
UPDATE manufacturing_partners 
SET 
  status = 'suspended',
  updated_at = now()
WHERE id = 'partner-id-here';
```

### 2. パートナーパフォーマンス確認
```sql
-- パートナー別受注・完了率
SELECT 
  mp.name,
  mp.company_name,
  COUNT(*) as total_orders,
  COUNT(*) FILTER (WHERE mo.status = 'shipped') as completed_orders,
  ROUND(100.0 * COUNT(*) FILTER (WHERE mo.status = 'shipped') / COUNT(*), 1) as completion_rate
FROM manufacturing_partners mp
LEFT JOIN manufacturing_orders mo ON mo.partner_id = mp.id
WHERE mp.status = 'approved'
GROUP BY mp.id, mp.name, mp.company_name
HAVING COUNT(*) > 0
ORDER BY completion_rate DESC;
```

## 支払い処理

### 1. 手動振込処理
```sql
-- 当日処理対象の支払い確認
SELECT 
  id,
  recipient_id,
  final_payout,
  breakdown->>'creator_name' as name,
  notes
FROM payouts_v31
WHERE status = 'ready_for_transfer'
  AND scheduled_date <= CURRENT_DATE
ORDER BY final_payout DESC;

-- 振込完了の記録（個別）
UPDATE payouts_v31 
SET 
  status = 'completed',
  paid_at = now(),
  transaction_id = 'manual_20240115_001', -- 実際の取引ID
  notes = COALESCE(notes, '') || ' 銀行振込完了'
WHERE id = 'payout-id-here'
  AND status = 'ready_for_transfer';

-- 一括完了処理（当日分全て）
UPDATE payouts_v31 
SET 
  status = 'completed',
  paid_at = now(),
  transaction_id = 'batch_' || TO_CHAR(now(), 'YYYYMMDD') || '_' || LPAD(ROW_NUMBER() OVER (ORDER BY id)::text, 3, '0'),
  notes = COALESCE(notes, '') || ' 一括振込完了'
WHERE status = 'ready_for_transfer'
  AND scheduled_date <= CURRENT_DATE;
```

### 2. 支払い失敗処理
```sql
-- 支払い失敗の記録
UPDATE payouts_v31 
SET 
  status = 'failed',
  notes = '振込先口座エラー: 口座番号不正'
WHERE id = 'failed-payout-id'
  AND status = 'ready_for_transfer';

-- 失敗分の再スケジュール
UPDATE payouts_v31 
SET 
  status = 'scheduled',
  scheduled_date = scheduled_date + interval '7 days',
  notes = COALESCE(notes, '') || ' 再スケジュール'
WHERE status = 'failed'
  AND id = 'payout-id-to-reschedule';
```

## 監視・アラート

### 1. 重要メトリクスの監視
```sql
-- エラー率チェック（過去24時間）
SELECT 
  COUNT(*) FILTER (WHERE status = 'failed') as failed_orders,
  COUNT(*) as total_orders,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*), 2) as error_rate
FROM manufacturing_orders
WHERE created_at >= now() - interval '24 hours';

-- 長期間未処理注文
SELECT COUNT(*) as stuck_orders
FROM manufacturing_orders
WHERE status IN ('submitted', 'accepted')
  AND created_at < now() - interval '48 hours';

-- パートナー応答時間
SELECT 
  AVG(EXTRACT(epoch FROM (assigned_at - created_at))/3600) as avg_response_hours
FROM manufacturing_orders
WHERE assigned_at IS NOT NULL
  AND created_at >= now() - interval '7 days';
```

### 2. システム負荷監視
```sql
-- データベース接続数
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- テーブルサイズ監視
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

## トラブルシューティング

### 1. よくある問題と対処法

**製造注文が工場に届かない**
```sql
-- 該当注文の詳細確認
SELECT 
  mo.*,
  mp.name as partner_name,
  mp.contact_email
FROM manufacturing_orders mo
JOIN manufacturing_partners mp ON mp.id = mo.partner_id
WHERE mo.order_id = 'problem-order-id';

-- 手動で工場に通知を再送
INSERT INTO partner_notifications (
  partner_id,
  type,
  payload,
  status
) VALUES (
  'partner-id',
  'new_order',
  jsonb_build_object('order_id', 'problem-order-id'),
  'queued'
);
```

**支払い計算エラー**
```sql
-- 問題のある購入データ確認
SELECT 
  p.*,
  (p.price - COALESCE(p.factory_payment, 0) - COALESCE(p.platform_total_revenue, 0)) as calculated_profit
FROM purchases p
WHERE id = 'problem-purchase-id';

-- 手数料再計算
UPDATE purchases 
SET 
  platform_markup = ROUND(COALESCE(factory_payment, 0) * 0.10),
  platform_sales_fee = ROUND(price * 0.30),
  platform_total_revenue = ROUND(COALESCE(factory_payment, 0) * 0.10) + ROUND(price * 0.30)
WHERE id = 'problem-purchase-id';
```

**RLS権限エラー**
```sql
-- ユーザーの権限確認
SELECT 
  id,
  email,
  role,
  created_at
FROM auth.users au
JOIN public.users pu ON pu.id = au.id
WHERE au.email = 'problem-user@example.com';

-- パートナーの所有権確認
SELECT 
  mp.*,
  u.email as owner_email
FROM manufacturing_partners mp
LEFT JOIN users u ON u.id = mp.owner_user_id
WHERE mp.contact_email = 'partner@example.com';
```

### 2. 緊急時対応

**システム全体停止**
1. サービス状況確認
2. データベース接続確認
3. Edge Functions 稼働確認
4. ログ分析
5. 復旧手順実行

**データ不整合発見時**
1. 該当データの特定と範囲確認
2. バックアップからの復旧計画立案
3. 影響ユーザーの特定
4. 修正クエリの作成とテスト
5. 本番適用とユーザー通知

## 定期メンテナンス

### 週次
- システムパフォーマンス確認
- ログローテーション
- 不要データの削除

### 月次
- 支払い処理実行
- 月次レポート作成
- パートナー評価更新

### 四半期
- パフォーマンス分析
- システム最適化検討
- セキュリティ監査

## 連絡先

### 緊急時連絡先
- システム管理者: system-admin@company.com
- 事業責任者: business-owner@company.com
- 技術サポート: tech-support@company.com

### エスカレーション手順
1. Level 1: 自動復旧/標準手順
2. Level 2: システム管理者対応
3. Level 3: 技術チーム召集
4. Level 4: 事業責任者判断