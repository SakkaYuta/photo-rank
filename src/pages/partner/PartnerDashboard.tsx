import { useEffect, useState } from 'react'
import { usePartnerAuth } from '../../hooks/usePartnerAuth'
import { getPartnerStats } from '../../services/partner.service'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'

type PartnerStats = {
  activeProducts: number
  totalOrders: number
  pendingOrders: number
  completedOrders: number
}

export function PartnerDashboard() {
  const { partner } = usePartnerAuth()
  const [stats, setStats] = useState<PartnerStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!partner) return
    
    async function fetchStats() {
      try {
        const data = await getPartnerStats(partner.id)
        setStats(data)
      } catch (error) {
        console.error('Failed to fetch partner stats:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchStats()
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">製造パートナーダッシュボード</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {partner.name}
        </div>
      </div>

      {/* Partner Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold mb-4">パートナー情報</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              会社名
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {partner.company_name || partner.name}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              連絡先メール
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {partner.contact_email}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              平均評価
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {partner.avg_rating.toFixed(1)} / 5.0 ({partner.ratings_count}件)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              ステータス
            </label>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              承認済み
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 text-sm font-semibold">
                    📦
                  </span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  活動中の商品
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {stats.activeProducts}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <span className="text-green-600 dark:text-green-400 text-sm font-semibold">
                    📋
                  </span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  総注文数
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {stats.totalOrders}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                  <span className="text-orange-600 dark:text-orange-400 text-sm font-semibold">
                    ⏳
                  </span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  処理中
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {stats.pendingOrders}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 dark:text-purple-400 text-sm font-semibold">
                    ✅
                  </span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  完了
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {stats.completedOrders}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold mb-4">クイックアクション</h2>
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary">
            新しい商品を追加
          </button>
          <button className="btn btn-outline">
            未処理の注文を確認
          </button>
          <button className="btn btn-outline">
            レビューを確認
          </button>
        </div>
      </div>
    </div>
  )
}