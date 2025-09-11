import { Heart, ShoppingCart, X } from 'lucide-react'
import type { Work } from '../../types'
import { formatJPY } from '../../utils/helpers'
import { voteWork } from '../../services/work.service'
import { purchaseService } from '../../services/purchase.service'
import { StripeCheckout } from '../checkout/StripeCheckout'
import { GoodsModal } from '../goods/GoodsModal'
import { useState } from 'react'

export function WorkCard({ work }: { work: Work }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onBuy = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await purchaseService.initiatePurchase(work.id)
      if (res.status === 'requires_payment' && res.clientSecret) {
        setClientSecret(res.clientSecret)
        setShowCheckout(true)
      } else if (res.error) {
        setError(res.error)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onVote = async () => {
    setBusy(true)
    try { await voteWork(work.id) } finally { setBusy(false) }
  }

  return (
    <div className="card">
      <img src={work.thumbnail_url || work.image_url} alt={work.title} className="mb-3 h-60 w-full rounded-md object-cover" />
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{work.title}</h3>
          <p className="text-sm text-gray-500">{formatJPY(work.price)}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={onVote} disabled={busy} title="投票">
            <Heart className="h-4 w-4" />
          </button>
          <button className="btn btn-primary" onClick={onBuy} disabled={busy} title="購入">
            <ShoppingCart className="mr-1 h-4 w-4" />購入
          </button>
        </div>
      </div>
      {error && <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</div>}
      {open && <GoodsModal work={work} onClose={() => setOpen(false)} />}
      {showCheckout && clientSecret && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">決済情報を入力</h3>
              <button className="btn btn-outline" onClick={() => { setShowCheckout(false); setClientSecret(null) }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <StripeCheckout
              clientSecret={clientSecret}
              workId={work.id}
              onSuccess={() => {
                setShowCheckout(false)
                setClientSecret(null)
                setOpen(true)
              }}
              onError={(msg) => setError(msg)}
              onCancel={() => { setShowCheckout(false); setClientSecret(null) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
