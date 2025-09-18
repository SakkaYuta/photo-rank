import { supabase } from './supabaseClient';

export interface DashboardData {
  collections: number;
  favorites: number;
  cartItems: number;
  orders: number;
  recentActivities: Activity[];
}

export interface Activity {
  id: string;
  type: 'favorite' | 'order' | 'collection' | 'cart';
  title: string;
  timestamp: string;
  icon: any;
  color: string;
  workTitle?: string;
  creatorName?: string;
  orderStatus?: string;
}

export interface Collection {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_avatar: string;
  work_count: number;
  total_spent: number;
  first_purchase_date: string;
  latest_purchase_date: string;
  works: {
    id: string;
    title: string;
    image_url: string;
    price: number;
    purchased_at: string;
  }[];
}

export interface OrderHistory {
  id: string;
  work_id: string;
  work_title: string;
  work_image_url: string;
  creator_name: string;
  price: number;
  status: string;
  purchased_at: string;
  tracking_number?: string;
  shipped_at?: string;
  delivered_at?: string;
}

export const fetchDashboardData = async (userId: string): Promise<DashboardData> => {
  try {
    // コレクション数を取得（購入したクリエイターの数）
    const { data: collectionsData } = await supabase
      .from('purchases')
      .select('work_id, works!inner(creator_id)')
      .eq('user_id', userId);

    const uniqueCreators = new Set(collectionsData?.map(p => p.works.creator_id) || []);
    const collections = uniqueCreators.size;

    // お気に入り数を取得
    const { count: favorites } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // カート内商品数を取得
    const { data: cartData } = await supabase
      .from('cart_items')
      .select('quantity')
      .eq('user_id', userId);

    const cartItems = cartData?.reduce((sum, item) => sum + item.quantity, 0) || 0;

    // 注文数を取得
    const { count: orders } = await supabase
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // 最近の活動を取得
    const recentActivities = await fetchRecentActivities(userId);

    return {
      collections,
      favorites: favorites || 0,
      cartItems,
      orders: orders || 0,
      recentActivities
    };
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    throw error;
  }
};

export const fetchRecentActivities = async (userId: string): Promise<Activity[]> => {
  try {
    const activities: Activity[] = [];

    // 最近のお気に入り追加
    const { data: favoritesData } = await supabase
      .from('favorites')
      .select(`
        id,
        created_at,
        works!inner(
          title,
          creator_id,
          users!inner(display_name)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);

    favoritesData?.forEach(fav => {
      activities.push({
        id: fav.id,
        type: 'favorite',
        title: `「${fav.works.title}」をお気に入りに追加`,
        timestamp: formatTimestamp(fav.created_at),
        icon: null, // アイコンはコンポーネント側で設定
        color: 'from-blue-500 to-purple-600',
        workTitle: fav.works.title,
        creatorName: fav.works.users.display_name
      });
    });

    // 最近の注文
    const { data: ordersData } = await supabase
      .from('purchases')
      .select(`
        id,
        created_at,
        status,
        works!inner(
          title,
          creator_id,
          users!inner(display_name)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);

    ordersData?.forEach(order => {
      activities.push({
        id: order.id,
        type: 'order',
        title: `「${order.works.title}」を注文しました`,
        timestamp: formatTimestamp(order.created_at),
        icon: null,
        color: 'from-green-500 to-green-600',
        workTitle: order.works.title,
        creatorName: order.works.users.display_name,
        orderStatus: order.status
      });
    });

    // 最近のカート追加
    const { data: cartData } = await supabase
      .from('cart_items')
      .select(`
        id,
        created_at,
        works!inner(
          title,
          creator_id,
          users!inner(display_name)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(2);

    cartData?.forEach(cart => {
      activities.push({
        id: cart.id,
        type: 'cart',
        title: `「${cart.works.title}」をカートに追加`,
        timestamp: formatTimestamp(cart.created_at),
        icon: null,
        color: 'from-orange-500 to-orange-600',
        workTitle: cart.works.title,
        creatorName: cart.works.users.display_name
      });
    });

    // 時系列順にソート
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);

  } catch (error) {
    console.error('Failed to fetch recent activities:', error);
    return [];
  }
};

export const fetchUserCollections = async (userId: string): Promise<Collection[]> => {
  try {
    const { data: purchasesData } = await supabase
      .from('purchases')
      .select(`
        id,
        price,
        purchased_at,
        works!inner(
          id,
          title,
          image_url,
          price,
          creator_id,
          users!inner(display_name, avatar_url)
        )
      `)
      .eq('user_id', userId)
      .order('purchased_at', { ascending: false });

    if (!purchasesData) return [];

    // クリエイター別にグループ化
    const creatorGroups = new Map<string, any[]>();

    purchasesData.forEach(purchase => {
      const creatorId = purchase.works.creator_id;
      if (!creatorGroups.has(creatorId)) {
        creatorGroups.set(creatorId, []);
      }
      creatorGroups.get(creatorId)!.push(purchase);
    });

    // コレクションデータを構築
    const collections: Collection[] = Array.from(creatorGroups.entries()).map(([creatorId, purchases]) => {
      const firstPurchase = purchases[purchases.length - 1];
      const latestPurchase = purchases[0];
      const totalSpent = purchases.reduce((sum, p) => sum + p.price, 0);

      return {
        id: creatorId,
        creator_id: creatorId,
        creator_name: firstPurchase.works.users.display_name,
        creator_avatar: firstPurchase.works.users.avatar_url ||
          `https://api.dicebear.com/7.x/identicon/svg?seed=${creatorId}`,
        work_count: purchases.length,
        total_spent: totalSpent,
        first_purchase_date: firstPurchase.purchased_at,
        latest_purchase_date: latestPurchase.purchased_at,
        works: purchases.map(p => ({
          id: p.works.id,
          title: p.works.title,
          image_url: p.works.image_url,
          price: p.price,
          purchased_at: p.purchased_at
        }))
      };
    });

    return collections.sort((a, b) =>
      new Date(b.latest_purchase_date).getTime() - new Date(a.latest_purchase_date).getTime()
    );

  } catch (error) {
    console.error('Failed to fetch user collections:', error);
    throw error;
  }
};

export const fetchOrderHistory = async (userId: string): Promise<OrderHistory[]> => {
  try {
    const { data: ordersData } = await supabase
      .from('purchases')
      .select(`
        id,
        price,
        status,
        purchased_at,
        tracking_number,
        shipped_at,
        delivered_at,
        works!inner(
          id,
          title,
          image_url,
          creator_id,
          users!inner(display_name)
        )
      `)
      .eq('user_id', userId)
      .order('purchased_at', { ascending: false });

    if (!ordersData) return [];

    return ordersData.map(order => ({
      id: order.id,
      work_id: order.works.id,
      work_title: order.works.title,
      work_image_url: order.works.image_url,
      creator_name: order.works.users.display_name,
      price: order.price,
      status: order.status,
      purchased_at: order.purchased_at,
      tracking_number: order.tracking_number,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at
    }));

  } catch (error) {
    console.error('Failed to fetch order history:', error);
    throw error;
  }
};

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins}分前`;
  } else if (diffHours < 24) {
    return `${diffHours}時間前`;
  } else {
    return `${diffDays}日前`;
  }
};