# 運用・監視ランブック（MVP）

## 環境変数 / 設定
- Stripe
  - `VITE_STRIPE_PUBLISHABLE_KEY`: フロント用公開鍵
  - `STRIPE_SECRET_KEY`: Edge Function / サーバ側シークレット
  - Webhook Secret（任意）: 決済通知を受ける場合は署名検証を有効化
- Supabase Edge Functions
  - `create-bulk-payment-intent`: デプロイ・ロール/権限の確認
  - 環境に userId を安全に受け渡し（Authコンテキスト）

## 主要フロー
- まとめて決済（CartView）
  1. `purchaseService.initiateBulkPurchase(workIds)` → clientSecret取得
  2. Stripe Elements で `confirmCardPayment`
  3. `checkBulkPurchaseCompletion(paymentIntentId)` で完了確認
  4. 成功時 `SuccessModal`、失敗/一部失敗はトースト + 再試行受付
- 単品決済（CartDrawer/プレビュー）
  1. `initiatePurchase(workId)` → clientSecret
  2. `StripeCheckout`（成功でSuccessModal、対象商品はカートから削除）

## モニタリング / アラート
- メトリクス（推奨）
  - 決済成功率 / 失敗率 / キャンセル率
  - 平均決済時間 / Edge Functionレイテンシ
  - 失敗商品の件数・割合
- アラート閾値例
  - 失敗率 > 5% (5分移動平均)
  - 連続エラー5件
  - レイテンシ p95 > 3s

## 運用の注意
- 冪等性: Edge Function側で idempotency-key を考慮（重複決済防止）
- ロック管理: 失敗時のロック解放・タイムアウト復旧を確認
- バリデーション: リクエスト（cart items/quantity/amount）をzod等で検証
- 例外時のUX: エラー詳細はログへ、ユーザーには一般化した文言 + 再試行導線

## リリース前チェック（要点）
- .envの鍵類が本番用/権限最小になっているか
- UIの文言整合（まとめて購入、SuccessModal統一）
- 主要シナリオの手動スモーク（複数/一部失敗/キャンセル）
- A11yスポット確認（モーダルフォーカス、コントラスト）

