import React, { useEffect, useState } from 'react'
import { parseHash } from '@/utils/navigation'
import { listLiveOffersForEvent, acquireLiveOfferLock, createLiveOfferIntent } from '@/services/liveOffers.service'
import { StripeCheckout } from '@/components/checkout/StripeCheckout'
import { supabase } from '@/services/supabaseClient'

const LiveEventOffers: React.FC = () => {
  const [eventId, setEventId] = useState<string>('')
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  useEffect(() => {
    const { params } = parseHash()
    setEventId(params.event || params.battle || '')
  }, [])

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const list = await listLiveOffersForEvent(eventId)
        setOffers(list || [])
        setError('')
      } catch (e: any) {
        setError(e?.message || '読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    })()
  }, [eventId])

  // Realtime: reflect stock changes in UI
  useEffect(() => {
    if (!eventId) return
    const ch = supabase
      .channel(`live-offers-${eventId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_offers', filter: `live_event_id=eq.${eventId}` }, (payload: any) => {
        const row: any = (payload as any).new
        setOffers(prev => prev.map(o => o.id === row.id ? { ...o, ...row } : o))
      })
      .subscribe()
    return () => { try { supabase.removeChannel(ch) } catch {} }
  }, [eventId])

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">ライブ限定アイテム</h1>
      {loading ? (
        <div>読み込み中...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : offers.length === 0 ? (
        <div className="text-gray-600">現在購入できるアイテムはありません。</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((o) => {
            const available = Math.max(0, (o.stock_total||0)-(o.stock_reserved||0)-(o.stock_sold||0))
            const price = o.price_override ?? o?.works?.price ?? 0
            return (
              <div key={o.id} className="rounded-lg border p-4 bg-white">
                <div className="text-xs text-gray-500 mb-1">{o.perks_type === 'signed' ? 'サイン入り' : '限定デザイン'}</div>
                <div className="text-lg font-bold">¥{price.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mb-2">残り {available} / {o.stock_total}</div>
                {selectedId === o.id && clientSecret ? (
                  <div className="mt-3">
                    <StripeCheckout clientSecret={clientSecret} workId={o.work_id}
                      onSuccess={() => { setSelectedId(null); setClientSecret(null) }}
                      onError={(m) => setError(m)}
                      onCancel={() => { setSelectedId(null); setClientSecret(null) }}
                    />
                  </div>
                ) : (
                  <button className="btn btn-primary mt-2" disabled={available<=0} onClick={async ()=>{
                    try {
                      const ok = await acquireLiveOfferLock(o.id)
                      if (!ok) { setError('在庫が確保できませんでした'); return }
                      const { clientSecret } = await createLiveOfferIntent(o.id)
                      setSelectedId(o.id)
                      setClientSecret(clientSecret)
                    } catch (e: any) {
                      setError(e?.message || '購入処理に失敗しました')
                    }
                  }}>購入</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default LiveEventOffers
