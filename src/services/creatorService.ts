import { supabase } from './supabaseClient';
import { getDemoUser } from './auth.service';

export interface CreatorStats {
  totalWorks: number;
  totalRevenue: number;
  totalViews: number;
  totalSales: number;
  monthlyGrowth: {
    works: number;
    revenue: number;
    views: number;
    sales: number;
  };
}

export interface CreatorWork {
  id: string;
  title: string;
  description: string; // DBのmessageをマッピング
  image_url: string;
  price: number;
  category: string; // スキーマにないためUI用のプレースホルダ
  tags: string[];   // スキーマにないためUI用のプレースホルダ
  is_active: boolean; // DBのis_publishedをマッピング
  created_at: string;
  updated_at: string; // スキーマにない場合はcreated_atを再利用
  views: number;
  likes: number;
  sales: number;
  revenue: number;
}

export interface CreatorDashboardData {
  stats: CreatorStats;
  recentWorks: CreatorWork[];
  topPerformingWorks: CreatorWork[];
}

export const fetchCreatorDashboard = async (creatorId: string): Promise<CreatorDashboardData> => {
  try {
    const isSample = (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true' || Boolean(getDemoUser())
    if (isSample) {
      const works = (await import('@/sample/worksSamples')).SAMPLE_WORKS.filter(w => w.creator_id === creatorId || true).map(w => ({
        id: w.id,
        title: w.title,
        description: w.description || '',
        image_url: w.image_url,
        price: w.price,
        category: 'photo',
        tags: [],
        is_active: true,
        created_at: w.created_at,
        updated_at: w.updated_at || w.created_at,
        views: Math.floor(Math.random() * 500) + 50,
        likes: Math.floor(Math.random() * 100),
        sales: Math.floor(Math.random() * 20),
        revenue: w.price * Math.floor(Math.random() * 20)
      }))
      const stats: CreatorStats = {
        totalWorks: works.length,
        totalRevenue: works.reduce((s, x) => s + x.revenue, 0),
        totalViews: works.reduce((s, x) => s + x.views, 0),
        totalSales: works.reduce((s, x) => s + x.sales, 0),
        monthlyGrowth: { works: 3, revenue: 15000, views: 1200, sales: 8 }
      }
      return { stats, recentWorks: works.slice(0, 5), topPerformingWorks: [...works].sort((a,b)=>b.revenue-a.revenue).slice(0,5) }
    }
    // 作品一覧と売上情報を取得
    const { data: worksData, error: worksError } = await supabase
      .from('works')
      .select(`
        id,
        title,
        description,
        image_url,
        price,
        is_published,
        created_at,
        purchases(
          id,
          price,
          purchased_at
        )
      `)
      .eq('creator_id', creatorId)
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (worksError) throw worksError;
    if (!worksData) throw new Error('Failed to fetch works data');

    // お気に入り数を取得
    // お気に入り数（作品IDで集計）
    const workIds = (worksData || []).map((w: any) => w.id)
    const { data: favoritesData } = workIds.length > 0
      ? await supabase
          .from('favorites')
          .select('work_id')
          .in('work_id', workIds)
      : { data: [] as any[] } as any

    // 統計情報を計算
    const currentDate = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(currentDate.getMonth() - 1);

    let totalRevenue = 0;
    let totalSales = 0;
    let monthlyRevenue = 0;
    let monthlySales = 0;
    let monthlyWorks = 0;

    const works: CreatorWork[] = worksData.map((work: any) => {
      const workSales = work.purchases?.length || 0;
      const workRevenue = work.purchases?.reduce((sum: number, purchase: any) => sum + purchase.price, 0) || 0;

      totalSales += workSales;
      totalRevenue += workRevenue;

      // 月間統計
      const recentSales = work.purchases?.filter((p: any) => new Date(p.purchased_at || p.created_at) >= oneMonthAgo) || [];
      monthlySales += recentSales.length;
      monthlyRevenue += recentSales.reduce((sum: number, purchase: any) => sum + purchase.price, 0);

      if (new Date(work.created_at) >= oneMonthAgo) {
        monthlyWorks++;
      }

      return {
        id: work.id,
        title: work.title,
        description: work.description || '',
        image_url: work.image_url,
        price: work.price,
        category: '未設定',
        tags: [],
        is_active: Boolean(work.is_published),
        created_at: work.created_at,
        updated_at: work.updated_at || work.created_at,
        views: Math.floor(Math.random() * 500) + 50, // TODO: 実際のビュー数を追加
        likes: favoritesData?.filter((f: any) => f.work_id === work.id).length || 0,
        sales: workSales,
        revenue: workRevenue
      };
    });

    const stats: CreatorStats = {
      totalWorks: works.length,
      totalRevenue,
      totalViews: works.reduce((sum, work) => sum + work.views, 0),
      totalSales,
      monthlyGrowth: {
        works: monthlyWorks,
        revenue: monthlyRevenue,
        views: Math.floor(Math.random() * 1000) + 100, // TODO: 実際の月間ビュー増加数
        sales: monthlySales
      }
    };

    // 最近の作品（最新5作品）
    const recentWorks = works.slice(0, 5);

    // トップパフォーマンス作品（売上順）
    const topPerformingWorks = [...works]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      stats,
      recentWorks,
      topPerformingWorks
    };

  } catch (error) {
    console.error('Failed to fetch creator dashboard data:', error);
    throw error;
  }
};

