# セキュリティ検証手順書 v5.0

v5.0 セキュリティハードニング適用後の検証手順

## 目次
1. [マイグレーション適用確認](#マイグレーション適用確認)
2. [Rate Limiting検証](#rate-limiting検証)
3. [認証・認可検証](#認証認可検証)
4. [ファイルアップロード検証](#ファイルアップロード検証)
5. [監査ログ検証](#監査ログ検証)
6. [XSS対策検証](#xss対策検証)
7. [継続監視設定](#継続監視設定)

## マイグレーション適用確認

### 1. マイグレーション実行状況
```sql
-- v5.0セキュリティマイグレーションの適用確認
SELECT version, executed_at, checksum 
FROM public.schema_migrations 
WHERE version = 'v5.0_security';

-- 期待結果: 1行返され、executed_atが最近の日時であること
```

### 2. セキュリティテーブル存在確認
```sql
-- rate_limits テーブル
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema='public' AND table_name='rate_limits'
);

-- audit_logs テーブルの新しいカラム
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema='public' AND table_name='audit_logs' 
  AND column_name IN ('severity', 'risk_score');
```

### 3. セキュリティ関数の動作確認
```sql
-- rate limit関数のテスト（実際のレコードは作成されない）
SELECT public.check_rate_limit(
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid,  -- テスト用UUID
  'test_action',
  5,
  60
);
-- 期待結果: true（初回なのでレート制限なし）

-- MIME検証関数のテスト
SELECT public.validate_image_mime_type(
  'image/jpeg',
  '\xFFD8FF'::bytea  -- JPEG魔法数
);
-- 期待結果: true
```

## Rate Limiting検証

### 1. Edge Functions Rate Limiting

#### Manufacturing Order
```bash
# 正常リクエスト（制限内）
curl -X POST https://your-project.supabase.co/functions/v1/manufacturing-order \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "test-order-001",
    "productData": {
      "product_type": "poster",
      "quantity": 1,
      "workId": "valid-work-id"
    }
  }'
# 期待結果: HTTP 200, レスポンス正常

# Rate limit超過テスト（101回目のリクエスト）
for i in {1..101}; do
  curl -s -X POST https://your-project.supabase.co/functions/v1/manufacturing-order \
    -H "Authorization: Bearer $USER_JWT" \
    -H "Content-Type: application/json" \
    -d '{...}' > /dev/null
done
# 期待結果: 101回目でHTTP 429エラー
```

#### Payment Intent
```bash
# 21回目のリクエストでrate limit
for i in {1..21}; do
  curl -s -X POST https://your-project.supabase.co/functions/v1/create-payment-intent \
    -H "Authorization: Bearer $USER_JWT" \
    -H "Content-Type: application/json" \
    -d '{"workId": "test-work-id"}' 
done
# 期待結果: 21回目でHTTP 429
```

### 2. Rate Limit状況監視
```sql
-- 現在のrate limit使用状況
SELECT * FROM public.security_rate_limit_stats;

-- 特定ユーザーのrate limit状況
SELECT 
  action_type,
  request_count,
  window_start,
  expires_at
FROM public.rate_limits 
WHERE user_id = 'target-user-id'
ORDER BY window_start DESC;
```

## 認証・認可検証

### 1. 管理者権限チェック

#### Process Payouts（管理者のみ）
```bash
# 一般ユーザーでのアクセス（失敗すべき）
curl -X POST https://your-project.supabase.co/functions/v1/process-payouts \
  -H "Authorization: Bearer $REGULAR_USER_JWT"
# 期待結果: HTTP 403 Forbidden

# 管理者でのアクセス（成功すべき）
curl -X POST https://your-project.supabase.co/functions/v1/process-payouts \
  -H "Authorization: Bearer $ADMIN_JWT"
# 期待結果: HTTP 200
```

#### 厳格な管理者チェック確認
```sql
-- ユーザーロールの確認
SELECT id, email, role FROM public.users WHERE role = 'admin';

-- 管理者関数の動作テスト
SELECT public.is_admin_strict('admin-user-id'::uuid);
-- 期待結果: true（管理者の場合）

SELECT public.is_admin_strict('regular-user-id'::uuid);
-- 期待結果: false（一般ユーザーの場合）
```

### 2. 作品所有権チェック
```bash
# 他人の作品での製造オーダー（失敗すべき）
curl -X POST https://your-project.supabase.co/functions/v1/manufacturing-order \
  -H "Authorization: Bearer $USER_A_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "unauthorized-order",
    "productData": {
      "product_type": "poster",
      "workId": "user-b-work-id"
    }
  }'
# 期待結果: HTTP 403 Unauthorized
```

## ファイルアップロード検証

### 1. MIME Type検証

#### 許可されたファイル形式
```bash
# 正常なJPEGファイル
curl -X POST https://your-project.supabase.co/functions/v1/add-watermark \
  -H "Authorization: Bearer $USER_JWT" \
  -F "image=@test-image.jpg" \
  -F "text=TEST"
# 期待結果: HTTP 200

# 正常なPNGファイル
curl -X POST https://your-project.supabase.co/functions/v1/add-watermark \
  -H "Authorization: Bearer $USER_JWT" \
  -F "image=@test-image.png" \
  -F "text=TEST"
# 期待結果: HTTP 200
```

#### 拒否されるファイル形式
```bash
# 偽装されたファイル（.txtを.jpgにリネーム）
curl -X POST https://your-project.supabase.co/functions/v1/add-watermark \
  -H "Authorization: Bearer $USER_JWT" \
  -F "image=@fake-image.jpg" \
  -F "text=TEST"
# 期待結果: HTTP 400 "Invalid file signature"

# 許可されていないSVGファイル
curl -X POST https://your-project.supabase.co/functions/v1/add-watermark \
  -H "Authorization: Bearer $USER_JWT" \
  -F "image=@test-image.svg" \
  -F "text=TEST"
# 期待結果: HTTP 400 "Invalid file type"
```

### 2. ファイルサイズ制限
```bash
# 10MB超過ファイル
curl -X POST https://your-project.supabase.co/functions/v1/add-watermark \
  -H "Authorization: Bearer $USER_JWT" \
  -F "image=@large-file-11mb.jpg" \
  -F "text=TEST"
# 期待結果: HTTP 413 "File too large"
```

### 3. 画像寸法制限
```bash
# 8000px超過画像（事前に作成が必要）
curl -X POST https://your-project.supabase.co/functions/v1/add-watermark \
  -H "Authorization: Bearer $USER_JWT" \
  -F "image=@huge-image-9000x9000.jpg" \
  -F "text=TEST"
# 期待結果: HTTP 500 "Image dimensions too large"
```

## 監査ログ検証

### 1. 支払い関連監査ログ
```sql
-- 支払い状況変更の監査ログ確認
INSERT INTO public.payouts_v31 (
  recipient_id, recipient_type, period_start, period_end,
  gross_revenue, transfer_fee, final_payout, status, scheduled_date
) VALUES (
  'test-user-id'::uuid, 'creator', '2024-01-01', '2024-01-31',
  10000, 250, 9750, 'scheduled', '2024-02-28'
);

-- ステータス更新（監査ログが生成されるはず）
UPDATE public.payouts_v31 
SET status = 'ready_for_transfer' 
WHERE recipient_id = 'test-user-id'::uuid;

-- 監査ログの確認
SELECT 
  action,
  old_data,
  new_data,
  severity,
  risk_score,
  created_at
FROM public.audit_logs
WHERE table_name = 'payouts_v31'
ORDER BY created_at DESC
LIMIT 5;
```

### 2. 高リスクイベント監視
```sql
-- 高リスクイベントの確認
SELECT * FROM public.security_high_risk_events LIMIT 10;

-- セキュリティダッシュボード
SELECT * FROM public.security_audit_dashboard;
```

## XSS対策検証

### 1. SVGテキスト消毒
```bash
# 悪意のあるXMLテキスト
curl -X POST https://your-project.supabase.co/functions/v1/add-watermark \
  -H "Authorization: Bearer $USER_JWT" \
  -F "image=@test-image.jpg" \
  -F "text=<script>alert('xss')</script>"
# 期待結果: HTTP 200、生成されたSVGに&lt;script&gt;が含まれる

# 実際の出力確認
# 生成されたSVGファイルを確認し、XMLエスケープが適用されていることを確認
```

### 2. XML消毒関数テスト
```sql
-- XML消毒関数のテスト
SELECT public.sanitize_xml_text('<script>alert("xss")</script>');
-- 期待結果: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;

SELECT public.sanitize_xml_text('Normal text & symbols');
-- 期待結果: Normal text &amp; symbols
```

## 継続監視設定

### 1. 監視ダッシュボードセットアップ
```sql
-- 日次セキュリティメトリクス
CREATE OR REPLACE VIEW public.daily_security_metrics AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE severity = 'critical') as critical_events,
  COUNT(*) FILTER (WHERE severity = 'error') as error_events,
  COUNT(*) FILTER (WHERE severity = 'warning') as warning_events,
  AVG(risk_score) as avg_risk_score
FROM public.audit_logs
WHERE created_at >= CURRENT_DATE - interval '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 2. アラート設定（pg_cron使用）
```sql
-- クリティカルイベントの自動チェック
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'security-alert-check',
      '*/15 * * * *', -- 15分毎
      $$
      SELECT CASE 
        WHEN EXISTS (
          SELECT 1 FROM public.audit_logs 
          WHERE severity = 'critical' 
            AND created_at >= now() - interval '15 minutes'
        ) THEN 'CRITICAL SECURITY EVENT DETECTED'
        ELSE 'OK'
      END;
      $$
    );
  END IF;
END $$;
```

### 3. 定期メンテナンス
```sql
-- 古いrate limitレコードのクリーンアップ確認
SELECT COUNT(*) FROM public.rate_limits WHERE expires_at < now() - interval '1 day';

-- 古い監査ログのクリーンアップ確認（90日以上前）
SELECT COUNT(*) FROM public.audit_logs WHERE created_at < now() - interval '90 days';
```

## セキュリティ検証チェックリスト

### マイグレーション
- [ ] `v5.0_security` マイグレーションが適用済み
- [ ] `rate_limits` テーブルが作成済み
- [ ] `audit_logs` テーブルに新しいカラムが追加済み
- [ ] セキュリティ関数が作成済み

### Rate Limiting
- [ ] `manufacturing-order` で100回/時間制限が動作
- [ ] `create-payment-intent` で20回/時間制限が動作
- [ ] `acquire-work-lock` で60回/時間制限が動作
- [ ] `add-watermark` で50回/時間制限が動作

### 認証・認可
- [ ] `process-payouts` が管理者のみアクセス可能
- [ ] `is_admin_strict` 関数が正しく動作
- [ ] 作品所有権チェックが正しく動作

### ファイルアップロード
- [ ] MIME Type検証が動作（jpeg/png/webp のみ許可）
- [ ] ファイル魔法数チェックが動作
- [ ] ファイルサイズ制限（10MB）が動作
- [ ] 画像寸法制限（8000px）が動作

### XSS対策
- [ ] SVGテキストのXML消毒が動作
- [ ] `sanitize_xml_text` 関数が正しく動作

### 監査ログ
- [ ] 支払い状況変更時に監査ログが生成される
- [ ] 適切な severity と risk_score が設定される
- [ ] セキュリティ監視ビューが正常に動作

### 継続監視
- [ ] セキュリティダッシュボードが設定済み
- [ ] 自動クリーンアップジョブが設定済み
- [ ] アラート機能が設定済み（オプション）

## トラブルシューティング

### よくある問題

**Rate Limit関数が見つからない**
```sql
-- 関数の存在確認
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'check_rate_limit';
```

**監査ログが生成されない**
```sql
-- トリガーの確認
SELECT trigger_name, event_object_table, trigger_schema
FROM information_schema.triggers 
WHERE trigger_name = 'audit_payouts_v31_changes';
```

**MIME検証エラー**
```sql
-- 関数の動作確認
SELECT public.validate_image_mime_type('image/jpeg', '\xFFD8FF'::bytea);
```

## セキュリティ運用指標

### KPI
- **Rate Limit違反**: 1日あたり10件未満
- **認証失敗**: 1日あたり100件未満  
- **ファイルアップロード拒否**: 全アップロードの5%未満
- **Critical監査ログ**: 1日あたり0件
- **Error監査ログ**: 1日あたり10件未満

### 監視頻度
- **リアルタイム**: Critical/Error監査ログ
- **15分毎**: Rate limit使用状況
- **1時間毎**: 認証失敗パターン
- **日次**: セキュリティメトリクス総合レポート
- **週次**: セキュリティ設定レビュー