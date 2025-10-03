# 🔒 RLS（Row Level Security）監査ガイド

**作成日**: 2025-10-03
**目的**: 全テーブルのRLS適用状況を確認し、セキュリティリスクを特定

---

## 🎯 監査対象

### v6コアテーブル（8つ）- 最優先
- user_roles
- products
- product_variants
- orders
- order_items
- fulfillments
- creator_organizers
- refunds

### v5テーブル（参考）
- sales
- purchases
- works
- organizers
- refund_requests
- manufacturing_orders
- manufacturing_partners
- user_public_profiles

---

## 📋 実行手順

### ステップ1: Supabase Studio SQL Editor

```
https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj
```

### ステップ2: 監査クエリ実行

`RLS_AUDIT_QUERIES.sql` の各クエリを順番に実行してください。

---

## 🔍 重要な確認項目

### 1. RLS有効化状況（クエリ1, 2）

**期待結果**:
- ✅ v6テーブル8つ全てで `rls_enabled = true`
- ⚠️ v5テーブルは環境により異なる

**クリティカル条件**:
```sql
-- v6テーブルでRLS無効の場合、即座対応必要
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_roles', 'products', 'product_variants', 'orders', 'order_items', 'fulfillments', 'creator_organizers', 'refunds')
  AND rowsecurity = false;
```

**対処方法**:

**オプション1: 専用スクリプト使用（推奨）**
```
RLS_ENABLE_V6_TABLES.sql を実行
（v6テーブル8つのRLS有効化 + 基本ポリシー追加）
```

**オプション2: 個別有効化**
```sql
-- RLS有効化（個別実行）
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
```

---

### 2. RLSポリシー適用状況（クエリ3, 4, 11）

**期待されるポリシー**:

#### products（3ポリシー）
- ✅ `products_viewable_by_all` (SELECT, is_active = true)
- ✅ `products_public_or_owner_select` (SELECT, status='published' OR creator_id=auth.uid())
- ✅ `products_owner_write` (ALL, creator_id=auth.uid())

#### product_variants（1ポリシー）
- ✅ `product_variants_viewable_by_all` (SELECT, is_available = true)

#### orders（1ポリシー）
- ✅ `users_can_view_own_orders` (SELECT, user_id = auth.uid())

#### order_items（1ポリシー）
- ✅ `users_can_view_order_items` (SELECT, 自分の注文 OR creator_id=auth.uid())

**確認クエリ**:
```sql
-- v6テーブルのポリシー数確認
SELECT
  tablename,
  COUNT(*) AS policy_count
FROM pg_policies
WHERE tablename IN ('user_roles', 'products', 'product_variants', 'orders', 'order_items', 'fulfillments', 'creator_organizers', 'refunds')
GROUP BY tablename;
```

**期待結果**:
| tablename | policy_count |
|-----------|-------------|
| products | 3 |
| product_variants | 1 |
| orders | 1 |
| order_items | 1 |

---

### 3. RLS有効だがポリシーなし（クエリ5）

**危険度**: CRITICAL

**問題**:
- RLS有効だがポリシーがない場合、**全アクセス拒否**
- service_role でもアクセス不可

**確認クエリ**:
```sql
SELECT
  t.tablename,
  'RLS有効だがポリシーなし' AS issue
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.tablename = t.tablename
  );
```

**対処方法**:
1. ポリシーを追加
2. または RLS を無効化（非推奨）

---

### 4. RLS無効のテーブル（クエリ6）

**危険度**:
- v6テーブル: CRITICAL
- その他: WARNING

**問題**:
- 全ユーザーがアクセス可能
- データ漏洩リスク

**対処方法**:
```sql
-- 即座に RLS を有効化（テーブル名を実際の名前に置き換え）
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillments ENABLE ROW LEVEL SECURITY;
-- （以下、対象テーブルごとに実行）

-- その後、適切なポリシーを追加
CREATE POLICY user_roles_own ON user_roles
  FOR SELECT
  USING (user_id = auth.uid());
```

**または**:
```
RLS_ENABLE_V6_TABLES.sql を実行（一括対応）
```

---

### 5. ポリシー数不足（クエリ7）

**推奨ポリシー数**:
- **最低2つ**: SELECT + INSERT/UPDATE/DELETE
- **理想3-4つ**: SELECT（公開）+ SELECT（本人）+ INSERT/UPDATE + DELETE

**確認**:
```sql
SELECT
  tablename,
  COUNT(*) AS policy_count
FROM pg_policies
WHERE tablename IN ('products', 'product_variants', 'orders', 'order_items')
GROUP BY tablename
HAVING COUNT(*) < 2;
```

---

### 6. 公開テーブルの確認（クエリ8）

**anon/authenticated に SELECT 権限があるテーブル**:

**許可されるべきテーブル**:
- ✅ users_vw（公開プロフィール）
- ✅ products（is_active=true, status='published'）
- ✅ product_variants（is_available=true）

**許可されるべきでないテーブル**:
- ❌ sales_vw（管理者専用）
- ❌ purchases_vw（管理者専用）
- ❌ refund_requests_vw（管理者専用）
- ❌ factory_orders_vw（製造パートナー専用）

---

