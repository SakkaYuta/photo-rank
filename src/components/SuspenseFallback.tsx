import React from 'react'
import { Loader2 } from 'lucide-react'

export const SuspenseFallback: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 dark:text-primary-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
      </div>
    </div>
  )
}