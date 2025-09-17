-- 既存のインデックス確認
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
  AND (tablename LIKE '%rate%' OR tablename LIKE '%limit%')
ORDER BY tablename, indexname;