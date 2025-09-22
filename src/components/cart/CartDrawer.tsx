import * as React from 'react'
import { X, ShoppingCart, Plus, Minus, Trash2, CreditCard } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { useToast } from '@/contexts/ToastContext'
import { purchaseService } from '@/services/purchase.service'
import { StripeCheckout } from '@/components/checkout/StripeCheckout'
import { SuccessModal } from '@/components/ui/SuccessModal'

type CartDrawerProps = {
  isOpen: boolean
  onClose: () => void
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const { items, updateQty, removeFromCart, clearCart } = useCart()
  const { showToast } = useToast()
  const [busy, setBusy] = React.useState(false)
  const [clientSecret, setClientSecret] = React.useState<string | null>(null)
  const [targetId, setTargetId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [showThanks, setShowThanks] = React.useState(false)
  const [thanksAmount, setThanksAmount] = React.useState<number | undefined>(undefined)

  React.useEffect(() => {
    if (!isOpen) {
      setClientSecret(null)
      setTargetId(null)
      setError(null)
      setBusy(false)
    }
  }, [isOpen])

  const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0)
  const TAX_RATE = 0.1
  const SHIPPING = items.length > 0 ? 500 : 0
  const tax = Math.floor(subtotal * TAX_RATE)
  const total = subtotal + tax + SHIPPING

  const proceedCheckout = async (id: string) => {
    setBusy(true)
    setError(null)
    setTargetId(id)
    try {
      const res = await purchaseService.initiatePurchase(id)
      if (res.status === 'requires_payment' && res.clientSecret) {
        setClientSecret(res.clientSecret)
      } else {
        setError(res.error || '購入の準備に失敗しました')
      }
    } finally {
      setBusy(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside className="w-full sm:max-w-md bg-white dark:bg-gray-900 h-full shadow-xl border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="w-5 h-5" /> カート
          </div>
          <button className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800" onClick={onClose} aria-label="閉じる">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-gray-900 dark:text-gray-100 text-center py-12">カートは空です</div>
          ) : (
            items.map(it => (
              <div key={it.id} className="flex items-center gap-3 border rounded-lg p-3 dark:border-gray-700">
                {it.imageUrl && (
                  <img src={it.imageUrl} alt="thumb" className="w-16 h-16 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate jp-text text-gray-900 dark:text-white">{it.title}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">¥{(it.price * it.qty).toLocaleString()}（¥{it.price.toLocaleString()} × {it.qty}）</div>
                  <div className="mt-2 inline-flex items-center gap-2">
                    <button className="btn btn-outline" onClick={() => updateQty(it.id, Math.max(1, it.qty - 1))}><Minus className="w-4 h-4" /></button>
                    <span className="text-sm text-gray-900 dark:text-white">{it.qty}</span>
                    <button className="btn btn-outline" onClick={() => updateQty(it.id, it.qty + 1)}><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button className="btn btn-outline" onClick={() => proceedCheckout(it.id)} disabled={busy}>
                    <CreditCard className="w-4 h-4 mr-1" /> 購入
                  </button>
                  <div className="text-[11px] text-gray-500">
                    購入ボタンを押すと
                    <button className="underline" onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'terms' } }))}>利用規約</button>
                    ・
                    <button className="underline" onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'privacy' } }))}>プライバシー</button>
                    ・
                    <button className="underline" onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'refunds' } }))}>返金</button>
                    に同意したものとみなします
                  </div>
                  <button className="btn btn-outline" onClick={() => { removeFromCart(it.id); showToast({ variant: 'success', message: '削除しました' }) }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">小計</span>
            <span className="text-base font-semibold text-gray-900 dark:text-white">¥{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">消費税 (10%)</span>
            <span className="text-base text-gray-900 dark:text-white">¥{tax.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">送料</span>
            <span className="text-base text-gray-900 dark:text-white">¥{SHIPPING.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">合計</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">¥{total.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button className="btn btn-outline flex-1" onClick={() => { clearCart(); showToast({ variant: 'warning', message: 'カートを空にしました' }) }} disabled={items.length === 0}>クリア</button>
            <button
              className="btn btn-primary flex-1"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'cart' } }))
                onClose()
              }}
              disabled={items.length === 0 || busy}
            >
              まとめて購入へ進む
            </button>
          </div>
          {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
          {clientSecret && targetId && (
            <div className="mt-3">
              <StripeCheckout
                clientSecret={clientSecret}
                workId={targetId}
                onSuccess={() => {
                  setClientSecret(null)
                  const item = items.find(i => i.id === targetId)
                  if (item) {
                    setThanksAmount(item.price * item.qty)
                    removeFromCart(item.id)
                  } else {
                    setThanksAmount(undefined)
                  }
                  setShowThanks(true)
                }}
                onError={(m) => setError(m)}
                onCancel={() => { setClientSecret(null); showToast({ variant: 'warning', message: '決済をキャンセルしました' }) }}
              />
            </div>
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
                window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'orders' } }))
              }}
              secondaryActionLabel="続けてショッピング"
              onSecondaryAction={() => {
                window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'trending' } }))
              }}
            />
          )}
        </footer>
      </aside>
    </div>
  )
}

export default CartDrawer
