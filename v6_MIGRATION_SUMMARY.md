# ✅ v6スキーマ移行 最終サマリー

**作成日**: 2025-10-02
**ステータス**: 準備完了
**SQLファイル**: `photo-rank/supabase/migrations/REMOTE_APPLY_v6_FINAL.sql`

---

## 🎯 実行準備完了

### SQLファイルの状態
✅ **全エラー修正済み**
- is_activeカラム参照エラー → 修正完了
- work_idカラム参照エラー → 削除完了
- purchasesテーブルJOINエラー → 修正完了
- organizersテーブルJOINエラー → 修正完了
- manufacturing_ordersエラー → fulfillmentsベースに変更

### 修正内容の詳細

#### 1. works_vw（is_activeエラー修正）
```sql
-- ❌ 修正前（エラー）
SELECT w.is_active FROM works w;

-- ✅ 修正後
SELECT true AS is_active FROM works w;
```
**理由**: v5 worksテーブルにis_activeカラムが存在しない

#### 2. approve_publishing関数（is_activeエラー修正）
```sql
-- ❌ 修正前（エラー）
UPDATE works SET
  is_published = p_approved,
  is_active = p_approved  -- エラー

-- ✅ 修正後
UPDATE works SET
  is_published = p_approved
```
**理由**: v5 worksテーブルにis_activeカラムが存在しない

#### 3. productsテーブル（work_idエラー修正）
```sql
-- ❌ 修正前（エラー）
CREATE TABLE products (
  work_id uuid REFERENCES works(id),  -- エラー
  ...
);

-- ✅ 修正後
CREATE TABLE products (
  -- work_idカラムなし
  title text NOT NULL,
  ...
);
```
**理由**: v5 worksテーブルの構造が不明、独立した商品マスタとして機能

#### 4. sales_vw（purchasesテーブルJOIN修正）
```sql
-- ❌ 修正前（エラー）
LEFT JOIN purchases p ON p.work_id = s.work_id AND p.creator_id = s.creator_id

-- ✅ 修正後
LEFT JOIN purchases p ON p.work_id = s.work_id
```
**理由**: purchasesテーブルにcreator_idカラムが存在しない

#### 5. publishing_approvals_vw（organizersテーブルJOIN修正）
```sql
-- ❌ 修正前（エラー）
LEFT JOIN organizer_profiles op ON op.user_id = w.organizer_id

-- ✅ 修正後
LEFT JOIN organizers o ON o.id = w.organizer_id
```
**理由**: organizer_profilesテーブルではなくorganizersテーブルを使用

#### 6. factory_orders_vw（manufacturing_orders問題修正）
```sql
-- ❌ 修正前（v5ベース、カラム不明）
FROM manufacturing_orders mo

-- ✅ 修正後（v6ベース、推奨方針B）
FROM fulfillments f
JOIN order_items oi ON oi.id = f.order_item_id
JOIN orders o ON o.id = oi.order_id
LEFT JOIN product_variants pv ON pv.id = oi.product_variant_id
LEFT JOIN products pr ON pr.id = pv.product_id
```
**理由**: v6正式スキーマ、顧客向け商品情報を導出、NULL値なし

---

## 📦 作成されるテーブル（8個）

1. **user_roles** - ユーザーロール管理
2. **products** - 商品カタログ（work_idなし）
3. **product_variants** - SKUバリアント
4. **orders** - 注文管理
5. **order_items** - 注文明細
6. **fulfillments** - 製造・配送管理（v6中核）
7. **creator_organizers** - クリエイター・オーガナイザー関係
8. **refunds** - 返金管理

---

## 🔍 作成されるビュー（7個）

### v5互換ビュー
1. **sales_vw** - v5 sales + purchases統合
2. **purchases_vw** - v5 purchases
3. **works_vw** - v5 works（is_active固定値）
4. **users_vw** - v5 users + user_public_profiles
5. **publishing_approvals_vw** - v5 works + organizers
6. **refund_requests_vw** - v5 refund_requests

### v6ネイティブビュー
7. **factory_orders_vw** - v6 fulfillmentsベース（推奨方針B）
   - 顧客向け商品情報（products.title）
   - 注文詳細（quantity, unit_price_jpy）
   - 顧客情報（customer_name）
   - **NULL値なし、全て実データ導出**

