# 環境変数（Edge Functions / Frontend）

Edge Functions（Supabase）:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET

Frontend（Vite）:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_STRIPE_PUBLISHABLE_KEY

StripeダッシュボードでWebhookエンドポイントを作成し、`stripe-webhook`を指すURLに対して`STRIPE_WEBHOOK_SECRET`を設定してください。
