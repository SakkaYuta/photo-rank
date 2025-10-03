-- v5スキーマの主要テーブル構造を確認

-- 1. salesテーブルの構造
SELECT 'sales' AS table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sales'
ORDER BY ordinal_position;

-- 区切り
SELECT '---' AS separator;

-- 2. purchasesテーブルの構造
SELECT 'purchases' AS table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'purchases'
ORDER BY ordinal_position;

-- 区切り
SELECT '---' AS separator;

-- 3. worksテーブルの構造
SELECT 'works' AS table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'works'
ORDER BY ordinal_position;

-- 区切り
SELECT '---' AS separator;

-- 4. usersテーブルの構造
SELECT 'users' AS table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- 区切り
SELECT '---' AS separator;

-- 5. organizersテーブルの構造
SELECT 'organizers' AS table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'organizers'
ORDER BY ordinal_position;
