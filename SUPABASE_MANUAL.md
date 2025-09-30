# Supabase 手動デプロイメントマニュアル

## 🔄 Database Schema Update (手動実行)

### 1. Supabase プロジェクト接続
```bash
# Supabase CLI でプロジェクトにリンク
npx supabase link --project-ref YOUR_PROJECT_REF
```

### 2. データベースマイグレーション実行
```sql
-- 1. Core Tables Migration (20240115_core_tables.sql)
-- Supabase SQL Editor で実行:

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (create or extend)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  is_creator BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  phone TEXT,
  notification_settings JSONB,
  privacy_settings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Works table
CREATE TABLE IF NOT EXISTS works (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  price INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  category TEXT,
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  factory_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  work_id UUID REFERENCES works(id) ON DELETE CASCADE,
  price INTEGER NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  tracking_number TEXT,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  stripe_payment_intent_id TEXT,
  amount INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Favorites and Cart tables
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  work_id UUID REFERENCES works(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, work_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  work_id UUID REFERENCES works(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, work_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_works_creator_id ON works(creator_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);

-- Create trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_works_updated_at BEFORE UPDATE ON works FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
```

### 2-Extra. 工場ダッシュボード拡張（2025-09-18）
```sql
-- 追加マイグレーション: パートナー注文ビューとリレーション強化
-- ファイル: supabase/migrations/20250918_partner_orders_enhancements.sql

-- 1) manufacturing_orders に外部キーを追加
ALTER TABLE public.manufacturing_orders
  ADD COLUMN IF NOT EXISTS factory_product_id uuid REFERENCES public.factory_products(id),
  ADD COLUMN IF NOT EXISTS purchase_id uuid REFERENCES public.purchases(id);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_mo_partner ON public.manufacturing_orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_mo_factory_product ON public.manufacturing_orders(factory_product_id);
CREATE INDEX IF NOT EXISTS idx_mo_work ON public.manufacturing_orders(work_id);
CREATE INDEX IF NOT EXISTS idx_mo_purchase ON public.manufacturing_orders(purchase_id);

-- 2) 製造注文のステータス履歴（任意）
CREATE TABLE IF NOT EXISTS public.manufacturing_order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturing_order_id uuid NOT NULL REFERENCES public.manufacturing_orders(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('submitted','accepted','in_production','shipped','cancelled','failed')),
  message text,
  created_at timestamptz DEFAULT now()
);

-- 3) パートナー向け統合ビュー
CREATE OR REPLACE VIEW public.partner_orders_view AS
SELECT
  mo.id,
  mo.order_id,
  mo.partner_id,
  mo.status,
  mo.created_at,
  mo.assigned_at,
  mo.shipped_at,
  mo.tracking_number,
  mo.factory_product_id,
  mo.work_id,
  mo.purchase_id,
  fp.product_type,
  fp.product_type AS product_name,
  w.title AS work_title,
  w.image_url AS work_image_url,
  w.creator_id,
  cu.display_name AS creator_name,
  cu.avatar_url AS creator_avatar,
  p.user_id AS customer_id,
  uu.display_name AS customer_name,
  uu.avatar_url AS customer_avatar
FROM public.manufacturing_orders mo
LEFT JOIN public.factory_products fp ON fp.id = mo.factory_product_id
LEFT JOIN public.works w ON w.id = mo.work_id
LEFT JOIN public.users cu ON cu.id = w.creator_id
LEFT JOIN public.purchases p ON p.id = mo.purchase_id
LEFT JOIN public.users uu ON uu.id = p.user_id;

-- RLS を使用している場合は、ビュー/基表に以下のようなセレクト制限を追加してください
-- 例: パートナー自身の行のみ参照可
-- CREATE POLICY "partner can read own orders view" ON partner_orders_view
--   FOR SELECT USING (partner_id = auth.jwt() ->> 'partner_id');
```

## 🔐 セキュリティ運用（RLS/Storage）

### RLS/ストレージポリシーの適用

Supabase SQL Editor で `db/security_policies.sql` を実行してください。主な内容は以下です。

- works テーブル
  - RLS 有効化
  - SELECT: 公開作品 or 自分の作品のみ
  - INSERT: `creator_id = auth.uid()` のみ、かつ `is_active` は false のみ許可（公開は承認フロー側で）
  - UPDATE: 自分の作品のみ。`is_active = true` への変更は禁止（モデレータ用ポリシーは別途）
  - CHECK 制約: `sale_end_at <= sale_start_at + 365 days`

- storage.objects（user-content バケット想定）
  - Private バケットを前提
  - INSERT/SELECT: `uploads/works/{uid}/...` の prefix のみ許可

### 画像アップロードのフロー

1. 一時領域にアップロード
2. Edge Function `process-uploaded-image` でサニタイズ/透かし処理
3. プレビューは署名付きURLで 1 時間など短期配信

クライアント側でも MIME/サイズ（例: 10MB 以下）を検査していますが、最終的な検証は Edge Function 側で実施してください。


