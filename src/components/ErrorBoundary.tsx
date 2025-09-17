import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // エラーログをコンソールに出力
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // エラー情報を状態に保存
    this.setState({
      error,
      errorInfo,
    })

    // カスタムエラーハンドラがあれば呼び出し
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // 本番環境ではエラートラッキングサービスに送信
    if (import.meta.env.PROD) {
      this.logErrorToService(error, errorInfo)
    }
  }

  logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // Sentry、LogRocket、Bugsnag などのサービスにエラーを送信
    // 例: Sentry.captureException(error, { extra: errorInfo })

    // Supabaseにエラーログを保存することも可能
    const errorLog = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }

    // ローカルストレージに一時保存（後で送信）
    try {
      const logs = JSON.parse(localStorage.getItem('error_logs') || '[]')
      logs.push(errorLog)
      if (logs.length > 10) logs.shift() // 最大10件まで保持
      localStorage.setItem('error_logs', JSON.stringify(logs))
    } catch (e) {
      console.error('Failed to save error log:', e)
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      // カスタムフォールバックが提供されている場合
      if (this.props.fallback) {
        return <>{this.props.fallback}</>
      }

      // デフォルトのエラー画面
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
          <Card className="max-w-2xl w-full">
            <CardContent className="text-center py-12">
              <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />

              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                申し訳ございません
              </h1>

              <p className="text-gray-600 dark:text-gray-400 mb-8">
                予期しないエラーが発生しました。<br />
                問題が解決しない場合は、サポートまでお問い合わせください。
              </p>

              {/* 開発環境でのみエラー詳細を表示 */}
              {import.meta.env.DEV && this.state.error && (
                <details className="mb-8 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    エラー詳細（開発環境のみ表示）
                  </summary>
                  <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-auto">
                    <pre className="text-xs text-red-600 dark:text-red-400">
                      <strong>Error:</strong> {this.state.error.message}
                      {'\n\n'}
                      <strong>Stack:</strong> {this.state.error.stack}
                      {'\n\n'}
                      <strong>Component Stack:</strong> {this.state.errorInfo?.componentStack}
                    </pre>
                  </div>
                </details>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  variant="primary"
                  onClick={this.handleReset}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  もう一度試す
                </Button>

                <Button
                  variant="secondary"
                  onClick={this.handleReload}
                >
                  ページを更新
                </Button>

                <Button
                  variant="ghost"
                  onClick={this.handleGoHome}
                >
                  <Home className="w-4 h-4 mr-2" />
                  ホームへ戻る
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}