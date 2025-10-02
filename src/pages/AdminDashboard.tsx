import React, { useEffect, useState } from 'react'
import { MetricCard } from '../components/admin/MetricCard'
import { ErrorLogTable } from '../components/admin/ErrorLogTable'
import { SystemStatus } from '../components/admin/SystemStatus'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../services/supabaseClient'
import { SAMPLE_ADMIN_METRICS } from '@/sample/adminMetrics'
import { isDemoEnabled } from '@/utils/demo'

export const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null)
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMetrics = async () => {
    try {
      if (isDemoEnabled()) {
        setMetrics({
          todayRevenue: SAMPLE_ADMIN_METRICS.todayRevenue,
          successRate: SAMPLE_ADMIN_METRICS.successRate,
          expiredLocks: SAMPLE_ADMIN_METRICS.expiredLocks,
          recentErrors: SAMPLE_ADMIN_METRICS.recentErrors,
        })
        setRevenueData(SAMPLE_ADMIN_METRICS.daily.map(d => ({
          date: new Date(d.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
          revenue: d.total_revenue,
          orders: d.total_purchases,
        })))
        return
      }
      // 認証付きの Edge Functions 呼び出しに一本化
      let data: any | null = null
      try {
        const inv = await supabase.functions.invoke('admin-metrics', { body: {} })
        if (!inv.error) data = inv.data
      } catch {}
      if (data?.metrics) setMetrics(data.metrics)

      const { data: dailyData } = await supabase
        .from('daily_summary')
        .select('*')
        .order('date', { ascending: false })
        .limit(7)
      if (dailyData) {
        setRevenueData(dailyData.reverse().map((d: any) => ({
          date: new Date(d.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
          revenue: d.total_revenue,
          orders: d.total_purchases,
        })))
      }
    } catch (e) {
      console.error('metrics fetch error', e)
      // fallback to sample on error
      setMetrics({
        todayRevenue: SAMPLE_ADMIN_METRICS.todayRevenue,
        successRate: SAMPLE_ADMIN_METRICS.successRate,
        expiredLocks: SAMPLE_ADMIN_METRICS.expiredLocks,
        recentErrors: SAMPLE_ADMIN_METRICS.recentErrors,
      })
      setRevenueData(SAMPLE_ADMIN_METRICS.daily.map(d => ({
        date: new Date(d.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
        revenue: d.total_revenue,
        orders: d.total_purchases,
      })))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    const t = setInterval(fetchMetrics, 60000)
    return () => clearInterval(t)
  }, [])

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Admin Welcome Section */}
      <div className="bg-white shadow-sm border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
              管理ダッシュボード
            </h1>
            <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400">
              システム全体の状況を監視できます
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">

        <div className="mb-6 sm:mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <MetricCard title="本日の売上" value={metrics?.todayRevenue || 0} prefix="¥" trend="up" change={12} />
          <MetricCard title="決済成功率" value={metrics?.successRate || 0} suffix="%" trend={(metrics?.successRate || 0) > 95 ? 'up' : 'down'} />
          <MetricCard title="期限切れロック" value={metrics?.expiredLocks || 0} suffix="件" trend={(metrics?.expiredLocks || 0) === 0 ? 'neutral' : 'down'} />
          <MetricCard title="エラー数" value={metrics?.recentErrors?.length || 0} suffix="件" trend={(metrics?.recentErrors?.length || 0) === 0 ? 'neutral' : 'down'} />
        </div>

        <div className="mb-6 sm:mb-8 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="rounded-lg bg-white p-4 sm:p-6 shadow-sm border border-gray-200 dark:bg-gray-900 dark:border-gray-800 lg:col-span-2">
            <h3 className="mb-4 text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">売上推移（7日間）</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" name="売上" strokeWidth={2} />
                <Line type="monotone" dataKey="orders" stroke="#10b981" name="注文数" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <SystemStatus />
          </div>
        </div>

        <ErrorLogTable errors={metrics?.recentErrors || []} onViewDetails={() => { /* noop */ }} />
      </div>
    </div>
  )
}
