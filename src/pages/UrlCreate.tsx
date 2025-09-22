import React, { useState } from 'react'
import { ingestOnlineAsset, generatePreview, getPublicUrl, createCustomProductIntent } from '@/services/asset.service'
import { StripeCheckout } from '@/components/checkout/StripeCheckout'

export const UrlCreate: React.FC = () => {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [assetId, setAssetId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState<string>('')
  const [author, setAuthor] = useState<string>('')
  const [productType, setProductType] = useState<'tshirt'|'mug'|'sticker'>('tshirt')
  const [color, setColor] = useState<string>('white')
  const [size, setSize] = useState<string>('M')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [tempWorkId, setTempWorkId] = useState<string | null>(null)

  const isValidUrl = (u: string) => {
    if (!u || u.length > 2048) return false
    try {
      const parsed = new URL(u)
      return parsed.protocol === 'https:' || parsed.protocol === 'http:'
    } catch { return false }
  }

  const onIngest = async () => {
    setError(null)
    setMessage('')
    setPreviewUrl(null)
    setAssetId(null)
    setStatus(null)
    const u = url.trim()
    if (!isValidUrl(u)) {
      setError('有効なURLを入力してください（https://...）')
      return
    }
    setLoading(true)
    try {
      const res = await ingestOnlineAsset(u, { title: title || undefined, author: author || undefined })
      setAssetId(res.asset_id)
      setStatus(res.status)
      if (res.status === 'approved') {
        setMessage('権利判定: 自動承認。プレビュー生成を実行できます。')
      } else if (res.status === 'pending') {
        setMessage('権利判定: 手動承認待ち。承認後にプレビュー生成が可能です。')
      } else {
        setMessage(`権利判定: ${res.status}`)
      }
    } catch (e: any) {
      setError(e?.message || '取込に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const onPreview = async () => {
    if (!assetId) return
    setLoading(true)
    setError(null)
    setMessage('')
    try {
      const res = await generatePreview(assetId)
      const publicUrl = getPublicUrl(res.bucket, res.preview_url)
      setPreviewUrl(publicUrl)
    } catch (e: any) {
      setError(e?.message || 'プレビュー生成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const onCheckout = async () => {
    if (!assetId || !previewUrl) return
    setLoading(true)
    setError(null)
    setMessage('')
    try {
      const res = await createCustomProductIntent({
        assetId,
        productType,
        color,
        size
      })
      setClientSecret(res.clientSecret)
      setTempWorkId(res.workId)
    } catch (e: any) {
      setError(e?.message || '決済の準備に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">URLからグッズ化</h1>
      <div className="mb-2 flex gap-2 flex-wrap items-end">
        <input
          className="input input-bordered w-full max-w-xl"
          placeholder="画像のURLを入力 (https://...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">タイトル（任意）</label>
          <input className="input input-bordered" value={title} onChange={e => setTitle(e.target.value)} placeholder="作品名など" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">作者名（任意）</label>
          <input className="input input-bordered" value={author} onChange={e => setAuthor(e.target.value)} placeholder="作者/権利者" />
        </div>
        <button className="btn btn-primary" onClick={onIngest} disabled={loading}>取込</button>
      </div>
      <p className="text-xs text-gray-500 mb-4">注: 公序良俗に反する画像、透かし入り画像、権利を侵害する画像は使用できません。許諾が必要な場合は承認待ちとなります。</p>
      {message && <div className="alert alert-info mb-4">{message}</div>}
      {error && <div className="alert alert-error mb-4">{error}</div>}
      {assetId && (
        <div className="mb-6">
          <div className="text-sm text-gray-600">Asset ID: {assetId}</div>
          <div className="text-sm text-gray-600">Status: {status}</div>
          <button className="btn btn-outline mt-2" onClick={onPreview} disabled={loading || status === 'pending'}>
            プレビュー生成
          </button>
        </div>
      )}
      {previewUrl && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">プレビュー</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="preview" className="max-w-md rounded border" />
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-semibold mb-2">グッズ構成（MVP）</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="flex items-center gap-2">種類
            <select value={productType} onChange={e => setProductType(e.target.value as 'tshirt'|'mug'|'sticker')} className="select select-bordered">
              <option value="tshirt">Tシャツ</option>
              <option value="mug">マグ</option>
              <option value="sticker">ステッカー</option>
            </select>
          </label>
          <label className="flex items-center gap-2">色
            <select value={color} onChange={e => setColor(e.target.value)} className="select select-bordered">
              <option value="white">White</option>
              <option value="black">Black</option>
              <option value="navy">Navy</option>
            </select>
          </label>
          <label className="flex items-center gap-2">サイズ
            <select value={size} onChange={e => setSize(e.target.value)} className="select select-bordered">
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
            </select>
          </label>
          {!clientSecret ? (
            <button className="btn btn-primary" disabled={!assetId || !previewUrl || loading || status === 'pending'} onClick={onCheckout}>
              この構成で購入に進む
            </button>
          ) : (
            <div className="w-full max-w-md">
              <StripeCheckout clientSecret={clientSecret} workId={tempWorkId || ''}
                onSuccess={() => setMessage('決済が完了しました。発送準備に進みます。')}
                onSucceeded={(pi) => {
                  // 購入の反映にはWebhook処理のタイムラグがあり得ます
                  window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'orders' } }))
                }}
                onError={(err) => setError(err || '決済に失敗しました')}
                onCancel={() => setClientSecret(null)}
              />
            </div>
          )}
        </div>
        <ul className="text-xs text-gray-500 mt-2 list-disc pl-5">
          <li>取込URLは著作権/利用許諾の範囲内でご利用ください。</li>
          <li>承認待ち（pending）の場合は、管理者の承認後に購入可能になります。</li>
          <li>プレビューは透かし入りで表示されます。製造時のみ原画像を使用します。</li>
        </ul>
      </div>
    </div>
  )
}

export default UrlCreate
