import React, { useEffect, useState } from 'react'
import { Users, Sword, ChevronRight, Sparkles, Search, Package, Shirt, Sticker, Heart, ShoppingCart, TrendingUp, Zap, Globe, Gamepad2 } from 'lucide-react'
import { APP_NAME } from '@/utils/constants'
import { useUserRole } from '@/hooks/useUserRole'
import { supabase } from '@/services/supabaseClient'
import { AuthModal } from '@/components/auth/AuthModal'
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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
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

  const handleViewWorks = () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'search' } }))
  }

  // 未ログインユーザーにはLPを表示
  if (!user) {
    return (
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        {/* Hero Section */}
        <section className="relative px-4 sm:px-6 py-12 sm:py-20 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight">
              推し活を
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                グッズバトル
              </span>
              で盛り上げよう
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-gray-900 mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
              お気に入りの画像から45種類のオリジナルグッズを作成・販売。
              リアルタイムバトルで競い合い、ファンと一緒に推し活を楽しもう！
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all text-sm sm:text-base"
              >
                グッズ作成を始める
              </button>
              <button
                onClick={handleViewWorks}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-gray-400 transition-colors text-sm sm:text-base"
              >
                バトルを見る
              </button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="px-4 sm:px-6 py-12 sm:py-16 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-8 sm:mb-12">
              {APP_NAME}の特徴
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              <div className="text-center p-4 sm:p-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-7 h-7 sm:w-8 sm:h-8 text-purple-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-3">URLから簡単グッズ化</h3>
                <p className="text-gray-900 text-sm sm:text-base">
                  お気に入りの画像URLを入力するだけで、自動で権利チェック。
                  45種類のグッズから選んですぐに注文できます。
                </p>
              </div>

              <div className="text-center p-4 sm:p-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gamepad2 className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-3">リアルタイムバトル</h3>
                <p className="text-gray-900 text-sm sm:text-base">
                  クリエイター同士がリアルタイムでバトル！ファンの応援でポイント獲得。
                  勝者には売上の20%ボーナスをプレゼント。
                </p>
              </div>

              <div className="text-center p-4 sm:p-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-3">応援チケット・特典</h3>
                <p className="text-gray-900 text-sm sm:text-base">
                  100円の応援チケットでバトルをサポート。
                  サイン入りグッズ権利やカスタムオプションを獲得。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Popular Categories */}
        <section className="px-4 sm:px-6 py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-12">
              人気のグッズカテゴリ
            </h2>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { name: 'Tシャツ・アパレル', count: '234', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=200&fit=crop' },
                { name: 'アクリルスタンド', count: '189', image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=300&h=200&fit=crop' },
                { name: 'ステッカー・バッジ', count: '156', image: 'https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=300&h=200&fit=crop' },
                { name: 'マグカップ・雑貨', count: '143', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop' }
              ].map((category) => (
                <div key={category.name} className="relative group cursor-pointer overflow-hidden rounded-xl shadow-medium hover:shadow-large transition-all duration-300">
                  <img
                    src={category.image}
                    alt={category.name}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent group-hover:from-black/70 transition-all duration-300">
                    <div className="absolute bottom-4 left-4 text-white">
                      <h3 className="text-lg font-bold leading-tight mb-1">{category.name}</h3>
                      <p className="text-sm opacity-90">{category.count}点の作品</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="px-4 sm:px-6 py-16 bg-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-12">
              {APP_NAME}の実績
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="p-6">
                <div className="text-4xl font-bold text-primary-600 mb-3">1,200+</div>
                <p className="text-gray-700 text-base font-medium">作成グッズ数</p>
              </div>
              <div className="p-6">
                <div className="text-4xl font-bold text-secondary-600 mb-3">350+</div>
                <p className="text-gray-700 text-base font-medium">登録クリエイター</p>
              </div>
              <div className="p-6">
                <div className="text-4xl font-bold text-accent-600 mb-3">85</div>
                <p className="text-gray-700 text-base font-medium">バトル開催数</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-4 sm:px-6 py-20 bg-gradient-to-r from-primary-600 to-secondary-600">
          <div className="max-w-4xl mx-auto text-center text-white">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">
              あなたも{APP_NAME}の一員に
            </h2>
            <p className="text-lg lg:text-xl mb-8 opacity-90 leading-relaxed max-w-3xl mx-auto">
              クリエイターとして推し活グッズを作成・販売、ファンとしてお気に入りグッズを購入・応援。<br className="hidden sm:block" />みんなで推し活を盛り上げよう！
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full sm:w-auto px-8 py-4 bg-white text-primary-600 font-semibold rounded-xl shadow-large hover:shadow-xl hover:scale-105 transition-all duration-300 text-base"
              >
                クリエイター登録
              </button>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full sm:w-auto px-8 py-4 bg-transparent border-2 border-white text-white font-semibold rounded-xl hover:bg-white hover:text-primary-600 transition-all duration-300 text-base"
              >
                ファン登録
              </button>
            </div>
          </div>
        </section>

        {/* Auth Modal */}
        {isAuthModalOpen && (
          <AuthModal onClose={() => setIsAuthModalOpen(false)} />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-soft border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{APP_NAME}</h1>
          <div className="flex gap-3">
            <button onClick={() => go('search')} className="flex items-center gap-2 px-4 py-2.5 border-2 border-primary-200 text-primary-700 font-medium rounded-lg hover:bg-primary-50 hover:border-primary-300 transition-colors text-sm">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">クリエイター</span>
              <span className="sm:hidden">検索</span>
            </button>
            <button onClick={() => go('battle-search')} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-medium rounded-lg hover:shadow-lg transition-all text-sm">
              <Sword className="w-4 h-4" />
              <span className="hidden sm:inline">バトル</span>
              <span className="sm:hidden">対戦</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">
        {/* Products overview */}
        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" /> 販売中の商品
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <a href="#search" className="rounded-xl border bg-white p-3 sm:p-4 hover:shadow transition-base flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg bg-emerald-50 p-1.5 sm:p-2 text-emerald-600">
                <Shirt className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="font-semibold text-base sm:text-lg text-gray-900">Tシャツ</p>
                <p className="text-sm text-gray-900">¥1,500〜</p>
              </div>
            </a>
            <a href="#search" className="rounded-xl border bg-white p-3 sm:p-4 hover:shadow transition-base flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg bg-orange-50 p-1.5 sm:p-2 text-orange-600">
                <Package className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="font-semibold text-base sm:text-lg text-gray-900">マグカップ</p>
                <p className="text-sm text-gray-900">¥800〜</p>
              </div>
            </a>
            <a href="#search" className="rounded-xl border bg-white p-3 sm:p-4 hover:shadow transition-base flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg bg-pink-50 p-1.5 sm:p-2 text-pink-600">
                <Sticker className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="font-semibold text-base sm:text-lg text-gray-900">ステッカー</p>
                <p className="text-sm text-gray-900">¥300〜</p>
              </div>
            </a>
            <a href="#search" className="rounded-xl border bg-white p-3 sm:p-4 hover:shadow transition-base flex items-center gap-2 sm:gap-3">
              <div className="rounded-lg bg-indigo-50 p-1.5 sm:p-2 text-indigo-600">
                <Sparkles className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="font-semibold text-base sm:text-lg leading-tight text-gray-900">キャンバス/パネル</p>
                <p className="text-sm text-gray-900">¥4,800〜</p>
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
                  <p className="text-base font-semibold text-gray-900">クリエイターを探す</p>
                  <p className="text-sm text-gray-900">作品からグッズ化の相談や発注へ</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-700" />
            </div>
          </button>

          <button onClick={() => go('battle-search')} className="group rounded-xl border bg-white p-5 text-left shadow hover:shadow-md transition-base">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-50 p-2 text-purple-600"><Sword className="w-6 h-6" /></div>
                <div>
                  <p className="text-base font-semibold text-gray-900">バトルを探す</p>
                  <p className="text-sm text-gray-900">開催中/予定の企画からコラボ募集</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-700" />
            </div>
          </button>
        </div>

        {/* Featured creators */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-500" /> 注目のクリエイター</h2>
            <button onClick={() => go('search')} className="text-sm text-blue-600 hover:underline flex items-center gap-1">すべて見る <ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {creators.map(c => (
              <a key={c.id} href={`#creator-profile?creator=${encodeURIComponent(c.id)}`} onClick={() => { try{localStorage.setItem('selected_creator_id', c.id)}catch{} }} className="rounded-xl border bg-white p-4 block hover:shadow transition-base">
                <img src={c.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.id}`} alt="" className="w-16 h-16 rounded-full mb-3" />
                <p className="font-semibold text-gray-900">{c.name}</p>
                {c.tagline && <p className="text-sm text-gray-900 line-clamp-2">{c.tagline}</p>}
              </a>
            ))}
          </div>
        </section>

        {/* Featured battles */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Search className="w-5 h-5 text-indigo-500" /> 注目のバトル</h2>
            <button onClick={() => go('battle-search')} className="text-sm text-blue-600 hover:underline flex items-center gap-1">すべて見る <ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {battles.map(b => (
              <button key={b.id} onClick={() => { try{localStorage.setItem('battle_query', b.title)}catch{}; go('battle-search') }} className="rounded-xl border bg-white overflow-hidden text-left hover:shadow transition-base">
                <div className="aspect-[3/1] bg-gray-100">
                  {b.banner && <img src={b.banner} className="w-full h-full object-cover" />}
                </div>
                <div className="p-4">
                  <p className="font-semibold text-gray-900">{b.title}</p>
                  <p className="text-xs mt-1 text-gray-600">{b.status === 'ongoing' ? '開催中' : b.status === 'upcoming' ? '開催予定' : '終了'}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Your eligible online data */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">あなたのオンラインデータ</h2>
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
                        <span className="text-gray-900">¥{w.price?.toLocaleString?.() || w.price}</span>
                        <a href="#factory" className="text-blue-600 hover:underline">工場比較</a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border bg-white p-6 text-gray-700">
                まだ作品がありません。<a href="#create" className="text-blue-600 hover:underline">作品を作成</a>してグッズ化してみましょう。
              </div>
            )
          ) : (
            <div className="rounded-xl border bg-white p-6 text-gray-700">
              お気に入りからグッズ化候補を探せます。<a href="#favorites" className="text-blue-600 hover:underline">お気に入りを見る</a>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default MerchContentHub
