import { supabase } from '@/services/supabaseClient';

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  image_url: string;
  image_urls?: string[]; // 追加ギャラリー（最大10件想定）
  creator_id: string;
  creator_name: string;
  creator_avatar?: string;
  category: string;
  views: number;
  likes: number;
  sales: number;
  rating: number;
  created_at: string;
  sale_start_at?: string | null;
  sale_end_at?: string | null;
  is_active: boolean;
  is_trending?: boolean;
  discount_percentage?: number;
  stock_quantity: number;
  product_types: string[];
}

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  creatorId?: string;
  searchTerm?: string;
  isActive?: boolean;
}

export interface ProductSortOptions {
  field: 'sales' | 'created_at' | 'price' | 'rating' | 'views';
  direction: 'asc' | 'desc';
}

/**
 * 商品一覧を取得
 */
export async function fetchProducts(
  filters?: ProductFilters,
  sort?: ProductSortOptions,
  limit: number = 20,
  offset: number = 0
): Promise<{ products: Product[]; total: number }> {
  try {
    // まずはワークテーブルから商品データを取得
    let query = supabase
      .from('works')
      .select(`
        id,
        title,
        description,
        price,
        image_url,
        image_urls,
        creator_id,
        category,
        view_count,
        like_count,
        sales_count,
        rating,
        created_at,
        sale_start_at,
        sale_end_at,
        is_active,
        stock_quantity,
        discount_percentage,
        product_types
      `, { count: 'exact' });

    // フィルタリング
    if (filters) {
      if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }
      if (filters.minPrice !== undefined) {
        query = query.gte('price', filters.minPrice);
      }
      if (filters.maxPrice !== undefined) {
        query = query.lte('price', filters.maxPrice);
      }
      if (filters.creatorId) {
        query = query.eq('creator_id', filters.creatorId);
      }
      if (filters.searchTerm) {
        query = query.or(`title.ilike.%${filters.searchTerm}%,description.ilike.%${filters.searchTerm}%`);
      }
      if (filters.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }
    }

    // デフォルトで公開中の商品のみ取得（filtersで未指定のとき）
    if (!filters || filters.isActive === undefined) {
      query = query.eq('is_active', true);
    }

    // ソート
    if (sort) {
      const column = sort.field === 'sales' ? 'sales_count' :
                    sort.field === 'views' ? 'view_count' :
                    sort.field === 'rating' ? 'rating' :
                    sort.field === 'created_at' ? 'created_at' :
                    'price';
      query = query.order(column, { ascending: sort.direction === 'asc' });
    } else {
      // デフォルトは売上順
      query = query.order('sales_count', { ascending: false });
    }

    // ページネーション
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const works = (data || []) as any[]

    // クリエイター公開プロフィールをまとめて取得
    const creatorIds = Array.from(new Set(works.map(w => w.creator_id).filter(Boolean)))
    let profiles: Record<string, { display_name?: string; avatar_url?: string }> = {}
    if (creatorIds.length > 0) {
      const { data: upp } = await supabase
        .from('user_public_profiles')
        .select('id, display_name, avatar_url')
        .in('id', creatorIds)
      if (upp) profiles = Object.fromEntries(upp.map((p: any) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }]))
    }

    // データを整形
    const products: Product[] = works.map((work: any) => ({
      id: work.id,
      title: work.title,
      description: work.description || '',
      price: work.price,
      image_url: work.image_url,
      image_urls: (work as any).image_urls || undefined,
      creator_id: work.creator_id,
      creator_name: profiles[work.creator_id]?.display_name || '匿名クリエイター',
      creator_avatar: profiles[work.creator_id]?.avatar_url,
      category: work.category || 'other',
      views: work.view_count || 0,
      likes: work.like_count || 0,
      sales: work.sales_count || 0,
      rating: work.rating || 0,
      created_at: work.created_at,
      sale_start_at: (work as any).sale_start_at || null,
      sale_end_at: (work as any).sale_end_at || null,
      is_active: work.is_active,
      is_trending: work.sales_count > 50, // 50販売以上をトレンドとする
      discount_percentage: work.discount_percentage,
      stock_quantity: work.stock_quantity || 100,
      product_types: work.product_types || ['standard']
    }));

    return {
      products,
      total: count || 0
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    // エラー時はモックデータを返す
    return {
      products: getMockProducts(),
      total: 8
    };
  }
}

/**
 * 特定の商品を取得
 */
