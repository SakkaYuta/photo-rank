import React, { useState, useEffect } from 'react';
import { useUserRole } from '../hooks/useUserRole';
import { useNav } from '@/contexts/NavContext';
import { fetchCreatorDashboard, CreatorDashboardData, updateWorkStatus } from '../services/creatorService';
import {
  Eye,
  Heart,
  ShoppingCart,
  DollarSign,
  Camera,
  TrendingUp,
  ChevronDown
} from 'lucide-react';
import { listBattles } from '@/services/battle.service'

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
  const [battleLoading, setBattleLoading] = useState(true)
  const [battleError, setBattleError] = useState<string | null>(null)
  const [battleStatus, setBattleStatus] = useState<'finished'|'live'|'scheduled'|'all'>('finished')
  const [battleHistory, setBattleHistory] = useState<Array<{ id: string; role: 'challenger'|'opponent'; opponentName: string; status: string; start_time?: string; end_time?: string; result?: 'win'|'lose'|'draw' }>>([])

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
        setError('データを読み込めませんでした。再度お試しください');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
    const loadBattles = async (status?: 'finished'|'live'|'scheduled') => {
      if (!user?.id) { setBattleLoading(false); setBattleHistory([]); return }
      try {
        setBattleLoading(true); setBattleError(null)
        const params: any = { limit: 50, only_mine: true }
        if (status) params.status = status
        const { items, participants } = await listBattles(params)
        const mapped = (items || []).map(b => {
          const amChallenger = b.challenger_id === user.id
          const opponentId = amChallenger ? b.opponent_id : b.challenger_id
          const oppName = participants?.[opponentId]?.display_name || opponentId?.slice(0,8)
          let result: 'win'|'lose'|'draw' | undefined = undefined
          if (b.winner_id) {
            result = b.winner_id === user.id ? 'win' : 'lose'
          }
          return { id: b.id, role: (amChallenger ? 'challenger' : 'opponent') as 'challenger'|'opponent', opponentName: oppName, status: b.status, start_time: b.start_time, end_time: b.end_time, result }
        })
        setBattleHistory(mapped)
      } catch (e: any) {
        setBattleError(e?.message || 'バトル履歴の取得に失敗しました')
        setBattleHistory([])
      } finally {
        setBattleLoading(false)
      }
    }
    loadBattles(battleStatus === 'all' ? undefined : battleStatus)
  }, [user?.id, battleStatus]);

  // ドロップダウンを外側クリック/Escで閉じる（内側は維持）
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      // ステータスドロップダウンが開いている場合、対象内のクリックは維持
      if (statusDropdown) {
        const within = target.closest(`[data-dropdown-work="${statusDropdown}"]`);
        if (!within) setStatusDropdown(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (statusDropdown) setStatusDropdown(null);
      }
    };

    if (statusDropdown) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [statusDropdown]);


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
      alert('変更を保存しました');
    } catch (err) {
      console.error('Failed to update work statuses:', err);
      alert('変更を保存できませんでした。もう一度お試しください');
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
                {userProfile?.display_name}さん、おかえりなさい
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
                  <h3 className="text-sm font-medium text-gray-600">あなたの作品</h3>
                  <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{dashboardData?.stats.totalWorks || 0}</p>
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +{dashboardData?.stats.monthlyGrowth.works || 0} 今月
                </p>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">累計売上</h3>
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">¥{dashboardData?.stats.totalRevenue.toLocaleString() || 0}</p>
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +¥{dashboardData?.stats.monthlyGrowth.revenue.toLocaleString() || 0} 今月
                </p>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">閲覧数</h3>
                  <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{dashboardData?.stats.totalViews.toLocaleString() || 0}</p>
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +{dashboardData?.stats.monthlyGrowth.views.toLocaleString() || 0} 今月
                </p>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">販売実績</h3>
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{dashboardData?.stats.totalSales.toLocaleString() || 0}</p>
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +{dashboardData?.stats.monthlyGrowth.sales.toLocaleString() || 0} 今月
                </p>
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
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={statusDropdown === work.id}
                              aria-controls={`status-menu-${work.id}`}
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
                                <span>💾 保存しています</span>
                              ) : (
                                <>
                                  <span>{currentStatus ? '✓ 公開中' : '⊘ 非公開'}</span>
                                  {hasChange && <span className="text-xs">(未保存)</span>}
                                  <ChevronDown className="w-3 h-3" />
                                </>
                              )}
                            </button>

                            {statusDropdown === work.id && (
                              <div
                                id={`status-menu-${work.id}`}
                                role="menu"
                                aria-labelledby={`status-toggle-${work.id}`}
                                className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  role="menuitem"
                                  onClick={() => handleStatusChange(work.id, true)}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-t-lg ${
                                    currentStatus ? 'text-gray-400' : 'text-gray-900'
                                  }`}
                                  disabled={currentStatus}
                                >
                                  ✓ 公開中
                                </button>
                                <button
                                  role="menuitem"
                                  onClick={() => handleStatusChange(work.id, false)}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-b-lg ${
                                    !currentStatus ? 'text-gray-400' : 'text-gray-900'
                                  }`}
                                  disabled={!currentStatus}
                                >
                                  ⊘ 非公開
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
                      <p className="font-medium">最初の一枚をアップロードしましょう！</p>
                      <p className="text-sm mt-1">あなたの作品を世界に届けましょう</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Summary */}
          <div className="space-y-6">
            {/* Top Performing Work */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">今月のハイライト</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm text-gray-600">新規作品</span>
                    <span className="font-semibold text-blue-600">+{dashboardData?.stats.monthlyGrowth.works || 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm text-gray-600">新規閲覧</span>
                    <span className="font-semibold text-purple-600">+{dashboardData?.stats.monthlyGrowth.views.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600">今月の売上</span>
                    <span className="font-semibold text-green-600">¥{dashboardData?.stats.monthlyGrowth.revenue.toLocaleString() || 0}</span>
            </div>
          </div>
        </div>

        {/* バトル履歴 */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 sm:p-6 border-b">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">バトル履歴</h2>
                <p className="text-sm text-gray-600 mt-1">過去の対戦結果を確認できます</p>
              </div>
              <div className="flex items-center gap-2">
                {([
                  {k:'finished', label:'終了'},
                  {k:'live', label:'進行中'},
                  {k:'scheduled', label:'予定'},
                  {k:'all', label:'すべて'},
                ] as const).map(t => (
                  <button
                    key={t.k}
                    onClick={() => setBattleStatus(t.k)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      battleStatus === t.k
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >{t.label}</button>
                ))}
                <button
                  className="ml-2 px-3 py-1.5 rounded-full text-sm border border-gray-300 hover:bg-gray-50"
                  onClick={() => {
                    const st = battleStatus === 'all' ? undefined : battleStatus
                    ;(async () => {
                      setBattleLoading(true)
                      setBattleError(null)
                      try {
                        const params: any = { limit: 50, only_mine: true }
                        if (st) params.status = st
                        const { items, participants } = await listBattles(params)
                        const mapped = (items || []).map(b => {
                          const amC = b.challenger_id === user?.id
                          const oppId = amC ? b.opponent_id : b.challenger_id
                          const oppName = participants?.[oppId]?.display_name || oppId?.slice(0, 8)
                          let result: 'win' | 'lose' | undefined = undefined
                          if (b.winner_id) result = b.winner_id === user?.id ? 'win' : 'lose'
                          return { id: b.id, role: amC ? 'challenger' : 'opponent', opponentName: oppName, status: b.status, start_time: b.start_time, end_time: b.end_time, result }
                        })
                        setBattleHistory(mapped as any)
                      } catch (e: any) {
                        setBattleError(e?.message || 'バトル履歴の再取得に失敗しました')
                      } finally {
                        setBattleLoading(false)
                      }
                    })()
                  }}
                >再読込</button>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            {battleLoading ? (
              <div className="space-y-3">
                {Array(3).fill(0).map((_,i)=> (
                  <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : battleError ? (
              <div className="text-red-600">{battleError}</div>
            ) : battleHistory.length === 0 ? (
              <div className="text-gray-600">バトル履歴はありません</div>
            ) : (
              <div className="divide-y">
                {battleHistory.map(b => (
                  <div key={b.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-700">対戦相手: <span className="font-medium text-gray-900">{b.opponentName}</span> <span className="ml-2 text-xs text-gray-500">({b.role === 'challenger' ? '挑戦者' : '対戦相手'})</span></div>
                      <div className="text-xs text-gray-500">開始: {b.start_time ? new Date(b.start_time).toLocaleString('ja-JP') : '-' } / 終了: {b.end_time ? new Date(b.end_time).toLocaleString('ja-JP') : '-'}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${b.result === 'win' ? 'text-green-600' : b.result === 'lose' ? 'text-red-600' : 'text-gray-600'}`}>
                        {b.result === 'win' ? '勝利' : b.result === 'lose' ? '敗北' : '—'}
                      </div>
                      <button className="text-xs text-blue-600 hover:underline" onClick={() => import('@/utils/navigation').then(m => m.navigate('battle-search'))}>詳細を見る</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
