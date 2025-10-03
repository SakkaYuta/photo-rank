# 🌅 v5互換ビュー サンセット計画

**作成日**: 2025-10-03
**ステータス**: 計画策定完了

---

## 🎯 目的

v5互換ビュー（sales_vw, purchases_vw, refund_requests_vw, publishing_approvals_vw, works_vw）を段階的に廃止し、v6ネイティブテーブルへ完全移行する。

---

## 📊 現状分析

### v5互換ビュー一覧

| ビュー名 | ベーステーブル | 現在の用途 | 依存関係 |
|---------|---------------|-----------|---------|
| **sales_vw** | sales + purchases (v5) | 売上レポート | 管理ダッシュボード |
| **purchases_vw** | purchases (v5) | 購入履歴 | 管理ダッシュボード |
| **refund_requests_vw** | refund_requests (v5) | 返金申請管理 | 管理ダッシュボード |
| **publishing_approvals_vw** | works (v5) | 作品承認フロー | 管理ダッシュボード |
| **works_vw** | works (v5) | 作品一覧 | クリエイターダッシュボード |

### v6ネイティブテーブル（移行先）

| v5ビュー | v6移行先 | 対応状況 |
|---------|---------|---------|
| sales_vw | orders + order_items + refunds | ✅ テーブル作成済み |
| purchases_vw | orders + order_items | ✅ テーブル作成済み |
| refund_requests_vw | refunds | ✅ テーブル作成済み |
| publishing_approvals_vw | products (status列) | ✅ テーブル作成済み |
| works_vw | products | ✅ テーブル作成済み |

---

## 📅 サンセット計画（3フェーズ）

### フェーズ1: 準備期間（1-2週間）

**目標**: v6ネイティブテーブルのデータ移行とアプリケーション対応

#### 1.1 データ移行スクリプト作成
```sql
-- v5 sales/purchases → v6 orders/order_items
INSERT INTO orders (user_id, total_amount_jpy, status, created_at)
SELECT ...;

-- v5 refund_requests → v6 refunds
INSERT INTO refunds (order_id, amount_jpy, reason, status, created_at)
SELECT ...;

-- v5 works → v6 products
INSERT INTO products (creator_id, title, description, product_type, base_price_jpy, status, created_at)
SELECT ...;
```

#### 1.2 アプリケーション側の移行
- **管理ダッシュボード**: v5ビュー → v6テーブルへのクエリ変更
- **クリエイターダッシュボード**: works_vw → products への移行
- **APIエンドポイント**: v5ビュー依存のエンドポイントを特定

#### 1.3 並行稼働開始
- v5ビューとv6テーブルの両方をサポート
- 新規データはv6テーブルに保存
- 既存データはv5ビューで参照（読み取り専用）

**完了条件**:
- ✅ データ移行スクリプトのテスト完了
- ✅ アプリケーション側の v6 対応コード実装完了
- ✅ v5/v6 並行稼働の動作確認完了

---

### フェーズ2: 移行期間（2-4週間）

**目標**: 段階的にv6テーブルへ切り替え、v5ビュー依存を削減

#### 2.1 段階的切り替え（週単位）

**Week 1: 返金機能**
- refund_requests_vw → refunds への完全移行
- 管理ダッシュボードの返金申請ページを v6 に切り替え
- 動作確認とバグ修正

**Week 2: 売上レポート**
- sales_vw → orders + order_items への移行
- 管理ダッシュボードの売上レポートを v6 に切り替え
- 集計ロジックの検証

**Week 3: 購入履歴**
- purchases_vw → orders + order_items への移行
- ユーザー向け購入履歴ページを v6 に切り替え
- パフォーマンステスト

**Week 4: 作品管理**
- works_vw → products への移行
- クリエイターダッシュボードの作品一覧を v6 に切り替え
- publishing_approvals_vw → products.status への移行

#### 2.2 モニタリング

**監視項目**:
- クエリパフォーマンス（v5 vs v6）
- エラーレート
- ユーザーフィードバック

**ロールバック条件**:
- クリティカルバグ発生
- パフォーマンス劣化 >30%
- ユーザークレーム増加

**完了条件**:
- ✅ 全機能が v6 テーブルで正常動作
- ✅ v5 ビューへのアクセスが管理ツールのみ
- ✅ パフォーマンス劣化なし（±10%以内）

---

### フェーズ3: サンセット完了（1週間）

**目標**: v5互換ビューの完全廃止

#### 3.1 最終確認

**確認項目**:
- ✅ v5ビューへのアクセスが0件（1週間）
- ✅ 全アプリケーション機能が v6 で動作
- ✅ データ整合性チェック完了

#### 3.2 ビュー廃止

```sql
-- 段階的に廃止（1つずつ）
DROP VIEW IF EXISTS refund_requests_vw;
DROP VIEW IF EXISTS sales_vw;
DROP VIEW IF EXISTS purchases_vw;
DROP VIEW IF EXISTS publishing_approvals_vw;
DROP VIEW IF EXISTS works_vw;
```

#### 3.3 v5テーブルのアーカイブ化

```sql
-- 読み取り専用に変更
REVOKE INSERT, UPDATE, DELETE ON sales FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON purchases FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON refund_requests FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON works FROM authenticated;

-- アーカイブスキーマに移動（将来的なバックアップ用）
CREATE SCHEMA IF NOT EXISTS archive;
ALTER TABLE sales SET SCHEMA archive;
ALTER TABLE purchases SET SCHEMA archive;
ALTER TABLE refund_requests SET SCHEMA archive;
ALTER TABLE works SET SCHEMA archive;
```

