// 開発者向けユーティリティ関数

// ローカルストレージにサンプルデータを追加
export function initializeSampleData() {
  const sampleData = {
    user_preferences: {
      theme: 'dark',
      language: 'ja',
      notifications: true
    },
    cart_backup: [
      {
        id: 'cart-item-1',
        work_id: 'demo-work-1',
        quantity: 2,
        price: 2500
      }
    ],
    favorites_backup: [
      'demo-work-1',
      'demo-work-2',
      'demo-work-3'
    ],
    recent_searches: [
      '桜',
      '夕暮れ',
      'アート'
    ],
    view_history: [
      {
        work_id: 'demo-work-1',
        viewed_at: new Date().toISOString(),
        duration: 45000
      }
    ]
  }

  Object.entries(sampleData).forEach(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value))
  })

  console.log('📊 サンプルデータをローカルストレージに追加しました')
}

// ローカルストレージをクリア
export function clearLocalStorage() {
  if (confirm('ローカルストレージをすべてクリアしますか？')) {
    localStorage.clear()
    console.log('🗑️ ローカルストレージをクリアしました')
  }
}

// セッションストレージをクリア
export function clearSessionStorage() {
  if (confirm('セッションストレージをすべてクリアしますか？')) {
    sessionStorage.clear()
    console.log('🗑️ セッションストレージをクリアしました')
  }
}

// ローカルデータのエクスポート
export function exportAllData() {
  const data = {
    localStorage: {},
    sessionStorage: {},
    timestamp: new Date().toISOString()
  }

  // LocalStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      try {
        data.localStorage[key] = JSON.parse(localStorage.getItem(key) || '')
      } catch {
        data.localStorage[key] = localStorage.getItem(key)
      }
    }
  }

  // SessionStorage
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i)
    if (key) {
      try {
        data.sessionStorage[key] = JSON.parse(sessionStorage.getItem(key) || '')
      } catch {
        data.sessionStorage[key] = sessionStorage.getItem(key)
      }
    }
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `photo-rank-data-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 開発者コンソール用のグローバル関数を登録
export function registerDevUtils() {
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    (window as any).devUtils = {
      initializeSampleData,
      clearLocalStorage,
      clearSessionStorage,
      exportAllData,
      goToDataViewer: () => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'local-data' } }))
      }
    }
    console.log('🔧 開発者ユーティリティを利用できます:')
    console.log('  devUtils.initializeSampleData() - サンプルデータを追加')
    console.log('  devUtils.clearLocalStorage() - ローカルストレージをクリア')
    console.log('  devUtils.clearSessionStorage() - セッションストレージをクリア')
    console.log('  devUtils.exportAllData() - データをエクスポート')
    console.log('  devUtils.goToDataViewer() - データビューアーを開く')
  }
}