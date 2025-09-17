-- PhotoRank v5.0 パートナーレビューテーブル作成
-- パートナーレビューシステムのデータベース設定

-- =====================================
-- 1. partner_reviews テーブル作成
-- =====================================

CREATE TABLE IF NOT EXISTS public.partner_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.manufacturing_partners(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manufacturing_order_id uuid REFERENCES public.manufacturing_orders(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  
  -- 制約: 同じユーザーが同じ注文に対して複数レビューできない
  UNIQUE(partner_id, author_user_id, manufacturing_order_id)
);

-- =====================================
-- 2. RLS（Row Level Security）設定
-- =====================================

-- RLS有効化
ALTER TABLE public.partner_reviews ENABLE ROW LEVEL SECURITY;

-- レビュー閲覧ポリシー（全員が閲覧可能）
CREATE POLICY partner_reviews_select ON public.partner_reviews 
FOR SELECT USING (true);

-- レビュー投稿ポリシー（認証済みユーザーのみ）
CREATE POLICY partner_reviews_insert ON public.partner_reviews 
FOR INSERT WITH CHECK (auth.uid() = author_user_id);

-- レビュー更新ポリシー（自分のレビューのみ）
CREATE POLICY partner_reviews_update ON public.partner_reviews 
FOR UPDATE USING (auth.uid() = author_user_id);

-- レビュー削除ポリシー（自分のレビューのみ）
CREATE POLICY partner_reviews_delete ON public.partner_reviews 
FOR DELETE USING (auth.uid() = author_user_id);

-- =====================================
-- 3. インデックス作成（パフォーマンス最適化）
-- =====================================

-- パートナーIDによる高速検索
CREATE INDEX IF NOT EXISTS idx_partner_reviews_partner_id 
ON public.partner_reviews(partner_id, created_at DESC);

-- ユーザーによるレビュー検索
CREATE INDEX IF NOT EXISTS idx_partner_reviews_author_user_id 
ON public.partner_reviews(author_user_id, created_at DESC);

-- 注文に関連するレビュー検索
CREATE INDEX IF NOT EXISTS idx_partner_reviews_order_id 
ON public.partner_reviews(manufacturing_order_id) 
WHERE manufacturing_order_id IS NOT NULL;

-- レビュー評価による検索
CREATE INDEX IF NOT EXISTS idx_partner_reviews_rating 
ON public.partner_reviews(partner_id, rating, created_at DESC);

-- =====================================
-- 4. 統計ビューの作成
-- =====================================

-- パートナーレビュー統計ビュー
CREATE OR REPLACE VIEW public.partner_review_stats AS
SELECT 
  mp.id as partner_id,
  mp.name as partner_name,
  COUNT(pr.id) as total_reviews,
  COALESCE(AVG(pr.rating), 0) as average_rating,
  COUNT(CASE WHEN pr.rating = 5 THEN 1 END) as five_star_count,
  COUNT(CASE WHEN pr.rating = 4 THEN 1 END) as four_star_count,
  COUNT(CASE WHEN pr.rating = 3 THEN 1 END) as three_star_count,
  COUNT(CASE WHEN pr.rating = 2 THEN 1 END) as two_star_count,
  COUNT(CASE WHEN pr.rating = 1 THEN 1 END) as one_star_count,
  MAX(pr.created_at) as latest_review_date
FROM public.manufacturing_partners mp
LEFT JOIN public.partner_reviews pr ON mp.id = pr.partner_id
WHERE mp.status = 'approved'
GROUP BY mp.id, mp.name;

-- =====================================
-- 5. 関数の作成
-- =====================================

-- レビュー投稿可能チェック関数
CREATE OR REPLACE FUNCTION public.can_user_review_partner(
  p_partner_id uuid,
  p_user_id uuid DEFAULT auth.uid(),
  p_order_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  -- ログインチェック
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- そのパートナーとの完了した注文があるかチェック
  IF NOT EXISTS (
    SELECT 1 FROM public.manufacturing_orders mo
    WHERE mo.partner_id = p_partner_id 
    AND mo.creator_user_id = p_user_id 
    AND mo.status = 'shipped'
  ) THEN
    RETURN false;
  END IF;

  -- 特定の注文に対してレビュー済みでないかチェック
  IF p_order_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.partner_reviews pr
      WHERE pr.partner_id = p_partner_id
      AND pr.author_user_id = p_user_id
      AND pr.manufacturing_order_id = p_order_id
    ) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- パートナー平均評価更新関数
CREATE OR REPLACE FUNCTION public.update_partner_rating()
RETURNS trigger AS $$
BEGIN
  -- manufacturing_partners テーブルの平均評価を更新
  UPDATE public.manufacturing_partners
  SET 
    average_rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM public.partner_reviews
      WHERE partner_id = COALESCE(NEW.partner_id, OLD.partner_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.partner_id, OLD.partner_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 6. トリガーの作成
-- =====================================

-- レビュー追加・更新・削除時に平均評価を自動更新
DROP TRIGGER IF EXISTS trigger_update_partner_rating ON public.partner_reviews;
CREATE TRIGGER trigger_update_partner_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.partner_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_partner_rating();

-- =====================================
-- 7. テストデータ（開発環境用）
-- =====================================

-- 開発環境でのみ実行（本番では削除）
DO $$
DECLARE
  partner_record record;
  user_record record;
BEGIN
  -- 既存のパートナーとユーザーがある場合のみサンプルレビューを追加
  FOR partner_record IN 
    SELECT id FROM public.manufacturing_partners 
    WHERE status = 'approved' 
    LIMIT 3
  LOOP
    FOR user_record IN 
      SELECT id FROM auth.users 
      LIMIT 2
    LOOP
      -- 重複を避けて挿入
      INSERT INTO public.partner_reviews (
        partner_id, 
        author_user_id, 
        rating, 
        comment
      )
      VALUES (
        partner_record.id,
        user_record.id,
        4 + (random() * 2)::int, -- 4-5の評価
        '素晴らしい品質でした。配送も迅速で満足です。'
      )
      ON CONFLICT (partner_id, author_user_id, manufacturing_order_id) DO NOTHING;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Sample partner reviews inserted for development';
END
$$;

-- =====================================
-- 8. 確認クエリ
-- =====================================

-- テーブル作成確認
SELECT 'partner_reviews table created' as status,
       EXISTS(
         SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_name = 'partner_reviews'
       ) as table_exists;

-- インデックス確認
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'partner_reviews'
ORDER BY indexname;

-- RLSポリシー確認
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'partner_reviews'
ORDER BY policyname;

-- サンプル統計表示
SELECT 
  partner_name,
  total_reviews,
  ROUND(average_rating, 2) as avg_rating
FROM public.partner_review_stats 
WHERE total_reviews > 0
ORDER BY average_rating DESC, total_reviews DESC;

-- =====================================
-- 完了メッセージ
-- =====================================

SELECT 
  'Partner Reviews System Setup Completed' as status,
  now() as completed_at,
  'Tables, indexes, policies, and functions created successfully' as details;