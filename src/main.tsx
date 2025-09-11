import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import * as Sentry from '@sentry/react'
import { initSentry } from './lib/monitoring'

initSentry()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div>エラーが発生しました。ページを再読み込みしてください。</div>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
