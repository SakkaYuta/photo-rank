import React, { useState, useEffect } from 'react';
import { navigate as navTo } from '@/utils/navigation'
import { useUserRole } from '../hooks/useUserRole';
import { fetchDashboardData, DashboardData } from '../services/dashboardService';
import {
  Heart,
  ShoppingCart,
  Package,
  User,
  Grid3X3,
  TrendingUp,
  Search,
  Settings,
  ChevronRight,
  Gamepad2
} from 'lucide-react';

const GeneralDashboard: React.FC = () => {
  const { userProfile, user } = useUserRole();
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    collections: 0,
    favorites: 0,
    cartItems: 0,
    orders: 0,
    recentActivities: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const envSamples = (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true'
      const useSamples = envSamples || (user && (user as any).is_demo)

      // デモユーザー or サンプルモードは常にサンプルデータを使用
      if (useSamples) {
        try {
          const data = await fetchDashboardData('demo-user-1')
          setDashboardData(data)
        } catch (e) {
          console.error('sample dashboard failed', e)
          // フォールバックで空データ
          setDashboardData({ collections: 0, favorites: 0, cartItems: 0, orders: 0, recentActivities: [] })
        } finally {
          setLoading(false)
        }
        return
      }

      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        const data = await fetchDashboardData(user.id);
        setDashboardData(data);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        // エラー時はデフォルト値を設定
        setDashboardData({
          collections: 0,
          favorites: 0,
          cartItems: 0,
          orders: 0,
          recentActivities: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user?.id]);

  const handleNavigateToSection = (section: string) => {
    const view = section === 'trending' ? 'merch' : section
    navTo(view)
  };

  const dashboardCards = [
    {
      id: 'collection',
      title: 'コレクション',
      description: 'お気に入りの作品をまとめて管理',
      icon: Grid3X3,
      color: 'from-blue-500 to-blue-600',
      count: loading ? '読み込み中...' : `${dashboardData.collections} コレクション`
    },
    {
      id: 'favorites',
      title: 'お気に入り',
      description: '気になる作品をブックマーク',
      icon: Heart,
      color: 'from-red-500 to-red-600',
      count: loading ? '読み込み中...' : `${dashboardData.favorites} 作品`
    },
    {
      id: 'cart',
      title: 'カート',
      description: '購入予定の商品を確認',
      icon: ShoppingCart,
      color: 'from-green-500 to-green-600',
      count: loading ? '読み込み中...' : `${dashboardData.cartItems} 商品`
    },
    {
      id: 'orders',
      title: '注文履歴',
      description: 'これまでの購入履歴を確認',
      icon: Package,
      color: 'from-purple-500 to-purple-600',
      count: loading ? '読み込み中...' : `${dashboardData.orders} 件の注文`
    }
  ];

  const quickActions = [
    {
      id: 'trending',
      title: 'トレンド作品',
      description: '今話題の作品をチェック',
      icon: TrendingUp,
      color: 'from-orange-500 to-orange-600'
    },
    {
      id: 'search',
      title: 'クリエイター検索',
      description: 'お気に入りのクリエイターを探す',
      icon: Search,
      color: 'from-indigo-500 to-indigo-600'
    },
    {
      id: 'battle-search',
      title: 'バトル検索',
      description: '進行中・開催予定のバトルを探す',
      icon: Gamepad2,
      color: 'from-purple-500 to-purple-600'
    }
  ];


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Welcome Section */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center shadow-lg">
              <User className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                おかえりなさい、{userProfile?.display_name || 'ユーザー'}さん
              </h1>
              <p className="text-sm lg:text-base text-gray-700">
                素敵な作品との出会いをお楽しみください
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        {/* Main Dashboard Cards */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
            マイダッシュボード
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {dashboardCards.map((card) => {
              const IconComponent = card.icon;
              return (
                <div
                  key={card.id}
                  onClick={() => handleNavigateToSection(card.id)}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 cursor-pointer hover:shadow-md hover:border-primary-200 transition-all duration-200 ease-in-out group"
                >
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className={`p-2 sm:p-2.5 lg:p-3 rounded-lg bg-gradient-to-br ${card.color} shadow-sm`}>
                      <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">
                    {card.title}
                  </h3>
                  <p className="text-gray-700 text-xs sm:text-sm mb-2 sm:mb-3 line-clamp-2">
                    {card.description}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 font-medium">
                    {card.count}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
            クイックアクション
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {quickActions.map((action) => {
              const IconComponent = action.icon;
              return (
                <div
                  key={action.id}
                  onClick={() => handleNavigateToSection(action.id)}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 cursor-pointer hover:shadow-md hover:border-primary-200 transition-all duration-200 ease-in-out group"
                >
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className={`p-2 sm:p-2.5 lg:p-3 rounded-lg bg-gradient-to-br ${action.color} shadow-sm flex-shrink-0`}>
                      <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 truncate">
                        {action.title}
                      </h3>
                      <p className="text-gray-700 text-xs sm:text-sm line-clamp-2">
                        {action.description}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
            最近の活動
          </h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 rounded-lg">
                    <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded animate-pulse w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : dashboardData.recentActivities.length > 0 ? (
              <div className="space-y-2">
                {dashboardData.recentActivities.map((activity) => {
                  // アクティビティタイプに応じてアイコンを選択
                  let IconComponent;
                  switch (activity.type) {
                    case 'favorite':
                      IconComponent = Heart;
                      break;
                    case 'order':
                      IconComponent = Package;
                      break;
                    case 'collection':
                      IconComponent = Grid3X3;
                      break;
                    case 'cart':
                      IconComponent = ShoppingCart;
                      break;
                    default:
                      IconComponent = Heart;
                  }

                  return (
                    <div key={activity.id} className="flex items-center space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className={`w-12 h-12 bg-gradient-to-br ${activity.color} rounded-full flex items-center justify-center shadow-sm`}>
                        <IconComponent className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-900 font-medium">{activity.title}</p>
                        <p className="text-gray-700 text-sm">{activity.timestamp}</p>
                        {activity.creatorName && (
                          <p className="text-gray-600 text-xs">by {activity.creatorName}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-700 font-medium mb-2">まだ活動がありません</p>
                <p className="text-gray-600 text-sm">作品をお気に入りに追加したり、注文をすると活動が表示されます</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralDashboard;
