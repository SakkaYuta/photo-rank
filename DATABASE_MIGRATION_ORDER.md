# データベースマイグレーション実行順序 🚀

## 修正版実行順序（2025-09-22更新）

### ⚠️ 重要な変更
- **トリガー競合エラー対応済み**
- **要件変更に対応したスキーマ修正**
- **冪等性を保証**

### 📋 推奨実行順序

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

# 12. テストデータ（開発時のみ）
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
- バックアップを取ってから実行推奨
- 段階的実行でエラー箇所を特定可能