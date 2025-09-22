import React, { useEffect, useMemo, useState } from 'react';
import { useUserRole } from '../hooks/useUserRole';
import { usePartnerAuth } from '../hooks/usePartnerAuth';
import { getPartnerStats, getPartnerOrders, updateOrderStatus } from '../services/partner.service';
import type { ManufacturingOrder } from '../types/partner.types';
import {
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  Settings,
  BarChart3,
  Truck,
  Calendar,
  DollarSign,
  Factory,
  ChevronDown
} from 'lucide-react';

const FactoryDashboard: React.FC = () => {
  const { userProfile } = useUserRole();
  const { partner, loading: partnerLoading } = usePartnerAuth();
  const [stats, setStats] = useState<{ activeProducts: number; totalOrders: number; pendingOrders: number; completedOrders: number; averageRating: number; totalReviews: number } | null>(null)
  const [orders, setOrders] = useState<ManufacturingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productFilter, setProductFilter] = useState<string>('')
  const [mdText, setMdText] = useState<string>('')
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null)
  const [pendingStatusChanges, setPendingStatusChanges] = useState<Map<string, ManufacturingOrder['status']>>(new Map())
  const [hasChanges, setHasChanges] = useState(false)
  const [updatingStatuses, setUpdatingStatuses] = useState(false)

  useEffect(() => {
    (async () => {
      if (!partner || partnerLoading) return
      try {
        setLoading(true)
        const [s, o] = await Promise.all([
          getPartnerStats(partner.id),
          getPartnerOrders(partner.id),
        ])
        setStats(s)
        setOrders(o || [])
        setError(null)
      } catch (e: any) {
        console.error('FactoryDashboard load error:', e)
        setError(e?.message || 'データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    })()
  }, [partner?.id, partnerLoading])

  // ドロップダウンを閉じるためのイベントリスナー
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      setStatusDropdown(null);
    };

    if (statusDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [statusDropdown])

  const productKeys = useMemo(() => {
    const keys = new Set<string>()
    ;(orders || []).forEach(o => {
      const fp = (o as any).factory_products
      const k = fp?.id || (o.request_payload as any)?.product_id || (o.request_payload as any)?.product_type
      if (k) keys.add(String(k))
    })
    return Array.from(keys)
  }, [orders])

  const filteredOrders = useMemo(() => {
    if (!productFilter) return orders
    return (orders || []).filter(o => {
      const fp = (o as any).factory_products
      const k = fp?.id || (o.request_payload as any)?.product_id || (o.request_payload as any)?.product_type
      return String(k) === productFilter
    })
  }, [orders, productFilter])

  const labelOf = (status: ManufacturingOrder['status']) => {
    switch (status) {
      case 'submitted': return '受付'
      case 'accepted': return '受入済み'
      case 'in_production': return '製造中'
      case 'shipped': return '出荷済み'
      case 'cancelled': return 'キャンセル'
      case 'failed': return '失敗'
      default: return status
    }
  }
  const badgeClass = (status: ManufacturingOrder['status']) => (
    status === 'shipped' ? 'bg-green-100 text-green-800' :
    status === 'in_production' ? 'bg-blue-100 text-blue-800' :
    status === 'accepted' ? 'bg-yellow-100 text-yellow-800' :
    status === 'submitted' ? 'bg-gray-100 text-gray-800' :
    status === 'cancelled' ? 'bg-red-100 text-red-800' :
    'bg-gray-100 text-gray-800'
  )

  const handleStatusChange = (orderId: string, newStatus: ManufacturingOrder['status']) => {
    const newChanges = new Map(pendingStatusChanges);
    const currentOrder = displayOrders.find(o => o.id === orderId);

    // 元の状態と同じなら変更を削除、異なるなら変更を記録
    if (currentOrder?.status === newStatus) {
      newChanges.delete(orderId);
    } else {
      newChanges.set(orderId, newStatus);
    }

    setPendingStatusChanges(newChanges);
    setHasChanges(newChanges.size > 0);
    setStatusDropdown(null);
  };

  const saveAllStatusChanges = async () => {
    if (pendingStatusChanges.size === 0) return;

    try {
      setUpdatingStatuses(true);

      // すべての変更を並列で実行
      const updatePromises = Array.from(pendingStatusChanges.entries()).map(
        ([orderId, newStatus]) => updateOrderStatus(orderId, newStatus)
      );

      await Promise.all(updatePromises);

      // ローカル状態を更新
      setOrders(prev => prev.map(o => {
        const newStatus = pendingStatusChanges.get(o.id);
        return newStatus ? { ...o, status: newStatus } : o;
      }));

      // 変更をクリア
      setPendingStatusChanges(new Map());
      setHasChanges(false);
      alert('ステータスを更新しました');
    } catch (e) {
      console.error('Status update failed', e);
      alert('ステータス更新に失敗しました');
    } finally {
      setUpdatingStatuses(false);
    }
  };

  const cancelStatusChanges = () => {
    setPendingStatusChanges(new Map());
    setHasChanges(false);
  };

  const toggleStatusDropdown = (orderId: string) => {
    setStatusDropdown(statusDropdown === orderId ? null : orderId);
  };

  async function applyMarkdownUpdates() {
    // Markdownの各行: "- <order_id>: <status>" or "<order_id> -> <status>"
    const lines = mdText.split(/\r?\n/)
    const updates: { id: string; status: ManufacturingOrder['status'] }[] = []
    for (const raw of lines) {
      const line = raw.trim()
      if (!line) continue
      const m = line.match(/^-?\s*([A-Za-z0-9_-]+)\s*(?:[:\-\>]{1,2})\s*([a-z_]+)/)
      if (!m) continue
      const id = m[1]
      const st = m[2] as ManufacturingOrder['status']
      if (!['submitted','accepted','in_production','shipped','cancelled','failed'].includes(st)) continue
      updates.push({ id, status: st })
    }
    if (updates.length === 0) return
    try {
      await Promise.all(updates.map(u => updateOrderStatus(u.id, u.status)))
      // ローカル反映
      setOrders(prev => prev.map(o => {
        const up = updates.find(x => x.id === o.id)
        return up ? { ...o, status: up.status } as ManufacturingOrder : o
      }))
      setMdText('')
    } catch (e) {
      console.error('Status update failed', e)
      alert('ステータス更新に失敗しました')
    }
  }

  // デモデータ生成
  const genDemoStats = () => ({
    activeProducts: 12,
    totalOrders: 128,
    pendingOrders: 5,
    completedOrders: 96,
    averageRating: 4.4,
    totalReviews: 58,
  })

  const genDemoOrders = (): ManufacturingOrder[] => {
    const now = Date.now()
    const statuses: ManufacturingOrder['status'][] = ['in_production', 'accepted', 'shipped']
    return Array.from({ length: 10 }).map((_, i) => {
      const created = new Date(now - (i + 1) * 36 * 60 * 60 * 1000) // 36h刻み
      const status = statuses[i % statuses.length]
      return {
        id: `DEMO-ORD-${String(i + 1).padStart(3, '0')}`,
        order_id: `DEMO-${1000 + i}`,
        partner_id: 'DEMO-001',
        request_payload: { product_type: ['tshirt', 'mug', 'poster'][i % 3], quantity: (i % 5) + 1 },
        response_payload: null,
        status,
        assigned_at: created.toISOString(),
        shipped_at: status === 'shipped' ? new Date(created.getTime() + 24 * 60 * 60 * 1000).toISOString() : null,
        tracking_number: status === 'shipped' ? `TRK${100000 + i}` : null,
        creator_user_id: `demo-user-${(Math.random() * 1e6).toFixed(0)}`,
        work_id: null,
        created_at: created.toISOString(),
        updated_at: created.toISOString(),
      }
    })
  }

  if (partnerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">工場情報を読み込み中...</div>
    )
  }

  const demoMode = !partner || !!error
  const displayStats = stats ?? genDemoStats()
  const displayOrders = (orders && orders.length > 0) ? orders : genDemoOrders()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">
                工場管理ダッシュボード
              </h1>
              <p className="text-gray-600">
                こんにちは、{userProfile?.display_name}さん
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {demoMode
                  ? 'デモ工場（ID: DEMO-001）'
                  : `${partner.company_name || partner.name}（ID: ${partner.id}）`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasChanges && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelStatusChanges}
                    className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={saveAllStatusChanges}
                    disabled={updatingStatuses}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-1"
                  >
                    {updatingStatuses ? 'ステータス保存中...' : 'ステータス変更を保存'}
                  </button>
                </div>
              )}
              <button
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'partner-settings' } }))}
              >
                <Settings className="w-5 h-5" />
                工場設定
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">受注中</h3>
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{loading && !demoMode ? '—' : (displayStats.pendingOrders)}</p>
            <p className="text-sm text-orange-600">{loading && !demoMode ? '' : `総受注 ${displayStats.totalOrders}件`}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">完了済み</h3>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{loading && !demoMode ? '—' : (displayStats.completedOrders)}</p>
            <p className="text-sm text-green-600">出荷済み件数</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">有効商品</h3>
              <Factory className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{loading && !demoMode ? '—' : (displayStats.activeProducts)}</p>
            <p className="text-sm text-blue-600">公開中の商品</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">平均評価</h3>
              <DollarSign className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{loading && !demoMode ? '—' : displayStats.averageRating.toFixed(1)}</p>
            <p className="text-sm text-gray-600">レビュー {loading && !demoMode ? '—' : displayStats.totalReviews} 件</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Production Queue */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">製造キュー</h2>
              </div>
              <div className="p-6">
                {error && !demoMode && (
                  <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
                )}
                <div className="space-y-4">
                  {(loading && !demoMode ? [] : (displayOrders.filter(o => (o.status === 'accepted' || o.status === 'in_production'))
                    .filter(o => {
                      if (!productFilter) return true
                      const fp = (o as any).factory_products
                      const k = fp?.id || (o.request_payload as any)?.product_id || (o.request_payload as any)?.product_type
                      return String(k) === productFilter
                    })
                  )).slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${order.status === 'in_production' ? 'bg-blue-500' : 'bg-yellow-500'}`}></div>
                        <div>
                          <h3 className="font-medium text-gray-900">{order.id}</h3>
                          <p className="text-sm text-gray-600">注文開始: {new Date(order.created_at).toLocaleString()}</p>
                          <p className="text-xs text-gray-500">製品ID: {String(((order as any).factory_products?.id) || (order.request_payload as any)?.product_id || (order.request_payload as any)?.product_type || '—')}</p>
                          {(order as any).works && (
                            <p className="text-xs text-gray-500">
                              作品: {(order as any).works.title} / クリエイター: {(order as any).creator_profile?.display_name || '—'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${badgeClass(order.status)}`}>
                          {labelOf(order.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {!loading && !demoMode && filteredOrders.filter(o => o.status === 'accepted' || o.status === 'in_production').length === 0 && (
                    <div className="text-center text-sm text-gray-500">現在、製造待ちの注文はありません</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 右側パネル */}
          <div className="space-y-6">
            {/* フィルター */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">フィルター</h2>
              </div>
              <div className="p-6 space-y-3">
                <label className="text-sm text-gray-700">製品IDで絞り込み</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
                  <option value="">すべて</option>
                  {productKeys.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ステータス一括更新（Markdown） */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">ステータス一括更新（Markdown）</h2>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-sm text-gray-600">
                  例: <code>ORD-001: in_production</code> や <code>ORD-002 -&gt; shipped</code> を1行ずつ記述
                </p>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-xs sm:text-sm min-h-[100px] sm:min-h-[120px]"
                  placeholder={"ORD-001: in_production\nORD-002 -> shipped"}
                  value={mdText}
                  onChange={(e) => setMdText(e.target.value)}
                />
                <div className="flex justify-end">
                  <button onClick={applyMarkdownUpdates} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">更新する</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">最近の注文</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      注文ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      作品
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      クリエイター
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      商品
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      数量
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">顧客</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ステータス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      金額
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(loading && !demoMode ? [] : displayOrders.filter(o => {
                    if (!productFilter) return true
                    const k = (o.request_payload as any)?.product_id || (o.request_payload as any)?.product_type
                    return String(k) === productFilter
                  }).slice(0, 10)).map((order) => (
                    <tr key={order.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(order as any).works?.title || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(order as any).creator_profile?.display_name || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {String(((order as any).factory_products?.id) || (order.request_payload as any)?.product_id || (order.request_payload as any)?.product_type || '—')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.request_payload?.quantity ?? '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(order as any).customer_profile?.display_name || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(() => {
                          // 保留中の変更をチェック
                          const pendingStatus = pendingStatusChanges.get(order.id);
                          const currentStatus = pendingStatus !== undefined ? pendingStatus : order.status;
                          const hasChange = pendingStatusChanges.has(order.id);
                          const allStatuses: ManufacturingOrder['status'][] = ['submitted', 'accepted', 'in_production', 'shipped', 'cancelled', 'failed'];

                          return (
                            <div className="relative">
                              <button
                                onClick={() => toggleStatusDropdown(order.id)}
                                disabled={updatingStatuses}
                                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full transition-colors ${
                                  hasChange
                                    ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-300'
                                    : badgeClass(currentStatus)
                                } ${updatingStatuses ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                              >
                                {updatingStatuses ? (
                                  <span>更新中...</span>
                                ) : (
                                  <>
                                    <span>{labelOf(currentStatus)}</span>
                                    {hasChange && <span className="text-xs">(未保存)</span>}
                                    <ChevronDown className="w-3 h-3" />
                                  </>
                                )}
                              </button>

                              {statusDropdown === order.id && (
                                <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                  {allStatuses.map((status) => (
                                    <button
                                      key={status}
                                      onClick={() => handleStatusChange(order.id, status)}
                                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                                        currentStatus === status ? 'text-gray-400' : 'text-gray-900'
                                      }`}
                                      disabled={currentStatus === status}
                                    >
                                      <span className={`inline-block w-3 h-3 rounded-full mr-2 ${badgeClass(status).replace('text-', 'bg-').replace('-800', '-500').replace('-100', '-200')}`}></span>
                                      {labelOf(status)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        —
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FactoryDashboard;
