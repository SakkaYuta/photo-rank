import { useEffect, useState } from 'react'
import { useFavorites } from '@/contexts/FavoritesContext'
import { listWorksByIds } from '@/services/work.service'
import type { Work } from '@/types/work.types'
import { useToast } from '@/contexts/ToastContext'
import { SAMPLE_WORKS } from '@/sample/worksSamples'
import { resolveImageUrl } from '@/utils/imageFallback'
import { defaultImages } from '@/utils/defaultImages'
import { TrendingUp, Heart as HeartIcon, ShoppingCart, ArrowLeft } from 'lucide-react'
import { useUserRole } from '@/hooks/useUserRole'
import { isDemoEnabled } from '@/utils/demo'

export function Favorites() {
  const { ids, toggle } = useFavorites()
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  // 購入モーダルはグッズ化フローに切り替えるため廃止
  const { showToast } = useToast()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'new' | 'priceAsc' | 'priceDesc' | 'title'>('new')
  const isSample = isDemoEnabled()
  const { userType } = useUserRole()

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        // サンプルモードでお気に入りが空の場合は、サンプル作品を表示
        if (isSample && ids.size === 0) {
          if (active) setWorks(SAMPLE_WORKS.slice(0, 8) as any)
        } else {
          const ws = await listWorksByIds(Array.from(ids))
          if (active) setWorks(ws)
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [ids])

  const filtered = works.filter(w => {
    if (!q.trim()) return true
    const key = `${w.title}`.toLowerCase()
    return key.includes(q.toLowerCase())
  })
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'new') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sort === 'priceAsc') return a.price - b.price
    if (sort === 'priceDesc') return b.price - a.price
    return a.title.localeCompare(b.title)
  })

  const formatRemaining = (createdAt?: string, endAt?: string | null) => {
    try {
      let end: Date
      if (endAt) end = new Date(endAt)
      else {
        const start = createdAt ? new Date(createdAt) : new Date()
        end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
      }
      const diff = end.getTime() - Date.now()
      if (diff <= 0) return '販売終了'
      const days = Math.floor(diff / (24 * 60 * 60 * 1000))
      const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
      return `残り ${days}日${hours}時間`
    } catch { return '' }
  }

  const handleGoodsify = (w: Work) => {
    const product = {
      id: w.id,
      title: w.title,
      description: (w as any).description || (w as any).message || '',
      price: w.price,
      image_url: w.thumbnail_url || w.image_url,
      creator_id: w.creator_id,
      creator_name: '',
      category: (w as any).category || 'other',
      views: 0,
      likes: 0,
      sales: 0,
      rating: 0,
      created_at: w.created_at,
      sale_end_at: (w as any).sale_end_at || null,
      is_active: true,
      stock_quantity: 0,
      product_types: []
    }
    try {
      const encoded = encodeURIComponent(JSON.stringify(product))
      import('@/utils/navigation').then(m => m.navigate('goods-item-selector', { productId: w.id, data: encoded }))
      showToast({ message: 'グッズアイテムを選択してください', variant: 'success' })
    } catch {
      import('@/utils/navigation').then(m => m.navigate('goods-item-selector'))
    }
  }

  const getDashboardRoute = () => {
    switch (userType) {
      case 'creator':
        return 'creator-dashboard'
      case 'factory':
        return 'factory-dashboard'
      case 'organizer':
        return 'organizer-dashboard'
      default:
        return 'general-dashboard'
    }
  }

  if (loading) return <div className="p-4">読み込み中...</div>

  return (
    <div className="p-4">
      <div className="mb-4">
        <button
          onClick={() => import('@/utils/navigation').then(m => m.navigate(getDashboardRoute()))}
          className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          マイダッシュボードに戻る
        </button>
      </div>
      <div className="mb-3 flex items-center gap-2">
        <input
          aria-label="お気に入り検索"
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900"
          placeholder="タイトルで検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="並び替え"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900"
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
        >
          <option value="new">新着順</option>
          <option value="priceAsc">価格が安い順</option>
          <option value="priceDesc">価格が高い順</option>
          <option value="title">タイトル順</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sorted.map(w => (
        <div key={w.id} className="rounded-xl border bg-white overflow-hidden hover:shadow transition-base">
          <div className="aspect-square bg-gray-100">
            <img src={resolveImageUrl(w.thumbnail_url || w.image_url, [defaultImages.work, defaultImages.product])} alt={w.title} className="w-full h-full object-cover" />
          </div>
          <div className="p-3">
            <p className="font-semibold text-gray-900 line-clamp-1">{w.title}</p>
            <p className="text-xs text-red-600 mt-0.5">{formatRemaining(w.created_at, (w as any).sale_end_at)}</p>
            <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />0</span>
              <span className="flex items-center gap-1"><HeartIcon className="w-3 h-3" />{/* お気に入り数は非表示/0 */}0</span>
              <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" />0</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => handleGoodsify(w)}
                className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
              >
                グッズ化する
              </button>
              <button
                onClick={() => { toggle(w.id); showToast({ variant: 'success', message: 'お気に入りを解除しました' }) }}
                className="px-3 py-2 rounded-lg border text-sm text-gray-700 hover:bg-gray-50"
              >解除</button>
            </div>
          </div>
        </div>
      ))}
      {sorted.length === 0 && (
        <div className="p-4 text-gray-500">お気に入りはまだありません。</div>
      )}
      </div>
    </div>
  )}

export default Favorites
