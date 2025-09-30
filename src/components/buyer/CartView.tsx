import React, { useState, useMemo } from 'react'
import { useCart, type CartItem } from '../../contexts/CartContext'
import { useToast } from '../../contexts/ToastContext'
import { purchaseService } from '../../services/purchase.service'
import { ShippingService, type ShippingCalculation, type FactoryGroup } from '../../services/shipping.service'
import { formatJPY } from '../../utils/helpers'
import { Trash2, Plus, Minus, ShoppingBag, CreditCard, Truck, Package } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { PurchaseSuccessModal } from '../ui/SuccessModal'
import { AddressService, type UserAddress } from '@/services/address.service'
import { getPartnerById } from '@/services/partner.service'
import { Analytics } from '@/services/analytics.service'
import { supabase } from '@/services/supabaseClient'

const pk = (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
const stripePromise = pk ? loadStripe(pk) : null

// 工場グループコンポーネント
const FactoryGroupCard: React.FC<{
  group: FactoryGroup
  onUpdateQty: (id: string, qty: number) => void
  onRemove: (id: string) => void
}> = ({ group, onUpdateQty, onRemove }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
    {/* 工場ヘッダー */}
    <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            {group.factoryName || '工場情報なし'}
          </h3>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            商品小計: {formatJPY(group.subtotal)}
          </span>
          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <Truck className="w-4 h-4" />
            <span>送料: {formatJPY(group.shippingCost)}</span>
          </div>
        </div>
      </div>
    </div>

    {/* 商品リスト */}
    <div className="p-4 space-y-3">
      {group.items.map(item => (
        <CartItemCard
          key={item.id}
          item={item}
          onUpdateQty={onUpdateQty}
          onRemove={onRemove}
          showFactory={false}
        />
      ))}
    </div>

    {/* グループ合計 */}
    <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-t border-gray-200 dark:border-gray-600">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          このグループの合計
        </span>
        <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">
          {formatJPY(group.total)}
        </span>
      </div>
    </div>
  </div>
)

// カートアイテムコンポーネント
const CartItemCard: React.FC<{
  item: CartItem
  onUpdateQty: (id: string, qty: number) => void
  onRemove: (id: string) => void
  showFactory?: boolean
}> = ({ item, onUpdateQty, onRemove, showFactory = true }) => (
  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center gap-3 w-full sm:w-auto">
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-12 h-12 sm:w-16 sm:h-16 rounded object-cover flex-shrink-0"
        />
      )}

      <div className="flex-1 sm:flex-none min-w-0">
        <h3 className="font-medium text-gray-900 text-sm sm:text-base line-clamp-2 break-words">
          {item.title}
        </h3>
        {(item as any).variant && ((item as any).variant.size || (item as any).variant.color) && (
          <div className="text-xs text-gray-500 mt-0.5">
            {(item as any).variant.size && (<span>サイズ: {(item as any).variant.size}</span>)}
            {((item as any).variant.size && (item as any).variant.color) && <span className="mx-1">/</span>}
            {(item as any).variant.color && (<span>カラー: {(item as any).variant.color}</span>)}
          </div>
        )}
        <p className="text-xs sm:text-sm text-gray-600">
          {formatJPY(item.price)}
        </p>
      </div>
    </div>

    <div className="flex items-center justify-between w-full sm:w-auto sm:flex-shrink-0 gap-3">
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => onUpdateQty(item.id, item.qty - 1)}
          disabled={item.qty <= 1}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="数量を減らす"
      >
        <Minus className="w-4 h-4" />
      </button>

        <span className="w-6 sm:w-8 text-center font-medium text-sm sm:text-base">
          {item.qty}
        </span>

        <button
          onClick={() => onUpdateQty(item.id, item.qty + 1)}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          aria-label="数量を増やす"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="font-semibold text-gray-900 text-sm sm:text-base">
          {formatJPY(item.price * item.qty)}
        </p>
        {showFactory && item.factoryId && (
          <p className="text-xs text-gray-500 mt-1">
            工場ID: {item.factoryId}
          </p>
        )}
      </div>

      <button
        onClick={() => onRemove(item.id)}
        className="p-1.5 sm:p-2 text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
        aria-label="カートから削除"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  </div>
)

