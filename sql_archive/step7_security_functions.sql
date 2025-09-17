-- ステップ7: セキュリティ関数作成
-- MIME検証関数（IMMUTABLE）
CREATE OR REPLACE FUNCTION public.validate_image_mime_safe(
  p_content_type text,
  p_file_signature bytea
) RETURNS boolean 
LANGUAGE plpgsql 
IMMUTABLE
AS $$
DECLARE
  v_signature_hex text;
BEGIN
  -- Content typeチェック
  IF p_content_type NOT IN ('image/jpeg', 'image/png', 'image/webp') THEN
    RETURN false;
  END IF;
  
  -- ファイル署名チェック
  v_signature_hex := encode(p_file_signature, 'hex');
  
  RETURN CASE p_content_type
    WHEN 'image/jpeg' THEN v_signature_hex LIKE 'ffd8ff%'
    WHEN 'image/png' THEN v_signature_hex LIKE '89504e47%'
    WHEN 'image/webp' THEN v_signature_hex LIKE '52494646%'
    ELSE false
  END;
END;
$$;

-- 管理者チェック関数
CREATE OR REPLACE FUNCTION public.is_admin_safe(p_user_id uuid)
RETURNS boolean 
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = p_user_id AND role = 'admin'
  );
END;
$$;

-- XML消毒関数（IMMUTABLE）
CREATE OR REPLACE FUNCTION public.sanitize_xml_safe(p_text text)
RETURNS text 
LANGUAGE plpgsql 
IMMUTABLE
AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN '';
  END IF;
  
  RETURN replace(replace(replace(replace(replace(
    p_text,
    '&', '&amp;'),
    '<', '&lt;'),
    '>', '&gt;'),
    '"', '&quot;'),
    '''', '&apos;'
  );
END;
$$;