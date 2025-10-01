# データベースマイグレーション実行順序 🚀

## 修正版実行順序（2025-09-22更新）

### ⚠️ 重要な変更
- **トリガー競合エラー対応済み**
- **要件変更に対応したスキーマ修正**
- **冪等性を保証**

### 📋 推奨実行順序（アクティブ）

```bash
# 1. 基本テーブル作成（修正版）
supabase/migrations/20240115_core_tables.sql

# 2. プロフィールテーブル
supabase/migrations/20240118_add_profile_tables.sql

# 3. RLSポリシー
supabase/migrations/20240119_add_rls_policies.sql

# 4. ユーザータイプ機能
supabase/migrations/20241219_add_user_types.sql

# 5. Webhookテーブル
supabase/migrations/20241217_basic_webhook_tables.sql

# 6. トリガー競合修正（新規追加）
supabase/migrations/20250922_fix_trigger_conflicts.sql

# 7. ユーザーテーブルスキーマ修正（新規追加）
supabase/migrations/20250922_fix_users_table_schema.sql

# 8. 作品テーブルスキーマ修正（新規追加）
supabase/migrations/20250922_fix_works_table_schema.sql

# 9. 要件変更対応スキーマ修正（新規追加）
supabase/migrations/20250922_schema_requirements_update.sql

# 10. セキュリティRLSポリシー（新規追加）
supabase/migrations/20250922_security_rls_policies.sql

# 11. 監査ログとレート制限テーブル（新規追加）
supabase/migrations/20250922_audit_and_rate_limit_tables.sql

# 12. RLSポリシー修正（新規追加）
supabase/migrations/20250922_rls_policy_fixes.sql

# 13. v5.0機能
supabase/migrations/20250922_v5_0_core.sql
supabase/migrations/20250922_v5_0_storage.sql

# 15. 追加セキュリティ修正（RLSとsearch_path固定）
supabase/migrations/20250930_security_fixes.sql

# 16. search_path 固定（SECURITY DEFINER 関数）
supabase/migrations/20250930_fix_function_search_path_any.sql
supabase/migrations/20251005_fix_function_search_path_security.sql

# 14. テストデータ（開発時のみ）
supabase/migrations/20241218_test_data_tables.sql
```

### 🔧 実行コマンド

#### 全マイグレーション実行
```bash
# 全てリセットして新規適用
supabase db reset

# または段階的適用
supabase db push
```

#### 個別実行（トラブルシューティング用）
```bash
# トリガー競合解決
psql -h your-host -d your-db -f supabase/migrations/20250922_fix_trigger_conflicts.sql

# スキーマ要件更新
psql -h your-host -d your-db -f supabase/migrations/20250922_schema_requirements_update.sql
```

### 🔒 セキュリティ補遺（手動適用SQLの例）
以下の指摘（linter）がある場合、環境に応じて SQL を直接適用してください（権限が必要な場合あり）。

- RLS disabled in public（public テーブルの RLS 無効）
```
ALTER TABLE IF EXISTS public.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.simple_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS schema_migrations_deny_all ON public.schema_migrations;
DROP POLICY IF EXISTS simple_rate_limits_deny_all ON public.simple_rate_limits;
CREATE POLICY schema_migrations_deny_all ON public.schema_migrations FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
CREATE POLICY simple_rate_limits_deny_all ON public.simple_rate_limits FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
```

- 指定テーブルのみ service_role に限定（例: manufacturing_order_status_history）
```
ALTER TABLE IF EXISTS public.manufacturing_order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mo_status_admin_all ON public.manufacturing_order_status_history;
CREATE POLICY mo_status_admin_all ON public.manufacturing_order_status_history FOR ALL TO authenticated
USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role')
WITH CHECK ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');
```

- extension in public（pg_trgm を public から移動）
```
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
```

- function search_path mutable（public 関数に search_path 固定）
```
SELECT format(
  'ALTER FUNCTION %I.%I(%s) SET search_path TO pg_catalog, public;',
  n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'set_updated_at','get_user_type','is_user_factory','get_creator_monthly_summary',
    'is_admin','generate_monthly_payouts_v50','simple_rate_check','update_updated_at_column',
    'check_rate_limit_safe','validate_image_mime_safe','is_admin_safe',
    'sanitize_xml_safe','sync_user_public_profile','delete_user_public_profile'
  );
# 出力された ALTER FUNCTION 文を実行
```

### ✅ 解決された問題

1. **ERROR: 42710: trigger already exists**
   - `DROP TRIGGER IF EXISTS`で安全に削除してから再作成
   - 冪等性を保証
   - stripe_webhook_events トリガー競合も含む

2. **ERROR: 42703: column "email" of relation "users" does not exist**
   - usersテーブルに必要なカラムを動的に追加
   - 条件チェック付きINSERT文

3. **ERROR: 42703: column "description" of relation "works" does not exist**
   - worksテーブルスキーマを完全修正
   - 全カラムの存在チェックと追加

4. **要件変更対応**
   - 新しいカラム追加（user_type, metadata）
   - メタデータ対応
   - ユーザータイプ管理強化

5. **セキュリティ強化**
   - 重要テーブルのRLSポリシー追加
   - ユーザーデータアクセス制御
   - サービスロール権限管理

6. **パフォーマンス最適化**
   - 適切なインデックス追加
   - GINインデックスでJSONB検索高速化

7. **セキュリティ強化（追加対応）**
   - Edge Functionsのレート制限実装
   - 包括的な監査ログシステム
   - pre-commitフックでシークレット検知
   - CORS処理の統一と改善

### 🛡️ 安全性について

- 全てのマイグレーションは冪等性を保証
- `IF NOT EXISTS`、`IF EXISTS`チェック使用
- データ損失なしで実行可能
- ロールバック可能

### 📝 注意事項

- 本番環境では**テストデータファイル**を除外
- `supabase/migrations/archive` 以下は履歴用です。新規セットアップでは実行しないでください。
- バックアップを取ってから実行推奨
- 段階的実行でエラー箇所を特定可能