### 3. プロフィール機能テーブル追加
```sql
-- 2. Profile Tables Migration (20240118_add_profile_tables.sql)
-- Supabase SQL Editor で実行:

-- 通知設定テーブル
CREATE TABLE IF NOT EXISTS user_notification_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  order_updates BOOLEAN DEFAULT true,
  marketing_emails BOOLEAN DEFAULT false,
  push_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- プライバシー設定テーブル
CREATE TABLE IF NOT EXISTS user_privacy_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_visibility TEXT DEFAULT 'public' CHECK (profile_visibility IN ('public', 'private', 'friends')),
  show_purchase_history BOOLEAN DEFAULT false,
  show_favorites BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 注文ステータス履歴テーブル
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 住所テーブル
CREATE TABLE IF NOT EXISTS user_addresses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  prefecture TEXT,
  city TEXT,
  address1 TEXT NOT NULL,
  address2 TEXT,
  phone TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_user_notification_settings_user_id ON user_notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_privacy_settings_user_id ON user_privacy_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_purchase_id ON order_status_history(purchase_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);

-- 更新日時トリガー
CREATE TRIGGER update_user_notification_settings_updated_at BEFORE UPDATE ON user_notification_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_user_privacy_settings_updated_at BEFORE UPDATE ON user_privacy_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
```

### 2-Extra. 商品登録の配送情報必須化（2025-09-30）
```sql
-- ファイル: supabase/migrations/20250930_require_shipping_info_for_products.sql
-- 概要: factory_products の INSERT/UPDATE 時に、対応パートナーの shipping_info（method_title, carrier_name, fee_general_jpy）
-- が未設定/不正な場合はエラーにします。

-- Supabase SQL Editor で実行する場合は、上記ファイルの内容を貼り付けてください。
-- Supabase CLI を使う場合は通常の migrate フローに追加してください。
```

### 2-Extra. Stripe購入の冪等性（2025-09-30）
```sql
-- ファイル: supabase/migrations/20250930_unique_pi_on_purchases.sql
-- 概要: purchases.stripe_payment_intent_id にユニークインデックスを追加し、
-- 同一PaymentIntentでの重複書込みをDBレベルで防止します。
```

### 2-Extra. RLS強化（2025-09-30）
```sql
-- ファイル: supabase/migrations/20250930_rls_hardening.sql
-- 概要: 
-- 1) manufacturing_partners: 公開閲覧は approved のみ、所有者は全権限
-- 2) factory_products: 公開閲覧は partnerがapproved かつ productがactive のみ
-- 既存の過度な公開ポリシー（factory_products_public_select）を置き換えます。
```

### 2-Extra. コンビニ/銀行振込の導入（2025-09-30）
```md
1) DB拡張
   - `supabase/migrations/20250930_payment_methods.sql` を適用
     - purchases に `payment_method`, `payment_status`, `payment_due_at`, `payment_instructions`, `konbini_*` などを追加
     - 返金用の `refund_status/amount/...` と `refund_requests` テーブルを追加

2) Edge Functions
   - `create-konbini-intent`: 金額/メタデータを受け取り、`payment_method_types=['konbini']` の PaymentIntent を作成
   - `create-bank-transfer-intent`: `customer_balance + jp_bank_transfer` の PI を作成し、振込先情報の配布を待機
   - Webhook: `stripe-webhook` は `processing/canceled` を補足（succeeded/failedは既存）

3) フロント連携（推奨フロー）
   - チェックアウトで決済手段を選択（カード/コンビニ/銀行振込）
   - コンビニ: `create-konbini-intent` → client_secret で確認 → Stripeのバウチャー表示
   - 銀行振込: `create-bank-transfer-intent` → 振込先情報（next_action）を表示
   - Webhookで `purchases.payment_status` を更新し、確定後に注文を実行
```
### 2-Extra. ライブバトル自動終了（2025-09-30）
```md
1) Edge Function をデプロイ
   - パス: `supabase/functions/battle-autofinish`
   - 内容: ライブ中(`status='live'`)のバトルで、`start_time + duration_minutes` を超過したものを自動処理。
     - 同点なら延長戦: `duration_minutes += 3`（ステータスは`live`のまま）
     - 非同点なら終了: `status='finished'`, `end_time=now()`, `winner_id`を更新

2) スケジュール設定（Supabase Dashboard → Scheduled Functions）
   - 関数: `battle-autofinish`
   - スケジュール: 毎分実行（`* * * * *`）

3) 追加インデックス/OTカラム適用
   - ファイル: `supabase/migrations/20250930_battle_indexes.sql`
   - 目的: `battles(status, start_time)`, `cheer_tickets(battle_id)` の参照高速化
   - ファイル: `supabase/migrations/20250930_battle_overtime.sql`
   - 目的: `battles.overtime_count` を追加し、延長回数を追跡（最大2回）
```

