import React, { useEffect, useState } from 'react'
import type { Work } from '../../types'
import { myPurchases } from '../../services/work.service'
import { supabase } from '../../services/supabaseClient'
import { ProductCard } from '@/components/product/ProductCard'
import { resolveImageUrl } from '@/utils/imageFallback'
import { defaultImages } from '@/utils/defaultImages'
import Modal from '@/components/ui/Modal'
import { SuccessModal } from '@/components/ui/SuccessModal'
import { purchaseService } from '@/services/purchase.service'
import { StripeCheckout } from '@/components/checkout/StripeCheckout'
import { useToast } from '@/contexts/ToastContext'
import { useCart } from '@/contexts/CartContext'
import { useFavorites } from '@/contexts/FavoritesContext'
import { Analytics } from '@/services/analytics.service'
import { AddressService, type UserAddress } from '@/services/address.service'
import { useUserRole } from '@/hooks/useUserRole'
import { ArrowLeft } from 'lucide-react'

type PurchaseItem = { id: string, purchased_at: string, work: Work }

export function Collection() {
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Work | null>(null)
  const [busy, setBusy] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [showThanks, setShowThanks] = useState(false)
  const [thanksAmount, setThanksAmount] = useState<number | undefined>(undefined)
  const { showToast } = useToast()
  const { addToCart } = useCart()
  const { toggle, has } = useFavorites()
  const { userType } = useUserRole()
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
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [addingAddr, setAddingAddr] = useState(false)
  const [newAddr, setNewAddr] = useState({ name: '', postal_code: '', prefecture: '', city: '', address1: '', address2: '', phone: '', is_default: false })

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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map(p => (
        <ProductCard
          id={p.work.id}
          key={p.id}
          imageUrl={resolveImageUrl(p.work.thumbnail_url || p.work.image_url, [defaultImages.work, defaultImages.product])}
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
                {/* 配送先 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">配送先</label>
                    <button className="text-xs underline" onClick={async ()=>{ const list=await AddressService.list(); setAddresses(list); const def=list.find(a=>a.is_default)||list[0]; setSelectedAddressId(def?.id||''); setAddingAddr(false)}}>再読込</button>
                  </div>
                  {addresses.length>0 && !addingAddr ? (
                    <div className="space-y-2">
                      {addresses.map(addr => (
                        <label key={addr.id} className="flex items-start gap-3 p-2 border rounded-md dark:border-gray-700">
                          <input type="radio" name="addr" checked={selectedAddressId===addr.id} onChange={()=>setSelectedAddressId(addr.id)} />
                          <div className="text-xs">
                            <div className="font-medium">{addr.name} {addr.is_default && <span className="text-green-600">既定</span>}</div>
                            <div className="text-gray-600 dark:text-gray-400">{addr.postal_code} {addr.prefecture}{addr.city} {addr.address1} {addr.address2}</div>
                            {addr.phone && <div className="text-gray-600 dark:text-gray-400">{addr.phone}</div>}
                          </div>
                        </label>
                      ))}
                      <button className="text-xs underline" onClick={()=>setAddingAddr(true)}>新しい住所を追加</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input className="border rounded-md p-2" placeholder="氏名" value={newAddr.name} onChange={e=>setNewAddr({...newAddr,name:e.target.value})} />
                      <input className="border rounded-md p-2" placeholder="郵便番号" value={newAddr.postal_code} onChange={e=>setNewAddr({...newAddr,postal_code:e.target.value})} />
                      <input className="border rounded-md p-2" placeholder="都道府県" value={newAddr.prefecture} onChange={e=>setNewAddr({...newAddr,prefecture:e.target.value})} />
                      <input className="border rounded-md p-2" placeholder="市区町村" value={newAddr.city} onChange={e=>setNewAddr({...newAddr,city:e.target.value})} />
                      <input className="border rounded-md p-2 md:col-span-2" placeholder="住所1（番地等）" value={newAddr.address1} onChange={e=>setNewAddr({...newAddr,address1:e.target.value})} />
                      <input className="border rounded-md p-2 md:col-span-2" placeholder="住所2（建物名等）" value={newAddr.address2} onChange={e=>setNewAddr({...newAddr,address2:e.target.value})} />
                      <input className="border rounded-md p-2 md:col-span-2" placeholder="電話番号" value={newAddr.phone} onChange={e=>setNewAddr({...newAddr,phone:e.target.value})} />
                      <div className="md:col-span-2 flex gap-2">
                        <button className="btn btn-outline" onClick={()=>setAddingAddr(false)} type="button">キャンセル</button>
                        <button className="btn btn-primary" type="button" onClick={async ()=>{ const created=await AddressService.create(newAddr); const list=await AddressService.list(); setAddresses(list); setSelectedAddressId(created?.id||''); setAddingAddr(false)}}>住所を保存</button>
                      </div>
                    </div>
                  )}
                </div>
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
                onCancel={() => setClientSecret(null)}
              />
            )}
            {/* 単品注記は一括決済導入により不要 */}
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
