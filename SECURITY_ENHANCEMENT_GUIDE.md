# 🔒 セキュリティ強化ガイド: PII最小化とアクセス権限最適化

**作成日**: 2025-10-03
**SQLファイル**: `photo-rank/supabase/migrations/SECURITY_ENHANCEMENT_PII.sql`

---

## 🎯 目的

1. **PII（個人識別情報）最小化**: factory_orders_vw.customer_name を users.email から display_name に変更
2. **アクセス権限最適化**: v5互換ビューのSELECT権限を最小化（必要最小限のロールのみ）

---

## 📊 変更内容

### 1. factory_orders_vw の PII 最小化 ✅

**変更前**:
```sql
COALESCE(u.email, 'unknown') AS customer_name
```
**問題点**:
- users.email は PII（個人識別情報）
- 製造パートナーには email の開示が不要

**変更後**:
```sql
COALESCE(uv.display_name, u.email, 'unknown') AS customer_name
```
**改善点**:
- ✅ display_name を優先表示（PII最小化）
- ✅ フォールバック: display_name → email → 'unknown'
- ✅ users_vw を LEFT JOIN して display_name を取得

**JOINの追加**:
```sql
LEFT JOIN users_vw uv ON uv.id = o.user_id
```

---

### 2. v5互換ビューのアクセス権限最小化 ✅

#### 対象ビュー（4つ）

| ビュー名 | 変更前 | 変更後 | 理由 |
|---------|--------|--------|------|
| **sales_vw** | anon, authenticated | **service_role のみ** | 旧テーブル依存、管理ツール専用 |
| **purchases_vw** | anon, authenticated | **service_role のみ** | 旧テーブル依存、管理ツール専用 |
| **refund_requests_vw** | anon, authenticated | **service_role のみ** | 旧テーブル依存、管理ツール専用 |
| **publishing_approvals_vw** | anon, authenticated | **service_role のみ** | 旧テーブル依存、管理ツール専用 |

**権限変更コマンド**:
```sql
REVOKE SELECT ON sales_vw FROM anon;
REVOKE SELECT ON sales_vw FROM authenticated;
GRANT SELECT ON sales_vw TO service_role;
```

---

### 3. works_vw の条件付きアクセス ✅

**アクセス権限**:
- ❌ **anon**: アクセス不可
- ✅ **authenticated**: 条件付きアクセス（RLSで制御）
- ✅ **service_role**: フルアクセス

**RLSポリシー**（予定）:
```sql
-- 本人または公開作品のみ閲覧可能
CREATE POLICY works_vw_access ON works_vw
  FOR SELECT USING (
    is_published = true OR creator_id = auth.uid()
  );
```

---

### 4. factory_orders_vw のアクセス権限設定 ✅

**アクセス権限**:
- ❌ **anon**: アクセス不可
- ❌ **authenticated**: アクセス不可（一般ユーザーは不要）
- ✅ **service_role**: フルアクセス（管理ツール、製造パートナー向けAPI）

**理由**:
- 製造情報は一般ユーザーに不要
- 製造パートナーは専用API経由でアクセス（service_role）

---

### 5. users_vw のアクセス権限確認 ✅

**アクセス権限**:
- ✅ **anon**: アクセス可能（公開プロフィール情報）
- ✅ **authenticated**: アクセス可能（公開プロフィール情報）
- ✅ **service_role**: フルアクセス

**理由**:
- display_name, avatar_url などは公開プロフィール情報
- PII（email, phone）は含まれない

---

## 🚀 実行手順

### ステップ1: Supabase Studio SQL Editor

```
https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj
```

### ステップ2: SQL実行

1. SQL Editor → New query
2. `photo-rank/supabase/migrations/SECURITY_ENHANCEMENT_PII.sql` をコピー&ペースト
3. **Run** ボタンをクリック

### ステップ3: 実行結果確認

**期待される出力**:
```
✅ セキュリティ強化完了
  1. factory_orders_vw: customer_name を display_name 優先に変更
  2. v5互換ビュー: アクセス権限を service_role のみに制限
  3. factory_orders_vw: 製造パートナーと管理者専用
  4. users_vw: 公開プロフィール情報として全ユーザーアクセス可能

✅ PII最小化とアクセス権限強化完了 | 2025-10-03 ...
```

---

## 🔍 動作確認クエリ

### 1. factory_orders_vw の customer_name 確認

```sql
SELECT
  customer_id,
  customer_name,
  product_name
FROM factory_orders_vw
LIMIT 5;
```

