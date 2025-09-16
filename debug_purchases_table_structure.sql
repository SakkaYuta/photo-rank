-- PhotoRank v5.0 purchasesテーブル構造確認とデバッグ
-- 実際のテーブル構造を確認してセキュリティパッチを正しく適用するため

-- =====================================
-- 1. purchasesテーブルの完全な構造確認
-- =====================================

-- テーブルの存在確認
SELECT 
  'Table Existence Check' as check_type,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases'
  ) as table_exists;

-- 全カラム情報の詳細表示
SELECT 
  'Purchases Table Columns' as info_type,
  ordinal_position,
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'purchases'
ORDER BY ordinal_position;

-- =====================================
-- 2. 制約・インデックス・主キー確認
-- =====================================

-- 主キー確認
SELECT 
  'Primary Key' as constraint_type,
  kcu.column_name
FROM information_schema.key_column_usage kcu
JOIN information_schema.table_constraints tc 
  ON kcu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name = 'purchases' 
  AND tc.constraint_type = 'PRIMARY KEY';

-- 外部キー制約確認
SELECT 
  'Foreign Keys' as constraint_type,
  kcu.column_name as column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
FROM information_schema.key_column_usage kcu
JOIN information_schema.constraint_column_usage ccu 
  ON kcu.constraint_name = ccu.constraint_name
JOIN information_schema.table_constraints tc 
  ON kcu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name = 'purchases' 
  AND tc.constraint_type = 'FOREIGN KEY';

-- インデックス確認
SELECT 
  'Indexes' as info_type,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'purchases';

-- =====================================
-- 3. 既存のRLSポリシー確認
-- =====================================

-- 既存のRLSポリシー表示
SELECT 
  'Current RLS Policies' as info_type,
  policyname,
  permissive,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'purchases';

-- RLS有効状況確認
SELECT 
  'RLS Status' as info_type,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' 
AND c.relname = 'purchases';

-- =====================================
-- 4. サンプルデータ構造確認（存在する場合）
-- =====================================

-- テーブル内データ件数確認
SELECT 
  'Data Count' as info_type,
  COUNT(*) as total_records
FROM public.purchases;

-- サンプルレコード構造確認（最大3件、プライバシー保護のため部分情報のみ）
SELECT 
  'Sample Record Structure' as info_type,
  id,
  -- ユーザー識別に使用可能なカラムを確認
  CASE 
    WHEN 'user_id' IN (SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases') 
    THEN 'HAS_user_id'
    ELSE 'NO_user_id'
  END as user_id_status,
  CASE 
    WHEN 'buyer_user_id' IN (SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases') 
    THEN 'HAS_buyer_user_id'
    ELSE 'NO_buyer_user_id'
  END as buyer_user_id_status,
  created_at
FROM public.purchases
LIMIT 3;

-- =====================================
-- 5. 関連テーブルとの関係確認
-- =====================================

-- usersテーブルとの関連確認
SELECT 
  'Related Tables Check' as info_type,
  'users' as related_table,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
  ) as table_exists;

-- worksテーブルとの関連確認  
SELECT 
  'Related Tables Check' as info_type,
  'works' as related_table,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'works'
  ) as table_exists;

-- =====================================
-- 6. 推奨される修正アクション
-- =====================================

-- 上記の確認結果に基づいて、適切なカラム名を使用した
-- セキュリティパッチを動的に生成する情報を提供

SELECT 
  'Recommended Actions' as info_type,
  'Based on the above results, determine the correct column name for user identification' as instruction,
  'Then use security_final_critical_patches_corrected.sql with appropriate column name' as next_step;