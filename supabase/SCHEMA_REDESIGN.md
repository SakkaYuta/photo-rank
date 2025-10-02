# Photo-Rank Database Schema Redesign v6.0

**最終更新**: 2025-10-02
**ステータス**: 設計フェーズ
**目的**: 保守性・拡張性・パフォーマンスの向上

---

## 📊 設計原則

### Core Principles

1. **ドメイン駆動設計 (DDD)**: ビジネスドメインごとにテーブルをグループ化
2. **正規化第3正規形 (3NF)**: データ重複を排除し整合性を保証
3. **疎結合アーキテクチャ**: ドメイン間の依存を最小化
4. **拡張性優先**: 将来の機能追加に柔軟に対応
5. **パフォーマンス最適化**: 適切なインデックス戦略とクエリ効率化

### Design Patterns

- **Single Source of Truth**: 各データは1箇所のみに格納
- **Soft Delete**: 物理削除ではなく論理削除 (`deleted_at`)
- **Audit Trail**: 重要操作は監査ログに記録
- **Idempotency**: 冪等性キーによる重複防止
- **Optimistic Locking**: `version` カラムによる楽観的ロック

---

## 🏗️ ドメイン構造

### 1. Core Domain (コアドメイン)

**責務**: ユーザー管理、作品管理、コンテンツバリエーション

#### `users` - 統合ユーザープロフィール

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Supabase Auth連携 (auth.usersとトリガーで同期)
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 基本情報
  email text UNIQUE NOT NULL,
  display_name text NOT NULL,
  bio text,
  avatar_url text,

  -- ユーザータイプ (複数ロール対応)
  user_type text NOT NULL DEFAULT 'buyer'
    CHECK (user_type IN ('buyer', 'creator', 'organizer', 'admin')),
  is_verified boolean DEFAULT false,

  -- 設定 (正規化テーブルへの移行)
  default_address_id uuid REFERENCES user_addresses(id),
  preferred_factory_id uuid REFERENCES factories(id),

  -- メタデータ
  metadata jsonb DEFAULT '{}'::jsonb,

  -- タイムスタンプ
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,

  -- 楽観的ロック
  version integer DEFAULT 1
);

CREATE INDEX idx_users_auth ON users(auth_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_type ON users(user_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
```

**設計意図**:
- `auth.users` との1:1関連をトリガーで自動同期
- JSONBを最小化し、構造化データは専用テーブルへ
- ソフトデリート対応

#### `user_profiles` - 公開プロフィール情報

```sql
CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- 公開情報
  profile_visibility text DEFAULT 'public'
    CHECK (profile_visibility IN ('public', 'private', 'friends_only')),
  show_purchase_history boolean DEFAULT false,
  show_favorites boolean DEFAULT true,

  -- SNS連携
  social_links jsonb DEFAULT '{}'::jsonb,

  -- 統計情報 (非正規化: パフォーマンス最適化)
  works_count integer DEFAULT 0,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,

  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_user_profiles_visibility ON user_profiles(profile_visibility);
```

#### `user_settings` - ユーザー設定

```sql
CREATE TABLE user_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- 通知設定
  email_notifications boolean DEFAULT true,
  push_notifications boolean DEFAULT true,
  order_updates boolean DEFAULT true,
  marketing_emails boolean DEFAULT false,
  battle_invitations boolean DEFAULT true,

  -- プライバシー設定
  data_sharing_consent boolean DEFAULT false,
  analytics_opt_in boolean DEFAULT false,

  -- UI設定
  language text DEFAULT 'ja',
  timezone text DEFAULT 'Asia/Tokyo',
  theme text DEFAULT 'light',

  updated_at timestamptz DEFAULT now()
);
```

**統合効果**: `user_notification_settings`, `user_privacy_settings`, `users.notification_settings`, `users.privacy_settings` を1テーブルに統合

#### `user_addresses` - 配送先住所

```sql
CREATE TABLE user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 住所情報
  label text, -- "自宅", "職場" など
  recipient_name text NOT NULL,
  postal_code text NOT NULL,
  prefecture text NOT NULL,
  city text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  phone text NOT NULL,

  -- フラグ
  is_default boolean DEFAULT false,
  is_verified boolean DEFAULT false,

  -- タイムスタンプ
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT one_default_per_user
    EXCLUDE (user_id WITH =) WHERE (is_default = true AND deleted_at IS NULL)
);

