import React, { useEffect, useMemo, useState } from 'react'
import { Users, Search, Filter, Star } from 'lucide-react'
import { supabase } from '@/services/supabaseClient'
import { resolveImageUrl } from '@/utils/imageFallback'
import { defaultImages } from '@/utils/defaultImages'

type Row = {
  id: string
  display_name: string
  avatar_url?: string
  bio?: string
}

const isSample = (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true' || (typeof window !== 'undefined' && !!localStorage.getItem('demoUser'))

const sampleCreators: Row[] = [
  { id: 'demo-creator-1', display_name: 'デモクリエイター', avatar_url: 'https://images.unsplash.com/photo-1494790108755-2616b332c66a?w=160&h=160&fit=crop&crop=face', bio: '写真とイラストの二刀流' },
  { id: 'demo-creator-2', display_name: 'ゆき', avatar_url: 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=160&h=160&fit=crop&crop=face', bio: '透明感のあるポートレート' },
  { id: 'demo-creator-3', display_name: 'ユウ', avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&h=160&fit=crop&crop=face', bio: '夜景シティポップ' },
]

const CreatorSearchPage: React.FC = () => {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Row[]>([])
  const [sort, setSort] = useState<'name'|'popular'>('name')
  const [workCounts, setWorkCounts] = useState<Record<string, number>>({})
  const [tag, setTag] = useState<string>('')

  useEffect(() => {
    const t = setTimeout(async () => {
      if (isSample) {
        const qText = (q + ' ' + tag).trim()
        const filtered = sampleCreators.filter(c => (qText ? (c.display_name + ' ' + (c.bio||'')).includes(qText) : true))
        setItems(filtered)
        return
      }
      if (!q && !tag) { setItems([]); return }
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, avatar_url, bio')
        .or(`display_name.ilike.%${q||''}%,bio.ilike.%${tag||''}%`)
        .eq('is_creator', true)
        .limit(20)
      if (!error) setItems((data || []) as any)
    }, 250)
    return () => clearTimeout(t)
  }, [q, tag])

  // 補助: 作品数を取得して人気順に利用（本番時のみ）
  useEffect(() => {
    (async () => {
      if (isSample || items.length === 0) { setWorkCounts({}); return }
      const ids = items.map(i => i.id)
      const { data, error } = await supabase
        .from('works')
        .select('creator_id')
        .in('creator_id', ids)
      if (error) { setWorkCounts({}); return }
      const counts = (data || []).reduce((acc: Record<string, number>, row: any) => {
        acc[row.creator_id] = (acc[row.creator_id] || 0) + 1
        return acc
      }, {})
      setWorkCounts(counts)
    })()
  }, [items])

  const ordered = useMemo(() => {
    const base = [...items]
    if (sort === 'popular') {
      return base.sort((a, b) => (workCounts[b.id] || 0) - (workCounts[a.id] || 0))
    }
    return base.sort((a, b) => a.display_name.localeCompare(b.display_name))
  }, [items, sort, workCounts])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Users className="w-6 h-6 text-blue-600" /> クリエイター検索</h1>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 border rounded-lg px-3 py-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="bg-transparent text-sm text-gray-900 focus:outline-none">
                <option value="name">名前順</option>
                <option value="popular">人気順（作品数）</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <div className="flex items-center gap-2 mb-3 rounded-xl border bg-white px-3 py-2 shadow-sm">
          <Search className="w-5 h-5 text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="クリエイター名やキーワードで検索"
            className="w-full bg-transparent py-2 outline-none text-gray-900 placeholder-gray-500"
          />
        </div>
        {/* Quick categories (商品マーケットプレイスと同一カテゴリ名・UIに合わせて横スクロール) */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-2 mb-6">
          {['すべて','配信者','俳優・女優','グラビア','アイドル','コスプレ','モデル','クリエイター'].map((name) => {
            const active = (name === 'すべて' ? tag === '' : tag === name)
            const onClick = () => setTag(name === 'すべて' ? '' : name)
            return (
              <button
                key={name}
                onClick={onClick}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                  active ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {name}
              </button>
            )
          })}
        </div>

        {/* Results */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ordered.map((u) => (
            <div key={u.id} className="rounded-xl border bg-white p-4 hover:shadow transition-base">
              <div className="flex items-center gap-3">
                <img src={resolveImageUrl(u.avatar_url, [defaultImages.avatar])} className="w-14 h-14 rounded-full" />
                <div className="min-w-0">
                  <p className="font-semibold truncate text-gray-900">{u.display_name}</p>
                  {u.bio && <p className="text-sm text-gray-600 line-clamp-2">{u.bio}</p>}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
                <span className="inline-flex items-center gap-1"><Star className="w-4 h-4 text-amber-500" /> 作品数: {workCounts[u.id] || (isSample ? Math.floor(Math.random()*30)+1 : 0)}</span>
                <a
                  href={`#creator-profile?creator=${encodeURIComponent(u.id)}`}
                  onClick={() => {
                    try { localStorage.setItem('selected_creator_id', u.id) } catch {}
                  }}
                  className="text-blue-600 hover:underline"
                >作品一覧へ</a>
              </div>
            </div>
          ))}
        </div>

        {q && ordered.length === 0 && (
          <div className="text-center text-gray-500 py-16">該当するクリエイターが見つかりませんでした</div>
        )}
      </main>
    </div>
  )
}

export default CreatorSearchPage