**完了条件**:
- ✅ v5互換ビューが全て削除
- ✅ v5テーブルがアーカイブスキーマに移動
- ✅ ドキュメント更新完了

---

## 🔧 技術的な移行詳細

### 1. sales_vw → orders + order_items

**v5 sales_vw 構造**:
```sql
SELECT
  s.id,
  s.work_id,
  s.creator_id,
  s.organizer_id,
  s.amount,
  s.platform_fee,
  s.net_amount,
  p.user_id AS buyer_id,  -- purchasesから取得
  s.created_at
FROM sales s
LEFT JOIN purchases p ON p.work_id = s.work_id;
```

**v6 orders + order_items クエリ**:
```sql
SELECT
  o.id,
  oi.product_id AS work_id,  -- products.id
  oi.creator_id,
  -- organizer_id は creator_organizers から取得
  oi.unit_price_jpy * oi.quantity AS amount,
  -- platform_fee は order_items.platform_fee
  -- net_amount は計算
  o.user_id AS buyer_id,
  o.created_at
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN creator_organizers co ON co.creator_id = oi.creator_id;
```

---

### 2. refund_requests_vw → refunds

**v5 refund_requests_vw 構造**:
```sql
SELECT
  rr.id,
  rr.purchase_id,  -- payment_id
  rr.reason,
  rr.status,
  rr.requested_amount,
  rr.stripe_refund_id,
  rr.created_at,
  rr.processed_at
FROM refund_requests rr;
```

**v6 refunds クエリ**:
```sql
SELECT
  r.id,
  r.order_item_id,  -- order_items経由でpayment特定
  r.reason,
  r.status,
  r.amount_jpy AS requested_amount,
  r.stripe_refund_id,
  r.created_at,
  r.processed_at
FROM refunds r;
```

---

### 3. works_vw → products

**v5 works_vw 構造**:
```sql
SELECT
  w.id,
  w.creator_id,
  w.title,
  true AS is_active,  -- 固定値
  w.created_at
FROM works w;
```

**v6 products クエリ**:
```sql
SELECT
  p.id,
  p.creator_id,
  p.title,
  p.is_active,
  p.created_at
FROM products p;
```

---

### 4. publishing_approvals_vw → products.status

**v5 publishing_approvals_vw 構造**:
```sql
SELECT
  w.id,
  w.creator_id,
  w.title,
  w.is_published,
  o.name AS organizer_name,
  w.created_at
FROM works w
LEFT JOIN organizers o ON o.id = w.organizer_id;
```

**v6 products + creator_organizers クエリ**:
```sql
SELECT
  p.id,
  p.creator_id,
  p.title,
  (p.status = 'published') AS is_published,
  co.organizer_id,
  -- organizer名は creator_organizers 経由
  p.created_at
FROM products p
LEFT JOIN creator_organizers co ON co.creator_id = p.creator_id;
```

---

## 📊 リスク管理

### 高リスク項目

| リスク | 影響度 | 発生確率 | 対策 |
|--------|--------|---------|------|
| **データ移行エラー** | 高 | 中 | バックアップ取得、段階的移行、ロールバック準備 |
| **パフォーマンス劣化** | 中 | 低 | 事前ベンチマーク、インデックス最適化 |
| **アプリケーションバグ** | 高 | 中 | テストカバレッジ向上、カナリアリリース |
| **ユーザー影響** | 中 | 低 | 段階的切り替え、モニタリング強化 |

### ロールバック計画

**条件**:
- クリティカルバグ発生
- データ整合性の問題
- パフォーマンス劣化 >30%

**手順**:
1. v6テーブルへの書き込みを停止
2. v5ビューを再有効化
3. アプリケーションを v5 に切り戻し
4. 原因調査と修正
5. 再移行計画の策定

---

## 📈 成功指標（KPI）

### フェーズ1完了時点
- ✅ データ移行スクリプトのテスト成功率 >99%
- ✅ v6対応コードのユニットテストカバレッジ >80%
- ✅ 並行稼働の動作確認完了

### フェーズ2完了時点
- ✅ v5ビューへのアクセス削減率 >90%
- ✅ v6クエリのパフォーマンス比較 ±10%以内
- ✅ クリティカルバグ発生件数 0件

### フェーズ3完了時点
- ✅ v5ビューへのアクセス 0件
- ✅ 全機能が v6 で正常動作
- ✅ ドキュメント更新完了率 100%

---

## 📝 次のアクション

### 即座実施
1. ✅ サンセット計画の承認
2. ✅ データ移行スクリプトの作成開始

### 1週間以内
- フェーズ1のキックオフ
- データ移行スクリプトのテスト
- アプリケーション側の v6 対応開始

### 1ヶ月以内
- フェーズ1完了
- フェーズ2開始（段階的切り替え）

### 2ヶ月以内
- フェーズ2完了
- フェーズ3開始（サンセット完了）

---

**ステータス**: 計画策定完了
**開始予定**: 2025-10-10
**完了予定**: 2025-12-15（約2ヶ月）
**リスクレベル**: 中（適切な対策により低減可能）
