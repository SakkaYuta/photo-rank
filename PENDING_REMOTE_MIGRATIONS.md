# 🔴 リモートDBへの未適用マイグレーション

**作成日**: 2025-10-02
**ステータス**: 要対応
**リスク**: 中（ローカルとリモートの不整合）

---

## 📊 未適用マイグレーション一覧

### ローカルには適用済み、リモート未適用

| マイグレーション | ファイル名 | 内容 | 優先度 |
|----------------|-----------|------|--------|
| 20251002130000 | `20251002130000_v6_compatibility_views.sql` | v6互換ビュー作成 | 🔴 高 |
| 20251002133000 | `20251002133000_v6_compatibility_views_additional.sql` | v6互換ビュー追加 | 🔴 高 |
| 20251002140000 | `20251002140000_security_hardening.sql` | セキュリティ強化関連 | 🟡 中 |
| 20251002150000 | `20251002150000_security_hardening_fixes.sql` | セキュリティ強化fixes | 🟡 中 |

### 手動適用用SQLファイル（推奨）

| ファイル名 | 内容 | 適用方法 |
|-----------|------|---------|
| `REMOTE_APPLY_v6_compatibility.sql` | v6互換ビュー一括作成 | Supabase Studio SQL Editor |
| `REMOTE_APPLY_security_hardening.sql` | セキュリティ強化一括適用 | Supabase Studio SQL Editor |

---

## 🚀 推奨適用手順

### オプション1: 手動適用用SQLファイルを使用（推奨）

**メリット**:
- ✅ 一括適用で効率的
- ✅ エラーハンドリング付き
- ✅ 検証関数付き
- ✅ 詳細なログ出力

**手順**:

#### 1. v6互換ビューの適用

```bash
# Supabase Studioにアクセス
https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj

# SQL Editor で以下を実行
```

**ファイル**: `photo-rank/supabase/migrations/REMOTE_APPLY_v6_compatibility.sql`

**実行前確認**:
- ローカルで動作確認済み: ✅
- 既存データへの影響: なし（ビュー作成のみ）
- ダウンタイム: なし

#### 2. セキュリティ強化の適用

**ファイル**: `photo-rank/supabase/migrations/REMOTE_APPLY_security_hardening.sql`

**実行前確認**:
- セキュリティリスク: 高・中リスク項目対応
- 既存機能への影響: なし（設定強化のみ）
- ダウンタイム: なし

**実行後確認**:
```sql
-- セキュリティ検証
SELECT * FROM verify_security_settings();
```

**期待される結果**:
```
check_type                      | status  | details
-------------------------------|---------|----------------------------------
SECURITY_DEFINER_SEARCH_PATH   | ✅ PASS | Functions without fixed search_path: 0
VIEW_SECURITY_INVOKER          | ✅ PASS | Views processed: X
RLS_ENABLED_TABLES             | ✅ PASS | Tables: X (without RLS: 0)
```

---

### オプション2: 個別マイグレーションを順次適用

**メリット**:
- ✅ マイグレーション履歴が保持される
- ✅ ロールバックが容易

**デメリット**:
- ❌ 4回のSQL実行が必要
- ❌ エラーハンドリングが手動

**手順**:

```bash
# 1. v6互換ビュー作成
cat photo-rank/supabase/migrations/20251002130000_v6_compatibility_views.sql

# 2. v6互換ビュー追加
cat photo-rank/supabase/migrations/20251002133000_v6_compatibility_views_additional.sql

# 3. セキュリティ強化関連
cat photo-rank/supabase/migrations/20251002140000_security_hardening.sql

# 4. セキュリティ強化fixes
cat photo-rank/supabase/migrations/20251002150000_security_hardening_fixes.sql
```

各ファイルの内容をSupabase Studio SQL Editorで実行

---

## ⚠️ 注意事項

### 1. マイグレーション順序の遵守

**重要**: 必ず以下の順序で適用してください:

1. ✅ v6互換ビュー作成（20251002130000）
2. ✅ v6互換ビュー追加（20251002133000）
3. ✅ セキュリティ強化関連（20251002140000）
4. ✅ セキュリティ強化fixes（20251002150000）

### 2. 既存機能への影響

**v6互換ビュー**:
- ✅ 既存のv5クエリと互換性あり
- ✅ アプリケーションコード変更不要
- ✅ ダウンタイムなし

**セキュリティ強化**:
- ✅ 既存機能への影響なし（設定強化のみ）
- ⚠️ SECURITY DEFINER関数の動作が厳密化
- ⚠️ ビューの権限評価方法が変更