export async function fetchProductById(productId: string): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from('works')
      .select(`
        id,
        title,
        description,
        price,
        image_url,
        image_urls,
        creator_id,
        category,
        view_count,
        like_count,
        sales_count,
        rating,
        created_at,
        sale_start_at,
        sale_end_at,
        is_active,
        stock_quantity,
        discount_percentage,
        product_types
      `)
      .eq('id', productId)
      .single();

    if (error) throw error;
    if (!data) return null;

    const base: any = {
      id: (data as any).id,
      title: (data as any).title,
      description: (data as any).description || '',
      price: (data as any).price,
      image_url: (data as any).image_url,
      image_urls: (data as any).image_urls || undefined,
      creator_id: (data as any).creator_id,
      creator_name: '匿名クリエイター',
      creator_avatar: undefined,
      category: (data as any).category || 'other',
      views: (data as any).view_count || 0,
      likes: (data as any).like_count || 0,
      sales: (data as any).sales_count || 0,
      rating: (data as any).rating || 0,
      created_at: (data as any).created_at,
      sale_start_at: (data as any).sale_start_at || null,
      sale_end_at: (data as any).sale_end_at || null,
      is_active: (data as any).is_active,
      is_trending: (data as any).sales_count > 50,
      discount_percentage: (data as any).discount_percentage,
      stock_quantity: (data as any).stock_quantity || 100,
      product_types: (data as any).product_types || ['standard']
    }

    // 補助: 公開プロフィールから表示名/アバターを解決
    try {
      const { data: upp } = await supabase
        .from('user_public_profiles')
        .select('id, display_name, avatar_url')
        .eq('id', base.creator_id)
        .single()
      if (upp) {
        base.creator_name = (upp as any).display_name || base.creator_name
        base.creator_avatar = (upp as any).avatar_url || base.creator_avatar
      }
    } catch {}

    return base as Product;
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    return null;
  }
}

/**
 * トレンド商品を取得
 */
export async function fetchTrendingProducts(limit: number = 8): Promise<Product[]> {
  const { products } = await fetchProducts(
    { isActive: true },
    { field: 'sales', direction: 'desc' },
    limit
  );
  return products;
}

/**
 * カテゴリー別商品を取得
 */
export async function fetchProductsByCategory(category: string, limit: number = 12): Promise<Product[]> {
  const { products } = await fetchProducts(
    { category, isActive: true },
    { field: 'sales', direction: 'desc' },
    limit
  );
  return products;
}

/**
 * クリエイター別商品を取得
 */
export async function fetchProductsByCreator(creatorId: string, limit: number = 20): Promise<Product[]> {
  const { products } = await fetchProducts(
    { creatorId, isActive: true },
    { field: 'created_at', direction: 'desc' },
    limit
  );
  return products;
}

/**
 * 商品のビューカウントを増やす
 */
export async function incrementProductView(productId: string): Promise<void> {
  try {
    // サーバー側でインクリメントするRPCを想定（存在しない場合は無害に終了）
    await supabase.rpc('increment_view_count', { p_work_id: productId } as any)
  } catch (error) {
    console.error('Error incrementing product view:', error)
  }
}

/**
 * 商品にいいねを追加/削除
 */
export async function toggleProductLike(productId: string, userId: string, isLiked: boolean): Promise<void> {
  try {
    if (isLiked) {
      // いいねを削除
      const { error } = await supabase
        .from('work_likes')
        .delete()
        .eq('work_id', productId)
        .eq('user_id', userId);

      if (error) throw error;

      // カウントを減らす
      try { await supabase.rpc('decrement_like_count', { p_work_id: productId } as any) } catch {}
    } else {
      // いいねを追加
      const { error } = await supabase
        .from('work_likes')
        .insert({ work_id: productId, user_id: userId });

      if (error) throw error;

      // カウントを増やす
      try { await supabase.rpc('increment_like_count', { p_work_id: productId } as any) } catch {}
    }
  } catch (error) {
    console.error('Error toggling product like:', error);
    throw error;
  }
}

/**
 * モックデータを返す（フォールバック用）
 */
