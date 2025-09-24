import { useEffect, useState } from 'react'
import { useFavorites } from '@/contexts/FavoritesContext'
import { listWorksByIds } from '@/services/work.service'
import type { Work } from '@/types/work.types'
import { ProductCard } from '@/components/product/ProductCard'
import Modal from '@/components/ui/Modal'
import { purchaseService } from '@/services/purchase.service'
import { StripeCheckout } from '@/components/checkout/StripeCheckout'
import { useToast } from '@/contexts/ToastContext'
import { SAMPLE_WORKS } from '@/sample/worksSamples'

export function Favorites() {
  const { ids, toggle } = useFavorites()
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Work | null>(null)
  const [busy, setBusy] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const { showToast } = useToast()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'new' | 'priceAsc' | 'priceDesc' | 'title'>('new')
  const isSample = (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true' || (typeof window !== 'undefined' && !!localStorage.getItem('demoUser'))

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

  if (loading) return <div className="p-4">読み込み中...</div>

  return (
    <div className="p-4">
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
        <ProductCard
          key={w.id}
          id={w.id}
          imageUrl={w.thumbnail_url || w.image_url}
          title={w.title}
          price={w.price}
          onClick={() => setSelected(w)}
          badgeText={w.created_at ? new Date(w.created_at).toLocaleDateString('ja-JP') : undefined}
        />
      ))}
      {sorted.length === 0 && (
        <div className="p-4 text-gray-500">お気に入りはまだありません。</div>
      )}

      {selected && (
        <Modal
          isOpen={true}
          onClose={() => { setSelected(null); setClientSecret(null); setErrMsg(null); setBusy(false) }}
          title="作品プレビュー"
          initialFocusSelector="[data-close]"
        >
          <div className="space-y-4">
            <img src={selected.thumbnail_url || selected.image_url} alt={selected.title} className="w-full rounded-lg object-cover" />
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold jp-text">{selected.title}</h3>
              <div className="text-lg font-bold">¥{selected.price.toLocaleString()}</div>
            </div>
            {errMsg && <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-600">{errMsg}</div>}
            {!clientSecret && (
              <div className="flex gap-2 justify-end">
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    if (!selected) return
                    toggle(selected.id)
                    setSelected(null)
                    showToast({ variant: 'success', message: 'お気に入りを解除しました' })
                  }}
                >
                  お気に入り解除
                </button>
              </div>
            )}
            {!clientSecret ? (
              <div className="flex justify-end">
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={async () => {
                    if (!selected) return
                    setBusy(true)
                    setErrMsg(null)
                    const res = await purchaseService.initiatePurchase(selected.id)
                    if (res.status === 'requires_payment' && res.clientSecret) {
                      setClientSecret(res.clientSecret)
                    } else {
                      setErrMsg(res.error || '購入の準備に失敗しました')
                    }
                    setBusy(false)
                  }}
                >
                  {busy ? '準備中...' : '購入'}
                </button>
              </div>
            ) : (
              <StripeCheckout
                clientSecret={clientSecret}
                workId={selected.id}
                onSuccess={() => {
                  setSelected(null)
                  setClientSecret(null)
                  showToast({ variant: 'success', message: '購入が完了しました。ありがとうございます！' })
                }}
                onError={(m) => setErrMsg(m)}
                onCancel={() => { setClientSecret(null); showToast({ variant: 'warning', message: '決済をキャンセルしました' }) }}
              />
            )}
          </div>
        </Modal>
      )}
      </div>
    </div>
  )}

export default Favorites