export const fetchCreatorWorks = async (creatorId: string): Promise<CreatorWork[]> => {
  try {
    if ((import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true') {
      const works = (await import('@/sample/worksSamples')).SAMPLE_WORKS
      return works.map(w => ({
        id: w.id,
        title: w.title,
        description: w.description || '',
        image_url: w.image_url,
        price: w.price,
        category: 'photo',
        tags: [],
        is_active: true,
        created_at: w.created_at,
        updated_at: w.updated_at || w.created_at,
        views: Math.floor(Math.random() * 500) + 50,
        likes: Math.floor(Math.random() * 100),
        sales: Math.floor(Math.random() * 20),
        revenue: w.price * Math.floor(Math.random() * 20)
      }))
    }
    const { data: worksData, error: worksError } = await supabase
      .from('works')
      .select(`
        id,
        title,
        description,
        image_url,
        price,
        is_published,
        created_at,
        purchases(
          id,
          price,
          purchased_at
        )
      `)
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    if (worksError) throw worksError;
    if (!worksData) return [];

    const workIds = (worksData || []).map((w: any) => w.id)
    const { data: favoritesData } = workIds.length > 0
      ? await supabase
          .from('favorites')
          .select('work_id')
          .in('work_id', workIds)
      : { data: [] as any[] } as any

    return worksData.map((work: any) => ({
      id: work.id,
      title: work.title,
      description: work.description || '',
      image_url: work.image_url,
      price: work.price,
      category: '未設定',
      tags: [],
      is_active: Boolean(work.is_published),
      created_at: work.created_at,
      updated_at: work.updated_at || work.created_at,
      views: Math.floor(Math.random() * 500) + 50,
      likes: favoritesData?.filter((f: any) => f.work_id === work.id).length || 0,
      sales: work.purchases?.length || 0,
      revenue: work.purchases?.reduce((sum: number, purchase: any) => sum + purchase.price, 0) || 0
    }));

  } catch (error) {
    console.error('Failed to fetch creator works:', error);
    throw error;
  }
};

export const updateWorkStatus = async (workId: string, isActive: boolean): Promise<void> => {
  try {
    const { error } = await supabase
      .from('works')
      .update({ is_published: isActive, updated_at: new Date().toISOString() })
      .eq('id', workId);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to update work status:', error);
    throw error;
  }
};

export const deleteWork = async (workId: string): Promise<void> => {
  try {
    // 関連するお気に入りとカートアイテムを削除
    await supabase.from('favorites').delete().eq('work_id', workId);
    await supabase.from('cart_items').delete().eq('work_id', workId);

    // 作品を削除
    const { error } = await supabase
      .from('works')
      .delete()
      .eq('id', workId);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to delete work:', error);
    throw error;
  }
};

export const updateWork = async (workId: string, updates: Partial<CreatorWork>): Promise<void> => {
  try {
    const { error } = await supabase
      .from('works')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', workId);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to update work:', error);
    throw error;
  }
};

export const createWork = async (creatorId: string, workData: Omit<CreatorWork, 'id' | 'created_at' | 'updated_at' | 'views' | 'likes' | 'sales' | 'revenue'>): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from('works')
      .insert({
        ...workData,
        creator_id: creatorId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Failed to create work:', error);
    throw error;
  }
};
