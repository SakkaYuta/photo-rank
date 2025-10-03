# 📦 データベースマイグレーション統一計画

**作成日**: 2025-10-03
**目的**: マイグレーションの分散問題解決と権威ソース確立

---

## 現状分析

### マイグレーション分散状況

**3つのディレクトリに分散**:
1. `supabase/migrations/` - v6系統一スキーマ（最新・権威）
2. `db/migrations/` - v5系旧スキーマ（レガシー）
3. ルート `photo-rank/supabase/migrations/` - 上記と同一

### 問題点

1. **Supabase CLI 混乱**: デフォルトでルート `supabase/` 参照、実体は `photo-rank/supabase/migrations`
2. **適用漏れリスク**: Edge Functions が要求する `rate_limit_logs`/`upload_attempts` が v6 で定義されているが、v5 環境では未適用
3. **メンテナンス困難**: どのマイグレーションが権威か不明確

---

## 統一方針

### 権威ディレクトリ決定

**採用**: `photo-rank/supabase/migrations/` (v6系)

**理由**:
- ✅ 最新の v6 統一スキーマを含む
- ✅ Edge Functions が依存する `rate_limit_logs`/`upload_attempts` 定義済み
- ✅ Supabase CLI と整合（プロジェクトルート配下）
- ✅ セキュリティ強化（RLS、監査ログ）実装済み

### アーカイブ対象

**`db/migrations/` (v5系)**:
- `db/migrations_archive_v5/` へ移動
- 履歴参照用として保持
- 新規適用は行わない

---

## 実行計画

### Phase 1: バックアップと検証

```bash
# 現在の DB 状態をバックアップ
PGPASSWORD=postgres pg_dump -h 127.0.0.1 -p 54322 -U postgres postgres \
  --schema=public -f supabase/backups/backup_pre_consolidation.sql

# 適用済みマイグレーション確認
psql -h 127.0.0.1 -p 54322 -U postgres postgres \
  -c "SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;"
```

### Phase 2: v5 マイグレーションアーカイブ

```bash
# アーカイブディレクトリ作成
mkdir -p db/migrations_archive_v5

# v5 マイグレーションを移動
mv db/migrations/*.sql db/migrations_archive_v5/

# README 作成
cat > db/migrations_archive_v5/README.md << 'EOF'
# v5 マイグレーション アーカイブ

これらのマイグレーションは v6 統一スキーマ移行に伴いアーカイブされました。

**権威ソース**: `photo-rank/supabase/migrations/`

**参照のみ**: 新規適用は行わないでください。
EOF
```

### Phase 3: v6 マイグレーション確認と適用

```bash
# v6 マイグレーションファイル一覧
ls -1 supabase/migrations/202510*.sql

# 期待されるファイル:
# 20251002100000_v6_unified_schema.sql
# 20251002100001_v6_config_and_helpers.sql
# 20251002110000_v6_security_hardening.sql
# 20251002120000_v6_compatibility_views.sql
# ...

# 未適用マイグレーション確認
npx supabase db diff --linked
```

### Phase 4: rate_limit_logs/upload_attempts 確認

```sql
-- テーブル存在確認
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('rate_limit_logs', 'upload_attempts');

-- 期待される結果: 両テーブルが存在すること
-- もし存在しない場合、v6_security_hardening.sql を再適用
```

### Phase 5: Edge Functions 依存関係確認

**確認対象**:
- `supabase/functions/_shared/rateLimit.ts` → `rate_limit_logs`
- `supabase/functions/process-uploaded-image/index.ts` → `upload_attempts`

**テスト**:
```bash
# Edge Function デプロイテスト（ローカル）
npx supabase functions serve

# レート制限テスト
curl -X POST http://localhost:54321/functions/v1/process-uploaded-image \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

## マイグレーション管理ルール

### 新規マイグレーション作成

```bash
# 必ず supabase/migrations/ 配下で作成
npx supabase migration new <migration_name>

# ファイル名形式: YYYYMMDDHHMMSS_<migration_name>.sql
# 例: 20251003120000_add_new_feature.sql
```

### 適用順序

1. **v6 統一スキーマ**: `20251002100000_v6_unified_schema.sql`
2. **設定とヘルパー**: `20251002100001_v6_config_and_helpers.sql`
3. **セキュリティ強化**: `20251002110000_v6_security_hardening.sql` (rate_limit_logs含む)
4. **互換性ビュー**: `20251002120000_v6_compatibility_views.sql` 以降

### ロールバック手順

```sql
-- 最新マイグレーションのロールバック
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20251002110000';

-- テーブル削除（必要に応じて）
DROP TABLE IF EXISTS rate_limit_logs CASCADE;
DROP TABLE IF EXISTS upload_attempts CASCADE;

-- 再適用
npx supabase db reset
```

---

## 検証チェックリスト

### マイグレーション統一確認

- [ ] `supabase/migrations/` のみが権威ソースとして認識されている
- [ ] `db/migrations/` は `db/migrations_archive_v5/` に移動済み
- [ ] Supabase CLI が正しいディレクトリを参照している

### スキーマ確認

- [ ] `rate_limit_logs` テーブルが存在する
- [ ] `upload_attempts` テーブルが存在する
- [ ] v6 統一スキーマの全テーブルが存在する
- [ ] RLS ポリシーが適用されている

### Edge Functions 確認

- [ ] `_shared/rateLimit.ts` が `rate_limit_logs` にアクセス可能
- [ ] `process-uploaded-image` が `upload_attempts` にアクセス可能
- [ ] レート制限が正常に機能する

### ドキュメント更新

- [ ] `DB_MIGRATION_CONSOLIDATION.md` 作成済み
- [ ] `db/migrations_archive_v5/README.md` 作成済み
- [ ] 他のドキュメントでマイグレーションパス参照を更新

---

## トラブルシューティング

### エラー: "relation rate_limit_logs does not exist"

**原因**: v6_security_hardening.sql が未適用

**対処**:
```bash
# 手動適用
psql -h 127.0.0.1 -p 54322 -U postgres postgres \
  -f supabase/migrations/20251002110000_v6_security_hardening.sql
```

### エラー: "duplicate key value violates unique constraint"

**原因**: マイグレーションが重複適用された

**対処**:
```sql
-- 重複レコード削除
DELETE FROM supabase_migrations.schema_migrations
WHERE version IN (
  SELECT version
  FROM supabase_migrations.schema_migrations
  GROUP BY version
  HAVING COUNT(*) > 1
)
AND ctid NOT IN (
  SELECT MIN(ctid)
  FROM supabase_migrations.schema_migrations
  GROUP BY version
);
```

---

## 次のステップ

### 統一完了後

1. ✅ v6 マイグレーションのみが権威ソース
2. ✅ Edge Functions が正常動作
3. ✅ 新規マイグレーションは `supabase/migrations/` で作成

### 本番環境適用

1. バックアップ取得
2. v6 マイグレーションを順次適用
3. Edge Functions 再デプロイ
4. 動作確認

---

**現在の状態**: 計画策定完了
**次のアクション**: Phase 1 バックアップと検証の実行
