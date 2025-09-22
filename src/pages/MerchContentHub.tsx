import React, { useEffect, useState } from 'react'
import { Users, Sword, ChevronRight, Sparkles, Search, Package, Shirt, MugHot, Sticker } from 'lucide-react'
import { APP_NAME } from '@/utils/constants'
import { useUserRole } from '@/hooks/useUserRole'
import { supabase } from '@/services/supabaseClient'
import type { Work } from '@/types'

type FeaturedCreator = {
  id: string
  name: string
  avatar?: string
  tagline?: string
}

type FeaturedBattle = {
  id: string
  title: string
  banner?: string
  status: 'ongoing' | 'upcoming' | 'ended'
}

const MerchContentHub: React.FC = () => {
  const [creators, setCreators] = useState<FeaturedCreator[]>([])
  const [battles, setBattles] = useState<FeaturedBattle[]>([])
  const [myEligible, setMyEligible] = useState<Work[]>([])
  const { user, userType } = useUserRole()
  const isSample = (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true' || typeof window !== 'undefined' && !!localStorage.getItem('demoUser')

  useEffect(() => {
    // 軽量なサンプル（本番ではAPIに置き換え）
    if (isSample) {
      setCreators([
        { id: 'c1', name: 'さくら', avatar: 'https://images.unsplash.com/photo-1494790108755-2616b332c66a?w=160&h=160&fit=crop&crop=face', tagline: '春色の世界を切り取る' },
        { id: 'c2', name: 'りく', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&h=160&fit=crop&crop=face', tagline: '街角スナップの魔術師' },
        { id: 'c3', name: 'みお', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=160&h=160&fit=crop&crop=face', tagline: '淡い空気の写真家' },
        { id: 'c4', name: 'カイ', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=160&h=160&fit=crop&crop=face', tagline: '夜景とネオンの達人' },
      ])
      setBattles([
        { id: 'b1', title: '夜景×ネオン バトル', banner: 'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?w=600&h=300&fit=crop', status: 'ongoing' },
        { id: 'b2', title: '海と空の青コンテスト', banner: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=600&h=300&fit=crop', status: 'upcoming' },
        { id: 'b3', title: '桜フォト合戦', banner: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=600&h=300&fit=crop', status: 'ended' },
      ])
    }
  }, [])

  // あなたのグッズ化可能データ（クリエイターなら自分の作品、一般なら空または案内）
  useEffect(() => {
    (async () => {
      if (!user) { setMyEligible([]); return }
      try {
        if (isSample) {
          const { SAMPLE_WORKS } = await import('@/sample/worksSamples')
          const items = SAMPLE_WORKS.filter((w: any) => userType === 'creator' ? (w.creator_id === user.id || true) : true).slice(0, 6) as any
          setMyEligible(items)
          return
        }
        if (userType === 'creator') {
          const { data } = await supabase
            .from('works')
            .select('*')
            .eq('creator_id', user.id)
            .order('created_at', { ascending: false })
            .limit(6)
          setMyEligible((data || []) as any)
        } else {
          setMyEligible([])
        }
      } catch {
        setMyEligible([])
      }
    })()
  }, [user?.id, userType])

  const go = (view: string) => window.dispatchEvent(new CustomEvent('navigate', { detail: { view } }))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{APP_NAME}</h1>
          <div className="flex gap-2">
            <button onClick={() => go('search')} className="btn btn-outline flex items-center gap-2">
              <Users className="w-4 h-4" /> クリエイター
            </button>
            <button onClick={() => go('battle-search')} className="btn btn-primary flex items-center gap-2">
              <Sword className="w-4 h-4" /> バトル
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-10">
        {/* Products overview */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Package className="w-5 h-5 text-teal-600" /> 販売中の商品</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a href="#search" className="rounded-xl border bg-white p-4 hover:shadow transition-base flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><Shirt className="w-6 h-6" /></div>
              <div>
                <p className="font-semibold">Tシャツ</p>
                <p className="text-xs text-gray-500">¥1,500〜</p>
              </div>
            </a>
            <a href="#search" className="rounded-xl border bg-white p-4 hover:shadow transition-base flex items-center gap-3">
              <div className="rounded-lg bg-orange-50 p-2 text-orange-600"><MugHot className="w-6 h-6" /></div>
              <div>
                <p className="font-semibold">マグカップ</p>
                <p className="text-xs text-gray-500">¥800〜</p>
              </div>
            </a>
            <a href="#search" className="rounded-xl border bg-white p-4 hover:shadow transition-base flex items-center gap-3">
              <div className="rounded-lg bg-pink-50 p-2 text-pink-600"><Sticker className="w-6 h-6" /></div>
              <div>
                <p className="font-semibold">ステッカー</p>
                <p className="text-xs text-gray-500">¥300〜</p>
              </div>
            </a>
            <a href="#search" className="rounded-xl border bg-white p-4 hover:shadow transition-base flex items-center gap-3">
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><Sparkles className="w-6 h-6" /></div>
              <div>
                <p className="font-semibold">キャンバス/パネル</p>
                <p className="text-xs text-gray-500">¥4,800〜</p>
              </div>
            </a>
          </div>
        </section>
        {/* Quick tabs (tappable) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => go('search')} className="group rounded-xl border bg-white p-5 text-left shadow hover:shadow-md transition-base">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><Users className="w-6 h-6" /></div>
                <div>
                  <p className="text-base font-semibold">クリエイターを探す</p>
                  <p className="text-sm text-gray-600">作品からグッズ化の相談や発注へ</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
            </div>
          </button>

          <button onClick={() => go('battle-search')} className="group rounded-xl border bg-white p-5 text-left shadow hover:shadow-md transition-base">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-50 p-2 text-purple-600"><Sword className="w-6 h-6" /></div>
                <div>
                  <p className="text-base font-semibold">バトルを探す</p>
                  <p className="text-sm text-gray-600">開催中/予定の企画からコラボ募集</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
            </div>
          </button>
        </div>

        {/* Featured creators */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-500" /> 注目のクリエイター</h2>
            <button onClick={() => go('search')} className="text-sm text-blue-600 hover:underline flex items-center gap-1">すべて見る <ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {creators.map(c => (
              <a key={c.id} href={`#creator-profile?creator=${encodeURIComponent(c.id)}`} onClick={() => { try{localStorage.setItem('selected_creator_id', c.id)}catch{} }} className="rounded-xl border bg-white p-4 block hover:shadow transition-base">
                <img src={c.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.id}`} alt="" className="w-16 h-16 rounded-full mb-3" />
                <p className="font-semibold">{c.name}</p>
                {c.tagline && <p className="text-sm text-gray-600 line-clamp-2">{c.tagline}</p>}
              </a>
            ))}
          </div>
        </section>

        {/* Featured battles */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Search className="w-5 h-5 text-indigo-500" /> 注目のバトル</h2>
            <button onClick={() => go('battle-search')} className="text-sm text-blue-600 hover:underline flex items-center gap-1">すべて見る <ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {battles.map(b => (
              <button key={b.id} onClick={() => { try{localStorage.setItem('battle_query', b.title)}catch{}; go('battle-search') }} className="rounded-xl border bg-white overflow-hidden text-left hover:shadow transition-base">
                <div className="aspect-[3/1] bg-gray-100">
                  {b.banner && <img src={b.banner} className="w-full h-full object-cover" />}
                </div>
                <div className="p-4">
                  <p className="font-semibold">{b.title}</p>
                  <p className="text-xs mt-1 text-gray-500">{b.status === 'ongoing' ? '開催中' : b.status === 'upcoming' ? '開催予定' : '終了'}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Your eligible online data */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">あなたのオンラインデータ</h2>
            {userType === 'creator' ? (
              <a href="#myworks" className="text-sm text-blue-600 hover:underline">もっと見る</a>
            ) : (
              <a href="#favorites" className="text-sm text-blue-600 hover:underline">お気に入りを見る</a>
            )}
          </div>
          {userType === 'creator' ? (
            myEligible.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {myEligible.map((w) => (
                  <div key={w.id} className="rounded-xl border bg-white overflow-hidden hover:shadow transition-base">
                    <div className="aspect-[4/3] bg-gray-100">
                      <img src={(w as any).thumbnail_url || (w as any).image_url} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-3">
                      <p className="font-medium truncate">{w.title}</p>
                      <div className="flex items-center justify-between mt-2 text-sm">
                        <span className="text-gray-600">¥{w.price?.toLocaleString?.() || w.price}</span>
                        <a href="#factory" className="text-blue-600 hover:underline">工場比較</a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border bg-white p-6 text-gray-600">
                まだ作品がありません。<a href="#create" className="text-blue-600 hover:underline">作品を作成</a>してグッズ化してみましょう。
              </div>
            )
          ) : (
            <div className="rounded-xl border bg-white p-6 text-gray-600">
              お気に入りからグッズ化候補を探せます。<a href="#favorites" className="text-blue-600 hover:underline">お気に入りを見る</a>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default MerchContentHub
