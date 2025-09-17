import React, { useState, useEffect } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'

export const NetworkErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
    window.location.reload()
  }

  if (!isOnline) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12">
            <WifiOff className="w-16 h-16 text-gray-400 mx-auto mb-4" />

            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              インターネット接続がありません
            </h2>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              ネットワーク接続を確認してください
            </p>

            {retryCount > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                再試行回数: {retryCount}
              </p>
            )}

            <Button
              variant="primary"
              onClick={handleRetry}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              再試行
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}