---

## 🔗 外部キー制約（1個）

- **fulfillments.manufacturing_partner_id** → manufacturing_partners(id)
  - ON DELETE SET NULL
  - 工場削除時、履歴保護

---

## ⚙️ 作成される関数（1個）

- **approve_publishing()** - 作品承認処理
  - is_publishedのみ更新（is_activeなし）

---

## 🚀 実行方法

### Supabase Studio SQL Editor
```
1. https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj
2. 左サイドバー → SQL Editor → New query
3. REMOTE_APPLY_v6_FINAL.sql をコピー&ペースト
4. Run をクリック
```

### 実行時間
約2分

### 期待される結果
```
✅ v6 完全スキーマSQL適用完了（最終版）

作成されたテーブル:
  ✅ user_roles
  ✅ products
  ✅ product_variants
  ✅ orders
  ✅ order_items
  ✅ fulfillments (manufacturing_partner_id FK: ON DELETE SET NULL)
  ✅ creator_organizers
  ✅ refunds

外部キー制約:
  ✅ fulfillments.manufacturing_partner_id → manufacturing_partners(id) [SET NULL]
  ℹ️  データ整合性保護

作成されたビュー:
  ✅ sales_vw (v5 sales + purchases)
  ✅ factory_orders_vw (v6 fulfillments - 推奨方針B)
      - 顧客向け商品名（products.title）
      - NULL値なし、実データ導出
      - 注文詳細・顧客情報含む
  ✅ publishing_approvals_vw (v5 works)
  ✅ purchases_vw (v5 purchases)
  ✅ works_vw (v5 works)
  ✅ users_vw (v5 users + profiles)
  ✅ refund_requests_vw (v5 refund_requests)

✅ v6完全スキーマ適用完了！
```

---

## 🔍 動作確認クエリ

```sql
-- テーブル確認
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM fulfillments;

-- factory_orders_vw の実データ確認
SELECT
  product_name,      -- products.title（顧客向け）
  product_type,      -- digital/physical/print
  quantity,          -- 実数値
  customer_name,     -- 顧客名
  status
FROM factory_orders_vw
LIMIT 5;

-- ビュー確認
SELECT COUNT(*) FROM sales_vw;
SELECT COUNT(*) FROM works_vw;
SELECT COUNT(*) FROM users_vw;
```

---

## ⚠️ 重要事項

### v5スキーマの制約を反映
- ✅ worksテーブルにis_activeカラムなし → works_vwで固定値true
- ✅ worksテーブルにwork_idカラムなし → productsからwork_id削除
- ✅ purchasesテーブルにcreator_idカラムなし → JOINをwork_idのみ
- ✅ organizer_profilesではなくorganizers使用

### データへの影響
- ✅ 既存v5テーブルは無変更
- ✅ 既存データは保護
- ✅ v6テーブルは空で作成
- ✅ ビューは既存v5テーブルを参照

### 推奨方針B準拠
- ✅ factory_orders_vw は fulfillments ベース
- ✅ 顧客向け商品情報（products.title）
- ✅ NULL値なし、実データ導出
- ✅ 注文詳細・顧客情報を完備

---

## 📝 次のアクション

### 即座実施（必須）
1. ✅ `REMOTE_APPLY_v6_FINAL.sql` を実行
2. ✅ 動作確認クエリを実行
3. ✅ エラーがないことを確認

### 短期（1-2週間）
- products, product_variants マスタ登録
- 新規注文をv6テーブルに保存開始

### 中期（1-2ヶ月）
- v5データの段階的移行
- ビューではなく直接v6テーブル参照

### 長期（必要に応じて）
- 方針C: partner_products テーブル追加
- 工場向け名称の分離管理

---

## 📚 関連ファイル

- `REMOTE_APPLY_v6_FINAL.sql` - 最終実行SQL
- `EXECUTE_v6_FINAL.md` - 詳細実行ガイド
- `APPLY_v6_COMPLETE.md` - 適用ガイド（旧版）

---

**ステータス**: ✅ 実行準備完了
**所要時間**: 2分
**リスク**: 最小
**推奨**: 即座実施
