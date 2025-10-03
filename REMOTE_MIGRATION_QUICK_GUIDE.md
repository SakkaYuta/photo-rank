# 🚀 リモートDB即座適用ガイド

**作成日**: 2025-10-02
**所要時間**: 5分
**リスク**: 低（ビュー・テーブル追加のみ、既存データへの影響なし）

---

## ⚠️ 現在の状況

**エラー**: `ERROR: 42P01: relation "user_roles" does not exist`

**原因**: v6互換ビューがリモートDBに適用されていない

**影響**: オーガナイザーダッシュボード、作品承認フローが動作しない

---

## ✅ 即座適用手順（5分）

### ステップ1: Supabase Studioにアクセス

```
https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj
```

### ステップ2: SQL Editorを開く

左サイドバー → **SQL Editor** → **New query**

### ステップ3: v6互換ビューSQLを実行

**ファイル**: `photo-rank/supabase/migrations/REMOTE_APPLY_v6_compatibility_safe.sql`

1. ファイル全体をコピー
2. SQL Editorにペースト
3. **Run** をクリック

**実行時間**: 約30秒

### ステップ4: セキュリティ強化SQLを実行（オプション）

**ファイル**: `photo-rank/supabase/migrations/REMOTE_APPLY_security_hardening.sql`

1. ファイル全体をコピー
2. SQL Editorにペースト
3. **Run** をクリック

**実行時間**: 約30秒

---

## 🎯 作成されるもの

### テーブル（3つ）
- ✅ `user_roles` - ユーザーロール管理
- ✅ `organizer_profiles` - オーガナイザープロフィール
- ✅ `creator_organizers` - クリエイター・オーガナイザー関係

### ビュー（3つ）
- ✅ `sales_vw` - 売上データビュー
- ✅ `publishing_approvals_vw` - 作品承認ビュー
- ✅ `factory_orders_vw` - ファクトリーオーダービュー

### 関数（1つ）
- ✅ `approve_publishing()` - 作品承認関数

---

## ✅ 実行後の確認

### SQL Editorで確認

```sql
-- ビューが正常に作成されたか確認
SELECT COUNT(*) FROM sales_vw;
SELECT COUNT(*) FROM publishing_approvals_vw;
SELECT COUNT(*) FROM factory_orders_vw;

-- テーブルが作成されたか確認
SELECT COUNT(*) FROM user_roles;
SELECT COUNT(*) FROM organizer_profiles;
SELECT COUNT(*) FROM creator_organizers;
```

### アプリケーションで確認

1. オーガナイザーダッシュボードにアクセス
2. 作品承認フローを実行
3. エラーが出ないことを確認

---

## 📋 実行ログ（期待される出力）

```
═══════════════════════════════════════════════════════════════
✅ v6互換ビュー作成完了（安全版）
═══════════════════════════════════════════════════════════════

作成されたテーブル:
  ✅ user_roles
  ✅ organizer_profiles
  ✅ creator_organizers

作成されたビュー:
  ✅ sales_vw
  ✅ publishing_approvals_vw
  ✅ factory_orders_vw

作成された関数:
  ✅ approve_publishing()

動作確認:
  SELECT COUNT(*) FROM sales_vw;
  SELECT COUNT(*) FROM publishing_approvals_vw;
  SELECT COUNT(*) FROM factory_orders_vw;

═══════════════════════════════════════════════════════════════
```

---

## 🔍 トラブルシューティング

### エラー: "permission denied"

**対応**: Supabase Studioで実行（自動的にpostgres権限で実行される）

### エラー: "relation already exists"

**対応**: 既に作成済み。問題なし。

### エラー: "column does not exist"

**対応**: v5スキーマとの互換性の問題。ビュー定義を確認。

---

## 📝 ファイル比較

### REMOTE_APPLY_v6_compatibility.sql（旧版）
- ❌ `user_roles`テーブルへの依存あり
- ❌ リモートDBでエラー発生

### REMOTE_APPLY_v6_compatibility_safe.sql（新版・推奨）
- ✅ `user_roles`テーブルを含む
- ✅ 完全な依存関係を含む
- ✅ エラーハンドリング付き

---

## 次のステップ

### 即座に実施
1. ✅ `REMOTE_APPLY_v6_compatibility_safe.sql` を実行
2. ✅ 動作確認

### 後で実施（オプション）
1. ⏳ `REMOTE_APPLY_security_hardening.sql` を実行
2. ⏳ セキュリティ検証を実行

---

**所要時間**: 5分
**難易度**: 簡単
**リスク**: 低
