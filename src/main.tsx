import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// エラーログを表示するためのコンポーネント
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('キャッチされたエラー:', event.error)
      setError(event.error)
      setHasError(true)
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Promise rejection:', event.reason)
      setError(new Error(event.reason))
      setHasError(true)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  if (hasError) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h1>アプリケーションエラー</h1>
        <p>エラーが発生しました:</p>
        <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '12px' }}>
          {error?.message}
        </pre>
        <button onClick={() => window.location.reload()}>
          ページを再読み込み
        </button>
      </div>
    )
  }

  return <>{children}</>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
