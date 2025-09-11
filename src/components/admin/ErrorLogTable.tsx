import React from 'react'
import { AlertCircle, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

type ErrorLog = {
  id: string
  event_type: string
  payload: any
  created_at: string
}

export const ErrorLogTable: React.FC<{ errors: ErrorLog[]; onViewDetails?: (e: ErrorLog) => void }> = ({ errors, onViewDetails }) => {
  const getErrorMessage = (payload: any) => {
    if (typeof payload === 'string') return payload
    if (payload?.error) return payload.error
    if (payload?.message) return payload.message
    return JSON.stringify(payload).slice(0, 100)
  }

  const getSeverityColor = (eventType: string) => {
    if (eventType.includes('failed')) return 'bg-red-100 text-red-700'
    if (eventType.includes('error')) return 'bg-orange-100 text-orange-700'
    return 'bg-yellow-100 text-yellow-700'
  }

  if (!errors || errors.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-900">
        <h3 className="mb-4 text-lg font-semibold">最近のエラー</h3>
        <div className="py-8 text-center text-gray-500">
          <AlertCircle className="mx-auto mb-2 h-12 w-12 text-gray-300" />
          <p>エラーはありません</p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-900">
      <div className="border-b p-6 dark:border-gray-800">
        <h3 className="text-lg font-semibold">最近のエラー</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">時刻</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">タイプ</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">エラー内容</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {errors.map((error) => (
              <tr key={error.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                  {format(new Date(error.created_at), 'M/d HH:mm')}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getSeverityColor(error.event_type)}`}>
                    {error.event_type}
                  </span>
                </td>
                <td className="max-w-md truncate px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                  {getErrorMessage(error.payload)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                  <button onClick={() => onViewDetails?.(error)} className="text-blue-600 hover:text-blue-900">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