### 3. ロールバック方法

**v6互換ビューのロールバック**:
```sql
DROP VIEW IF EXISTS sales_vw CASCADE;
DROP VIEW IF EXISTS publishing_approvals_vw CASCADE;
DROP VIEW IF EXISTS factory_orders_vw CASCADE;
DROP TABLE IF EXISTS creator_organizers CASCADE;
DROP TABLE IF EXISTS organizer_profiles CASCADE;
```

**セキュリティ強化のロールバック**:
```sql
-- SECURITY DEFINER関数のsearch_path解除
ALTER FUNCTION complete_purchase_transaction(text, integer) RESET search_path;

-- ビューのsecurity_invoker解除
ALTER VIEW purchases_vw RESET (security_invoker);
```

---

## 📝 適用後の確認事項

### 1. v6互換ビュー動作確認

```sql
-- sales_vw確認
SELECT COUNT(*) FROM sales_vw;

-- publishing_approvals_vw確認
SELECT COUNT(*) FROM publishing_approvals_vw;

-- factory_orders_vw確認
SELECT COUNT(*) FROM factory_orders_vw;
```

### 2. セキュリティ設定確認

```sql
-- 検証関数実行
SELECT * FROM verify_security_settings();

-- SECURITY DEFINER関数確認
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  p.prosecdef AS is_security_definer,
  p.proconfig AS search_path_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true
  AND n.nspname = 'public'
ORDER BY p.proname;
```

### 3. アプリケーション動作確認

- ✅ オーガナイザーダッシュボード（sales_vw使用）
- ✅ 作品承認フロー（publishing_approvals_vw使用）
- ✅ ファクトリーダッシュボード（factory_orders_vw使用）
- ✅ 返金処理（refund_requests_vw使用）

---

## 🔍 トラブルシューティング

### エラー: "relation already exists"

**症状**:
```
ERROR: relation "sales_vw" already exists
```

**原因**: ビューが既に存在

**対応**:
```sql
DROP VIEW IF EXISTS sales_vw CASCADE;
-- その後、再度CREATE VIEW実行
```

### エラー: "function does not exist"

**症状**:
```
ERROR: function complete_purchase_transaction(text, integer) does not exist
```

**原因**: 該当関数がまだ作成されていない

**対応**: 問題なし。スキップされます。

### エラー: "permission denied"

**症状**:
```
ERROR: permission denied for table users
```

**原因**: 実行ユーザーの権限不足

**対応**:
- Supabase Studioで実行（postgres権限で実行される）
- または、`GRANT` 文で権限付与

---

## 📊 適用状況トラッキング

| マイグレーション | ローカル | リモート | 最終確認日 |
|----------------|---------|---------|-----------|
| 20251002130000 | ✅ | ❌ | 2025-10-02 |
| 20251002133000 | ✅ | ❌ | 2025-10-02 |
| 20251002140000 | ✅ | ❌ | 2025-10-02 |
| 20251002150000 | ✅ | ❌ | 2025-10-02 |
| REMOTE_APPLY_v6_compatibility | N/A | ❌ | 2025-10-02 |
| REMOTE_APPLY_security_hardening | N/A | ❌ | 2025-10-02 |

---

## 🎯 次のアクション

### 即座に実施（優先度: 🔴 高）

1. **v6互換ビューの適用**
   - `REMOTE_APPLY_v6_compatibility.sql` をSupabase Studioで実行
   - オーガナイザーダッシュボード、作品承認フローで必須

2. **セキュリティ強化の適用**
   - `REMOTE_APPLY_security_hardening.sql` をSupabase Studioで実行
   - 高・中リスクのセキュリティ問題を解決

### 確認・検証（優先度: 🟡 中）

1. **動作確認**
   - オーガナイザーダッシュボードアクセス
   - 作品承認フロー実行
   - 返金処理テスト

2. **セキュリティ検証**
   - `verify_security_settings()` 実行
   - 検証結果の確認

### ドキュメント更新（優先度: 🟢 低）

1. **適用完了記録**
   - このファイルの「適用状況トラッキング」更新
   - `MIGRATION_STATUS.md` 更新

---

**作成者**: Claude (AI Assistant)
**最終更新**: 2025-10-02
**関連ドキュメント**:
- `SECURITY_HARDENING_GUIDE.md` - セキュリティ強化詳細
- `DEPLOYMENT_GUIDE_v6.md` - v6デプロイ手順
- `V6_MIGRATION_VERIFICATION_REPORT.md` - 検証レポート
