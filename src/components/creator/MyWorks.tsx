import { useEffect, useState } from 'react'
import type { Work } from '../../types'
import { myWorks } from '../../services/work.service'
import { supabase } from '../../services/supabaseClient'
import { ProductCard } from '@/components/product/ProductCard'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { regeneratePreviewFromOriginal } from '@/services/uploadPipeline.service'
import { useToast } from '@/contexts/ToastContext'

export function MyWorks() {
  const [items, setItems] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const { LoginGate } = useRequireAuth()
  const { showToast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setItems([]); setLoading(false); return }
      const data = await myWorks(user.id)
      if (active) setItems(data)
      setLoading(false)
      // ハイライト対象があればスクロール
      try {
        const id = localStorage.getItem('highlight_work_id')
        if (id) {
          setHighlightId(id)
          setTimeout(() => {
            const el = document.getElementById(`work-${id}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            // ハイライトは数秒で解除
            setTimeout(() => setHighlightId((prev) => (prev === id ? null : prev)), 2200)
            localStorage.removeItem('highlight_work_id')
          }, 50)
        }
      } catch {}
    })()
    return () => { active = false }
  }, [])

  if (loading) return <div className="p-4">読み込み中...</div>

  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
      <LoginGate />
      {items.map((w) => (
        <div
          key={w.id}
          id={`work-${w.id}`}
          className={
            highlightId === w.id
              ? 'ring-2 ring-primary-500 rounded-lg transition-shadow'
              : ''
          }
        >
          <ProductCard
            id={w.id}
            imageUrl={w.thumbnail_url || w.image_url}
            title={w.title}
            price={w.price}
            badgeText={new Date(w.created_at).toLocaleDateString('ja-JP')}
          />
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="text-xs text-gray-500 truncate">
              {(w as any)?.metadata?.image_original_storage_paths?.[0] ? '原本あり' : '原本未登録'}
            </div>
            <button
              className="text-xs px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
              disabled={busyId === w.id || !(w as any)?.metadata?.image_original_storage_paths?.[0]}
              onClick={async () => {
                const originalPath = (w as any)?.metadata?.image_original_storage_paths?.[0]
                if (!originalPath) return
                setBusyId(w.id)
                try {
                  const res = await regeneratePreviewFromOriginal(originalPath, w.id)
                  if (res.ok && res.preview?.bucket && res.preview.path) {
                    const { data } = supabase.storage.from(res.preview.bucket).getPublicUrl(res.preview.path)
                    // 楽観更新: サムネイル側のみ更新
                    setItems(prev => prev.map(it => it.id === w.id ? ({ ...it, thumbnail_url: data.publicUrl, image_url: data.publicUrl }) : it))
                    showToast({ variant: 'success', message: 'プレビューを再生成しました' })
                  } else {
                    showToast({ variant: 'error', message: res.error || '再生成に失敗しました' })
                  }
                } catch (e: any) {
                  showToast({ variant: 'error', message: e?.message || '再生成に失敗しました' })
                } finally {
                  setBusyId(null)
                }
              }}
            >
              {busyId === w.id ? '生成中...' : 'プレビュー再生成'}
            </button>
          </div>
        </div>
      ))}
      {items.length === 0 && <div className="p-4 text-gray-500">作品はまだありません。</div>}
    </div>
  )
}
