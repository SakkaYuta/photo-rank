import React, { useState, useEffect } from 'react';
import { useUserRole } from '../hooks/useUserRole';
import { useNav } from '@/contexts/NavContext';
import { fetchCreatorDashboard, CreatorDashboardData, updateWorkStatus } from '../services/creatorService';
import {
  Upload,
  BarChart3,
  Eye,
  Heart,
  ShoppingCart,
  DollarSign,
  Camera,
  Users,
  TrendingUp,
  Star,
  ChevronDown,
  Gamepad2
} from 'lucide-react';

const CreatorDashboard: React.FC = () => {
  const { userProfile, user } = useUserRole();
  const { navigate } = useNav();
  const [dashboardData, setDashboardData] = useState<CreatorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [pendingStatusChanges, setPendingStatusChanges] = useState<Map<string, boolean>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);

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

  // ドロップダウンを閉じるためのイベントリスナー
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      setStatusDropdown(null);
    };

    if (statusDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [statusDropdown]);

  const goToCreate = () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'create' } }))
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
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">
                クリエイターダッシュボード
              </h1>
              <p className="text-gray-600">
                こんにちは、{userProfile?.display_name}さん
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasChanges && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelChanges}
                    className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={saveAllChanges}
                    disabled={updatingStatus === 'all'}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm flex items-center gap-1"
                  >
                    {updatingStatus === 'all' ? '保存中...' : '変更を保存'}
                  </button>
                </div>
              )}
              <button onClick={goToCreate} className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 whitespace-nowrap text-sm sm:text-base">
                <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">新しい作品をアップロード</span>
                <span className="sm:hidden">作品投稿</span>
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'merch' } }))}
                className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm text-gray-900"
                title="ホームへ"
              >
                ✨ PhotoRank
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
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
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">総作品数</h3>
                  <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{dashboardData?.stats.totalWorks || 0}</p>
                <p className="text-sm text-green-600">+{dashboardData?.stats.monthlyGrowth.works || 0} 今月</p>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">総売上</h3>
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">¥{dashboardData?.stats.totalRevenue.toLocaleString() || 0}</p>
                <p className="text-sm text-green-600">+¥{dashboardData?.stats.monthlyGrowth.revenue.toLocaleString() || 0} 今月</p>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">合計ビュー</h3>
                  <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{dashboardData?.stats.totalViews.toLocaleString() || 0}</p>
                <p className="text-sm text-green-600">+{dashboardData?.stats.monthlyGrowth.views.toLocaleString() || 0} 今月</p>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Recent Works */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 sm:p-6 border-b">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">最近の作品</h2>
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
                        window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'myworks' } }))
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
                          <div className="relative">
                            <button
                              onClick={() => toggleStatusDropdown(work.id)}
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
                              <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
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
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 sm:p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">パフォーマンス</h2>
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

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 sm:p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">クイックアクション</h2>
              </div>
              <div className="p-6 space-y-3">
                <button onClick={goToCreate} className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg">
                  <Upload className="w-5 h-5 text-blue-600" />
                  <span className="truncate">新しい作品をアップロード</span>
                </button>
                <button
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg"
                  onClick={() => navigate('battle-search')}
                >
                  <Gamepad2 className="w-5 h-5 text-purple-600" />
                  <span className="truncate">バトルを探す</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorDashboard;
