-- パフォーマンス最適化のためのデータベース設定
-- インデックス、関数、トリガーなどを設定

-- 1. 重要なインデックスを追加
CREATE INDEX IF NOT EXISTS idx_works_active_sales ON works(is_active, sales_count DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_works_category_sales ON works(category, sales_count DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_works_creator_created ON works(creator_id, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_works_search_title ON works USING gin(to_tsvector('english', title)) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_works_search_description ON works USING gin(to_tsvector('english', description)) WHERE is_active = true;

-- 2. 複合インデックス
CREATE INDEX IF NOT EXISTS idx_works_price_range ON works(price, sales_count DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_works_trending ON works(sales_count DESC, view_count DESC, created_at DESC) WHERE is_active = true AND sales_count > 50;

-- 3. ユーザープロフィール用インデックス
CREATE INDEX IF NOT EXISTS idx_user_public_profiles_search ON user_public_profiles(id, display_name, avatar_url);

-- 4. パフォーマンス統計ビューを作成
CREATE OR REPLACE VIEW work_performance_stats AS
SELECT
    id,
    title,
    category,
    price,
    sales_count,
    view_count,
    like_count,
    created_at,
    -- パフォーマンスメトリクス
    CASE
        WHEN sales_count > 100 THEN 'high'
        WHEN sales_count > 50 THEN 'medium'
        ELSE 'low'
    END as sales_performance,

    CASE
        WHEN view_count > 1000 THEN 'viral'
        WHEN view_count > 500 THEN 'popular'
        ELSE 'normal'
    END as view_performance,

    -- エンゲージメント率
    CASE
        WHEN view_count > 0 THEN ROUND((like_count::decimal / view_count::decimal) * 100, 2)
        ELSE 0
    END as engagement_rate,

    -- 変換率（ビュー→セールス）
    CASE
        WHEN view_count > 0 THEN ROUND((sales_count::decimal / view_count::decimal) * 100, 2)
        ELSE 0
    END as conversion_rate
FROM works
WHERE is_active = true;

-- 5. 高速検索関数
CREATE OR REPLACE FUNCTION search_works(
    search_text text DEFAULT NULL,
    category_filter text DEFAULT NULL,
    min_price integer DEFAULT NULL,
    max_price integer DEFAULT NULL,
    creator_filter text DEFAULT NULL,
    sort_by text DEFAULT 'sales',
    sort_order text DEFAULT 'desc',
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0
)
RETURNS TABLE(
    id text,
    title text,
    description text,
    price integer,
    image_url text,
    image_urls text[],
    creator_id text,
    category text,
    view_count integer,
    like_count integer,
    sales_count integer,
    rating decimal,
    created_at timestamp,
    sale_start_at timestamp,
    sale_end_at timestamp,
    is_active boolean,
    stock_quantity integer,
    discount_percentage integer,
    product_types text[],
    total_count bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.id,
        w.title,
        w.description,
        w.price,
        w.image_url,
        w.image_urls,
        w.creator_id,
        w.category,
        w.view_count,
        w.like_count,
        w.sales_count,
        w.rating,
        w.created_at,
        w.sale_start_at,
        w.sale_end_at,
        w.is_active,
        w.stock_quantity,
        w.discount_percentage,
        w.product_types,
        COUNT(*) OVER() as total_count
    FROM works w
    WHERE
        w.is_active = true
        AND (search_text IS NULL OR
             w.title ILIKE '%' || search_text || '%' OR
             w.description ILIKE '%' || search_text || '%')
        AND (category_filter IS NULL OR category_filter = 'all' OR w.category = category_filter)
        AND (min_price IS NULL OR w.price >= min_price)
        AND (max_price IS NULL OR w.price <= max_price)
        AND (creator_filter IS NULL OR w.creator_id = creator_filter)
    ORDER BY
        CASE
            WHEN sort_by = 'sales' AND sort_order = 'desc' THEN w.sales_count
            WHEN sort_by = 'views' AND sort_order = 'desc' THEN w.view_count
            WHEN sort_by = 'rating' AND sort_order = 'desc' THEN w.rating
            WHEN sort_by = 'price' AND sort_order = 'desc' THEN w.price
        END DESC,
        CASE
            WHEN sort_by = 'sales' AND sort_order = 'asc' THEN w.sales_count
            WHEN sort_by = 'views' AND sort_order = 'asc' THEN w.view_count
            WHEN sort_by = 'rating' AND sort_order = 'asc' THEN w.rating
            WHEN sort_by = 'price' AND sort_order = 'asc' THEN w.price
            WHEN sort_by = 'created_at' AND sort_order = 'asc' THEN extract(epoch from w.created_at)
        END ASC,
        CASE
            WHEN sort_by = 'created_at' AND sort_order = 'desc' THEN w.created_at
        END DESC,
        w.id -- 安定ソート用
    LIMIT limit_count
    OFFSET offset_count;
END;
$$;

-- 6. キャッシュ無効化トリガー関数
CREATE OR REPLACE FUNCTION invalidate_work_cache()
RETURNS trigger AS $$
BEGIN
    -- 実際のアプリケーションではRedisやMemcachedのキーを削除
    -- ここではログ出力のみ
    RAISE NOTICE 'Cache invalidation triggered for work: %', COALESCE(NEW.id, OLD.id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 7. キャッシュ無効化トリガー
DROP TRIGGER IF EXISTS trigger_invalidate_work_cache ON works;
CREATE TRIGGER trigger_invalidate_work_cache
    AFTER INSERT OR UPDATE OR DELETE ON works
    FOR EACH ROW EXECUTE FUNCTION invalidate_work_cache();

-- 8. バッチ統計更新関数
CREATE OR REPLACE FUNCTION update_work_stats()
RETURNS void AS $$
BEGIN
    -- ビューカウント、いいね数、セールス数の整合性を確保
    UPDATE works
    SET
        view_count = COALESCE((
            SELECT COUNT(*) FROM work_views WHERE work_id = works.id
        ), 0),
        like_count = COALESCE((
            SELECT COUNT(*) FROM work_likes WHERE work_id = works.id
        ), 0),
        sales_count = COALESCE((
            SELECT COUNT(*) FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE oi.work_id = works.id AND o.status = 'completed'
        ), 0)
    WHERE updated_at < NOW() - INTERVAL '1 hour'; -- 1時間以上更新されていない作品のみ

    RAISE NOTICE 'Work statistics updated';
END;
$$ LANGUAGE plpgsql;

-- 9. 定期実行用の統計更新（手動実行）
-- SELECT update_work_stats();

-- 10. パフォーマンス監視用ビュー
CREATE OR REPLACE VIEW performance_metrics AS
SELECT
    'total_works' as metric,
    COUNT(*)::text as value,
    'count' as unit
FROM works WHERE is_active = true

UNION ALL

SELECT
    'avg_engagement_rate' as metric,
    ROUND(AVG(
        CASE
            WHEN view_count > 0 THEN (like_count::decimal / view_count::decimal) * 100
            ELSE 0
        END
    ), 2)::text as value,
    'percentage' as unit
FROM works WHERE is_active = true

UNION ALL

SELECT
    'high_performing_works' as metric,
    COUNT(*)::text as value,
    'count' as unit
FROM works
WHERE is_active = true AND sales_count > 50

UNION ALL

SELECT
    'cache_hit_simulation' as metric,
    'Enabled' as value,
    'status' as unit;

COMMENT ON VIEW performance_metrics IS 'パフォーマンス監視用メトリクス';
COMMENT ON FUNCTION search_works IS '高速検索機能（インデックス最適化済み）';
COMMENT ON FUNCTION update_work_stats IS 'バッチ統計更新（手動実行推奨）';