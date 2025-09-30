import React, { useMemo, useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { Work } from '@/types'
import { useToast } from '@/contexts/ToastContext'
import { createLiveOffer, publishLiveOffer } from '@/services/liveOffers.service'
import { supabase } from '@/services/supabaseClient'

type Props = {
  isOpen: boolean
  onClose: () => void
  work: Work
}

type PerksType = 'signed' | 'limited_design'

export const LiveOfferModal: React.FC<Props> = ({ isOpen, onClose, work }) => {
  const { showToast } = useToast()
  const originalPath = useMemo(() => (work as any)?.metadata?.image_original_storage_paths?.[0] as string | undefined, [work])
  const [eventId, setEventId] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [stockTotal, setStockTotal] = useState<number>(10)
  const [perUserLimit, setPerUserLimit] = useState<number>(1)
  const [priceOverride, setPriceOverride] = useState<number | ''>('')
  const [currency] = useState('jpy')

  const [perksType, setPerksType] = useState<PerksType>('signed')

  // Signed overlay settings
  const [overlayText, setOverlayText] = useState('SIGNED')
  const [overlayPos, setOverlayPos] = useState<'top-left'|'top-right'|'bottom-left'|'bottom-right'>('bottom-right')
  const [overlayColor, setOverlayColor] = useState('#ffffff')
  const [overlayOpacity, setOverlayOpacity] = useState(0.7)

  // Variant paths (either generated or manually specified)
  const [variantOriginalPath, setVariantOriginalPath] = useState('')
  const [variantPreviewPath, setVariantPreviewPath] = useState('')
  const [genBusy, setGenBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)

  const reset = () => {
    setEventId(''); setStartAt(''); setEndAt(''); setStockTotal(10); setPerUserLimit(1); setPriceOverride('')
    setPerksType('signed'); setOverlayText('SIGNED'); setOverlayPos('bottom-right'); setOverlayColor('#ffffff'); setOverlayOpacity(0.7)
    setVariantOriginalPath(''); setVariantPreviewPath('')
  }

  const handleGenerateSigned = async () => {
    try {
      if (!originalPath) { showToast({ variant: 'error', message: '原本パスが見つかりません' }); return }
      setGenBusy(true)
      const { data, error } = await supabase.functions.invoke('create-signed-variant', {
        body: {
          original_path: originalPath,
          overlay: { mode: 'text', text: overlayText, position: overlayPos, color: overlayColor, opacity: overlayOpacity }
        }
      })
      if (error) throw error
      const v = data as any
      setVariantOriginalPath(v.variant_original_path || '')
      setVariantPreviewPath(v.variant_preview_path || '')
      showToast({ variant: 'success', message: 'サイン入りバリアントを生成しました' })
    } catch (e: any) {
      showToast({ variant: 'error', message: e?.message || '生成に失敗しました' })
    } finally {
      setGenBusy(false)
    }
  }

  const buildPayload = () => {
    const payload: any = {
      work_id: work.id,
      live_event_id: eventId || undefined,
      start_at: new Date(startAt).toISOString(),
      end_at: new Date(endAt).toISOString(),
      stock_total: Number(stockTotal),
      per_user_limit: Number(perUserLimit) || 1,
      price_override: priceOverride === '' ? undefined : Number(priceOverride),
      currency,
      perks_type: perksType,
      perks: perksType === 'signed' ? {
        overlay: { mode: 'text', text: overlayText, position: overlayPos, color: overlayColor, opacity: overlayOpacity }
      } : {},
      image_preview_path: variantPreviewPath || undefined,
      variant_original_path: variantOriginalPath || undefined,
      variant_preview_path: variantPreviewPath || undefined,
    }
    return payload
  }

  const handleSave = async (publish: boolean) => {
    try {
      if (!startAt || !endAt || !stockTotal || Number(stockTotal) < 1) {
        showToast({ variant: 'error', message: '期間と在庫を入力してください' }); return
      }
      if (perksType === 'signed' && (!variantOriginalPath || !variantPreviewPath)) {
        showToast({ variant: 'warning', message: 'サイン入りはバリアント生成を先に行ってください' }); return
      }
      setSaveBusy(true)
      const created = await createLiveOffer(buildPayload())
      if (publish) {
        await publishLiveOffer(created.id)
        showToast({ variant: 'success', message: 'ライブ限定オファーを公開しました' })
      } else {
        showToast({ variant: 'success', message: '下書きとして保存しました' })
      }
      reset(); onClose()
    } catch (e: any) {
      showToast({ variant: 'error', message: e?.message || '保存に失敗しました' })
    } finally {
      setSaveBusy(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose() }} title={`ライブ限定オプション - ${work.title}`} size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">イベントID（任意）</label>
            <input className="input input-bordered w-full" value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="battle_xxx など" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">開始</label>
              <input type="datetime-local" className="input input-bordered w-full" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">終了</label>
              <input type="datetime-local" className="input input-bordered w-full" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">在庫</label>
            <input type="number" min={1} className="input input-bordered w-full" value={stockTotal} onChange={(e) => setStockTotal(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">ユーザー当たり上限</label>
            <input type="number" min={1} className="input input-bordered w-full" value={perUserLimit} onChange={(e) => setPerUserLimit(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">特価（任意）</label>
            <input type="number" min={0} className="input input-bordered w-full" value={priceOverride} onChange={(e) => setPriceOverride(e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">特典タイプ</label>
          <div className="flex items-center gap-6">
            <label className="inline-flex items-center gap-2"><input type="radio" checked={perksType==='signed'} onChange={() => setPerksType('signed')} /> サイン入り</label>
            <label className="inline-flex items-center gap-2"><input type="radio" checked={perksType==='limited_design'} onChange={() => setPerksType('limited_design')} /> 限定デザイン</label>
          </div>
        </div>

        {perksType === 'signed' && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="text-sm text-gray-600">原本: {originalPath || '未検出（作品の原本が必要）'}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1">テキスト</label>
                <input className="input input-bordered w-full" value={overlayText} onChange={e=>setOverlayText(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">位置</label>
                <select className="select select-bordered w-full" value={overlayPos} onChange={e=>setOverlayPos(e.target.value as any)}>
                  <option value="bottom-right">右下</option>
                  <option value="bottom-left">左下</option>
                  <option value="top-right">右上</option>
                  <option value="top-left">左上</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">カラー</label>
                <input type="color" className="input input-bordered w-full h-10 p-1" value={overlayColor} onChange={e=>setOverlayColor(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-sm font-semibold mb-1">不透明度</label>
                <input type="number" min={0} max={1} step={0.05} className="input input-bordered w-full" value={overlayOpacity} onChange={e=>setOverlayOpacity(Number(e.target.value))} />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button className="btn btn-primary" disabled={!originalPath || genBusy} onClick={handleGenerateSigned}>{genBusy ? '生成中...' : 'サインプレビュー生成'}</button>
              </div>
            </div>
            <div className="text-xs text-gray-600">生成パス（保存時に利用）</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className="input input-bordered w-full" placeholder="variant_original_path" value={variantOriginalPath} onChange={e=>setVariantOriginalPath(e.target.value)} />
              <input className="input input-bordered w-full" placeholder="variant_preview_path" value={variantPreviewPath} onChange={e=>setVariantPreviewPath(e.target.value)} />
            </div>
          </div>
        )}

        {perksType === 'limited_design' && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="text-sm text-gray-600">限定デザインのアセットパスを指定してください（先にアップロード/サニタイズ）</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className="input input-bordered w-full" placeholder="variant_original_path (photos-original/...)" value={variantOriginalPath} onChange={e=>setVariantOriginalPath(e.target.value)} />
              <input className="input input-bordered w-full" placeholder="variant_preview_path (photos-watermarked/...)" value={variantPreviewPath} onChange={e=>setVariantPreviewPath(e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button className="btn" onClick={() => { reset(); onClose() }}>キャンセル</button>
          <button className="btn btn-outline" disabled={saveBusy} onClick={() => handleSave(false)}>{saveBusy ? '保存中...' : '下書き保存'}</button>
          <button className="btn btn-primary" disabled={saveBusy} onClick={() => handleSave(true)}>{saveBusy ? '公開中...' : '公開'}</button>
        </div>
      </div>
    </Modal>
  )
}

export default LiveOfferModal