function getMockProducts(): Product[] {
  return [
    {
      id: '1',
      title: '推しの夢幻アート Tシャツ',
      description: '幻想的なデザインが特徴的な推し活グッズ。高品質プリントで色褪せしにくい。',
      price: 3500,
      image_url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=400&fit=crop',
      creator_id: 'creator1',
      creator_name: 'アートクリエイター結',
      creator_avatar: 'https://images.unsplash.com/photo-1611095564682-f2ccacf7dd2c?w=100&h=100&fit=crop',
      category: 'tshirt',
      views: 1250,
      likes: 89,
      sales: 34,
      rating: 4.8,
      created_at: '2024-01-15',
      is_active: true,
      is_trending: true,
      discount_percentage: 15,
      stock_quantity: 50,
      product_types: ['Tシャツ', 'パーカー']
    },
    {
      id: '2',
      title: 'アイドル応援ステッカーセット',
      description: 'キラキラ輝くアイドル風デザインのステッカー5枚セット。防水加工済みで推し活に最適。',
      price: 1200,
      image_url: 'https://images.unsplash.com/photo-1621784563330-caee0b138442?w=400&h=400&fit=crop',
      creator_id: 'creator2',
      creator_name: 'アイドル推し工房',
      category: 'sticker',
      views: 890,
      likes: 67,
      sales: 156,
      rating: 4.9,
      created_at: '2024-01-20',
      is_active: true,
      stock_quantity: 200,
      product_types: ['ステッカー']
    },
    {
      id: '3',
      title: 'コスプレテーママグカップ',
      description: 'コスプレ衣装をイメージしたカラーリングの特別なマグカップ。電子レンジ・食洗機対応。',
      price: 2800,
      image_url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=400&fit=crop',
      creator_id: 'creator3',
      creator_name: 'コスプレカフェ工房',
      category: 'mug',
      views: 567,
      likes: 45,
      sales: 78,
      rating: 4.7,
      created_at: '2024-01-18',
      is_active: true,
      stock_quantity: 75,
      product_types: ['マグカップ', 'タンブラー']
    },
    {
      id: '4',
      title: 'アニメキャラフォンケース',
      description: 'アニメキャラクター風イラストデザインのスマホケース。衝撃吸収素材使用。',
      price: 3200,
      image_url: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=400&fit=crop',
      creator_id: 'creator1',
      creator_name: 'アートクリエイター結',
      creator_avatar: 'https://images.unsplash.com/photo-1611095564682-f2ccacf7dd2c?w=100&h=100&fit=crop',
      category: 'phone_case',
      views: 2100,
      likes: 123,
      sales: 89,
      rating: 4.6,
      created_at: '2024-01-22',
      is_active: true,
      is_trending: true,
      stock_quantity: 100,
      product_types: ['iPhone', 'Android']
    },
    {
      id: '5',
      title: 'アイドル応援ポスター A2サイズ',
      description: '高画質印刷のアイドル風大型ポスター。部屋をアイドル色に染めよう！',
      price: 2500,
      image_url: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=400&fit=crop',
      creator_id: 'creator4',
      creator_name: 'アイドルポスター工房',
      category: 'poster',
      views: 456,
      likes: 34,
      sales: 23,
      rating: 4.5,
      created_at: '2024-01-19',
      is_active: true,
      stock_quantity: 150,
      product_types: ['A2', 'A3', 'B2']
    },
    {
      id: '6',
      title: 'コスプレ衣装トートバッグ - エコ素材',
      description: '環境に優しい素材を使用した大容量トートバッグ。コスプレ衣装の持ち運びに最適。',
      price: 2200,
      image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop',
      creator_id: 'creator5',
      creator_name: 'コスプレバッグ工房',
      category: 'bag',
      views: 789,
      likes: 56,
      sales: 67,
      rating: 4.8,
      created_at: '2024-01-21',
      is_active: true,
      discount_percentage: 10,
      stock_quantity: 80,
      product_types: ['トート', 'ショルダー']
    },
    {
      id: '7',
      title: 'アニメキャラアクリルスタンド',
      description: 'キラキラ輝くホログラム加工のアニメキャラ風アクリルスタンド。デスクに最適！',
      price: 1800,
      image_url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=400&fit=crop',
      creator_id: 'creator6',
      creator_name: 'アニメアクリル工房',
      category: 'acrylic',
      views: 1456,
      likes: 178,
      sales: 234,
      rating: 4.9,
      created_at: '2024-01-17',
      is_active: true,
      is_trending: true,
      stock_quantity: 120,
      product_types: ['10cm', '15cm', '20cm']
    },
    {
      id: '8',
      title: 'アイドル風レトロTシャツ',
      description: '80年代アイドル風レトロポップなデザインTシャツ。ヴィンテージ加工済み。',
      price: 4200,
      image_url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=400&fit=crop',
      creator_id: 'creator7',
      creator_name: 'レトロアイドル工房',
      category: 'tshirt',
      views: 987,
      likes: 76,
      sales: 45,
      rating: 4.7,
      created_at: '2024-01-16',
      is_active: true,
      stock_quantity: 60,
      product_types: ['Tシャツ', 'ロンT']
    }
  ];
}
