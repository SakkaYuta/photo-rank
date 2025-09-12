import { useEffect, useState } from 'react'
import { usePartnerAuth } from '../../hooks/usePartnerAuth'
import { getPartnerOrders, updateOrderStatus } from '../../services/partner.service'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import type { ManufacturingOrder } from '../../types'
import { Package, Truck, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

const statusColors = {
  submitted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  accepted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_production: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  shipped: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
}

const statusLabels = {
  submitted: '受注待ち',
  accepted: '受注済み',
  in_production: '製造中',
  shipped: '発送済み',
  cancelled: 'キャンセル',
  failed: '失敗'
}

const statusIcons = {
  submitted: <Clock className="w-4 h-4" />,
  accepted: <Package className="w-4 h-4" />,
  in_production: <AlertCircle className="w-4 h-4" />,
  shipped: <CheckCircle className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
  failed: <XCircle className="w-4 h-4" />
}

export function PartnerOrders() {
  const { partner } = usePartnerAuth()
  const [orders, setOrders] = useState<ManufacturingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [selectedOrder, setSelectedOrder] = useState<ManufacturingOrder | null>(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!partner) return
    
    fetchOrders()
  }, [partner])

  async function fetchOrders() {
    if (!partner) return
    
    try {
      const data = await getPartnerOrders(partner.id)
      setOrders(data)
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAcceptOrder(order: ManufacturingOrder) {
    if (updating) return
    
    setUpdating(true)
    try {
      await updateOrderStatus(order.id, 'accepted')
      await fetchOrders()
    } catch (error) {
      console.error('Failed to accept order:', error)
    } finally {
      setUpdating(false)
    }
  }

  async function handleStartProduction(order: ManufacturingOrder) {
    if (updating) return
    
    setUpdating(true)
    try {
      await updateOrderStatus(order.id, 'in_production')
      await fetchOrders()
    } catch (error) {
      console.error('Failed to start production:', error)
    } finally {
      setUpdating(false)
    }
  }

  async function handleShipOrder(order: ManufacturingOrder) {
    if (!trackingNumber.trim()) {
      alert('追跡番号を入力してください')
      return
    }
    
    if (updating) return
    
    setUpdating(true)
    try {
      await updateOrderStatus(order.id, 'shipped', { 
        tracking_number: trackingNumber.trim() 
      })
      await fetchOrders()
      setSelectedOrder(null)
      setTrackingNumber('')
    } catch (error) {
      console.error('Failed to ship order:', error)
    } finally {
      setUpdating(false)
    }
  }

  async function handleCancelOrder(order: ManufacturingOrder) {
    if (!confirm('この注文をキャンセルしてもよろしいですか？')) return
    
    setUpdating(true)
    try {
      await updateOrderStatus(order.id, 'cancelled')
      await fetchOrders()
    } catch (error) {
      console.error('Failed to cancel order:', error)
    } finally {
      setUpdating(false)
    }
  }

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true
    return order.status === filter
  })

  if (!partner || partner.status !== 'approved') {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">受注管理</h1>
          <p className="text-gray-600 dark:text-gray-400">
            承認済みパートナーのみアクセスできます。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">受注管理</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          総注文数: {orders.length}件
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'all', label: 'すべて', count: orders.length },
            { key: 'submitted', label: '受注待ち', count: orders.filter(o => o.status === 'submitted').length },
            { key: 'accepted', label: '受注済み', count: orders.filter(o => o.status === 'accepted').length },
            { key: 'in_production', label: '製造中', count: orders.filter(o => o.status === 'in_production').length },
            { key: 'shipped', label: '発送済み', count: orders.filter(o => o.status === 'shipped').length }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {filteredOrders.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-center">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">注文がありません</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {filter === 'all' ? '新しい注文をお待ちください' : `${statusLabels[filter as keyof typeof statusLabels]}の注文がありません`}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        注文ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        商品情報
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        ステータス
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        注文日
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        追跡番号
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {order.order_id.slice(-8)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {order.request_payload?.product_type || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            数量: {order.request_payload?.quantity || 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                            {statusIcons[order.status]}
                            {statusLabels[order.status]}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(order.created_at).toLocaleDateString('ja-JP')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {order.tracking_number || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            {order.status === 'submitted' && (
                              <>
                                <button
                                  onClick={() => handleAcceptOrder(order)}
                                  disabled={updating}
                                  className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-medium"
                                >
                                  受注
                                </button>
                                <button
                                  onClick={() => handleCancelOrder(order)}
                                  disabled={updating}
                                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium"
                                >
                                  拒否
                                </button>
                              </>
                            )}
                            {order.status === 'accepted' && (
                              <button
                                onClick={() => handleStartProduction(order)}
                                disabled={updating}
                                className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 font-medium"
                              >
                                製造開始
                              </button>
                            )}
                            {order.status === 'in_production' && (
                              <button
                                onClick={() => setSelectedOrder(order)}
                                disabled={updating}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                              >
                                発送
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Shipping Modal */}
          {selectedOrder && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold">注文を発送する</h2>
                </div>
                
                <div className="px-6 py-4 space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      注文ID: {selectedOrder.order_id.slice(-8)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      追跡番号 *
                    </label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="追跡番号を入力してください"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(null)
                        setTrackingNumber('')
                      }}
                      className="btn btn-outline"
                      disabled={updating}
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => handleShipOrder(selectedOrder)}
                      className="btn btn-primary flex items-center gap-2"
                      disabled={updating || !trackingNumber.trim()}
                    >
                      <Truck className="w-4 h-4" />
                      {updating ? '発送中...' : '発送完了'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}