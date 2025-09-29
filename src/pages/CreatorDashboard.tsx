import React, { useState, useEffect } from 'react';
import { useUserRole } from '../hooks/useUserRole';
import { useNav } from '@/contexts/NavContext';
import { fetchCreatorDashboard, CreatorDashboardData, updateWorkStatus } from '../services/creatorService';
import {
  Upload,
  Eye,
  Heart,
  ShoppingCart,
  DollarSign,
  Camera,
  TrendingUp,
  ChevronDown,
  Menu,
  X,
  Home,
  Search
} from 'lucide-react';

const CreatorDashboard: React.FC = () => {
  const { userProfile, user, userType } = useUserRole();
  const { navigate } = useNav();
  const [dashboardData, setDashboardData] = useState<CreatorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [pendingStatusChanges, setPendingStatusChanges] = useState<Map<string, boolean>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await fetchCreatorDashboard(user.id);
        setDashboardData(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch creator dashboard data:', err);
        setError('データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user?.id]);

  // ドロップダウンを外側クリックで閉じる（内側は維持）
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      // ステータスドロップダウンが開いている場合、対象内のクリックは維持
      if (statusDropdown) {
        const within = target.closest(`[data-dropdown-work="${statusDropdown}"]`);
        if (!within) setStatusDropdown(null);
      }
      // メニューは外側クリックで閉じる（メニューコンテナ内のクリックは除外）
      if (isMenuOpen) {
        const withinMenu = target.closest('[data-menu-container]');
        if (!withinMenu) setIsMenuOpen(false);
      }
    };

    if (statusDropdown || isMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [statusDropdown, isMenuOpen]);

  const goToCreate = () => {
    import('@/utils/navigation').then(m => m.navigate('create'))
  }

  const goToDashboard = () => {
    import('@/utils/navigation').then(m => m.navigate('dashboard'))
    setIsMenuOpen(false)
  }

  const goToBattle = () => {
    import('@/utils/navigation').then(m => m.navigate('battle'))
    setIsMenuOpen(false)
  }

  const handleStatusChange = (workId: string, newStatus: boolean) => {
    const newChanges = new Map(pendingStatusChanges);
    const currentWork = dashboardData?.recentWorks.find(w => w.id === workId);

    // 元の状態と同じなら変更を削除、異なるなら変更を記録
    if (currentWork?.is_active === newStatus) {
      newChanges.delete(workId);
    } else {
      newChanges.set(workId, newStatus);
    }

    setPendingStatusChanges(newChanges);
    setHasChanges(newChanges.size > 0);
    setStatusDropdown(null);
  };

  const saveAllChanges = async () => {
    if (pendingStatusChanges.size === 0) return;

    try {
      setUpdatingStatus('all');

      // すべての変更を並列で実行
      const updatePromises = Array.from(pendingStatusChanges.entries()).map(
        ([workId, newStatus]) => updateWorkStatus(workId, newStatus)
      );

      await Promise.all(updatePromises);

      // データを再読み込み
      if (user?.id) {
        const updatedData = await fetchCreatorDashboard(user.id);
        setDashboardData(updatedData);
      }

      // 変更をクリア
      setPendingStatusChanges(new Map());
      setHasChanges(false);
      alert('ステータスを更新しました');
    } catch (err) {
      console.error('Failed to update work statuses:', err);
      alert('ステータスの更新に失敗しました');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const cancelChanges = () => {
    setPendingStatusChanges(new Map());
    setHasChanges(false);
  };

  const toggleStatusDropdown = (workId: string) => {
    setStatusDropdown(statusDropdown === workId ? null : workId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Creator Welcome Section */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                クリエイターダッシュボード
              </h1>
              <p className="text-sm lg:text-base text-gray-600">
                こんにちは、{userProfile?.display_name}さん
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasChanges && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelChanges}
                    className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm transition-all duration-200 ease-in-out"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={saveAllChanges}
                    disabled={updatingStatus === 'all'}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm flex items-center gap-1 transition-all duration-200 ease-in-out"
                  >
                    {updatingStatus === 'all' ? '保存中...' : '変更を保存'}
                  </button>
                </div>
              )}
              <button
                onClick={goToCreate}
                className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 items-center gap-2 whitespace-nowrap text-sm sm:text-base transition-all duration-200 ease-in-out"
              >
                <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">新しい作品をアップロード</span>
                <span className="sm:hidden">作品投稿</span>
              </button>

              {/* ハンバーガーメニューボタン */}
              <div className="relative" data-menu-container>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(!isMenuOpen);
                  }}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 ease-in-out"
                  aria-label="メニュー"
                >
                  {isMenuOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </button>

                {/* ドロップダウンメニュー */}
                {isMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={goToDashboard}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Home className="w-4 h-4" />
                      ダッシュボード
                    </button>
                    <button
                      onClick={() => {
                        goToCreate();
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      新しい作品をアップロード
                    </button>
                    <button
                      onClick={goToBattle}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      バトルを探す
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {loading ? (
            // Loading skeleton
            Array(4).fill(0).map((_, index) => (
              <div key={index} className="bg-white p-4 sm:p-6 rounded-lg shadow-sm animate-pulse">
                <div className="flex items-center justify-between mb-2">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                  <div className="w-5 h-5 bg-gray-200 rounded"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-12"></div>
              </div>
            ))
          ) : error ? (
            <div className="col-span-4 bg-red-50 p-6 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          ) : (
            <>
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">総作品数</h3>
                  <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{dashboardData?.stats.totalWorks || 0}</p>
                <p className="text-sm text-green-600">+{dashboardData?.stats.monthlyGrowth.works || 0} 今月</p>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">総売上</h3>
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">¥{dashboardData?.stats.totalRevenue.toLocaleString() || 0}</p>
                <p className="text-sm text-green-600">+¥{dashboardData?.stats.monthlyGrowth.revenue.toLocaleString() || 0} 今月</p>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">合計ビュー</h3>
                  <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{dashboardData?.stats.totalViews.toLocaleString() || 0}</p>
                <p className="text-sm text-green-600">+{dashboardData?.stats.monthlyGrowth.views.toLocaleString() || 0} 今月</p>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">総販売数</h3>
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{dashboardData?.stats.totalSales.toLocaleString() || 0}</p>
                <p className="text-sm text-green-600">+{dashboardData?.stats.monthlyGrowth.sales.toLocaleString() || 0} 今月</p>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Recent Works */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 sm:p-6 border-b">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">最近の作品</h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="space-y-4">
                  {loading ? (
                    // Loading skeleton for works
                    Array(3).fill(0).map((_, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg animate-pulse">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
                          <div>
                            <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                            <div className="flex gap-4">
                              <div className="h-3 bg-gray-200 rounded w-12"></div>
                              <div className="h-3 bg-gray-200 rounded w-12"></div>
                              <div className="h-3 bg-gray-200 rounded w-12"></div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
                          <div className="h-4 bg-gray-200 rounded w-12"></div>
                        </div>
                      </div>
                    ))
                  ) : error ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>データの読み込みに失敗しました</p>
                    </div>
                  ) : dashboardData?.recentWorks && dashboardData.recentWorks.length > 0 ? (
                    dashboardData.recentWorks.map((work) => {
                      // 保留中の変更をチェック
                      const pendingStatus = pendingStatusChanges.get(work.id);
                      const currentStatus = pendingStatus !== undefined ? pendingStatus : work.is_active;
                      const hasChange = pendingStatusChanges.has(work.id);
                      const openWork = () => {
                        try {
                          localStorage.setItem('highlight_work_id', work.id)
                        } catch {}
                        import('@/utils/navigation').then(m => m.navigate('myworks'))
                      }

                      return (
                      <div key={work.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-4 cursor-pointer" onClick={openWork}>
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                            {work.image_url ? (
                              <img
                                src={work.image_url}
                                alt={work.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-200"></div>
                            )}
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{work.title}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                              <span className="flex items-center gap-1">
                                <Eye className="w-4 h-4" />
                                {work.views.toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Heart className="w-4 h-4" />
                                {work.likes.toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <ShoppingCart className="w-4 h-4" />
                                {work.sales.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">¥{work.revenue.toLocaleString()}</p>
                          <div className="relative" data-dropdown-work={work.id}>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleStatusDropdown(work.id); }}
                              disabled={updatingStatus === 'all'}
                              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors ${
                                hasChange
                                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-300'
                                  : currentStatus
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              } ${updatingStatus === 'all' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              {updatingStatus === 'all' ? (
                                <span>更新中...</span>
                              ) : (
                                <>
                                  <span>{currentStatus ? '公開中' : '非公開'}</span>
                                  {hasChange && <span className="text-xs">(未保存)</span>}
                                  <ChevronDown className="w-3 h-3" />
                                </>
                              )}
                            </button>

                            {statusDropdown === work.id && (
                              <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-10" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleStatusChange(work.id, true)}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-t-lg ${
                                    currentStatus ? 'text-gray-400' : 'text-gray-900'
                                  }`}
                                  disabled={currentStatus}
                                >
                                  公開中
                                </button>
                                <button
                                  onClick={() => handleStatusChange(work.id, false)}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-b-lg ${
                                    !currentStatus ? 'text-gray-400' : 'text-gray-900'
                                  }`}
                                  disabled={!currentStatus}
                                >
                                  非公開
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                    })
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Camera className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>まだ作品がありません</p>
                      <p className="text-sm mt-1">新しい作品をアップロードしてみましょう</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Performance Chart & Quick Actions */}
          <div className="space-y-6">
            {/* Performance Chart */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 sm:p-6 border-b">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">パフォーマンス</h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="text-center text-gray-500">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                    <p>売上グラフ</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorDashboard;
