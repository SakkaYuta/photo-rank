# データベースマイグレーション実行順序 🚀

## v6 統合スキーマ（2025-10-03更新）

### ⚠️ 重要な変更
- **v6 統合スキーマに一本化**: すべてのマイグレーションは `photo-rank/supabase/migrations/` に統一
- **v5 系はアーカイブ化**: 旧v5系は `migrations_old/` に退避、適用対象外
- **権威ディレクトリの明確化**: `photo-rank/supabase/migrations/` のみが唯一の適用対象

### 📋 権威ディレクトリ（v6 のみ）

**唯一の適用対象**: `photo-rank/supabase/migrations/`

このディレクトリ内のマイグレーションファイルのみを適用してください。

### 🔧 実行コマンド（v6）

#### 推奨：プロジェクトディレクトリからの適用
```bash
cd photo-rank
supabase link --project-ref YOUR_PROJECT_REF
supabase db push  # v6 マイグレーションのみを適用
```

#### 全マイグレーション実行（開発環境）
```bash
cd photo-rank
supabase db reset  # ローカル環境を完全にリセットして再適用
```

### 📂 v6 マイグレーションファイル一覧

権威ディレクトリ `photo-rank/supabase/migrations/` に含まれるファイル：

1. **基盤スキーマ（v6統合）**
   - `20251002100000_v6_unified_schema.sql` - v6統合スキーマ（テーブル、インデックス、関数）
   - `20251002100001_v6_config_and_helpers.sql` - 設定とヘルパー関数

2. **セキュリティ強化**
   - `20251002110000_v6_security_hardening.sql` - セキュリティ強化（RLS、関数search_path）
   - `20251002134500_v6_security_hardening_followup.sql` - セキュリティ強化フォローアップ
   - `20251002150000_security_hardening_fixes.sql` - セキュリティ修正

3. **互換性ビュー**
   - `20251002120000_v6_compatibility_views.sql` - v5互換ビュー
   - `20251002130000_v6_compatibility_views_v2.sql` - 互換ビューv2
   - `20251002133000_v6_compatibility_views_v3.sql` - 互換ビューv3
   - `20251002140000_v6_organizer_compatibility_views.sql` - オーガナイザー互換ビュー

4. **v6追加機能（2025-10-05）**
   - `20251005_repair_enums_and_views.sql` - Enum型とビューの修復
   - `20251005_registration_applications.sql` - 登録申請機能
   - `20251005_fix_view_security_invoker.sql` - ビューのSECURITY INVOKER修正

5. **RLS有効化**
   - `RLS_ENABLE_V6_TABLES.sql` - v6テーブルのRLS有効化（通知のみスタブ版）

6. **リモート適用用SQL（参考）**
   - `migrations/archive/REMOTE_APPLY_*.sql` - 本番環境への段階的適用用（参考用、通常は適用しない）
   - `SECURITY_ENHANCEMENT_PII.sql` - PII保護強化（必要時のみ）

### ✅ 反映確認クエリ

マイグレーション適用後、以下のクエリで確認してください：

```sql
-- v6 テーブル群の存在確認
SELECT
  to_regclass('public.rate_limit_logs') AS has_rate_limit_logs,
  to_regclass('public.upload_attempts')  AS has_upload_attempts,
  to_regclass('public.users_vw')        AS has_users_vw,
  to_regclass('public.user_roles')      AS has_user_roles,
  to_regclass('public.user_profiles')   AS has_user_profiles;

-- RLS 確認（v6 テーブル）
SELECT relname, relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND relname IN ('rate_limit_logs', 'upload_attempts', 'user_roles', 'user_profiles')
ORDER BY relname;

-- Enum型の確認
SELECT typname, typtype
FROM pg_type
WHERE typname IN ('user_role_type', 'application_status', 'registration_type')
ORDER BY typname;
```

### 🚫 アーカイブディレクトリ（適用対象外）

以下のディレクトリ内のファイルは**適用しないでください**：

1. **photo-rank/supabase/migrations_old/**
   - 79個の旧v5系マイグレーション
   - 履歴保持用、参考用のみ

2. **supabase/migrations_old/**
   - ルート直下の補助SQL（7ファイル）
   - `README_ARCHIVE.md` に警告記載

3. **photo-rank/db/migrations_old/**
   - v5/v3.1系マイグレーション（12ファイル）
   - `README_ARCHIVE.md` に警告記載

4. **supabase/migrations/** (ルート)
   - 空ディレクトリ（誤適用防止のため）

### 🛡️ 安全性について

- 全てのマイグレーションは冪等性を保証
- `IF NOT EXISTS`、`IF EXISTS`チェック使用
- データ損失なしで実行可能
- ロールバック可能（必要に応じてREMOTE_APPLY系を使用）

### 📝 注意事項（重要）

1. **権威ディレクトリの厳守**
   - `photo-rank/supabase/migrations/` のみが適用対象
   - 他のディレクトリのSQLファイルは適用しない

2. **実行ディレクトリの確認**
   - 必ず `photo-rank/` ディレクトリに移動してから実行
   - ルートディレクトリからの実行は避ける

3. **バックアップの推奨**
   - 本番環境では必ずバックアップを取得
   - `supabase db dump` でバックアップ作成

4. **段階的適用**
   - トラブルシューティング時は個別ファイルを順次適用可能
   - `psql` コマンドでの手動適用も可能

### 🔍 トラブルシューティング

#### エラーが発生した場合

1. **マイグレーション履歴の確認**
   ```sql
   SELECT * FROM supabase_migrations.schema_migrations
   ORDER BY version DESC
   LIMIT 10;
   ```

2. **個別ファイルの適用**
   ```bash
   cd photo-rank
   psql -h your-host -d your-db -f photo-rank/supabase/migrations/[ファイル名].sql
   ```

3. **ログの確認**
   - Supabaseダッシュボードのログを確認
   - `supabase db diff` でスキーマ差分を確認

### 📚 関連ドキュメント

- **README.md**: プロジェクト概要とv6権威パスの説明
- **supabase/MIGRATION_GUIDE.md**: v5→v6移行ガイド
- **supabase/V6_COMPLETION_REPORT.md**: v6完了レポート
- **supabase/SCHEMA_REDESIGN.md**: v6スキーマ設計詳細

### 🎯 v6 の主な変更点

1. **テーブル構造の統一**
   - `user_roles` テーブルでロール管理
   - `users_vw` ビューで統合ユーザー情報提供

2. **セキュリティ強化**
   - すべての関数に `search_path` 固定
   - RLSポリシーの全面的見直し
   - PII保護の強化

3. **レート制限の統一**
   - `rate_limit_logs` イベントベースに統一
   - `upload_attempts` で画像アップロード制限

4. **互換性の維持**
   - v5互換ビューで既存コードとの互換性確保
   - 段階的移行をサポート
