import React, { useEffect, useState } from 'react'
import { TrendingUp, Heart, ShoppingCart } from 'lucide-react'
import { fetchProductsByCreator } from '@/services/productsService'
import { useToast } from '@/contexts/ToastContext'
import { resolveImageUrl } from '@/utils/imageFallback'
import { defaultImages } from '@/utils/defaultImages'

type Product = {
  id: string
  title: string
  description: string
  price: number
  image_url: string
  creator_id: string
  creator_name: string
  creator_avatar?: string
  category: string
  views: number
  likes: number
  sales: number
  rating: number
  created_at: string
  sale_end_at?: string | null
  is_trending?: boolean
  discount_percentage?: number
  stock_quantity: number
  product_types: string[]
}

const CreatorGoodsPage: React.FC = () => {
  const [creatorId, setCreatorId] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    try {
      const raw = window.location.hash.replace(/^#/, '')
      const qs = raw.split('?')[1]
      const params = new URLSearchParams(qs)
      const id = params.get('creator') || localStorage.getItem('selected_creator_id') || ''
      setCreatorId(id)
    } catch {}
  }, [])

  useEffect(() => {
    (async () => {
      if (!creatorId) { setItems([]); setLoading(false); return }
      setLoading(true)
      try {
        const products = await fetchProductsByCreator(creatorId, 48)
        setItems(products as any)
        // ベストエフォートで名前を決定
        if (products && products.length > 0) {
          setCreatorName(products[0].creator_name || '')
        }
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    })()
  }, [creatorId])

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

  const handleGoodsify = (product: Product) => {
    try {
      const encoded = encodeURIComponent(JSON.stringify(product))
      import('@/utils/navigation').then(m => m.navigate('goods-item-selector', { productId: product.id, data: encoded }))
      showToast({ message: 'グッズアイテムを選択してください', variant: 'success' })
    } catch {
      import('@/utils/navigation').then(m => m.navigate('goods-item-selector'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
          <h1 className="text-2xl font-bold text-gray-900">
            {creatorName ? `${creatorName}のグッズ化可能なコンテンツ` : 'グッズ化可能なコンテンツ'}
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="py-16 text-center text-gray-500">読み込み中...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-gray-500">作品が見つかりませんでした</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((p) => (
              <div key={p.id} className="rounded-xl border bg-white overflow-hidden hover:shadow transition-base">
                <div className="aspect-square bg-gray-100">
                  <img src={resolveImageUrl(p.image_url, [defaultImages.product, defaultImages.work])} alt={p.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="font-semibold text-gray-900 line-clamp-1">{p.title}</p>
                  <p className="text-xs text-red-600 mt-0.5">{formatRemaining(p.created_at, (p as any).sale_end_at)}</p>
                  <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
                    <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{(p.sales ?? 0).toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{p.likes ?? 0}</span>
                    <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" />{p.views ?? 0}</span>
                  </div>
                  <button
                    onClick={() => handleGoodsify(p)}
                    className="w-full mt-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
                  >
                    グッズ化する
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CreatorGoodsPage
