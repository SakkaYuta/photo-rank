import React, { useState } from 'react'
import { useTrendingWorks } from '../../hooks/useWorks'
import { searchWorks } from '@/services/work.service'
import { ProductCard } from '@/components/product/ProductCard'
import type { Work } from '@/types/work.types'
import Modal from '@/components/ui/Modal'
import { SuccessModal } from '@/components/ui/SuccessModal'
import { purchaseService } from '@/services/purchase.service'
import { StripeCheckout } from '@/components/checkout/StripeCheckout'
import { useToast } from '@/contexts/ToastContext'
import { useCart } from '@/contexts/CartContext'
import { useFavorites } from '@/contexts/FavoritesContext'
import { Analytics } from '@/services/analytics.service'
import { AddressService, type UserAddress } from '@/services/address.service'
import { resolveImageUrl } from '@/utils/imageFallback'
import { defaultImages } from '@/utils/defaultImages'

export function TrendingView() {
  const { works, loading, error } = useTrendingWorks()

  const [q, setQ] = useState('')
  const [minPrice, setMinPrice] = useState<string>('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [factoryId, setFactoryId] = useState('')
  const [results, setResults] = useState<Work[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Work | null>(null)
  const [busy, setBusy] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [showThanks, setShowThanks] = useState(false)
  const [thanksAmount, setThanksAmount] = useState<number | undefined>(undefined)

  // 検索の発火（デバウンス）
  React.useEffect(() => {
    const hasFilters = Boolean(q.trim() || minPrice || maxPrice || factoryId.trim())
    if (!hasFilters) { setResults(null); return }
    const h = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await searchWorks({
          q,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          factoryId: factoryId || undefined,
          limit: 60,
        })
        setResults(res)
      } catch (e) {
        console.error('search error', e)
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(h)
  }, [q, minPrice, maxPrice, factoryId])

  const data = results ?? works
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [addingAddr, setAddingAddr] = useState(false)
  const [newAddr, setNewAddr] = useState({ name: '', postal_code: '', prefecture: '', city: '', address1: '', address2: '', phone: '', is_default: false })
  const { showToast } = useToast()
  const { addToCart } = useCart()
  const { toggle, has } = useFavorites()
  // load addresses when modal opens
  React.useEffect(() => {
    (async () => {
      if (selected) {
        const list = await AddressService.list()
        setAddresses(list)
        const def = list.find(a => a.is_default) || list[0]
        setSelectedAddressId(def?.id || '')
        setAddingAddr(false)
      }
    })()
  }, [selected])
  if (loading) return <div className="p-4">読み込み中...</div>
  if (error) return <div className="p-4 text-red-600">{error}</div>
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <input className="border rounded-md p-2 md:col-span-2" placeholder="キーワード（タイトル）" value={q} onChange={(e)=>setQ(e.target.value)} />
        <input className="border rounded-md p-2" type="number" inputMode="numeric" placeholder="最低価格" value={minPrice} onChange={(e)=>setMinPrice(e.target.value)} min={0} />
        <input className="border rounded-md p-2" type="number" inputMode="numeric" placeholder="最高価格" value={maxPrice} onChange={(e)=>setMaxPrice(e.target.value)} min={0} />
        <input className="border rounded-md p-2" placeholder="工場ID（任意）" value={factoryId} onChange={(e)=>setFactoryId(e.target.value)} />
      </div>
      {searching && <div className="text-sm text-gray-500">検索中...</div>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.map((w: Work) => (
        <ProductCard
          key={w.id}
          id={w.id}
          imageUrl={resolveImageUrl(w.thumbnail_url || w.image_url, [defaultImages.work, defaultImages.product])}
          title={w.title}
          price={w.price}
          rating={0}
          reviewsCount={0}
          onClick={() => setSelected(w)}
        />
      ))}
      </div>
      {selected && (
        <Modal
          isOpen={true}
          onClose={() => { setSelected(null); setClientSecret(null); setErrMsg(null); setBusy(false) }}
          title="作品プレビュー"
          initialFocusSelector="[data-close]"
        >
          <div className="space-y-4">
            <img src={resolveImageUrl(selected.thumbnail_url || selected.image_url, [defaultImages.work, defaultImages.product])} alt={selected.title} className="w-full rounded-lg object-cover" />
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
                    addToCart({ id: selected.id, title: selected.title, price: selected.price, imageUrl: selected.thumbnail_url || selected.image_url })
                    showToast({ variant: 'success', message: 'カートに追加しました' })
                    Analytics.track('add_to_cart', { item_id: selected.id, price: selected.price })
                  }}
                >
                  カートに追加
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    if (!selected) return
                    toggle(selected.id)
                    showToast({ variant: 'success', message: has(selected.id) ? 'お気に入りを解除しました' : 'お気に入りに追加しました' })
                  }}
                >
                  お気に入り
                </button>
              </div>
            )}
            {!clientSecret ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-500 text-right">
                  購入ボタンを押すと
                  <button className="underline ml-1" onClick={() => import('@/utils/navigation').then(m => m.navigate('terms'))}>利用規約</button>
                  ・
                  <button className="underline" onClick={() => import('@/utils/navigation').then(m => m.navigate('privacy'))}>プライバシー</button>
                  ・
                  <button className="underline" onClick={() => import('@/utils/navigation').then(m => m.navigate('refunds'))}>返金</button>
                  に同意したものとみなします
                </div>
                <div className="flex justify-end">
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={async () => {
                    if (!selected) return
                    if (!selectedAddressId) { setErrMsg('配送先住所を選択・登録してください'); return }
                    setBusy(true)
                    setErrMsg(null)
                    const res = await purchaseService.initiatePurchase(selected.id, selectedAddressId)
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
              </div>
            ) : (
              <StripeCheckout
                clientSecret={clientSecret}
                workId={selected.id}
                onSuccess={() => {
                  if (selected) setThanksAmount(selected.price)
                  setSelected(null)
                  setClientSecret(null)
                  setShowThanks(true)
                  showToast({ variant: 'success', message: '購入が完了しました。ありがとうございます！' })
                  if (selected) Analytics.trackPurchase(selected.price, [{ id: selected.id, price: selected.price, qty: 1 }])
                }}
                onError={(m) => setErrMsg(m)}
                onCancel={() => {
                  setClientSecret(null)
                  showToast({ variant: 'warning', message: '決済をキャンセルしました' })
                }}
              />
            )}
          </div>
        </Modal>
      )}
      {showThanks && (
        <SuccessModal
          isOpen={true}
          onClose={() => setShowThanks(false)}
          type="purchase"
          amount={thanksAmount}
          itemCount={1}
          actionLabel="注文履歴を見る"
          onAction={() => {
            import('@/utils/navigation').then(m => m.navigate('orders'))
          }}
          secondaryActionLabel="続けてショッピング"
          onSecondaryAction={() => {
            import('@/utils/navigation').then(m => m.navigate('trending'))
          }}
        />
      )}
    </div>
  )
}
