import { useEffect, useState } from 'react'
import { usePartnerAuth } from '../../hooks/usePartnerAuth'
import { getPartnerOrders, updateOrderStatus } from '../../services/partner.service'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { Table } from '../../components/ui/table'
import { Badge } from '../../components/ui/badge'
import { Tabs } from '../../components/ui/tabs'
import { Button } from '../../components/ui/button'
import type { ManufacturingOrder } from '../../types'
import { Package, Truck, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Input } from '../../components/ui/input'

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

  const pendingOrders = orders.filter(o => o.status === 'submitted')
  const processingOrders = orders.filter(o => o.status === 'accepted' || o.status === 'in_production')
  const completedOrders = orders.filter(o => o.status === 'shipped')
  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true
    if (filter === 'pending') return order.status === 'submitted'
    if (filter === 'processing') return order.status === 'accepted' || order.status === 'in_production'
    if (filter === 'completed') return order.status === 'shipped'
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
      <Tabs defaultValue="all">
        <Tabs.List className="mb-2">
          <Tabs.Trigger value="all" className="mr-1" onClick={() => setFilter('all')}>すべて</Tabs.Trigger>
          <Tabs.Trigger value="pending" className="mr-1" onClick={() => setFilter('pending')}>
            新規注文
            {pendingOrders.length > 0 && (
              <Badge variant="warning" size="sm" className="ml-2">{pendingOrders.length}</Badge>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger value="processing" className="mr-1" onClick={() => setFilter('processing')}>製造中</Tabs.Trigger>
          <Tabs.Trigger value="completed" onClick={() => setFilter('completed')}>完了</Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      {loading ? (
        <div className="flex justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {filteredOrders.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-base">
              <div className="text-center">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">注文がありません</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {filter === 'all' ? '新しい注文をお待ちください' : `${statusLabels[(filter === 'pending' ? 'submitted' : filter === 'processing' ? 'accepted' : 'shipped') as keyof typeof statusLabels]}の注文がありません`}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-base">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>注文ID</Table.Head>
                    <Table.Head>商品情報</Table.Head>
                    <Table.Head>ステータス</Table.Head>
                    <Table.Head>注文日</Table.Head>
                    <Table.Head>追跡番号</Table.Head>
                    <Table.Head className="text-right">操作</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {filteredOrders.map((order) => (
                    <Table.Row key={order.id}>
                      <Table.Cell className="font-medium">{order.order_id.slice(-8)}</Table.Cell>
                      <Table.Cell>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{order.request_payload?.product_type || 'N/A'}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">数量: {order.request_payload?.quantity || 1}</div>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge variant={(order.status === 'submitted' ? 'pending' : order.status === 'shipped' ? 'success' : 'primary') as any}>
                          {statusLabels[order.status]}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="text-sm text-gray-500 dark:text-gray-400">{new Date(order.created_at).toLocaleDateString('ja-JP')}</Table.Cell>
                      <Table.Cell className="text-sm text-gray-500 dark:text-gray-400">{order.tracking_number || '-'}</Table.Cell>
                      <Table.Cell className="text-right">
                        {order.status === 'submitted' && (
                          <div className="flex items-center gap-2 justify-end">
                            <Button variant="success" size="sm" className="transition-base hover-lift" onClick={() => handleAcceptOrder(order)} disabled={updating}>受注</Button>
                            <Button variant="danger" size="sm" className="transition-base hover-lift" onClick={() => handleCancelOrder(order)} disabled={updating}>拒否</Button>
                          </div>
                        )}
                        {order.status === 'accepted' && (
                          <Button variant="secondary" size="sm" className="transition-base hover-lift" onClick={() => handleStartProduction(order)} disabled={updating}>製造開始</Button>
                        )}
                        {order.status === 'in_production' && (
                          <Button variant="primary" size="sm" className="transition-base hover-lift" onClick={() => setSelectedOrder(order)} disabled={updating}>発送</Button>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
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
                    <label htmlFor="tracking_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      追跡番号 *
                    </label>
                    <Input
                      id="tracking_number"
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
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
