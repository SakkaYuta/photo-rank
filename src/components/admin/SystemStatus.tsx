import React, { useEffect, useState } from 'react'
import { CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'

type Status = 'healthy' | 'warning' | 'error'
type Item = { name: string; status: Status; message?: string; value?: number }

export const SystemStatus: React.FC<{ refreshInterval?: number }> = ({ refreshInterval = 30000 }) => {
  const [statuses, setStatuses] = useState<Item[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  const check = async () => {
    setIsRefreshing(true)
    try {
      // 認証付きの Edge Functions 呼び出しに一本化
      let data: any | null = null
      try {
        const inv = await (await import('@/services/supabaseClient')).supabase.functions.invoke('admin-metrics', { body: {} })
        if (!inv.error) data = inv.data
      } catch {}
      if (!data) throw new Error('metrics unavailable')
      const s: Item[] = [
        {
          name: '決済システム',
          status: data.metrics.successRate > 90 ? 'healthy' : data.metrics.successRate > 70 ? 'warning' : 'error',
          message: `成功率: ${data.metrics.successRate}%`,
          value: data.metrics.successRate,
        },
        {
          name: '在庫ロック',
          status: data.metrics.expiredLocks === 0 ? 'healthy' : data.metrics.expiredLocks < 5 ? 'warning' : 'error',
          message: `期限切れ: ${data.metrics.expiredLocks}件`,
          value: data.metrics.expiredLocks,
        },
        {
          name: 'Webhook処理',
          status: (data.metrics.recentErrors?.length || 0) === 0 ? 'healthy' : (data.metrics.recentErrors?.length || 0) < 5 ? 'warning' : 'error',
          message: `エラー: ${(data.metrics.recentErrors?.length || 0)}件`,
          value: data.metrics.recentErrors?.length || 0,
        },
      ]
      setStatuses(s)
      setLastUpdated(new Date())
    } catch (e) {
      console.error('status error', e)
      setStatuses([{ name: 'システム', status: 'error', message: 'ステータス取得失敗' }])
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    check()
    const t = setInterval(check, refreshInterval)
    return () => clearInterval(t)
  }, [refreshInterval])

  const Icon = (status: Status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
    }
  }

  const color = (status: Status) => status === 'healthy' ? 'bg-green-50 border-green-200' : status === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'

  return (
    <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">システムステータス</h3>
        <button onClick={check} disabled={isRefreshing} className="text-gray-500 hover:text-gray-700 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="space-y-3">
        {statuses.map((it) => (
          <div key={it.name} className={`flex items-center justify-between rounded-lg border p-3 ${color(it.status)}`}>
            <div className="flex items-center gap-3">
              {Icon(it.status)}
              <div>
                <p className="font-medium">{it.name}</p>
                {it.message && <p className="text-sm text-gray-600 dark:text-gray-400">{it.message}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-gray-500">最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}</p>
    </div>
  )
}