### 7. auth.uid() 参照の確認（クエリ10）

**必須パターン**:
```sql
-- ユーザー本人のデータのみアクセス可能
user_id = auth.uid()
creator_id = auth.uid()
```

**確認クエリ**:
```sql
SELECT
  tablename,
  policyname,
  qual
FROM pg_policies
WHERE qual LIKE '%auth.uid()%';
```

**期待結果**:
- orders: `user_id = auth.uid()`
- order_items: `creator_id = auth.uid()`
- products: `creator_id = auth.uid()`

---

## 📊 セキュリティサマリー（クエリ12）

**期待される結果**:

| metric | value |
|--------|-------|
| 全テーブル数 | 50-60（環境により異なる） |
| RLS有効テーブル数 | 10-20 |
| RLS無効テーブル数 | 30-50 |
| 適用中ポリシー総数 | 15-30 |
| v6テーブルRLS有効数 | **8（必須）** |
| v6テーブルポリシー数 | **6以上（推奨）** |

---

## ⚠️ 発見された問題への対処

### CRITICAL: v6テーブルでRLS無効

**影響**: データ漏洩リスク極大

**対処**:

**推奨**: `RLS_ENABLE_V6_TABLES.sql` を実行

**または個別対応**:
```sql
-- 例: user_roles の場合
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_roles_own ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

---

### CRITICAL: RLS有効だがポリシーなし

**影響**: 全アクセス拒否（service_roleも不可）

**対処**:

**推奨**: `RLS_ENABLE_V6_TABLES.sql` を実行（適切なポリシー自動追加）

**または個別追加**:
```sql
-- 例: user_roles の場合（本人のみアクセス）
CREATE POLICY user_roles_own ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

---

### WARNING: ポリシー数不足

**影響**: セキュリティホール、権限管理不十分

**対処**:

**推奨**: `RLS_ENABLE_V6_TABLES.sql` を実行

**または個別追加**:
```sql
-- 例: fulfillments の場合
CREATE POLICY fulfillments_creator ON fulfillments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM order_items oi
      WHERE oi.id = fulfillments.order_item_id
        AND oi.creator_id = auth.uid()
    )
  );
```

---

### WARNING: 公開テーブルの権限過剰

**影響**: 不要なデータ開示

**対処**:
```sql
-- 例: sales_vw の場合
REVOKE SELECT ON sales_vw FROM anon;
REVOKE SELECT ON sales_vw FROM authenticated;

-- service_role のみに制限
GRANT SELECT ON sales_vw TO service_role;
```

**注**: `SECURITY_ENHANCEMENT_PII.sql` で既に対応済み

---

## 🔧 推奨されるRLS設定

### user_roles

```sql
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 本人のロールのみ参照可能
CREATE POLICY user_roles_own ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 管理者は全体参照可能
CREATE POLICY user_roles_admin ON user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

---

### fulfillments

```sql
ALTER TABLE fulfillments ENABLE ROW LEVEL SECURITY;

-- クリエイターは自分の商品の製造記録を参照可能
CREATE POLICY fulfillments_creator ON fulfillments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM order_items oi
      WHERE oi.id = fulfillments.order_item_id
        AND oi.creator_id = auth.uid()
    )
  );

-- 製造パートナーは担当製造記録を参照可能
CREATE POLICY fulfillments_partner ON fulfillments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM partner_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.partner_id = fulfillments.manufacturing_partner_id
    )
  );

-- 管理者は全体参照・編集可能
CREATE POLICY fulfillments_admin ON fulfillments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

---

### creator_organizers

```sql
ALTER TABLE creator_organizers ENABLE ROW LEVEL SECURITY;

-- クリエイター本人のみ参照・編集可能
CREATE POLICY creator_organizers_own ON creator_organizers
  FOR ALL
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- オーガナイザーは自分の関係のみ参照可能
CREATE POLICY creator_organizers_organizer ON creator_organizers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizer_profiles op
      WHERE op.user_id = auth.uid()
        AND op.organizer_id = creator_organizers.organizer_id
    )
  );
```

---

### refunds

```sql
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の注文の返金のみ参照可能
CREATE POLICY refunds_user ON refunds
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = refunds.order_item_id
        AND o.user_id = auth.uid()
    )
  );

-- クリエイターは自分の商品の返金を参照可能
CREATE POLICY refunds_creator ON refunds
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM order_items oi
      WHERE oi.id = refunds.order_item_id
        AND oi.creator_id = auth.uid()
    )
  );

-- 管理者のみ返金処理可能
CREATE POLICY refunds_admin ON refunds
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

---

## 📝 次のアクション

### 即座実施（必須）
1. ✅ RLS_AUDIT_QUERIES.sql を実行
2. ✅ クエリ2, 5, 6 の結果を確認
3. ✅ CRITICALな問題があれば即座対応

### 短期（1週間以内）
- v6テーブルのRLS有効化（未対応の場合）
- 必要最小限のポリシー追加
- 公開テーブルの権限見直し

### 中期（1ヶ月以内）
- 全テーブルのRLS適用
- ポリシーの詳細チューニング
- RLSテストの実施

---

**ステータス**: 監査準備完了
**所要時間**: 10-15分
**推奨**: 即座実施
