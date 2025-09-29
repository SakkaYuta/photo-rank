import React from 'react'
import { AlertCircle } from 'lucide-react'
import ErrorBoundary from './ErrorBoundary'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'

interface PartialErrorBoundaryProps {
  children: React.ReactNode
  name?: string
}

export const PartialErrorBoundary: React.FC<PartialErrorBoundaryProps> = ({
  children,
  name = 'このセクション'
}) => {
  return (
    <ErrorBoundary
      fallback={
        <Card className="p-6 text-center">
          <CardContent>
            <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400 mb-3">
              {name}の読み込みに失敗しました
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
            >
              再読み込み
            </Button>
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