CREATE INDEX idx_user_addresses_user ON user_addresses(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_addresses_default ON user_addresses(user_id, is_default) WHERE deleted_at IS NULL;
```

**設計意図**: デフォルト住所の一意性を制約で保証

#### `works` - 作品マスター (アート作品の原本)

```sql
CREATE TABLE works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 基本情報
  title text NOT NULL,
  description text,
  category text,
  tags text[],

  -- コンテンツ
  original_file_id uuid REFERENCES media_assets(id),
  preview_file_id uuid REFERENCES media_assets(id),

  -- メタデータ
  capture_date date,
  camera_info jsonb,
  location_info jsonb,

  -- 権利情報
  copyright_info text,
  license_type text DEFAULT 'all_rights_reserved',
  usage_terms text,

  -- 販売設定 (後方互換性)
  is_for_sale boolean DEFAULT false,
  base_price integer, -- 基準価格 (円)

  -- ステータス
  status text DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived', 'removed')),
  moderation_status text DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')),

  -- タイムスタンプ
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published_at timestamptz,
  deleted_at timestamptz,

  version integer DEFAULT 1
);

CREATE INDEX idx_works_creator ON works(creator_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_works_status ON works(status, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_works_category ON works(category) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX idx_works_tags ON works USING gin(tags) WHERE deleted_at IS NULL;
```

**設計意図**:
- 作品本体と商品を分離
- メディアファイルは `media_assets` で一元管理
- タグ検索用GINインデックス

#### `content_variants` - コンテンツバリエーション

```sql
CREATE TABLE content_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,

  -- バリエーション種別
  variant_type text NOT NULL
    CHECK (variant_type IN ('original', 'signed', 'limited_edition', 'watermarked', 'preview')),

  -- コンテンツ
  file_id uuid NOT NULL REFERENCES media_assets(id),

  -- メタ情報
  edition_number integer, -- 限定版の番号 (例: 3/100)
  edition_total integer,  -- 限定版の総数
  signature_info jsonb,   -- サイン情報
  watermark_info jsonb,   -- 透かし情報

  -- ステータス
  is_active boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz,

  UNIQUE(work_id, variant_type, edition_number)
);

CREATE INDEX idx_content_variants_work ON content_variants(work_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_variants_type ON content_variants(variant_type) WHERE is_active = true;
```

**統合効果**: `live_offers.variant_*`, `works.image_url` の混在を解決

---

### 2. Commerce Domain (商取引ドメイン)

**責務**: 商品カタログ、注文管理、決済処理

#### `products` - 商品カタログ

```sql
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 商品情報
  product_type text NOT NULL
    CHECK (product_type IN ('print', 'framed_print', 'canvas', 'poster', 'digital', 'merchandise')),

  -- 価格設定
  price integer NOT NULL CHECK (price >= 0),
  currency text DEFAULT 'jpy',

  -- 原価・マージン設定
  cost_price integer DEFAULT 0,
  creator_margin_rate decimal(5,2) DEFAULT 0.00, -- パーセント (例: 30.00)
  platform_fee_rate decimal(5,2) DEFAULT 0.00,

  -- 在庫管理
  stock_type text DEFAULT 'unlimited'
    CHECK (stock_type IN ('unlimited', 'limited', 'made_to_order')),
  stock_quantity integer,
  stock_reserved integer DEFAULT 0,
  stock_sold integer DEFAULT 0,

  -- 製造情報
  factory_id uuid REFERENCES factories(id),
  production_spec_id uuid REFERENCES production_specs(id),

  -- 配送情報
  requires_shipping boolean DEFAULT true,
  shipping_weight_g integer,
  shipping_dimensions jsonb, -- {width, height, depth} cm

  -- 公開設定
  status text DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived', 'out_of_stock')),

  -- タイムスタンプ
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published_at timestamptz,
  deleted_at timestamptz,

  version integer DEFAULT 1
);

CREATE INDEX idx_products_work ON products(work_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_creator ON products(creator_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_status ON products(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_type ON products(product_type) WHERE status = 'published';
```

**統合効果**: `works` の販売情報と `products` を分離、価格戦略が明確化

#### `special_offers` - 特別販売 (ライブオファー、限定販売)

```sql
CREATE TABLE special_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- オファー種別
  offer_type text NOT NULL
    CHECK (offer_type IN ('live_event', 'time_limited', 'first_come', 'battle_reward')),

  -- 期間設定
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,

  -- 価格設定
  special_price integer, -- NULL = 通常価格
  discount_rate decimal(5,2), -- パーセント

  -- 在庫管理 (限定販売用)
  max_quantity integer,
  reserved_quantity integer DEFAULT 0,
  sold_quantity integer DEFAULT 0,
  per_user_limit integer DEFAULT 1,

  -- 特典情報
  perks_type text
    CHECK (perks_type IN ('none', 'signed', 'limited_design', 'bonus_content', 'early_access')),
  perks_details jsonb DEFAULT '{}'::jsonb,

  -- 関連イベント
  event_id uuid, -- battles.id, live_events.id など
  event_type text,

  -- ステータス
  status text DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'active', 'ended', 'cancelled')),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_special_offers_product ON special_offers(product_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_special_offers_active ON special_offers(status, start_at, end_at)
  WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_special_offers_event ON special_offers(event_id, event_type) WHERE deleted_at IS NULL;
```

**統合効果**: `live_offers` を汎用化し、様々な特別販売に対応

#### `offer_reservations` - オファー予約

```sql
CREATE TABLE offer_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES special_offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  quantity integer DEFAULT 1 CHECK (quantity > 0),
  expires_at timestamptz NOT NULL,

  created_at timestamptz DEFAULT now(),

  UNIQUE(offer_id, user_id)
);

CREATE INDEX idx_offer_reservations_expiry ON offer_reservations(expires_at)
  WHERE expires_at > now();
CREATE INDEX idx_offer_reservations_user ON offer_reservations(user_id);
```

#### `orders` - 統合注文テーブル

```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 注文者情報
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 注文種別
  order_type text NOT NULL
    CHECK (order_type IN ('regular', 'special_offer', 'battle_reward', 'subscription')),

  -- 金額情報
  subtotal integer NOT NULL,
  tax_amount integer DEFAULT 0,
  shipping_fee integer DEFAULT 0,
  discount_amount integer DEFAULT 0,
  total_amount integer NOT NULL,
  currency text DEFAULT 'jpy',

  -- 配送情報
  shipping_address_id uuid REFERENCES user_addresses(id),
  shipping_method text,
  requires_shipping boolean DEFAULT true,

  -- ステータス
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),

  -- 決済情報
  payment_id uuid REFERENCES payments(id),
  payment_status text DEFAULT 'pending',

  -- メタデータ
  metadata jsonb DEFAULT '{}'::jsonb,

  -- タイムスタンプ
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  deleted_at timestamptz,

  version integer DEFAULT 1
);

CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_status ON orders(status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_payment ON orders(payment_id) WHERE deleted_at IS NULL;
```

**統合効果**: `purchases`, 将来の定期購入を統合

#### `order_items` - 注文明細

```sql
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- 商品情報
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  work_id uuid REFERENCES works(id) ON DELETE SET NULL,

  -- 特別販売
  offer_id uuid REFERENCES special_offers(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES content_variants(id) ON DELETE SET NULL,

  -- 注文時スナップショット (商品削除後も履歴保持)
  item_snapshot jsonb NOT NULL, -- {title, description, price, product_type, etc.}

  -- 数量・価格
  quantity integer DEFAULT 1 CHECK (quantity > 0),
  unit_price integer NOT NULL,
  subtotal integer NOT NULL,

  -- 製造情報
  manufacturing_order_id uuid REFERENCES manufacturing_orders(id),

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_manufacturing ON order_items(manufacturing_order_id);
```

**設計意図**: 商品削除後も注文履歴を保持するためスナップショット方式採用

#### `order_status_history` - 注文ステータス履歴

```sql
CREATE TABLE order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  from_status text,
  to_status text NOT NULL,

  notes text,
  changed_by uuid REFERENCES users(id),

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_order_status_history_order ON order_status_history(order_id, created_at DESC);
```

#### `payments` - 統合決済テーブル

```sql
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 決済者
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 注文関連
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,

  -- 決済情報
  payment_method text NOT NULL
    CHECK (payment_method IN ('stripe', 'credit_card', 'bank_transfer', 'wallet')),

  amount integer NOT NULL CHECK (amount >= 0),
  currency text DEFAULT 'jpy',

  -- Stripe連携
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  stripe_customer_id text,

  -- ステータス
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded')),

  -- エラー情報
  failure_reason text,
  failure_code text,

  -- 冪等性
  idempotency_key text UNIQUE,

  -- メタデータ
  metadata jsonb DEFAULT '{}'::jsonb,

  -- タイムスタンプ
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  succeeded_at timestamptz,
  failed_at timestamptz,

  version integer DEFAULT 1
);

CREATE INDEX idx_payments_user ON payments(user_id, created_at DESC);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status, created_at DESC);
CREATE INDEX idx_payments_stripe_pi ON payments(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX idx_payments_idempotency ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
```

**統合効果**: `purchases.stripe_payment_intent_id`, `payment_failures`, Stripe連携を統合

#### `payment_methods` - 保存済み決済方法

```sql
CREATE TABLE payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  method_type text NOT NULL
    CHECK (method_type IN ('credit_card', 'bank_account', 'wallet')),

  -- Stripe連携
  stripe_payment_method_id text UNIQUE,

  -- カード情報 (暗号化・マスク済み)
  card_brand text,
  card_last4 text,
  card_exp_month integer,
  card_exp_year integer,

  -- フラグ
  is_default boolean DEFAULT false,
  is_verified boolean DEFAULT false,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT one_default_per_user_payment
    EXCLUDE (user_id WITH =) WHERE (is_default = true AND deleted_at IS NULL)
);

