-- ステップ9: マイグレーション記録
-- マイグレーション管理テーブル
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version text PRIMARY KEY,
  executed_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  checksum text
);

-- マイグレーション記録
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_security_final', 'safe')
ON CONFLICT (version) DO NOTHING;

-- 成功メッセージ
DO $$ BEGIN
  RAISE NOTICE 'Security migration completed successfully!';
END $$;