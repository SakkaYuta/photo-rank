# 🚨 リモートDB状態の緊急確認が必要

**作成日**: 2025-10-02
**ステータス**: 🔴 緊急対応必要
**問題**: リモートDBとローカルDBのスキーマが完全に不一致

---

## 🔴 発生しているエラー

### エラー1: user_roles テーブルが存在しない
```
ERROR: 42P01: relation "user_roles" does not exist
```

### エラー2: order_items テーブルが存在しない
```
ERROR: 42P01: relation "order_items" does not exist
LINE 164: FROM order_items oi
```

---

## 📊 推測される状況

### ローカルDB（動作中）
- ✅ v6 統合スキーマ（56テーブル）
- ✅ user_roles, order_items, orders など全て存在
- ✅ 互換ビュー（sales_vw, publishing_approvals_vw）動作中

### リモートDB（本番）
- ❌ v5 スキーマのみ
- ❌ v6テーブル（user_roles, order_items等）が存在しない
- ❌ 互換ビューも存在しない
- ⚠️ おそらく purchases, works などv5テーブルのみ

---

## 🎯 必要な対応

### オプション1: v5スキーマとの完全互換性確保（推奨）

**方針**: リモートDBの既存v5スキーマを活かし、v6機能を段階的に追加

**メリット**:
- ✅ 既存データを保持
- ✅ ダウンタイムなし
- ✅ 段階的な移行が可能
- ✅ リスクが最小

**手順**:

#### 1. リモートDBの現在のスキーマを確認

Supabase Studio SQL Editorで実行:

```sql
-- 既存テーブル一覧
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 既存カラム確認（purchasesテーブル）
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'purchases'
ORDER BY ordinal_position;
```

#### 2. v5スキーマベースの互換ビュー作成

必要なファイル: **`REMOTE_APPLY_v5_compatible_views.sql`**（作成必要）

内容:
- v5の既存テーブル（purchases, works等）をベースにしたビュー
- v6互換APIを提供するが、内部的にはv5テーブルを参照
- 新規テーブルの作成は最小限に

---

### オプション2: v6スキーマの完全適用（非推奨）

**方針**: v6の56テーブルを全て作成し、既存データを移行

**デメリット**:
- ❌ 大規模なダウンタイムが必要
- ❌ データ移行のリスクが高い
- ❌ ロールバックが困難
- ❌ 本番環境での実施は危険

---

## 🚀 即座実施すべきこと

### ステップ1: リモートDBスキーマの確認

Supabase Studio SQL Editorで以下を実行:

```sql
-- テーブル一覧
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**実行結果を確認してください**

### ステップ2: v5スキーマに基づいた判断

確認結果に基づき、以下のいずれかを選択:

**A. v5スキーマが確認できた場合**
→ v5互換ビューを作成（`REMOTE_APPLY_v5_compatible_views.sql`を作成）

**B. v6テーブルが既に存在する場合**
→ 互換ビューのみ追加（`REMOTE_APPLY_v6_compatibility_safe.sql`）

**C. 空のDBの場合**
→ v6スキーマの完全適用（`20251002100000_v6_unified_schema.sql`から順次）

---

## 📋 チェックリスト

### 確認事項
- [ ] リモートDBのテーブル一覧を確認
- [ ] 既存のpurchasesテーブルのスキーマを確認
- [ ] 既存のworksテーブルのスキーマを確認
- [ ] 既存データ件数を確認

### 実施事項（確認後）
- [ ] 適切なマイグレーションSQLを選択
- [ ] マイグレーションSQLを実行
- [ ] 動作確認

---

## ⚠️ 重要な注意事項

### 絶対にやってはいけないこと
- ❌ リモートDBでDROP TABLEを実行（データ消失）
- ❌ 本番DBで未検証のSQLを実行
- ❌ バックアップなしでのスキーマ変更

### やるべきこと
- ✅ 必ずSupabase StudioのSQL Editorで実行（権限確認済み）
- ✅ 実行前に必ずSELECTで確認
- ✅ エラーログを保存

---

## 🔍 次のステップ

### 即座に実施
1. **リモートDBスキーマの確認**（上記SQLを実行）
2. **確認結果の報告**
3. **適切なマイグレーション戦略の選択**

### 確認結果の共有方法

以下の情報を提供してください:

```
=== リモートDBスキーマ確認結果 ===

【テーブル一覧】
（SQL実行結果を貼り付け）

【purchasesテーブルのカラム】
（存在する場合、カラム一覧を貼り付け）

【worksテーブルのカラム】
（存在する場合、カラム一覧を貼り付け）

【データ件数】
SELECT 'purchases', COUNT(*) FROM purchases
UNION ALL
SELECT 'works', COUNT(*) FROM works;
```

---

## 📞 サポート情報

**作成者**: Claude (AI Assistant)
**緊急度**: 🔴 高
**推奨対応時間**: 1時間以内

**関連ドキュメント**:
- `PENDING_REMOTE_MIGRATIONS.md` - マイグレーション一覧
- `DEPLOYMENT_GUIDE_v6.md` - デプロイガイド
- `V6_MIGRATION_VERIFICATION_REPORT.md` - 検証レポート
