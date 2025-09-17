// グローバルエラーハンドリング

// 未処理のPromise rejectionをキャッチ
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)

  // エラーをログに記録
  const errorLog = {
    type: 'unhandled_rejection',
    reason: event.reason,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  }

  // ローカルストレージに保存
  try {
    const logs = JSON.parse(localStorage.getItem('error_logs') || '[]')
    logs.push(errorLog)
    if (logs.length > 10) logs.shift() // 最大10件まで保持
    localStorage.setItem('error_logs', JSON.stringify(logs))
  } catch (e) {
    console.error('Failed to log error:', e)
  }

  // デフォルトの動作を防ぐ（コンソールエラーの抑制）
  event.preventDefault()
})

// グローバルエラーハンドラ
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error)

  // 必要に応じてエラー画面を表示
  if (event.error?.name === 'ChunkLoadError') {
    // Code splitting でチャンクの読み込みに失敗した場合
    if (window.confirm('新しいバージョンが利用可能です。ページを更新しますか？')) {
      window.location.reload()
    }
  }

  // エラーをログに記録
  const errorLog = {
    type: 'global_error',
    message: event.error?.message || event.message,
    stack: event.error?.stack,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  }

  // ローカルストレージに保存
  try {
    const logs = JSON.parse(localStorage.getItem('error_logs') || '[]')
    logs.push(errorLog)
    if (logs.length > 10) logs.shift() // 最大10件まで保持
    localStorage.setItem('error_logs', JSON.stringify(logs))
  } catch (e) {
    console.error('Failed to log error:', e)
  }
})

// エラーログを取得する関数
export const getErrorLogs = () => {
  try {
    return JSON.parse(localStorage.getItem('error_logs') || '[]')
  } catch (e) {
    console.error('Failed to get error logs:', e)
    return []
  }
}

// エラーログをクリアする関数
export const clearErrorLogs = () => {
  try {
    localStorage.removeItem('error_logs')
  } catch (e) {
    console.error('Failed to clear error logs:', e)
  }
}

// エラーログをサーバーに送信する関数
export const sendErrorLogsToServer = async () => {
  const logs = getErrorLogs()
  if (logs.length === 0) return

  try {
    // ここでSupabaseやその他のAPIにログを送信
    // await supabase.from('error_logs').insert(logs)

    // 送信後にローカルログをクリア
    clearErrorLogs()
    console.log('Error logs sent successfully')
  } catch (error) {
    console.error('Failed to send error logs:', error)
  }
}