### 4. RLSポリシー設定
```sql
-- 3. RLS Policies (20240119_add_rls_policies.sql)
-- Supabase SQL Editor で実行:

-- Enable RLS on all tables
ALTER TABLE works ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

-- Works policies
CREATE POLICY "Works are publicly visible" ON works
  FOR SELECT USING (is_active = true);

CREATE POLICY "Creators can manage their works" ON works
  FOR ALL USING (auth.uid() = creator_id);

-- Purchases policies
CREATE POLICY "Users can view their own purchases" ON purchases
  FOR SELECT USING (auth.uid() = user_id);

-- Notification settings policies
CREATE POLICY "Users can manage their own notification settings" ON user_notification_settings
  FOR ALL USING (auth.uid() = user_id);

-- Privacy settings policies
CREATE POLICY "Users can manage their own privacy settings" ON user_privacy_settings
  FOR ALL USING (auth.uid() = user_id);

-- Order status history policies
CREATE POLICY "Users can view order status for their purchases" ON order_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.id = order_status_history.purchase_id
      AND purchases.user_id = auth.uid()
    )
  );

-- User addresses policies
CREATE POLICY "Users can manage their own addresses" ON user_addresses
  FOR ALL USING (auth.uid() = user_id);

-- Favorites and cart policies
CREATE POLICY "Users can manage their own favorites" ON favorites
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own cart" ON cart_items
  FOR ALL USING (auth.uid() = user_id);

-- Partner orders view の参照制御（例）
-- ビューに対して直接RLSを定義するか、基表側のポリシーで partner_id によるフィルタリングを保証してください
-- CREATE POLICY "Partners see their orders" ON manufacturing_orders
--   FOR SELECT USING (partner_id IN (
--     SELECT id FROM manufacturing_partners WHERE owner_user_id = auth.uid()
--   ));
```

### 5. ストレージ設定
```sql
-- Storage bucket for user content
INSERT INTO storage.buckets (id, name, public) VALUES ('user-content', 'user-content', true) ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-content' AND
    (storage.foldername(name))[1] = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[2]
  );

CREATE POLICY "Public can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-content' AND (storage.foldername(name))[1] = 'avatars');
```

## 🔧 Edge Functions Manual Deploy

### Edge Function リスト (手動デプロイ)
```bash
# 各関数を個別にデプロイ
npx supabase functions deploy create-payment-intent
npx supabase functions deploy create-bulk-payment-intent
npx supabase functions deploy stripe-webhook
npx supabase functions deploy manufacturing-order
npx supabase functions deploy notify-partner
npx supabase functions deploy process-notification-queue
```

### Environment Secrets 設定
```bash
# Supabase Dashboard > Settings > Edge Functions > Environment Variables
STRIPE_SECRET_KEY=sk_live_your-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
GOOGLE_CLIENT_SECRET=your-google-client-secret
SMTP_PASS=your-sendgrid-api-key
```

## ✅ 手動検証チェックリスト

### Database Tables
- [ ] `users` テーブル (プロフィール拡張済み)
- [ ] `works` テーブル (factory_id 追加済み)
- [ ] `purchases` テーブル (追跡情報追加済み)
- [ ] `user_notification_settings` テーブル
- [ ] `user_privacy_settings` テーブル
- [ ] `order_status_history` テーブル
- [ ] `user_addresses` テーブル
- [ ] `favorites` テーブル
- [ ] `cart_items` テーブル

### RLS Policies
- [ ] 全テーブルでRLS有効化
- [ ] ユーザーは自分のデータのみアクセス
- [ ] 作品は公開設定に応じてアクセス制御
- [ ] ストレージポリシー設定済み

### Edge Functions
- [ ] create-payment-intent (決済作成)
- [ ] create-bulk-payment-intent (一括決済)
- [ ] stripe-webhook (Stripe連携)
- [ ] manufacturing-order (製造注文)
- [ ] notify-partner (パートナー通知)

### Storage
- [ ] user-content バケット作成済み
- [ ] アバターアップロードポリシー設定済み

## 🔍 動作確認

### 1. Database Query Test
```sql
-- ユーザーテーブル確認
SELECT COUNT(*) FROM users;

-- プロフィール設定テーブル確認
SELECT COUNT(*) FROM user_notification_settings;
SELECT COUNT(*) FROM user_privacy_settings;
SELECT COUNT(*) FROM user_addresses;

-- 注文関連テーブル確認
SELECT COUNT(*) FROM purchases;
SELECT COUNT(*) FROM order_status_history;
```

### 2. RLS Policy Test
```sql
-- RLS有効確認
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE rowsecurity = true;
```

### 3. Edge Functions Test
Supabase Dashboard > Edge Functions で各関数の実行ログを確認

## 📋 Manual Deployment Summary

✅ **手動実行完了項目**:
1. コアテーブル作成 (users, works, purchases, favorites, cart_items)
2. プロフィール機能テーブル追加 (user_notification_settings, user_privacy_settings, user_addresses, order_status_history)
3. RLSセキュリティポリシー設定
4. ストレージバケット・ポリシー設定
5. Edge Functions デプロイ
6. Environment Secrets 設定

次は Vercel 側の自動デプロイを実行します。
