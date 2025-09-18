import { useEffect, useState } from 'react'
import type { Work } from '../../types'
import { myPurchases } from '../../services/work.service'
import { supabase } from '../../services/supabaseClient'
import { ProductCard } from '@/components/product/ProductCard'
import Modal from '@/components/ui/Modal'
import { PurchaseSuccessModal } from '@/components/ui/SuccessModal'
import { purchaseService } from '@/services/purchase.service'
import { StripeCheckout } from '@/components/checkout/StripeCheckout'
import { useToast } from '@/contexts/ToastContext'
import { useCart } from '@/contexts/CartContext'
import { useFavorites } from '@/contexts/FavoritesContext'

type PurchaseItem = { id: string, purchased_at: string, work: Work }

export function Collection() {
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Work | null>(null)
  const [busy, setBusy] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [showThanks, setShowThanks] = useState(false)
  const { showToast } = useToast()
  const { addToCart } = useCart()
  const { toggle, has } = useFavorites()

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setItems([]); setLoading(false); return }
      const data = await myPurchases(user.id)
      if (active) setItems(data as any)
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  if (loading) return <div className="p-4">読み込み中...</div>

  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map(p => (
        <ProductCard
          id={p.work.id}
          key={p.id}
          imageUrl={p.work.thumbnail_url || p.work.image_url}
          title={p.work.title}
          price={p.work.price}
          reviewsCount={0}
          onClick={() => setSelected(p.work)}
          badgeText={new Date(p.purchased_at).toLocaleDateString('ja-JP')}
        />
      ))}
      {items.length === 0 && (
        <div className="p-4 text-gray-500">購入した作品はまだありません。</div>
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
                    addToCart({ id: selected.id, title: selected.title, price: selected.price, imageUrl: selected.thumbnail_url || selected.image_url })
                    showToast({ variant: 'success', message: 'カートに追加しました' })
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
                  setShowThanks(true)
                  showToast({ variant: 'success', message: '購入が完了しました。ありがとうございます！' })
                }}
                onError={(m) => setErrMsg(m)}
                onCancel={() => setClientSecret(null)}
              />
            )}
            {/* 単品注記は一括決済導入により不要 */}
          </div>
        </Modal>
      )}
      {showThanks && (
        <PurchaseSuccessModal
          isOpen={true}
          onClose={() => setShowThanks(false)}
        />
      )}
    </div>
  )
}
