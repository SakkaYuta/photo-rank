import React, { useEffect, useState } from 'react'
import { Users, Sword, ChevronRight, Sparkles, Search, Package, Heart, ShoppingCart, TrendingUp, Zap, Globe, Gamepad2, RefreshCw } from 'lucide-react'
import { APP_NAME } from '@/utils/constants'
import { useUserRole } from '@/hooks/useUserRole'
import { supabase } from '@/services/supabaseClient'
import { AuthModal } from '@/components/auth/AuthModal'
import { UserIntentModal } from '@/components/ui/UserIntentModal'
import { userIntentUtils, type UserIntent } from '@/utils/userIntent'
import type { Work } from '@/types'
import { fetchTrendingProducts } from '@/services/productsService'

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
  const [marketProducts, setMarketProducts] = useState<any[]>([])
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isIntentModalOpen, setIsIntentModalOpen] = useState(false)
  const [userIntent, setUserIntent] = useState<UserIntent>(null)
  const { user, userType } = useUserRole()
  const isSample = (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true' || typeof window !== 'undefined' && !!localStorage.getItem('demoUser')

  // 有効なユーザー意図を取得（stateを優先）
  const effectiveIntent = userIntent || userIntentUtils.getEffectiveIntent(userType)

  // 初回訪問時の意図選択モーダル表示制御
  useEffect(() => {
    const currentIntent = userIntentUtils.getUserIntent()
    setUserIntent(currentIntent)

    // 未ログイン && 初回訪問 && 意図未設定の場合はモーダル表示
    if (!user && userIntentUtils.isFirstVisit()) {
      setIsIntentModalOpen(true)
    }
  }, [user])

  // ユーザー意図選択処理
  const handleSelectIntent = (intent: UserIntent) => {
    userIntentUtils.setUserIntent(intent)
    setUserIntent(intent)
    setIsIntentModalOpen(false)
  }

  // 意図切り替え処理
  const handleToggleIntent = () => {
    const newIntent = effectiveIntent === 'creator' ? 'fan' : 'creator'
    // localStorageを更新
    userIntentUtils.setUserIntent(newIntent)
    setUserIntent(newIntent)
  }

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

  // マーケットプレイス風の商品（トレンド商品）
  useEffect(() => {
    (async () => {
      try {
        const items = await fetchTrendingProducts(8)
        setMarketProducts(items)
      } catch {
        setMarketProducts([])
      }
    })()
  }, [])

  const formatRemaining = (createdAt?: string, endAt?: string | null) => {
    try {
      let end: Date
      if (endAt) {
        end = new Date(endAt)
      } else {
        const start = createdAt ? new Date(createdAt) : new Date()
        end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
      }
      const diff = end.getTime() - Date.now()
      if (diff <= 0) return '販売終了'
      const days = Math.floor(diff / (24 * 60 * 60 * 1000))
      const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
      return `残り ${days}日${hours}時間`
    } catch { return '' }
  }

  const go = (view: string) => window.dispatchEvent(new CustomEvent('navigate', { detail: { view } }))

  const handleViewWorks = () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'battle-search' } }))
  }

  const handleContentTypeClick = (persona: string) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'products-marketplace', persona } }))
  }

  // 未ログインユーザーにはLPを表示
  if (!user) {
    return (
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen min-h-screen">
        {/* Intent switcher */}
        {effectiveIntent && (
          <div className="fixed top-20 right-4 z-40">
            <button
              onClick={handleToggleIntent}
              className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:shadow-xl transition-all text-sm font-medium text-gray-900"
            >
              <RefreshCw className="w-4 h-4" />
{effectiveIntent === 'creator' ? '推してる方はこちら' : 'クリエイターの方はこちら'}
            </button>
          </div>
        )}

        {effectiveIntent === 'creator' ? (
          // クリエイター向けLP
          <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 min-h-screen relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0">
              <div className="absolute top-0 left-0 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute top-1/3 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
              <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-2000" />
            </div>

            {/* Hero Section */}
            <section className="relative px-4 sm:px-6 py-16 sm:py-24 text-center">
              <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-white/80 text-sm mb-6">
                    <Sparkles className="w-4 h-4" />
                    クリエイター向け
                  </div>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                  あなたの創作を
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
                    収益化
                  </span>
                  しませんか？
                </h1>

                <p className="text-lg sm:text-xl text-white/80 mb-10 max-w-3xl mx-auto leading-relaxed">
                  作品をグッズにして販売、リアルタイムバトルでファンと盛り上がり、
                  <br className="hidden sm:block" />
                  <span className="text-yellow-400 font-medium">月収10万円以上</span>を目指そう！
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-bold rounded-xl shadow-2xl hover:shadow-yellow-400/25 hover:scale-105 transform transition-all"
                  >
                    🎨 今すぐ作品を作成
                  </button>
                  <button
                    onClick={handleViewWorks}
                    className="w-full sm:w-auto px-8 py-4 bg-white/10 backdrop-blur-md text-white font-medium rounded-xl border border-white/20 hover:bg-white/20 transition-all"
                  >
                    ⚔️ バトルで稼ぐ方法を見る
                  </button>
                </div>

                {/* Success stats */}
                <div className="grid grid-cols-2 gap-8 max-w-xl mx-auto">
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-yellow-400">¥127k</div>
                    <div className="text-white/60 text-sm">月間平均売上</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-blue-400">2.3x</div>
                    <div className="text-white/60 text-sm">バトル勝率ボーナス</div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          // ファン向けLP
          <div className="bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 min-h-screen relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0">
              <div className="absolute top-0 right-0 w-72 h-72 bg-pink-300/30 rounded-full blur-3xl animate-bounce" />
              <div className="absolute top-1/2 left-0 w-96 h-96 bg-purple-300/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-blue-300/25 rounded-full blur-3xl animate-bounce delay-1000" />
            </div>

            {/* Hero Section */}
            <section className="relative px-4 sm:px-6 py-16 sm:py-24 text-center">
              <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-md rounded-full text-gray-700 text-sm mb-6">
                    <Heart className="w-4 h-4 text-pink-500" />
                    推してる方向け
                  </div>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                  推しクリエイターを
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600">
                    見つけて応援
                  </span>
                  しよう！
                </h1>

                <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
                  お気に入りのクリエイターのグッズを購入して、
                  <br className="hidden sm:block" />
                  リアルタイムバトルで<span className="text-pink-500 font-medium">一緒に盛り上がろう！</span>
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
                  <button
                    onClick={() => go('products-marketplace')}
                    className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-xl shadow-2xl hover:shadow-pink-500/25 hover:scale-105 transform transition-all"
                  >
                    🛍️ 推しグッズを探す
                  </button>
                  <button
                    onClick={handleViewWorks}
                    className="w-full sm:w-auto px-8 py-4 bg-white/80 backdrop-blur-md text-gray-700 font-medium rounded-xl border border-gray-200 hover:bg-white transition-all"
                  >
                    ⚔️ バトルで応援する
                  </button>
                </div>

                {/* Community stats */}
                <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-pink-500">1,200+</div>
                    <div className="text-gray-500 text-sm">グッズアイテム</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-purple-500">350+</div>
                    <div className="text-gray-500 text-sm">クリエイター</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-blue-500">85</div>
                    <div className="text-gray-500 text-sm">バトル開催数</div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Features Section */}
        <section className={`px-4 sm:px-6 py-12 sm:py-16 ${effectiveIntent === 'creator' ? 'bg-gray-900' : 'bg-white'}`}>
          <div className="max-w-6xl mx-auto">
            <h2 className={`text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12 ${effectiveIntent === 'creator' ? 'text-white' : 'text-gray-900'}`}>
              {effectiveIntent === 'creator' ? '収益化の仕組み' : 'PhotoRankの楽しみ方'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {effectiveIntent === 'creator' ? (
                // クリエイター向けFeatures
                <>
                  <div className="text-center p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                    <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Globe className="w-8 h-8 text-black" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-white">作品をグッズ化</h3>
                    <p className="text-white/80 text-sm leading-relaxed">
                      画像URLを入力するだけで45種類のグッズを作成。
                      自動権利チェックで安心して販売できます。
                    </p>
                  </div>

                  <div className="text-center p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Gamepad2 className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-white">バトルで稼ぐ</h3>
                    <p className="text-white/80 text-sm leading-relaxed">
                      ライブバトルで他のクリエイターと競い合い。
                      勝利すると売上20%ボーナスを獲得！
                    </p>
                    <div className="mt-4 text-blue-400 font-bold">最大 +20% ボーナス</div>
                  </div>

                  <div className="text-center p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                    <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-4">
                      <TrendingUp className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-white">ファンと繋がる</h3>
                    <p className="text-white/80 text-sm leading-relaxed">
                      応援チケットでファンと直接交流。
                      限定グッズや特典で関係を深めましょう。
                    </p>
                  </div>
                </>
              ) : (
                // ファン向けFeatures
                <>
                  <div className="text-center p-6 bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl border border-pink-200">
                    <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-gray-900">推しを発見</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      350+のクリエイターから、あなたの好みに
                      ピッタリの推しを見つけよう！
                    </p>
                    <div className="mt-4 text-pink-500 font-bold">新作チェック機能付き</div>
                  </div>

                  <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShoppingCart className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-gray-900">グッズを購入</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      1,200+のアイテムから選んで購入。
                      限定グッズやサイン入りも手に入る！
                    </p>
                    <div className="mt-4 text-blue-500 font-bold">送料無料キャンペーン</div>
                  </div>

                  <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl border border-orange-200">
                    <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Heart className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-gray-900">バトルで応援</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      リアルタイムバトルで推しを応援！
                      チケット購入で特別な特典をゲット。
                    </p>
                    <div className="mt-4 text-orange-500 font-bold">無料応援 30回/時</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Content/Success Stories Section */}
        <section className={`px-4 sm:px-6 py-16 ${effectiveIntent === 'creator' ? 'bg-gradient-to-r from-purple-900 to-blue-900' : 'bg-gray-50'}`}>
          <div className="max-w-6xl mx-auto">
            <h2 className={`text-2xl sm:text-3xl font-bold text-center mb-12 ${effectiveIntent === 'creator' ? 'text-white' : 'text-gray-900'}`}>
              {effectiveIntent === 'creator' ? '成功事例' : '人気のコンテンツ'}
            </h2>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {effectiveIntent === 'creator' ? (
                // クリエイター向け成功事例
                [
                  { name: 'アートクリエイター結', earnings: '¥127k/月', image: 'https://images.unsplash.com/photo-1494790108755-2616b332c66a?w=300&h=200&fit=crop', tag: 'イラスト' },
                  { name: 'フォトグラファーりく', earnings: '¥89k/月', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=200&fit=crop', tag: '写真' },
                  { name: 'デザイナーみお', earnings: '¥156k/月', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=200&fit=crop', tag: 'デザイン' },
                  { name: 'アニメーターカイ', earnings: '¥203k/月', image: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=300&h=200&fit=crop', tag: 'アニメ' }
                ].map((creator) => (
                  <div key={creator.name} className="relative group cursor-pointer overflow-hidden rounded-xl shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 transform hover:scale-105">
                    <img
                      src={creator.image}
                      alt={creator.name}
                      className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                      <div className="absolute top-3 left-3">
                        <span className="px-2 py-1 bg-yellow-400 text-black text-xs font-bold rounded-full">
                          {creator.tag}
                        </span>
                      </div>
                      <div className="absolute bottom-4 left-4 text-white">
                        <h3 className="text-sm font-bold leading-tight mb-1">{creator.name}</h3>
                        <p className="text-yellow-400 font-bold text-lg">{creator.earnings}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                // ファン向けコンテンツカテゴリ
                [
                  { name: '配信者', count: '234', image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=200&fit=crop', persona: 'streamer' },
                  { name: '俳優・女優', count: '189', image: 'https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?w=300&h=200&fit=crop', persona: 'actor' },
                  { name: 'グラビア', count: '156', image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=300&h=200&fit=crop', persona: 'gravure' },
                  { name: 'クリエイター', count: '143', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=200&fit=crop', persona: 'creator' }
                ].map((contentType) => (
                  <div key={contentType.name} onClick={() => handleContentTypeClick(contentType.persona)} className="relative group cursor-pointer overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                    <img
                      src={contentType.image}
                      alt={contentType.name}
                      className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
                      <div className="absolute bottom-4 left-4 text-white">
                        <h3 className="text-lg font-bold leading-tight mb-1">{contentType.name}</h3>
                        <p className="text-sm opacity-90">{contentType.count}点の作品</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
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

  const goToDashboard = () => {
    const target: Record<string, string> = {
      creator: 'creator-dashboard',
      factory: 'factory-dashboard',
      organizer: 'organizer-dashboard',
      general: 'general-dashboard',
    }
    go(target[userType] || 'general-dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-soft border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{APP_NAME}</h1>
          <div className="flex gap-3">
            <button onClick={goToDashboard} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-medium rounded-lg hover:shadow-lg transition-all text-sm">
              <Sparkles className="w-4 h-4" />
              <span>ダッシュボード</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">
        {/* Products overview (マーケットプレイス風プレビュー) */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" /> グッズ化可能な商品
            </h2>
            <button onClick={() => go('products-marketplace')} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              もっと見る <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {marketProducts.map((p) => (
              <div key={p.id} className="rounded-xl border bg-white overflow-hidden hover:shadow transition-base">
                <div className="aspect-square bg-gray-100">
                  <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="font-semibold text-gray-900 line-clamp-1">{p.title}</p>
                  <p className="text-xs text-red-600 mt-0.5">{formatRemaining(p.created_at, (p as any).sale_end_at)}</p>
                  <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
                    <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{(p.sales ?? 0).toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{p.likes ?? 0}</span>
                    <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" />{p.views ?? 0}</span>
                  </div>
                  <button
                    onClick={() => {
                      try {
                        const encoded = encodeURIComponent(JSON.stringify(p))
                        window.location.hash = `goods-item-selector?productId=${p.id}&data=${encoded}`
                      } catch {
                        window.location.hash = `goods-item-selector`
                      }
                    }}
                    className="w-full mt-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
                  >
                    グッズ化する
                  </button>
                </div>
              </div>
            ))}
          </div>
          
        </section>
        {/* Quick tabs removed as requested */}

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

      {/* UserIntent Modal */}
      <UserIntentModal
        isOpen={isIntentModalOpen}
        onClose={() => setIsIntentModalOpen(false)}
        onSelectIntent={(intent) => {
          userIntentUtils.setUserIntent(intent)
          setUserIntent(intent)
          setIsIntentModalOpen(false)
        }}
      />

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <AuthModal
          onClose={() => setIsAuthModalOpen(false)}
        />
      )}
    </div>
  )
}

export default MerchContentHub
