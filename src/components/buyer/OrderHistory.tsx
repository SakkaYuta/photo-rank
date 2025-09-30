import React, { useEffect, useState } from 'react'
import { supabase } from '../../services/supabaseClient'
import { OrderService } from '../../services/order.service'
import { PurchaseService } from '../../services/purchase.service'
import type { Purchase, OrderStatus } from '../../types/work.types'
import Modal from '@/components/ui/Modal'
import { RefundService } from '@/services/refund.service'
import { useToast } from '@/contexts/ToastContext'
import { useUserRole } from '@/hooks/useUserRole'
import { ArrowLeft } from 'lucide-react'

type OrderWithWork = Purchase & { work: any }

export function OrderHistory() {
  const [orders, setOrders] = useState<OrderWithWork[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<OrderWithWork | null>(null)
  const [statusHistory, setStatusHistory] = useState<OrderStatus[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const { userType } = useUserRole()
  const { showToast } = useToast()
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState<number>(0)
  const [refundReason, setRefundReason] = useState<string>('')
  const [submittingRefund, setSubmittingRefund] = useState(false)

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setOrders([])
        return
      }

      const orderHistory = await OrderService.getOrderHistory(user.id)
      setOrders(orderHistory)
    } catch (error) {
      console.error('Failed to load orders:', error)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const openOrderDetail = async (order: OrderWithWork) => {
    setSelectedOrder(order)
    setLoadingDetail(true)
    try {
      const history = await OrderService.getStatusHistory(order.id)
      setStatusHistory(history)
      setRefundAmount(Number(order.amount || order.price || 0))
      setRefundReason('')
    } catch (error) {
      console.error('Failed to load status history:', error)
      setStatusHistory([])
    } finally {
      setLoadingDetail(false)
    }
  }

  const getTrackingUrl = (order: OrderWithWork) => {
    return OrderService.generateTrackingUrl(order.tracking_number || '')
  }

  const generateMockTracking = async () => {
    try {
      await PurchaseService.setMockTrackingForRecentPurchases()
      await loadOrders() // 再読み込みして更新を反映
    } catch (error) {
      console.error('Failed to generate mock tracking:', error)
    }
  }

  const getDashboardRoute = () => {
    switch (userType) {
      case 'creator':
        return 'creator-dashboard'
      case 'factory':
        return 'factory-dashboard'
      case 'organizer':
        return 'organizer-dashboard'
      default:
        return 'general-dashboard'
    }
  }

  if (loading) {
    return <div className="p-4">読み込み中...</div>
  }

  if (orders.length === 0) {
    return (
      <div className="p-4">
        <div className="mb-4">
          <button
            onClick={() => import('@/utils/navigation').then(m => m.navigate(getDashboardRoute()))}
            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            マイダッシュボードに戻る
          </button>
        </div>
        <div className="text-center text-gray-500">
          <div className="mb-4">📦</div>
          <div>注文履歴はありません</div>
          <div className="text-sm mt-2">商品を購入すると、こちらに履歴が表示されます</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="mb-4">
        <button
          onClick={() => import('@/utils/navigation').then(m => m.navigate(getDashboardRoute()))}
          className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          マイダッシュボードに戻る
        </button>
      </div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold jp-text">注文履歴</h2>
        {orders.length > 0 && (
          <button
            className="btn btn-outline btn-sm"
            onClick={generateMockTracking}
          >
            追跡番号を生成（テスト用）
          </button>
        )}
      </div>

      <div className="space-y-3">
        {orders.map((order) => (
          <div
            key={order.id}
            className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            onClick={() => openOrderDetail(order)}
          >
            <div className="flex items-start gap-3">
              <img
                src={order.work?.thumbnail_url || order.work?.image_url}
                alt={order.work?.title}
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-sm jp-text truncate">
                    {order.work?.title}
                  </h3>
                  <div className="text-sm font-bold">
                    ¥{(order.amount || order.price).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">
                    {OrderService.getStatusIcon(order.status)}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {OrderService.getStatusLabel(order.status)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    注文日: {new Date(order.purchased_at || order.created_at || '').toLocaleDateString('ja-JP')}
                  </span>
                  {order.tracking_number && (
                    <span className="text-blue-600 dark:text-blue-400">
                      追跡番号: {order.tracking_number}
                    </span>
                  )}
                </div>

                {/* プログレスバー */}
                <div className="mt-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${OrderService.getProgressPercentage(order.status)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 注文詳細モーダル */}
      {selectedOrder && (
        <Modal
          isOpen={true}
          onClose={() => {
            setSelectedOrder(null)
            setStatusHistory([])
          }}
          title="注文詳細"
          initialFocusSelector="[data-close]"
        >
          <div className="space-y-4">
            {/* 商品情報 */}
            <div className="flex items-start gap-3 pb-4 border-b">
              <img
                src={selectedOrder.work?.thumbnail_url || selectedOrder.work?.image_url}
                alt={selectedOrder.work?.title}
                className="w-20 h-20 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h3 className="font-semibold jp-text mb-1">
                  {selectedOrder.work?.title}
                </h3>
                <div className="text-lg font-bold mb-2">
                  ¥{(selectedOrder.amount || selectedOrder.price).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  注文番号: {selectedOrder.id.slice(0, 8)}...
                </div>
              </div>
            </div>

            {/* 配送情報 */}
            {selectedOrder.tracking_number && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">追跡番号</div>
                    <div className="text-lg font-mono">
                      {selectedOrder.tracking_number}
                    </div>
                  </div>
                  {getTrackingUrl(selectedOrder) && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        const url = getTrackingUrl(selectedOrder)
                        if (url) window.open(url, '_blank', 'noopener,noreferrer')
                      }}
                    >
                      配送状況を確認
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ステータス履歴 */}
            <div>
              <h4 className="font-medium mb-3">配送状況</h4>
              {loadingDetail ? (
                <div className="text-sm text-gray-500">読み込み中...</div>
              ) : (
                <div className="space-y-3">
                  {statusHistory.map((status, index) => (
                    <div
                      key={status.id}
                      className="flex items-start gap-3"
                    >
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm">
                          {OrderService.getStatusIcon(status.status)}
                        </div>
                        {index < statusHistory.length - 1 && (
                          <div className="w-0.5 h-8 bg-gray-200 dark:bg-gray-700 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="font-medium text-sm">
                          {OrderService.getStatusLabel(status.status)}
                        </div>
                        {status.message && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {status.message}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(status.created_at).toLocaleString('ja-JP')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 支払い手順（オフライン決済など） */}
            {selectedOrder.payment_instructions && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="font-medium mb-1">支払い手順</div>
                <pre className="whitespace-pre-wrap text-sm text-gray-800">
                  {typeof selectedOrder.payment_instructions === 'string'
                    ? selectedOrder.payment_instructions
                    : JSON.stringify(selectedOrder.payment_instructions, null, 2)}
                </pre>
              </div>
            )}

            {/* アクション */}
            <div className="pt-4 border-t">
              <div className="flex gap-2 justify-end">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => { import('@/utils/navigation').then(m => m.navigate('trending')) }}
                >
                  同じ商品を再注文
                </button>
                {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                  <button
                    className="btn btn-outline btn-sm text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => {
                      // キャンセル機能（実装は今後）
                      alert('キャンセル機能は準備中です')
                    }}
                  >
                    注文をキャンセル
                  </button>
                )}
                {/* 返金申請（簡易版: 配達済みなど一定条件で表示） */}
                {(['delivered','shipped','processing'] as string[]).includes(selectedOrder.status as any) && (
                  <button className="btn btn-primary btn-sm" onClick={() => setRefundOpen(true)}>返金を申請</button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 返金リクエストモーダル */}
      {refundOpen && selectedOrder && (
        <Modal isOpen={refundOpen} onClose={() => setRefundOpen(false)} title="返金を申請">
          <div className="space-y-4">
            <div className="text-sm text-gray-700">
              注文ID: <span className="font-mono">{selectedOrder.id.slice(0,8)}...</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs text-gray-600">返金金額（円）</span>
                <input type="number" min={0} className="input input-bordered w-full" value={refundAmount}
                  onChange={e => setRefundAmount(Math.max(0, Number(e.target.value||0)))} />
              </label>
              <label className="block md:col-span-2">
                <span className="block text-xs text-gray-600">理由（任意）</span>
                <input className="input input-bordered w-full" value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="不良・誤配送・重複決済 など" />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-outline btn-sm" onClick={() => setRefundOpen(false)}>閉じる</button>
              <button className={`btn btn-primary btn-sm ${submittingRefund?'btn-disabled':''}`} disabled={submittingRefund}
                onClick={async () => {
                  try {
                    setSubmittingRefund(true)
                    await RefundService.requestRefund(selectedOrder.id, Math.floor(refundAmount||0), refundReason || undefined)
                    showToast({ message: '返金リクエストを送信しました', variant: 'success' })
                    setRefundOpen(false)
                  } catch (e: any) {
                    showToast({ message: e?.message || '返金リクエストの送信に失敗しました', variant: 'error' })
                  } finally {
                    setSubmittingRefund(false)
                  }
                }}
              >{submittingRefund ? '送信中...' : '送信'}</button>
            </div>
            <div className="text-xs text-gray-500">
              返金方法は決済手段により異なります。カード決済はカード会社経由、コンビニ/銀行振込は銀行振込での返金となります。
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
