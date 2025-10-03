# 🚨 緊急: 最小構成SQLの適用

**作成日**: 2025-10-02
**所要時間**: 1分
**リスク**: ゼロ（テーブル作成のみ、既存データに影響なし）

---

## 🎯 状況

リモートDBのv5スキーマ構造が不明なため、**エラー解決に必要なテーブルのみ**を作成します。

### 発生しているエラー
1. ❌ `relation "user_roles" does not exist`
2. ❌ `relation "order_items" does not exist`
3. ❌ `column s.buyer_id does not exist`

---

## 📋 2段階アプローチ

### 第1段階: 最小構成SQL（今すぐ実施）

**目的**: エラー解決
**ファイル**: `REMOTE_APPLY_MINIMAL.sql`

**作成内容**:
- ✅ user_roles テーブル（空）
- ✅ orders テーブル（空）
- ✅ order_items テーブル（空）
- ✅ creator_organizers テーブル（空）
- ✅ refunds テーブル（空）

**作成しないもの**:
- ❌ ビュー（sales_vw, publishing_approvals_vw等）
- ❌ データ移行

---

### 第2段階: テーブル構造確認（その後）

**目的**: v5スキーマの正確な構造を把握
**ファイル**: `CHECK_V5_TABLES.sql`

**確認項目**:
- sales テーブルのカラム
- purchases テーブルのカラム
- works テーブルのカラム
- organizers テーブルのカラム

---

## 🚀 適用手順

### ステップ1: 最小構成SQLを実行

1. Supabase Studio SQL Editor
   ```
   https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj
   ```

2. `REMOTE_APPLY_MINIMAL.sql` をコピー&ペースト

3. **Run** をクリック

**実行時間**: 約10秒

### ステップ2: テーブル構造を確認

1. 同じSQL Editorで新規クエリ

2. `CHECK_V5_TABLES.sql` をコピー&ペースト

3. **Run** をクリック

4. **結果をコピーしてください**

---

## ✅ 期待される結果

### 第1段階実行後

```
✅ v6 最小構成SQL適用完了

作成されたテーブル:
  ✅ user_roles (空テーブル)
  ✅ orders (空テーブル)
  ✅ order_items (空テーブル)
  ✅ creator_organizers (空テーブル)
  ✅ refunds (空テーブル)
```

### 解決されるエラー

- ✅ `relation "user_roles" does not exist` → 解決
- ✅ `relation "order_items" does not exist` → 解決

### 残るエラー（一時的）

- ⚠️ ビュー関連のエラーは残る可能性あり
- ⚠️ アプリケーションコードの修正が必要な場合あり

---

## 📊 第2段階の確認結果の使い方

`CHECK_V5_TABLES.sql` の実行結果を確認して、以下を報告してください:

```
【salesテーブルのカラム】
（実行結果を貼り付け）

【purchasesテーブルのカラム】
（実行結果を貼り付け）

【worksテーブルのカラム】
（実行結果を貼り付け）

【organizersテーブルのカラム】
（実行結果を貼り付け）
```

この情報に基づいて、正しいビューを作成します。

---

## ⚠️ 重要な注意事項

### 現在の状態

- ✅ 必須テーブルは作成される
- ❌ ビューは作成されない
- ✅ 既存データは保護される

### アプリケーションへの影響

**短期的**:
- 一部の機能でエラーが残る可能性
- ビューを参照している箇所は動作しない

**解決策**:
- v5テーブル構造の確認後、正しいビューを作成
- または、アプリケーションコードでv5テーブルを直接参照

---

## 🔄 ロールバック（必要な場合）

```sql
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS creator_organizers CASCADE;
DROP TABLE IF EXISTS refunds CASCADE;
```

---

## 📞 次のアクション

### 即座実施
1. ✅ `REMOTE_APPLY_MINIMAL.sql` を実行
2. ✅ `CHECK_V5_TABLES.sql` を実行
3. ✅ 結果を報告

### 報告後
- v5スキーマに基づいた正しいビューを作成
- アプリケーションの完全な動作を確認

---

**所要時間**: 1分（第1段階）+ 1分（第2段階）
**難易度**: 非常に簡単
**リスク**: ゼロ
**即座実施**: ✅ 必須