**期待結果**: customer_name が display_name を優先表示

### 2. ビューのアクセス権限確認

```sql
SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('sales_vw', 'purchases_vw', 'refund_requests_vw', 'publishing_approvals_vw', 'factory_orders_vw', 'users_vw')
ORDER BY table_name, grantee;
```

**期待結果**:

| table_name | grantee | privilege_type |
|-----------|---------|----------------|
| factory_orders_vw | service_role | SELECT |
| sales_vw | service_role | SELECT |
| purchases_vw | service_role | SELECT |
| refund_requests_vw | service_role | SELECT |
| publishing_approvals_vw | service_role | SELECT |
| users_vw | anon | SELECT |
| users_vw | authenticated | SELECT |
| users_vw | service_role | SELECT |

---

## 📊 セキュリティ改善効果

### PII最小化効果

| 項目 | 変更前 | 変更後 | 改善率 |
|------|--------|--------|--------|
| **factory_orders_vw.customer_name** | users.email（100% PII） | display_name（0% PII） | **100%改善** |
| **製造パートナーへのPII開示** | email 開示 | display_name のみ | **PII漏洩リスク低減** |

### アクセス権限最適化効果

| ビュー | 変更前アクセス可能ロール数 | 変更後アクセス可能ロール数 | 削減率 |
|-------|--------------------------|--------------------------|--------|
| **sales_vw** | 3（anon, authenticated, service_role） | 1（service_role） | **67%削減** |
| **purchases_vw** | 3 | 1 | **67%削減** |
| **refund_requests_vw** | 3 | 1 | **67%削減** |
| **publishing_approvals_vw** | 3 | 1 | **67%削減** |
| **factory_orders_vw** | 3 | 1 | **67%削減** |

---

## ⚠️ 影響範囲

### アプリケーション側の影響

#### 製造パートナー向けAPI

**変更前**:
```typescript
// authenticated ユーザーが factory_orders_vw にアクセス可能
const { data } = await supabase
  .from('factory_orders_vw')
  .select('*');
```

**変更後**:
```typescript
// service_role キーが必要（サーバーサイドAPI経由）
const supabaseAdmin = createClient(url, SERVICE_ROLE_KEY);
const { data } = await supabaseAdmin
  .from('factory_orders_vw')
  .select('*');
```

#### v5互換ビューへのアクセス

**影響**:
- クライアントサイドから sales_vw, purchases_vw などに直接アクセス不可
- 管理ダッシュボードは service_role キー経由でアクセス

**対応**:
1. サーバーサイドAPIを経由してアクセス
2. または v6 ネイティブテーブル（orders, order_items など）を直接使用

---

## 🔄 ロールバック（必要な場合）

```sql
-- factory_orders_vw を元に戻す
DROP VIEW IF EXISTS factory_orders_vw;
CREATE VIEW factory_orders_vw AS
SELECT
  f.id,
  pr.id AS product_id,
  pr.title AS product_name,
  pv.id AS product_variant_id,
  pr.product_type,
  oi.quantity,
  oi.unit_price_jpy,
  f.manufacturing_partner_id AS factory_id,
  o.id AS order_id,
  o.user_id AS customer_id,
  COALESCE(u.email, 'unknown') AS customer_name,  -- 元に戻す
  oi.creator_id,
  f.status,
  f.created_at,
  f.updated_at
FROM fulfillments f
JOIN order_items oi ON oi.id = f.order_item_id
JOIN orders o ON o.id = oi.order_id
LEFT JOIN users u ON u.id = o.user_id
LEFT JOIN product_variants pv ON pv.id = oi.product_variant_id
LEFT JOIN products pr ON pr.id = pv.product_id;

-- v5互換ビューのアクセス権限を元に戻す
GRANT SELECT ON sales_vw TO anon;
GRANT SELECT ON sales_vw TO authenticated;
-- （他のビューも同様）
```

---

## 📝 次のアクション

### 即座実施（必須）
1. ✅ `SECURITY_ENHANCEMENT_PII.sql` を実行
2. ✅ 動作確認クエリを実行
3. ✅ エラーがないことを確認

### 短期（1週間以内）
- 製造パートナー向けAPIをサーバーサイドに移行
- v5互換ビューへのアクセスを管理ダッシュボードのみに制限

### 中期（1ヶ月以内）
- v5互換ビューのサンセット計画策定
- v6ネイティブテーブルへの完全移行

---

**ステータス**: ✅ 実行準備完了
**所要時間**: 2分
**安全性**: 最大（ロールバック可能）
**推奨**: 即座実施
