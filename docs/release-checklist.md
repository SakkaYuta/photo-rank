# リリースチェックリスト（MVP）

## 環境変数（Edge/Server）
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- SendGrid: `SENDGRID_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`（任意）
- App: `APP_ORIGIN`（メール内の「開く」ボタンURL）

## Edge Functions（デプロイ＆動作確認）
- `stripe-webhook`
  - `payment_intent.succeeded/failed`、`charge.refunded` をテスト送信
  - DBにイベント記録、メール送信ログを確認
- `create-bulk-payment-intent`
  - 有効なclientSecretが返る、purchases pendingが作成される

## 手動スモーク（本番/ステージング）
- 単品購入（成功/失敗/キャンセル）→ サンクスモーダル/履歴反映/メール
- 一括購入（2商品以上）→ サンクス/履歴/メールに明細
- 返金（Stripeから）→ 履歴がrefunded/メール
- Checkout同意チェック（CartView）→ 未同意で不可/法務リンク遷移

## 体験/表示
- 成功モーダルの文言/導線（履歴/ショッピング）
- フッターの法務リンク（利用規約/プライバシー/返金/特商法）
- 主要画面のキーボード操作/コントラストAA/alt

## 計測/運用
- dataLayer/gtag（任意）の動作確認
- アラートしきい値（失敗率/連続エラー/レイテンシ）を運用に設定