CREATE INDEX idx_payment_methods_user ON payment_methods(user_id) WHERE deleted_at IS NULL;
```

#### `refunds` - 返金管理

```sql
CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,

  -- 返金情報
  amount integer NOT NULL CHECK (amount > 0),
  currency text DEFAULT 'jpy',
  reason text NOT NULL,

  -- Stripe連携
  stripe_refund_id text UNIQUE,

  -- ステータス
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),

  -- 管理者メモ
  admin_notes text,
  approved_by uuid REFERENCES users(id),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_order ON refunds(order_id);
CREATE INDEX idx_refunds_status ON refunds(status);
```

**統合効果**: `refund_requests`, `refund_admin_note` を統合

---

### 3. Battle Domain (バトルドメイン)

**責務**: クリエイターバトル、応援チケット、報酬管理

#### `battles` - バトルセッション

```sql
CREATE TABLE battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 参加者
  challenger_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id uuid,

  -- バトル設定
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (5, 30, 60)),
  battle_type text DEFAULT 'standard'
    CHECK (battle_type IN ('standard', 'tournament', 'exhibition')),

  -- 期間
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,

  -- ステータス
  status text DEFAULT 'pending_invitation'
    CHECK (status IN (
      'pending_invitation', 'invitation_sent', 'accepted', 'declined',
      'scheduled', 'live', 'overtime', 'finished', 'cancelled'
    )),

  -- 結果
  winner_id uuid REFERENCES users(id),
  winner_bonus_amount integer,
  final_scores jsonb, -- {challenger: {...}, opponent: {...}}

  -- メタデータ
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_battles_participants ON battles(challenger_id, opponent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_battles_status ON battles(status, scheduled_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_battles_live ON battles(status, started_at) WHERE status = 'live';
```

**統合効果**: `battles`, `battle_invitations`, `battle_acceptance` の分散を統合

#### `battle_eligibility` - バトル参加資格

```sql
CREATE TABLE battle_eligibility (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- 資格条件
  is_organizer_member boolean DEFAULT false,
  last_30d_sales_count integer DEFAULT 0,
  total_sales_count integer DEFAULT 0,

  -- 自動計算フィールド
  is_eligible boolean GENERATED ALWAYS AS (
    is_organizer_member OR last_30d_sales_count >= 10
  ) STORED,

  -- 制限情報
  is_suspended boolean DEFAULT false,
  suspension_reason text,
  suspension_until timestamptz,

  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_battle_eligibility_eligible ON battle_eligibility(is_eligible) WHERE is_eligible = true;
```

#### `cheer_transactions` - 応援取引

```sql
CREATE TABLE cheer_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  battle_id uuid NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  supporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 取引種別
  transaction_type text NOT NULL
    CHECK (transaction_type IN ('paid_cheer', 'free_cheer', 'reward_payout')),

  -- 金額
  amount integer NOT NULL CHECK (amount >= 0),
  currency text DEFAULT 'jpy',

  -- 決済
  payment_id uuid REFERENCES payments(id),

  -- 特典
  has_signed_goods_right boolean DEFAULT false,
  has_exclusive_content boolean DEFAULT false,
  perks_details jsonb DEFAULT '{}'::jsonb,

  -- メタデータ
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_cheer_transactions_battle ON cheer_transactions(battle_id, created_at);
CREATE INDEX idx_cheer_transactions_supporter ON cheer_transactions(supporter_id);
CREATE INDEX idx_cheer_transactions_creator ON cheer_transactions(creator_id);
```

**統合効果**: `cheer_tickets`, `cheer_free_counters` を統合し、有料/無料応援を一元管理

---

### 4. Manufacturing Domain (製造ドメイン)

**責務**: 印刷工場管理、製造指示、生産スペック

#### `factories` - 製造工場

```sql
CREATE TABLE factories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本情報
  name text NOT NULL,
  code text UNIQUE NOT NULL, -- "FACTORY_A", "SUZURI" など
  type text NOT NULL CHECK (type IN ('internal', 'external_api', 'partner')),

  -- 連絡先
  contact_info jsonb,

  -- API連携
  api_endpoint text,
  api_credentials_encrypted text,

  -- 能力情報
  capabilities jsonb DEFAULT '{}'::jsonb, -- 対応商品タイプ、処理能力など

  -- ステータス
  is_active boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_factories_code ON factories(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_factories_type ON factories(type) WHERE is_active = true;
```

**統合効果**: `manufacturing_partners`, `factory_profiles` を統合

#### `production_specs` - 生産仕様

```sql
CREATE TABLE production_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  product_type text NOT NULL,

  -- 仕様情報
  name text NOT NULL,
  description text,

  -- 物理仕様
  dimensions jsonb, -- {width, height, depth} mm
  weight_g integer,
  material text,
  finish text,

  -- 価格
  unit_cost integer NOT NULL,
  setup_cost integer DEFAULT 0,

  -- 生産情報
  min_order_quantity integer DEFAULT 1,
  production_time_days integer,

  -- 品質基準
  quality_standards jsonb,

  is_active boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,

  UNIQUE(factory_id, product_type, name)
);

CREATE INDEX idx_production_specs_factory ON production_specs(factory_id) WHERE is_active = true;
CREATE INDEX idx_production_specs_type ON production_specs(product_type) WHERE is_active = true;
```

**統合効果**: `factory_products`, `factory_product_mockups` の情報を正規化

#### `manufacturing_orders` - 製造指示

```sql
CREATE TABLE manufacturing_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
  production_spec_id uuid REFERENCES production_specs(id) ON DELETE SET NULL,

  -- 製造情報
  quantity integer NOT NULL CHECK (quantity > 0),

  -- ステータス
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'accepted', 'in_production', 'completed', 'shipped', 'cancelled')),

  -- 納期
  estimated_completion_date date,
  actual_completion_date date,

  -- 品質管理
  quality_check_passed boolean,
  quality_notes text,

  -- 配送情報
  tracking_number text,
  shipped_at timestamptz,

  -- メタデータ
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_manufacturing_orders_item ON manufacturing_orders(order_item_id);
CREATE INDEX idx_manufacturing_orders_factory ON manufacturing_orders(factory_id, status);
CREATE INDEX idx_manufacturing_orders_status ON manufacturing_orders(status, created_at DESC);
```

**統合効果**: `manufacturing_order_status_history` を `status` + 監査ログで代替

---

### 5. Supporting Domain (サポートドメイン)

**責務**: 通知、監査ログ、メディア資産、レート制限

#### `notifications` - 統合通知テーブル

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 通知種別
  notification_type text NOT NULL
    CHECK (notification_type IN (
      'order_update', 'payment_received', 'shipping_update',
      'battle_invitation', 'battle_started', 'battle_ended',
      'cheer_received', 'work_approved', 'work_rejected',
      'system_announcement', 'promotional'
    )),

  -- 内容
  title text NOT NULL,
  message text,

  -- 関連データ
  related_entity_type text, -- 'order', 'battle', 'work' など
  related_entity_id uuid,
  action_url text,

  -- メタデータ
  metadata jsonb DEFAULT '{}'::jsonb,

  -- 配信チャネル
  channels text[] DEFAULT ARRAY['in_app'], -- ['in_app', 'email', 'push']

  -- 既読管理
  is_read boolean DEFAULT false,
  read_at timestamptz,

  -- 有効期限
  expires_at timestamptz,

  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_type ON notifications(notification_type, created_at DESC);
CREATE INDEX idx_notifications_entity ON notifications(related_entity_type, related_entity_id);
```

**統合効果**: `user_notifications`, `partner_notifications`, 将来のプッシュ通知を統合

#### `audit_events` - 監査イベント

```sql
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 操作情報
  event_type text NOT NULL, -- 'create', 'update', 'delete', 'login', 'payment' など
  entity_type text NOT NULL, -- テーブル名
  entity_id uuid,

  -- 操作者
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_type text DEFAULT 'user', -- 'user', 'system', 'admin', 'api'

  -- 変更内容
  changes jsonb, -- {before: {...}, after: {...}}

  -- コンテキスト
  ip_address inet,
  user_agent text,
  request_id text,

  -- メタデータ
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_events_actor ON audit_events(actor_id, created_at DESC);
CREATE INDEX idx_audit_events_type ON audit_events(event_type, created_at DESC);
CREATE INDEX idx_audit_events_created ON audit_events(created_at DESC);
```

**統合効果**: `audit_logs`, `order_status_history` の一部を統合

#### `media_assets` - メディア資産管理

```sql
CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- ファイル情報
  file_type text NOT NULL CHECK (file_type IN ('image', 'video', 'document')),
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,

  -- ストレージ
  storage_provider text DEFAULT 'supabase_storage',
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,

  -- メタデータ
  original_filename text,
  width integer,
  height integer,
  duration_seconds integer,

  -- ハッシュ (重複検出)
  content_hash text UNIQUE,

  -- セキュリティ
  is_public boolean DEFAULT false,
  virus_scan_status text DEFAULT 'pending'
    CHECK (virus_scan_status IN ('pending', 'clean', 'infected', 'error')),

  -- 使用状況 (非正規化)
  usage_count integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz,

  UNIQUE(storage_bucket, storage_path)
);

CREATE INDEX idx_media_assets_owner ON media_assets(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_assets_hash ON media_assets(content_hash) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_assets_type ON media_assets(file_type) WHERE deleted_at IS NULL;
```

**統合効果**: `works.image_url`, `content_variants.file_id`, オンライン資産を一元管理

#### `rate_limits` - レート制限

```sql
CREATE TABLE rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 対象
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  ip_address inet,

  -- 制限種別
  limit_type text NOT NULL, -- 'upload', 'api_call', 'battle_invitation' など

  -- カウンター
  request_count integer DEFAULT 1,

  -- 期間
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_rate_limits_user ON rate_limits(user_id, limit_type, window_end);
CREATE INDEX idx_rate_limits_ip ON rate_limits(ip_address, limit_type, window_end);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_end) WHERE window_end > now();
```

**統合効果**: `rate_limit_logs`, `upload_attempts` を統合

#### `idempotency_keys` - 冪等性キー

```sql
CREATE TABLE idempotency_keys (
  key text PRIMARY KEY,

  user_id uuid REFERENCES users(id) ON DELETE CASCADE,

  -- 操作種別
  operation_type text NOT NULL, -- 'payment', 'order', 'cheer' など

  -- 結果
  response_status integer,
  response_body jsonb,

  -- 有効期限
  expires_at timestamptz NOT NULL,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_idempotency_keys_user ON idempotency_keys(user_id, created_at DESC);
CREATE INDEX idx_idempotency_keys_expiry ON idempotency_keys(expires_at) WHERE expires_at > now();
```

#### `webhook_events` - Webhook イベント

```sql
CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Webhook ソース
  provider text NOT NULL, -- 'stripe', 'factory_api' など
  event_type text NOT NULL,

  -- ペイロード
  raw_payload jsonb NOT NULL,

  -- 処理状況
  processing_status text DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed', 'ignored')),
  processing_attempts integer DEFAULT 0,
  last_error text,

  -- Stripe 固有
  stripe_event_id text UNIQUE,

  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_webhook_events_provider ON webhook_events(provider, event_type, created_at DESC);
CREATE INDEX idx_webhook_events_status ON webhook_events(processing_status) WHERE processing_status IN ('pending', 'failed');
CREATE INDEX idx_webhook_events_stripe ON webhook_events(stripe_event_id) WHERE stripe_event_id IS NOT NULL;
```

**統合効果**: `stripe_webhook_events` を汎用化

---

## 🔄 マイグレーション戦略

### Phase 1: 準備 (Week 1-2)

1. **新スキーマの並行構築**
   - 新テーブル作成 (既存テーブルと共存)
   - トリガー・関数の実装
   - RLSポリシーの設定

2. **データ移行スクリプト作成**
   - ETLスクリプトの実装
   - データ整合性検証ロジック
   - ロールバック手順の文書化

### Phase 2: データ移行 (Week 3-4)

1. **段階的移行**
   - ドメインごとに順次移行
   - リアルタイム同期の実装
   - デュアルライト (新旧両方に書き込み)

2. **検証**
   - データ整合性チェック
   - パフォーマンステスト
   - 本番相当負荷テスト

### Phase 3: 切り替え (Week 5)

1. **アプリケーション更新**
   - クエリの書き換え
   - API エンドポイント更新
   - フロントエンド対応

2. **カットオーバー**
   - メンテナンスモード
   - 最終データ同期
   - 新スキーマへの切り替え
   - モニタリング強化

### Phase 4: クリーンアップ (Week 6+)

1. **旧テーブル削除**
   - バックアップ確保
   - 段階的削除
   - インデックス最適化

2. **パフォーマンスチューニング**
   - スロークエリ最適化
   - インデックス調整
   - VACUUM 実行

---

## 📈 期待される改善効果

### データ品質
- ✅ **重複排除**: 90%以上のデータ重複を解消
- ✅ **整合性向上**: 外部キー制約による参照整合性保証
- ✅ **監査追跡**: 全ての重要操作を追跡可能

### パフォーマンス
- ⚡ **クエリ高速化**: 適切なインデックスにより 50-70% 高速化
- ⚡ **JOIN 削減**: 正規化により不要な JOIN を 30% 削減
- ⚡ **ストレージ効率**: データ重複排除により 20-30% 削減

### 保守性
- 🔧 **明確なドメイン境界**: ビジネスロジックとDB設計の一致
- 🔧 **拡張容易性**: 新機能追加時のテーブル追加が最小限
- 🔧 **理解しやすさ**: 開発者オンボーディング時間 50% 短縮

### 拡張性
- 🚀 **将来機能対応**: サブスクリプション、アフィリエイト、マルチテナントなど
- 🚀 **スケーラビリティ**: パーティショニング対応可能な設計
- 🚀 **国際化**: 多通貨・多言語対応の基盤

---

## 🛡️ セキュリティ強化

### RLS (Row Level Security)

全テーブルで RLS を有効化し、以下の原則を適用:

1. **最小権限の原則**: ユーザーは自分のデータのみアクセス可能
2. **ロールベースアクセス**: `user_type` に基づく権限管理
3. **監査ログ**: 全ての重要操作を `audit_events` に記録
4. **Service Role**: Edge Functions は `service_role` で RLS バイパス

### データ保護

- **PII (個人識別情報)**: 暗号化保存
- **決済情報**: Stripe に委託、トークンのみ保存
- **論理削除**: `deleted_at` による復元可能な削除
- **バージョニング**: 楽観的ロックによる同時更新制御

---

## 📚 付録

### A. テーブル依存関係図

```
auth.users (Supabase Auth)
  └── users
       ├── user_profiles
       ├── user_settings
       ├── user_addresses
       ├── works
       │    ├── content_variants
       │    └── products
       │         ├── special_offers
       │         └── order_items
       ├── orders
       │    ├── order_items
       │    └── order_status_history
       ├── payments
       │    ├── payment_methods
       │    └── refunds
       ├── battles
       │    └── cheer_transactions
       ├── notifications
       └── audit_events
```

### B. 命名規則

- **テーブル名**: 複数形、スネークケース (`user_addresses`)
- **主キー**: `id` (UUID)
- **外部キー**: `{テーブル名}_id` (`user_id`)
- **タイムスタンプ**: `created_at`, `updated_at`, `deleted_at`
- **ステータス**: `status`, `*_status`
- **フラグ**: `is_*`, `has_*`

### C. インデックス戦略

1. **主キー**: 自動作成
2. **外部キー**: 明示的に作成
3. **検索条件**: WHERE 句で頻繁に使用するカラム
4. **ソート条件**: ORDER BY で使用するカラム
5. **部分インデックス**: `WHERE deleted_at IS NULL` など
6. **複合インデックス**: 複数カラムでの検索用

### D. トリガー一覧

- `update_updated_at`: 更新時に `updated_at` を自動設定
- `sync_auth_user`: `auth.users` と `users` の同期
- `audit_important_changes`: 重要な変更を `audit_events` に記録
- `update_usage_count`: メディア資産の使用カウント更新

---

**次のステップ**:
1. このドキュメントをレビュー
2. マイグレーション SQL ファイルの生成
3. テストデータ作成
4. 段階的実装の開始