// 決済フォームコンポーネント
type PaymentMethod = 'card' | 'konbini' | 'bank_transfer'
const CheckoutForm: React.FC<{
  cartItems: CartItem[]
  shippingCalculation: ShippingCalculation
  onSuccess: () => void
  onCancel: () => void
}> = ({ cartItems, shippingCalculation, onSuccess, onCancel }) => {
  const stripe = useStripe()
  const elements = useElements()
  const { clearCart } = useCart()
  const { showToast } = useToast()
  const [processing, setProcessing] = useState(false)
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [adding, setAdding] = useState(false)
  const [agree, setAgree] = useState(false)
  const [shippingInfos, setShippingInfos] = useState<Array<{ partnerId: string; partnerName: string; info: any }>>([])
  const [missingShippingPartners, setMissingShippingPartners] = useState<Array<{ partnerId: string; partnerName: string }>>([])
  const [shippingInfoVersion, setShippingInfoVersion] = useState(0)
  const [liveShippingCalc, setLiveShippingCalc] = useState<ShippingCalculation>(shippingCalculation)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [billingName, setBillingName] = useState('')
  const [billingEmail, setBillingEmail] = useState('')

  const [newAddr, setNewAddr] = useState({
    name: '', postal_code: '', prefecture: '', city: '', address1: '', address2: '', phone: '', is_default: true,
  })

  React.useEffect(() => {
    (async () => {
      const list = await AddressService.list()
      setAddresses(list)
      const def = list.find(a => a.is_default) || list[0]
      setSelectedAddressId(def?.id || '')
    })()
  }, [])

  // 住所変更やカート内容に応じて送料を再計算（沖縄料金等を適用）
  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const pref = addresses.find(a => a.id === selectedAddressId)?.prefecture || undefined
        const calc = await ShippingService.calculateShippingAsync(cartItems, { destinationPref: pref })
        if (active) setLiveShippingCalc(calc)
      } catch {
        if (active) setLiveShippingCalc(shippingCalculation)
      }
    })()
    return () => { active = false }
  }, [cartItems, addresses, selectedAddressId, shippingInfoVersion])

  // 購入ページ表示用の「商品のお届けについて」を工場設定から取得
  React.useEffect(() => {
    (async () => {
      const ids = Array.from(new Set((cartItems || []).map(i => i.factoryId).filter(Boolean))) as string[]
      if (ids.length === 0) { setShippingInfos([]); setMissingShippingPartners([]); return }
      try {
        const results: Array<{ partnerId: string; partnerName: string; info: any }> = []
        const missing: Array<{ partnerId: string; partnerName: string }> = []
        for (const pid of ids) {
          const p = await getPartnerById(pid)
          if (p) {
            const name = p.company_name || p.name
            if ((p as any).shipping_info) {
              results.push({ partnerId: pid, partnerName: name, info: (p as any).shipping_info })
            } else {
              missing.push({ partnerId: pid, partnerName: name })
            }
          } else {
            missing.push({ partnerId: pid, partnerName: `工場ID: ${pid}` })
          }
        }
        setShippingInfos(results)
        setMissingShippingPartners(missing)
        setShippingInfoVersion(v => v + 1)
      } catch (e) {
        console.warn('failed to load shipping info from partners', e)
        setShippingInfos([])
        setMissingShippingPartners([])
      }
    })()
  }, [cartItems])

  // Realtime: チェックアウト中も配送情報の更新を反映
  React.useEffect(() => {
    const ids = Array.from(new Set((cartItems || []).map(i => i.factoryId).filter(Boolean))) as string[]
    if (ids.length === 0) return
    const channels = ids.map(pid => (
      supabase
        .channel(`checkout-shipping-${pid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'manufacturing_partners', filter: `id=eq.${pid}` }, async () => {
          try {
            const p = await getPartnerById(pid)
            const name = (p?.company_name || p?.name || `工場ID: ${pid}`) as string
            const info = (p as any)?.shipping_info
            setShippingInfos(prev => {
              const others = prev.filter(x => x.partnerId !== pid)
              return info ? [...others, { partnerId: pid, partnerName: name, info }] : others
            })
            setMissingShippingPartners(prev => {
              const others = prev.filter(x => x.partnerId !== pid)
              return info ? others : [...others, { partnerId: pid, partnerName: name }]
            })
            setShippingInfoVersion(v => v + 1)
          } catch {}
        })
        .subscribe()
    ))
    return () => { channels.forEach(ch => { try { supabase.removeChannel(ch) } catch {} }) }
  }, [cartItems])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!selectedAddressId && !adding) {
      showToast({ message: '配送先住所を選択してください', variant: 'warning' })
      return
    }
    if (!agree) {
      showToast({ message: '利用規約等への同意が必要です', variant: 'warning' })
      return
    }
    // Stripe.js は全方式で使用（confirm 用）。公開鍵未設定ならブロック
    if (!stripe || !elements) {
      showToast({ message: '決済システムの準備ができていません', variant: 'error' })
      return
    }

    setProcessing(true)

    try {
      // 一括決済を開始
      const workIds = cartItems.map(item => item.id)

      // クレジットカード
      if (paymentMethod === 'card') {
        const result = await purchaseService.initiateBulkPurchase(workIds, selectedAddressId)

        if (result.status === 'failed') {
          showToast({ message: result.error || '決済の開始に失敗しました', variant: 'error' })
          return
        }

        if (result.status !== 'requires_payment' || !result.clientSecret) {
          showToast({ message: '決済の準備に失敗しました', variant: 'error' })
          return
        }

        // 失敗した商品がある場合は警告表示
        if (result.failedItems && result.failedItems.length > 0) {
          const failedTitles = result.failedItems
            .map(f => cartItems.find(c => c.id === f.workId)?.title || f.workId)
            .join(', ')
          showToast({ message: `一部の商品が購入できません: ${failedTitles}`, variant: 'warning' })
        }

        const cardElement = elements.getElement(CardElement)
        if (!cardElement) {
          showToast({ message: 'カード情報の取得に失敗しました', variant: 'error' })
          return
        }

        // Stripe決済を確認
        const { error, paymentIntent } = await stripe.confirmCardPayment(result.clientSecret, {
          payment_method: {
            card: cardElement,
          }
        })

        if (error) {
          showToast({ message: error.message || '決済に失敗しました', variant: 'error' })
          return
        }

        if (paymentIntent?.status === 'succeeded') {
          // 購入完了確認
          const completionResult = await purchaseService.checkBulkPurchaseCompletion(paymentIntent.id)

          if (completionResult.status === 'completed') {
            clearCart()
            showToast({ message: 'ご購入ありがとうございます！', variant: 'success' })
            onSuccess()
          } else {
            showToast({ message: '購入処理を確認中です...', variant: 'default' })
            setTimeout(() => {
              purchaseService.checkBulkPurchaseCompletion(paymentIntent.id, 5, 3000)
                .then(result => {
                  if (result.status === 'completed') {
                    clearCart()
                    showToast({ message: 'ご購入ありがとうございます！', variant: 'success' })
                    onSuccess()
                  }
                })
            }, 1000)
          }
        }
        return
      }

      // コンビニ
      if (paymentMethod === 'konbini') {
        if (!billingName || !billingEmail) {
          showToast({ message: '名前とメールアドレスを入力してください（コンビニ決済）', variant: 'warning' })
          return
        }
        const { data, error } = await supabase.functions.invoke('create-konbini-intent', {
          body: { amount: liveShippingCalc.grandTotal, currency: 'jpy', description: 'Konbini payment', metadata: { type: 'bulk_purchase', work_ids: workIds } }
        })
        if (error) { showToast({ message: error.message || 'コンビニ決済の作成に失敗しました', variant: 'error' }); return }
        const clientSecret = (data as any)?.clientSecret
        // @ts-ignore
        const res = await (stripe as any).confirmKonbiniPayment(clientSecret, {
          payment_method: { billing_details: { name: billingName, email: billingEmail } },
          return_url: window.location.origin + '/#/receipt'
        })
        if (res?.error) { showToast({ message: res.error.message || 'コンビニ決済の確定に失敗しました', variant: 'error' }); return }
        showToast({ message: 'お支払い手順をメールで送信しました。期日内にお支払いください。', variant: 'success' })
        onSuccess(); return
      }

      // 銀行振込
      if (paymentMethod === 'bank_transfer') {
        if (!billingEmail) {
          showToast({ message: 'メールアドレスを入力してください（銀行振込情報の送付）', variant: 'warning' })
          return
        }
        const { data, error } = await supabase.functions.invoke('create-bank-transfer-intent', {
          body: { amount: liveShippingCalc.grandTotal, currency: 'jpy', description: 'Bank transfer payment', metadata: { type: 'bulk_purchase', work_ids: workIds } }
        })
        if (error) { showToast({ message: error.message || '銀行振込の作成に失敗しました', variant: 'error' }); return }
        const clientSecret = (data as any)?.clientSecret
        // @ts-ignore
        const res = await (stripe as any).confirmCustomerBalancePayment(clientSecret, {
          payment_method: { billing_details: { email: billingEmail, name: billingName || undefined } },
          return_url: window.location.origin + '/#/receipt'
        })
        if (res?.error) { showToast({ message: res.error.message || '銀行振込の確定に失敗しました', variant: 'error' }); return }
        showToast({ message: '振込先情報をメールで送信しました。期日内にお振込ください。', variant: 'success' })
        onSuccess(); return
      }
    } catch (error) {
      console.error('Checkout error:', error)
      showToast({ message: '決済処理中にエラーが発生しました', variant: 'error' })
    } finally {
      setProcessing(false)
    }
  }

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
    },
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 支払い方法 */}
      <div className="p-4 border rounded-lg bg-white dark:bg-gray-800">
        <h3 className="text-lg font-semibold mb-2">お支払い方法</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="pm" checked={paymentMethod==='card'} onChange={()=>setPaymentMethod('card')} />クレジットカード</label>
          <label className="flex items-center gap-2"><input type="radio" name="pm" checked={paymentMethod==='konbini'} onChange={()=>setPaymentMethod('konbini')} />コンビニ払い</label>
          <label className="flex items-center gap-2"><input type="radio" name="pm" checked={paymentMethod==='bank_transfer'} onChange={()=>setPaymentMethod('bank_transfer')} />銀行振込</label>
        </div>
        {(paymentMethod === 'konbini' || paymentMethod === 'bank_transfer') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <label className="block"><span className="block text-xs text-gray-600">お名前</span><input className="input input-bordered w-full" value={billingName} onChange={e=>setBillingName(e.target.value)} placeholder="山田 太郎" /></label>
            <label className="block"><span className="block text-xs text-gray-600">メールアドレス</span><input type="email" className="input input-bordered w-full" value={billingEmail} onChange={e=>setBillingEmail(e.target.value)} placeholder="taro@example.com" /></label>
          </div>
        )}
      </div>
      {/* 送料未設定の工場がある場合の注意 */}
      {missingShippingPartners.length > 0 && (
        <div className="p-4 border border-yellow-200 bg-yellow-50 text-yellow-800 rounded-lg">
          <div className="font-semibold mb-1">一部の工場で送料設定が未入力です</div>
          <div className="text-sm">以下の工場は送料情報が設定されていないため、表示送料は暫定値です。住所に応じて確定するか、工場設定の更新後に反映されます。</div>
          <ul className="list-disc list-inside mt-2 text-sm">
            {missingShippingPartners.map(m => (
              <li key={m.partnerId}>{m.partnerName}</li>
            ))}
          </ul>
        </div>
      )}
      {/* 沖縄県向け強調案内 */}
      {(() => {
        const pref = addresses.find(a => a.id === selectedAddressId)?.prefecture || ''
        const isOkinawa = pref.includes('沖縄')
        if (!isOkinawa || shippingInfos.length === 0) return null
        return (
          <div className="p-4 rounded-lg border border-orange-200 bg-orange-50 text-orange-800">
            <div className="font-semibold mb-1">沖縄県へのお届けに関する注意</div>
            <div className="text-sm">お届け先が沖縄県の場合、送料や到着目安、取扱い条件が異なる場合があります。以下をご確認ください。</div>
            {shippingInfos.map(s => (
              <div key={s.partnerId} className="mt-2 text-sm">
                <div className="font-medium">提供工場: {s.partnerName}</div>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  {(Array.isArray(s.info.cautions) ? s.info.cautions : []).map((c: string, idx: number) => (
                    <li key={`c-${idx}`}>{c}</li>
                  ))}
                  {(Array.isArray(s.info.split_cautions) ? s.info.split_cautions : []).map((c: string, idx: number) => (
                    <li key={`sc-${idx}`}>{c}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )
      })()}
      {/* 商品のお届けについて（工場設定より） */}
      {shippingInfos.length > 0 && (
        <div className="p-4 border rounded-lg bg-white dark:bg-gray-800">
          <h3 className="text-lg font-semibold mb-2">商品のお届けについて</h3>
          {shippingInfos.map(s => (
            <div key={s.partnerId} className="mb-4 last:mb-0">
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">提供工場: {s.partnerName}</div>
              <div className="text-sm">
                <div className="font-medium text-gray-900 dark:text-gray-100">{s.info.method_title || '宅配便'}</div>
                {s.info.per_order_note && (
                  <div className="text-gray-700 dark:text-gray-300">{s.info.per_order_note}</div>
                )}
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-700 dark:text-gray-300">
                  {s.info.carrier_name && (<div>配送会社: {s.info.carrier_name}</div>)}
                  <div>
                    送料: {typeof s.info.fee_general_jpy === 'number' ? `全国（沖縄を除く）税込¥${s.info.fee_general_jpy.toLocaleString()}` : '—'}
                    {typeof s.info.fee_okinawa_jpy === 'number' ? ` / 沖縄 税込¥${s.info.fee_okinawa_jpy.toLocaleString()}` : ''}
                  </div>
                  {s.info.eta_text && (<div>到着目安: {s.info.eta_text}</div>)}
                </div>
                {Array.isArray(s.info.cautions) && s.info.cautions.length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium">注意事項</div>
                    <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
                      {s.info.cautions.map((c: string, idx: number) => (
                        <li key={idx}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(s.info.split_title || s.info.split_desc || (Array.isArray(s.info.split_cautions) && s.info.split_cautions.length > 0)) && (
                  <div className="mt-3">
                    <div className="font-medium">{s.info.split_title || '分納について'}</div>
                    {s.info.split_desc && (<div className="text-sm text-gray-700 dark:text-gray-300">{s.info.split_desc}</div>)}
                    {Array.isArray(s.info.split_cautions) && s.info.split_cautions.length > 0 && (
                      <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {s.info.split_cautions.map((c: string, idx: number) => (
                          <li key={idx}>{c}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 配送先 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">配送先</label>
        {addresses.length > 0 && !adding ? (
          <div className="space-y-2">
            {addresses.map(addr => (
              <label key={addr.id} className="flex items-start gap-3 p-3 border rounded-md dark:border-gray-700">
                <input
                  type="radio"
                  name="address"
                  checked={selectedAddressId === addr.id}
                  onChange={() => setSelectedAddressId(addr.id)}
                />
                <div className="text-sm">
                  <div className="font-medium">{addr.name} {addr.is_default && <span className="ml-1 text-xs text-green-600">既定</span>}</div>
                  <div className="text-gray-600 dark:text-gray-400">{addr.postal_code} {addr.prefecture}{addr.city} {addr.address1} {addr.address2}</div>
                  {addr.phone && <div className="text-gray-600 dark:text-gray-400">{addr.phone}</div>}
                </div>
              </label>
            ))}
            <button type="button" className="text-sm underline" onClick={() => setAdding(true)}>新しい住所を追加</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border rounded-md p-2" placeholder="氏名" value={newAddr.name} onChange={e => setNewAddr({ ...newAddr, name: e.target.value })} required />
            <input className="border rounded-md p-2" placeholder="郵便番号" value={newAddr.postal_code} onChange={e => setNewAddr({ ...newAddr, postal_code: e.target.value })} required />
            <input className="border rounded-md p-2" placeholder="都道府県" value={newAddr.prefecture} onChange={e => setNewAddr({ ...newAddr, prefecture: e.target.value })} />
            <input className="border rounded-md p-2" placeholder="市区町村" value={newAddr.city} onChange={e => setNewAddr({ ...newAddr, city: e.target.value })} />
            <input className="border rounded-md p-2 md:col-span-2" placeholder="住所1（番地等）" value={newAddr.address1} onChange={e => setNewAddr({ ...newAddr, address1: e.target.value })} required />
            <input className="border rounded-md p-2 md:col-span-2" placeholder="住所2（建物名等）" value={newAddr.address2 || ''} onChange={e => setNewAddr({ ...newAddr, address2: e.target.value })} />
            <input className="border rounded-md p-2 md:col-span-2" placeholder="電話番号" value={newAddr.phone || ''} onChange={e => setNewAddr({ ...newAddr, phone: e.target.value })} />
            <div className="md:col-span-2 flex gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setAdding(false)}>キャンセル</button>
              <button type="button" className="btn btn-primary" onClick={async () => {
                const created = await AddressService.create(newAddr)
                const list = await AddressService.list()
                setAddresses(list)
                setSelectedAddressId(created?.id || '')
                setAdding(false)
              }}>住所を保存</button>
            </div>
          </div>
        )}
      </div>
      {paymentMethod === 'card' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">カード情報</label>
          <div className="p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
            <CardElement options={cardElementOptions} />
          </div>
        </div>
      )}

      {/* 規約同意 */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" className="rounded" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            <button type="button" className="underline" onClick={() => import('@/utils/navigation').then(m => m.navigate('terms'))}>利用規約</button>
            ・
            <button type="button" className="underline" onClick={() => import('@/utils/navigation').then(m => m.navigate('privacy'))}>プライバシーポリシー</button>
            ・
            <button type="button" className="underline" onClick={() => import('@/utils/navigation').then(m => m.navigate('refunds'))}>返金ポリシー</button>
            に同意します
          </span>
        </label>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">商品点数</span>
          <span className="font-medium">{liveShippingCalc.totalItems}点</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">商品小計</span>
          <span className="font-medium">{formatJPY(liveShippingCalc.totalSubtotal)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <Truck className="w-4 h-4" />
            送料合計
          </span>
          <span className="font-medium">{formatJPY(liveShippingCalc.totalShipping)}</span>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">合計金額</span>
            <span className="text-xl font-bold text-primary-600">
              {formatJPY(liveShippingCalc.grandTotal)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 px-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={!stripe || processing || !agree}
          className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              処理中...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              {formatJPY(shippingCalculation.grandTotal)}で購入
            </>
          )}
        </button>
      </div>
    </form>
  )
}

// メインカートビューコンポーネント
export const CartView: React.FC = () => {
  const { items, updateQty, removeFromCart, clearCart } = useCart()
  const [showCheckout, setShowCheckout] = useState(false)
  const [showGrouped, setShowGrouped] = useState(true)
  const [shippingInfos, setShippingInfos] = useState<Array<{ partnerId: string; partnerName: string; info: any }>>([])
  const [missingShippingPartners, setMissingShippingPartners] = useState<Array<{ partnerId: string; partnerName: string }>>([])
  const [shippingInfoVersion, setShippingInfoVersion] = useState(0)

  // 送料計算（工場設定 shipping_info を優先）
  const [shippingCalculation, setShippingCalculation] = useState<ShippingCalculation>({ factoryGroups: [], totalItems: 0, totalSubtotal: 0, totalShipping: 0, grandTotal: 0 })
  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const calc = await ShippingService.calculateShippingAsync(items)
        if (active) setShippingCalculation(calc)
      } catch {
        // フォールバック: 同期モック計算
        if (active) setShippingCalculation(ShippingService.calculateShipping(items))
      }
    })()
    return () => { active = false }
  }, [items, shippingInfoVersion])

  // Realtime: 対象工場の配送設定更新を監視して反映
  React.useEffect(() => {
    const ids = Array.from(new Set((items || []).map(i => i.factoryId).filter(Boolean))) as string[]
    if (ids.length === 0) return
    const channels = ids.map(pid => (
      supabase
        .channel(`cart-shipping-${pid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'manufacturing_partners', filter: `id=eq.${pid}` }, async () => {
          try {
            const p = await getPartnerById(pid)
            const name = (p?.company_name || p?.name || `工場ID: ${pid}`) as string
            const info = (p as any)?.shipping_info
            setShippingInfos(prev => {
              const others = prev.filter(x => x.partnerId !== pid)
              return info ? [...others, { partnerId: pid, partnerName: name, info }] : others
            })
            setMissingShippingPartners(prev => {
              const others = prev.filter(x => x.partnerId !== pid)
              return info ? others : [...others, { partnerId: pid, partnerName: name }]
            })
            setShippingInfoVersion(v => v + 1)
          } catch {}
        })
        .subscribe()
    ))
    return () => { channels.forEach(ch => { try { supabase.removeChannel(ch) } catch {} }) }
  }, [items])

  // 最適化提案
  const optimizationSuggestions = useMemo(() => {
    return ShippingService.getShippingOptimizationSuggestions(shippingCalculation)
  }, [shippingCalculation])

  // カート一覧にも「商品のお届けについて」を表示するため、工場設定から配送情報を取得
  React.useEffect(() => {
    (async () => {
      const ids = Array.from(new Set((items || []).map(i => i.factoryId).filter(Boolean))) as string[]
      if (ids.length === 0) { setShippingInfos([]); setMissingShippingPartners([]); return }
      try {
        const results: Array<{ partnerId: string; partnerName: string; info: any }> = []
        const missing: Array<{ partnerId: string; partnerName: string }> = []
        for (const pid of ids) {
          const p = await getPartnerById(pid)
          if (p) {
            const name = p.company_name || p.name
            if ((p as any).shipping_info) {
              results.push({ partnerId: pid, partnerName: name, info: (p as any).shipping_info })
            } else {
              missing.push({ partnerId: pid, partnerName: name })
            }
          } else {
            missing.push({ partnerId: pid, partnerName: `工場ID: ${pid}` })
          }
        }
        setShippingInfos(results)
        setMissingShippingPartners(missing)
      } catch (e) {
        console.warn('failed to load shipping info (cart view)', e)
        setShippingInfos([])
        setMissingShippingPartners([])
      }
    })()
  }, [items])

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          カートは空です
        </h2>
        <p className="text-gray-900">
          お気に入りの写真を見つけてカートに追加してください
        </p>
      </div>
    )
  }

  if (showCheckout) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-black mb-2">
            お支払い
          </h2>
          <p className="text-gray-600">
            カード情報を入力して購入を完了してください
          </p>
        </div>

        {stripePromise ? (
          <Elements stripe={stripePromise}>
            <CheckoutForm
              cartItems={items}
              shippingCalculation={shippingCalculation}
              onSuccess={() => setShowCheckout(false)}
              onCancel={() => setShowCheckout(false)}
            />
          </Elements>
        ) : (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
            Stripeの公開鍵が未設定です。`.env` に `VITE_STRIPE_PUBLISHABLE_KEY` を設定してください。
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            ショッピングカート
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {shippingCalculation.totalItems}点の商品
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-4">
            <button
              onClick={clearCart}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              すべて削除
            </button>
          </div>
        )}
      </div>

      {/* 最適化提案 */}
      {optimizationSuggestions.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-2">
            <Truck className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                送料最適化のご提案
              </h3>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                {optimizationSuggestions.map((suggestion, index) => (
                  <li key={index}>• {suggestion}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 商品のお届けについて（工場設定より） */}
      {shippingInfos.length > 0 && (
        <div className="mb-6 p-4 border rounded-lg bg-white dark:bg-gray-800">
          <h3 className="text-lg font-semibold mb-2">商品のお届けについて</h3>
          {shippingInfos.map(s => (
            <div key={s.partnerId} className="mb-4 last:mb-0">
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">提供工場: {s.partnerName}</div>
              <div className="text-sm">
                <div className="font-medium text-gray-900 dark:text-gray-100">{s.info.method_title || '宅配便'}</div>
                {s.info.per_order_note && (
                  <div className="text-gray-700 dark:text-gray-300">{s.info.per_order_note}</div>
                )}
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-700 dark:text-gray-300">
                  {s.info.carrier_name && (<div>配送会社: {s.info.carrier_name}</div>)}
                  <div>
                    送料: {typeof s.info.fee_general_jpy === 'number' ? `全国（沖縄を除く）税込¥${s.info.fee_general_jpy.toLocaleString()}` : '—'}
                    {typeof s.info.fee_okinawa_jpy === 'number' ? ` / 沖縄 税込¥${s.info.fee_okinawa_jpy.toLocaleString()}` : ''}
                  </div>
                  {s.info.eta_text && (<div>到着目安: {s.info.eta_text}</div>)}
                </div>
                {Array.isArray(s.info.cautions) && s.info.cautions.length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium">注意事項</div>
                    <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
                      {s.info.cautions.map((c: string, idx: number) => (
                        <li key={idx}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(s.info.split_title || s.info.split_desc || (Array.isArray(s.info.split_cautions) && s.info.split_cautions.length > 0)) && (
                  <div className="mt-3">
                    <div className="font-medium">{s.info.split_title || '分納について'}</div>
                    {s.info.split_desc && (<div className="text-sm text-gray-700 dark:text-gray-300">{s.info.split_desc}</div>)}
                    {Array.isArray(s.info.split_cautions) && s.info.split_cautions.length > 0 && (
                      <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {s.info.split_cautions.map((c: string, idx: number) => (
                          <li key={idx}>{c}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {missingShippingPartners.length > 0 && (
        <div className="mb-6 p-4 border border-yellow-200 bg-yellow-50 text-yellow-800 rounded-lg">
          <div className="font-semibold mb-1">一部の工場で送料設定が未入力です</div>
          <div className="text-sm">以下の工場は送料情報が設定されていないため、表示送料は暫定値です。チェックアウト時の住所に応じて確定するか、工場設定の更新後に反映されます。</div>
          <ul className="list-disc list-inside mt-2 text-sm">
            {missingShippingPartners.map(m => (
              <li key={m.partnerId}>{m.partnerName}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4 mb-8">
        {items.map(item => (
          <CartItemCard
            key={item.id}
            item={item}
            onUpdateQty={updateQty}
            onRemove={removeFromCart}
            showFactory={false}
          />
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">商品小計</span>
            <span className="font-medium">{formatJPY(shippingCalculation.totalSubtotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <Truck className="w-4 h-4" />
              送料合計
            </span>
            <span className="font-medium">{formatJPY(shippingCalculation.totalShipping)}</span>
          </div>
          <div className="text-xs text-gray-500">最終的な送料は配送先住所の選択後（チェックアウト画面）に確定します。沖縄県は別料金となります。</div>
          <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                合計金額
              </span>
              <span className="text-2xl font-bold text-primary-600">
                {formatJPY(shippingCalculation.grandTotal)}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setShowCheckout(true)
            Analytics.track('begin_checkout', {
              value: shippingCalculation.grandTotal,
              items: items.map(i => ({ item_id: i.id, price: i.price, quantity: i.qty })),
            })
          }}
          className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <CreditCard className="w-5 h-5" />
          レジに進む
        </button>
      </div>
    </div>
  )
}

export default CartView
