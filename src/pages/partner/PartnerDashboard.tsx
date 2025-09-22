import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import { usePartnerAuth } from '../../hooks/usePartnerAuth'
import { useNav } from '@/contexts/NavContext'
import { getPartnerStats } from '../../services/partner.service'
import { useOptimizedQuery } from '../../hooks/useOptimizedQuery'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { PartnerReviews } from '../../components/partner/PartnerReviews'
import { Star, Package, Bell, CheckCircle, AlertCircle, Clock, RotateCcw } from 'lucide-react'
import { NotificationService } from '../../services/notification.service'
import { Card } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { supabase } from '../../services/supabaseClient'

type PartnerStats = {
  activeProducts: number
  totalOrders: number
  pendingOrders: number
  completedOrders: number
  averageRating: number
  totalReviews: number
}

type NotificationStats = {
  total_24h: number
  sent_24h: number
  failed_24h: number
  pending_24h: number
  retry_24h: number
}

type PartnerNotification = {
  id: string
  notification_type: string
  status: 'pending' | 'sent' | 'failed' | 'retry'
  attempts: number
  sent_at?: string
  error_message?: string
  created_at: string
  payload: any
}

export function PartnerDashboard() {
  const { partner } = usePartnerAuth()
  const { navigate } = useNav()
  const [stats, setStats] = useState<PartnerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [notifications, setNotifications] = useState<PartnerNotification[]>([])
  const [notificationStats, setNotificationStats] = useState<NotificationStats | null>(null)
  const [notificationsLoading, setNotificationsLoading] = useState(true)

  useEffect(() => {
    if (!partner) return

    async function fetchStats() {
      try {
        const data = await getPartnerStats(partner!.id)
        setStats(data)
      } catch (error) {
        console.error('Failed to fetch partner stats:', error)
      } finally {
        setLoading(false)
      }
    }

    async function fetchRecentOrders() {
      try {
        const { data, error } = await supabase
          .from('manufacturing_orders')
          .select(`
            *,
            factory_products(product_type),
            manufacturing_partners(name)
          `)
          .eq('partner_id', partner!.id)
          .order('created_at', { ascending: false })
          .limit(5)

        if (data) {
          setRecentOrders(data)
        }
      } catch (error) {
        console.error('Failed to fetch recent orders:', error)
      } finally {
        setOrdersLoading(false)
      }
    }

    async function fetchNotifications() {
      try {
        const data = await NotificationService.getPartnerNotifications(partner!.id, 10)
        setNotifications(data || [])
      } catch (error) {
        console.error('Failed to fetch notifications:', error)
      } finally {
        setNotificationsLoading(false)
      }
    }

    async function fetchNotificationStats() {
      try {
        const s = await NotificationService.getNotificationStats(partner!.id)
        // 表示仕様に合わせる場合はここで 24h のロジックへ変換
        setNotificationStats({
          total_24h: s.total,
          sent_24h: s.sent,
          failed_24h: s.failed,
          pending_24h: s.pending,
          retry_24h: s.retry,
        })
      } catch (error) {
        console.error('Failed to fetch notification stats:', error)
      }
    }

    fetchStats()
    fetchRecentOrders()
    fetchNotifications()
    fetchNotificationStats()
  }, [partner])

  if (!partner) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">製造パートナーダッシュボード</h1>
          <p className="text-gray-600 dark:text-gray-400">
            製造パートナーとして登録されていません。
          </p>
        </div>
      </div>
    )
  }

  if (partner.status === 'pending') {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">製造パートナーダッシュボード</h1>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200">
              パートナー申請は審査中です。承認まで今しばらくお待ちください。
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (partner.status === 'suspended') {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">製造パートナーダッシュボード</h1>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">
              アカウントが停止されています。サポートまでお問い合わせください。
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center">
          <LoadingSpinner />
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-3xl font-bold">製造パートナーダッシュボード</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {partner.name}
        </div>
      </div>

      {/* Partner Info Card */}
      <Card>
        <Card.Header>
          <h2 className="text-xl font-semibold">パートナー情報</h2>
        </Card.Header>
        <Card.Body>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">会社名</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{partner.company_name || partner.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">連絡先メール</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{partner.contact_email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">平均評価</label>
              <div className="mt-1 flex items-center gap-1">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${star <= Math.round(stats?.averageRating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-900 dark:text-gray-100">{stats?.averageRating?.toFixed(1) || '0.0'} ({stats?.totalReviews || 0}件)</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">ステータス</label>
              <Badge variant={partner.status === 'approved' ? 'approved' : partner.status === 'pending' ? 'pending' : 'suspended'}>
                {partner.status}
              </Badge>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="rounded-lg p-6 transition-base hover-lift bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-soft">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">📦</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-white/80">
                  活動中の商品
                </p>
                <p className="text-2xl font-semibold">
                  {stats.activeProducts}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg p-6 transition-base hover-lift bg-gradient-to-r from-green-500 to-green-600 text-white shadow-soft">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">📋</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-white/80">
                  総注文数
                </p>
                <p className="text-2xl font-semibold">
                  {stats.totalOrders}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg p-6 transition-base hover-lift bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-soft">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">⏳</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-white/80">
                  処理中
                </p>
                <p className="text-2xl font-semibold">
                  {stats.pendingOrders}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg p-6 transition-base hover-lift bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-soft">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">✅</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-white/80">
                  完了
                </p>
                <p className="text-2xl font-semibold">
                  {stats.completedOrders}
                </p>
              </div>
            </div>
          </div>

          {/* Notification Stats Card */}
          {notificationStats && (
            <div className="rounded-lg p-6 transition-base hover-lift bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-soft">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Bell className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-white/80">
                    通知 (24h)
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-semibold">
                      {notificationStats.total_24h}
                    </p>
                    <div className="flex text-xs">
                      <span className="text-white/90">✓{notificationStats.sent_24h}</span>
                      {notificationStats.failed_24h > 0 && (
                        <span className="ml-1 text-white/90">✗{notificationStats.failed_24h}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <Card.Header>
          <h2 className="text-xl font-semibold">クイックアクション</h2>
        </Card.Header>
        <Card.Body>
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary transition-base hover-lift">新しい商品を追加</button>
            <button className="btn btn-outline transition-base hover-lift">未処理の注文を確認</button>
            <button
              className="btn btn-outline transition-base hover-lift"
              onClick={() => navigate('search')}
            >
              バトルを探す
            </button>
          </div>
        </Card.Body>
      </Card>

      {/* Manufacturing Orders Section */}
      <Card>
        <Card.Header>
          <h2 className="text-xl font-semibold">製造発注管理</h2>
        </Card.Header>
        <Card.Body>
          {ordersLoading ? (
            <div className="text-center py-4">
              <span className="text-gray-500">読み込み中...</span>
            </div>
          ) : recentOrders.length > 0 ? (
            <>
              <div className="space-y-3">
                {recentOrders.map(order => (
                  <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg transition-base hover-lift">
                    <div>
                      <p className="font-medium">{order.factory_products?.product_name || order.factory_products?.product_type}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {order.quantity}個 × ¥{order.unit_price?.toLocaleString() || 'N/A'}
                      </p>
                    </div>
                    <Badge variant={
                      order.status === 'shipped' ? 'success' :
                      order.status === 'in_production' ? 'warning' :
                      order.status === 'accepted' ? 'primary' :
                      'secondary'
                    }>
                      {order.status === 'submitted' && '発注済み'}
                      {order.status === 'accepted' && '受注確認'}
                      {order.status === 'in_production' && '製造中'}
                      {order.status === 'shipped' && '発送済み'}
                    </Badge>
                  </div>
                ))}
              </div>

              <Button
                variant="primary"
                className="mt-4 w-full transition-base hover-lift"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('navigate', {
                    detail: { view: 'factory-order' }
                  }))
                }}
              >
                <Package className="w-4 h-4 mr-2" />
                新規製造発注
              </Button>
            </>
          ) : (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">製造発注はまだありません</p>
              <Button
                variant="primary"
                className="transition-base hover-lift"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('navigate', {
                    detail: { view: 'factory-order' }
                  }))
                }}
              >
                最初の発注を作成
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Notifications Section */}
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              <h2 className="text-xl font-semibold">通知履歴</h2>
            </div>
            {notificationStats && (
              <div className="flex gap-2">
                <Badge variant="secondary">
                  24時間: {notificationStats.total_24h}件
                </Badge>
                <Badge variant="success">
                  成功: {notificationStats.sent_24h}件
                </Badge>
                {notificationStats.failed_24h > 0 && (
                  <Badge variant="error">
                    失敗: {notificationStats.failed_24h}件
                  </Badge>
                )}
              </div>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          {notificationsLoading ? (
            <div className="text-center py-4">
              <span className="text-gray-500">読み込み中...</span>
            </div>
          ) : notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.map(notification => (
                <div key={notification.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg transition-base hover-lift">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {notification.notification_type === 'order_created' && '新規注文'}
                        {notification.notification_type === 'order_updated' && '注文更新'}
                        {notification.notification_type === 'order_cancelled' && '注文キャンセル'}
                        {notification.notification_type === 'payment_received' && '支払い受領'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(notification.created_at).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    {notification.error_message && (
                      <p className="text-sm text-red-600">{notification.error_message}</p>
                    )}
                    <p className="text-sm text-gray-600">
                      試行回数: {notification.attempts}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {notification.status === 'sent' && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {notification.status === 'failed' && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    {notification.status === 'pending' && (
                      <Clock className="w-5 h-5 text-yellow-500" />
                    )}
                    {notification.status === 'retry' && (
                      <RotateCcw className="w-5 h-5 text-blue-500" />
                    )}
                    <Badge variant={
                      notification.status === 'sent' ? 'success' :
                      notification.status === 'failed' ? 'error' :
                      notification.status === 'pending' ? 'warning' :
                      'secondary'
                    }>
                      {notification.status === 'sent' && '送信済み'}
                      {notification.status === 'failed' && '失敗'}
                      {notification.status === 'pending' && '保留中'}
                      {notification.status === 'retry' && 'リトライ中'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">通知履歴はまだありません</p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Reviews Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <PartnerReviews partnerId={partner.id} />
        </div>
      </div>
    </div>
  )
}
