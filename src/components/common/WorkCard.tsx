import { Heart, ShoppingCart, X, Package } from 'lucide-react'
import type { Work } from '../../types'
import { formatJPY } from '../../utils/helpers'
import { voteWork } from '../../services/work.service'
import { purchaseService } from '../../services/purchase.service'
import { StripeCheckout } from '../checkout/StripeCheckout'
import { GoodsModal } from '../goods/GoodsModal'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

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

// 作品カード拡張: グッズ製造への導線
export const WorkCardFactoryExtension = ({ work }: { work: Work }) => {
  const [showFactoryOption, setShowFactoryOption] = useState(false)
  const [quantity, setQuantity] = useState(10)
  const [productType, setProductType] = useState('tshirt')

  const handleFactoryOrder = () => {
    window.dispatchEvent(
      new CustomEvent('start-factory-order', {
        detail: {
          workId: work.id,
          productType,
          quantity,
          designUrl: work.image_url,
        },
      })
    )
    setShowFactoryOption(false)
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setShowFactoryOption(true)}
        className="mt-2 w-full"
      >
        <Package className="w-4 h-4 mr-2" />
        グッズ化して製造
      </Button>

      {showFactoryOption && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">グッズ製造オプション</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">商品タイプ</label>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="tshirt">Tシャツ</option>
                <option value="mug">マグカップ</option>
                <option value="poster">ポスター</option>
                <option value="canvas">キャンバス</option>
                <option value="sticker">ステッカー</option>
                <option value="phonecase">スマホケース</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">製造数量</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  max={1000}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
                <span className="text-sm text-gray-500">個</span>
              </div>
              {quantity >= 50 && (
                <p className="text-sm text-green-600 mt-1">50個以上でロット割引が適用される場合があります</p>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <Button variant="ghost" onClick={() => setShowFactoryOption(false)}>
                キャンセル
              </Button>
              <Button variant="primary" onClick={handleFactoryOrder}>
                工場を比較する
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
