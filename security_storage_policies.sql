-- PhotoRank v5.0 ストレージセキュリティポリシー
-- 原画像の秘匿と透かし画像の公開制御

-- =====================================
-- 1. ストレージバケット構成説明
-- =====================================

-- 推奨バケット構成:
-- photos-original (非公開) - 原画像格納
-- photos-watermarked (公開) - 透かし画像格納

-- 注意: バケットの作成は Supabase コンソールで行う必要があります
-- この SQL は RLS ポリシーの設定のみ対応

-- =====================================
-- 2. 原画像用バケット（非公開）のRLSポリシー
-- =====================================

-- 原画像は所有者のみアクセス可能
-- ポリシー名: "Original photos owner access"
-- 適用先: photos-original バケット

/*
Supabase Storage コンソールで以下を設定:

1. photos-original バケットを作成（Public: false）

2. 以下のRLSポリシーを追加:

Policy Name: Original photos owner access
Allowed operations: SELECT
Target roles: authenticated
Using expression:
bucket_id = 'photos-original' AND 
auth.uid()::text = (storage.foldername(name))[1]

3. ファイルアップロード権限:

Policy Name: Original photos upload
Allowed operations: INSERT
Target roles: authenticated  
With check:
bucket_id = 'photos-original' AND
auth.uid()::text = (storage.foldername(name))[1]

4. ファイル削除権限:

Policy Name: Original photos delete
Allowed operations: DELETE
Target roles: authenticated
Using expression:
bucket_id = 'photos-original' AND
auth.uid()::text = (storage.foldername(name))[1]
*/

-- =====================================
-- 3. 透かし画像用バケット（公開）のRLSポリシー
-- =====================================

-- 透かし画像は公開読み取り可能
-- ポリシー名: "Watermarked photos public read"
-- 適用先: photos-watermarked バケット

/*
Supabase Storage コンソールで以下を設定:

1. photos-watermarked バケットを作成（Public: true）

2. 以下のRLSポリシーを追加:

Policy Name: Watermarked photos public read  
Allowed operations: SELECT
Target roles: public, authenticated, anon
Using expression:
bucket_id = 'photos-watermarked' AND 
starts_with(name, 'watermarked/')

3. 透かし画像アップロード権限（認証済みユーザーのみ）:

Policy Name: Watermarked photos upload
Allowed operations: INSERT
Target roles: authenticated
With check:
bucket_id = 'photos-watermarked' AND
starts_with(name, 'watermarked/') AND
auth.uid()::text = (storage.foldername(name))[2]
*/

-- =====================================
-- 4. ストレージ使用量監視用ビュー
-- =====================================

-- ストレージ使用状況を監視するビュー（管理者用）
CREATE OR REPLACE VIEW public.storage_usage_summary AS
SELECT 
  'Storage Usage Monitor' as view_name,
  'Run storage queries in Supabase Dashboard' as instruction,
  'Check bucket policies and file counts' as details;

-- =====================================
-- 5. ファイルパス規約の定義
-- =====================================

-- ファイルパス構造の定義
/*
原画像パス構造:
photos-original/
  {user_id}/
    {work_id}/
      original.{ext}
      
透かし画像パス構造:
photos-watermarked/
  watermarked/
    {work_id}/
      watermarked.{ext}
      thumbnail.{ext}
*/

-- =====================================
-- 6. アプリケーション側の実装ガイド
-- =====================================

-- Edge Functions での署名URL生成例:
/*
// 原画像の署名URL生成（所有者のみ）
const { data: signedUrl } = await supabase
  .storage
  .from('photos-original')
  .createSignedUrl(`${userId}/${workId}/original.jpg`, 3600); // 1時間有効

// 透かし画像の公開URL取得
const { data: publicUrl } = await supabase
  .storage
  .from('photos-watermarked')
  .getPublicUrl(`watermarked/${workId}/watermarked.jpg`);
*/

-- =====================================
-- 7. セキュリティチェック用関数
-- =====================================

-- ストレージポリシーの整合性チェック関数
CREATE OR REPLACE FUNCTION public.check_storage_security()
RETURNS table(
  check_name text,
  status text,
  recommendation text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'storage_bucket_separation'::text,
    'MANUAL_CHECK_REQUIRED'::text,
    'Verify photos-original (private) and photos-watermarked (public) buckets exist'::text;
    
  RETURN QUERY
  SELECT 
    'storage_rls_policies'::text,
    'MANUAL_CHECK_REQUIRED'::text,
    'Verify RLS policies are applied in Supabase Storage console'::text;
    
  RETURN QUERY
  SELECT 
    'file_path_structure'::text,
    'DEFINED'::text,
    'Original: {user_id}/{work_id}/file.ext, Watermarked: watermarked/{work_id}/file.ext'::text;
    
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 8. 移行スクリプト（既存データがある場合）
-- =====================================

-- 既存の画像ファイルを新しいバケット構造に移行する場合のガイド
/*
移行手順:
1. 新しいバケット（photos-original, photos-watermarked）を作成
2. 既存ファイルを適切なバケットにコピー
3. データベース内のファイルパス参照を更新
4. 古いバケットを段階的に削除

注意: 実際の移行は本番環境への影響を最小限にするため、
段階的に実行することを強く推奨
*/

-- =====================================
-- 確認・完了メッセージ  
-- =====================================

SELECT 
  'Storage Security Policies Defined' as status,
  now() as defined_at,
  'Manual configuration required in Supabase Storage console' as next_step;