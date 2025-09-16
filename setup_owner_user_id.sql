-- owner_user_id設定用SQLセット
-- Supabase SQLエディタで順次実行してください

-- 1. 現在の状況確認
SELECT 
  id, 
  name, 
  contact_email,
  owner_user_id, 
  status 
FROM public.manufacturing_partners 
ORDER BY created_at DESC 
LIMIT 20;

-- 2. 未設定の確認
SELECT 
  id, 
  name, 
  contact_email,
  status
FROM public.manufacturing_partners 
WHERE owner_user_id IS NULL;

-- 3. 一括設定（contact_email と auth.users.email を突き合わせ）
UPDATE public.manufacturing_partners mp
SET owner_user_id = au.id
FROM auth.users au
WHERE mp.owner_user_id IS NULL
  AND lower(mp.contact_email) = lower(au.email);

-- 4. 設定結果確認
SELECT 
  mp.id,
  mp.name,
  mp.contact_email,
  mp.owner_user_id,
  au.email as user_email
FROM public.manufacturing_partners mp
LEFT JOIN auth.users au ON mp.owner_user_id = au.id
ORDER BY mp.created_at DESC;

-- 5. 未設定の残り確認（個別設定が必要）
SELECT 
  id, 
  name, 
  contact_email
FROM public.manufacturing_partners 
WHERE owner_user_id IS NULL;

-- 個別設定用テンプレート（必要に応じて）
-- UPDATE public.manufacturing_partners
-- SET owner_user_id = '該当するuser_id'
-- WHERE id = 'partner_id';

-- 最終確認（0行になればOK）
SELECT COUNT(*) as unset_count 
FROM public.manufacturing_partners 
WHERE owner_user_id IS NULL;