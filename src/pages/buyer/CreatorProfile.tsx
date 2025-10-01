import React, { useEffect, useState } from 'react'
import { supabase } from '@/services/supabaseClient'
import type { Work } from '@/types'
import { ProductCard } from '@/components/product/ProductCard'
import { isDemoEnabled } from '@/utils/demo'

const isSample = isDemoEnabled()

const CreatorProfilePage: React.FC = () => {
  const [creatorId, setCreatorId] = useState<string>('')
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // 1) ハッシュから取得 #creator-profile?creator=ID
    const raw = window.location.hash.replace(/^#/, '')
    const qs = raw.split('?')[1]
    const params = new URLSearchParams(qs)
    const byHash = params.get('creator') || ''
    // 2) localStorage から取得
    const byStorage = localStorage.getItem('selected_creator_id') || ''
    // 3) サンプル時のデフォルト
    const fallback = isSample ? 'demo-creator-1' : ''
    const id = byHash || byStorage || fallback
    setCreatorId(id)
  }, [])

  useEffect(() => {
    (async () => {
      if (!creatorId) { setLoading(false); return }
      try {
        setLoading(true)
        if (isSample) {
          const { SAMPLE_WORKS } = await import('@/sample/worksSamples')
          const list = SAMPLE_WORKS.filter((w: any) => !w.creator_id || w.creator_id === creatorId)
          setWorks(list as any)
        } else {
          const { data } = await supabase
            .from('works')
            .select('*')
            .eq('creator_id', creatorId)
            .eq('is_published', true)
            .order('created_at', { ascending: false })
          setWorks((data || []) as any)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [creatorId])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-bold text-black">クリエイターの作品</h1>
          {!creatorId && (
            <p className="text-sm text-gray-500 mt-2">
              クリエイターが選択されていません。<a href="#search" className="text-blue-600 hover:underline">クリエイター検索</a>から選んでください。
            </p>
          )}
        </div>
      </div>
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        {loading ? (
          <div className="text-gray-500">読み込み中...</div>
        ) : works.length === 0 ? (
          <div className="text-gray-500">
            作品が見つかりませんでした。{isSample ? '（サンプル）' : ''}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {works.map((w) => (
              <ProductCard
                key={w.id}
                id={w.id}
                imageUrl={(w as any).thumbnail_url || (w as any).image_url}
                title={w.title}
                price={w.price}
                badgeText={new Date(w.created_at).toLocaleDateString('ja-JP')}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default CreatorProfilePage
