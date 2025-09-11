import { useState } from 'react'
import { PhotoEditor } from './PhotoEditor'
import { createWork } from '../../services/work.service'
import { supabase } from '../../services/supabaseClient'

export function CreateWork() {
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState(1500)
  const [imageUrl, setImageUrl] = useState('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop')
  const [filterType, setFilterType] = useState('none')
  const [frameType, setFrameType] = useState('none')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const onSubmit = async () => {
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('ログインが必要です')
      await createWork({
        creator_id: user.id,
        title,
        image_url: imageUrl,
        thumbnail_url: imageUrl,
        price,
        filter_type: filterType,
        frame_type: frameType,
        is_published: true
      } as any)
      setMessage('作品を公開しました')
      setTitle('')
    } catch (e: any) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="card space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">タイトル</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-gray-300 bg-white p-2 outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">価格 (円)</span>
          <input type="number" min={0} value={price} onChange={(e) => setPrice(parseInt(e.target.value || '0'))} className="w-full rounded-md border border-gray-300 bg-white p-2 outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">画像URL</span>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full rounded-md border border-gray-300 bg-white p-2 outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900" />
        </label>
      </div>

      <PhotoEditor
        imageUrl={imageUrl}
        filterType={filterType}
        frameType={frameType}
        onChange={({ filterType, frameType }) => { setFilterType(filterType); setFrameType(frameType) }}
      />

      <div className="flex justify-end gap-2">
        <button className="btn btn-primary" onClick={onSubmit} disabled={busy || !title}>公開する</button>
      </div>
      {message && <div className="text-sm text-gray-600">{message}</div>}
    </div>
  )
}

