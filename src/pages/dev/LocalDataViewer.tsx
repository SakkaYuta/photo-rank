import React, { useState, useEffect } from 'react'
import { Database, Search, Eye, RefreshCw, Download, Upload, Trash2 } from 'lucide-react'
import { SAMPLE_WORKS } from '@/sample/worksSamples'

interface LocalStorageItem {
  key: string
  value: any
  size: number
}

export default function LocalDataViewer() {
  const [activeTab, setActiveTab] = useState<'sample' | 'localStorage' | 'sessionStorage'>('sample')
  const [localStorageItems, setLocalStorageItems] = useState<LocalStorageItem[]>([])
  const [sessionStorageItems, setSessionStorageItems] = useState<LocalStorageItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [isExpanded, setIsExpanded] = useState<Record<string, boolean>>({})

  // ストレージアイテムを取得
  const loadStorageItems = () => {
    // LocalStorage
    const localItems: LocalStorageItem[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        try {
          const value = localStorage.getItem(key)
          const parsedValue = value ? JSON.parse(value) : value
          localItems.push({
            key,
            value: parsedValue,
            size: new Blob([value || '']).size
          })
        } catch {
          const value = localStorage.getItem(key)
          localItems.push({
            key,
            value,
            size: new Blob([value || '']).size
          })
        }
      }
    }
    setLocalStorageItems(localItems.sort((a, b) => a.key.localeCompare(b.key)))

    // SessionStorage
    const sessionItems: LocalStorageItem[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key) {
        try {
          const value = sessionStorage.getItem(key)
          const parsedValue = value ? JSON.parse(value) : value
          sessionItems.push({
            key,
            value: parsedValue,
            size: new Blob([value || '']).size
          })
        } catch {
          const value = sessionStorage.getItem(key)
          sessionItems.push({
            key,
            value,
            size: new Blob([value || '']).size
          })
        }
      }
    }
    setSessionStorageItems(sessionItems.sort((a, b) => a.key.localeCompare(b.key)))
  }

  useEffect(() => {
    loadStorageItems()
  }, [])

  // 検索フィルタリング
  const filterItems = (items: LocalStorageItem[]) => {
    if (!searchQuery) return items
    return items.filter(item =>
      item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(item.value).toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  // アイテム展開/折りたたみ
  const toggleExpanded = (key: string) => {
    setIsExpanded(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // JSONのプリティ表示
  const formatJSON = (value: any) => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  // ファイルサイズの表示
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // ストレージアイテム削除
  const deleteStorageItem = (key: string, storage: 'local' | 'session') => {
    if (confirm(`"${key}" を削除しますか？`)) {
      if (storage === 'local') {
        localStorage.removeItem(key)
      } else {
        sessionStorage.removeItem(key)
      }
      loadStorageItems()
    }
  }

  // データエクスポート
  const exportData = () => {
    const data = {
      localStorage: localStorageItems,
      sessionStorage: sessionStorageItems,
      sampleWorks: SAMPLE_WORKS,
      timestamp: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `local-data-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const renderStorageItems = (items: LocalStorageItem[], storageType: 'local' | 'session') => (
    <div className="space-y-2">
      {filterItems(items).map((item) => (
        <div key={item.key} className="border border-gray-200 rounded-lg p-4 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleExpanded(item.key)}
                className="text-blue-600 font-mono font-semibold hover:text-blue-800"
              >
                {item.key}
              </button>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded dark:bg-gray-800">
                {formatSize(item.size)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedItem({ key: item.key, value: item.value })}
                className="p-1 text-gray-500 hover:text-blue-600"
                title="詳細表示"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteStorageItem(item.key, storageType)}
                className="p-1 text-gray-500 hover:text-red-600"
                title="削除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {isExpanded[item.key] && (
            <pre className="text-xs bg-gray-50 p-3 rounded border overflow-auto max-h-64 dark:bg-gray-900">
              {formatJSON(item.value)}
            </pre>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          {/* ヘッダー */}
          <div className="border-b border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="w-6 h-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  ローカルデータビューアー
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadStorageItems}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  title="データを再読み込み"
                >
                  <RefreshCw className="w-4 h-4" />
                  更新
                </button>
                <button
                  onClick={exportData}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                  title="データをエクスポート"
                >
                  <Download className="w-4 h-4" />
                  エクスポート
                </button>
              </div>
            </div>

            {/* 検索バー */}
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="キーまたは値で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
          </div>

          {/* タブナビゲーション */}
          <div className="border-b border-gray-200 dark:border-gray-800">
            <nav className="flex space-x-8 px-6">
              {[
                { key: 'sample', label: 'サンプルデータ', count: SAMPLE_WORKS.length },
                { key: 'localStorage', label: 'LocalStorage', count: localStorageItems.length },
                { key: 'sessionStorage', label: 'SessionStorage', count: sessionStorageItems.length }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </nav>
          </div>

          {/* コンテンツ */}
          <div className="p-6">
            {activeTab === 'sample' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">サンプル作品データ</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {SAMPLE_WORKS.filter(work =>
                    !searchQuery ||
                    work.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    work.description?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map((work) => (
                    <div key={work.id} className="border border-gray-200 rounded-lg p-4 dark:border-gray-700">
                      <img
                        src={work.image_url}
                        alt={work.title}
                        className="w-full h-32 object-cover rounded-md mb-3"
                      />
                      <h4 className="font-semibold text-sm mb-1">{work.title}</h4>
                      <p className="text-xs text-gray-600 mb-2 dark:text-gray-400">
                        {work.description}
                      </p>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-green-600 font-semibold">¥{work.price}</span>
                        <button
                          onClick={() => setSelectedItem({ key: work.id, value: work })}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          詳細
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'localStorage' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">LocalStorage ({localStorageItems.length}件)</h3>
                {renderStorageItems(localStorageItems, 'local')}
              </div>
            )}

            {activeTab === 'sessionStorage' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">SessionStorage ({sessionStorageItems.length}件)</h3>
                {renderStorageItems(sessionStorageItems, 'session')}
              </div>
            )}
          </div>
        </div>

        {/* 詳細モーダル */}
        {selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-800 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {selectedItem.key}
                  </h3>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-auto max-h-[60vh]">
                <pre className="text-sm bg-gray-50 p-4 rounded border dark:bg-gray-800">
                  {formatJSON(selectedItem.value)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}