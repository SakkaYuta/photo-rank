import React, { useState, useEffect, Suspense } from 'react'
import { Header } from './components/common/Header'
import { Navigation } from './components/common/Navigation'
import { TrendingView } from './components/buyer/TrendingView'
import CreatorSearchPage from './pages/buyer/CreatorSearch'
import MerchContentHub from './pages/MerchContentHub'
import CreatorProfilePage from './pages/buyer/CreatorProfile'
import CollectionPage from './pages/buyer/Collection'
import { CreateWork } from './components/creator/CreateWork'
import { MyWorks } from './components/creator/MyWorks'
import OrderHistoryPage from './pages/buyer/OrderHistory'
import FavoritesPage from './pages/buyer/Favorites'
import CartPage from './pages/buyer/Cart'
import { ProfileSettings } from './components/buyer/ProfileSettings'
import { AdminDashboard } from './pages/AdminDashboard'
import { PartnerDashboard } from './pages/partner/PartnerDashboard'
import { PartnerProducts } from './pages/partner/PartnerProducts'
import { PartnerOrders } from './pages/partner/PartnerOrders'
import { FactoryCompare } from './components/factory/FactoryCompare'
import { FactoryCompareContainer } from '@/components/factory/FactoryCompareContainer'
import { useAuth } from './hooks/useAuth'
import { usePartnerAuth } from './hooks/usePartnerAuth'
import { useAdminAuth } from './hooks/useAdminAuth'
import { useUserRole } from './hooks/useUserRole'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NetworkErrorBoundary } from './components/NetworkErrorBoundary'
import { SuspenseFallback } from './components/SuspenseFallback'
import { PartialErrorBoundary } from './components/PartialErrorBoundary'
import { ToastProvider } from './contexts/ToastContext'
import { CartProvider } from './contexts/CartContext'
import { FavoritesProvider } from './contexts/FavoritesContext'
import { NavProvider } from './contexts/NavContext'
import { Footer } from './components/common/Footer'
import { Terms } from './pages/legal/Terms'
import { Privacy } from './pages/legal/Privacy'
import { RefundPolicy } from './pages/legal/RefundPolicy'
import { CommerceAct } from './pages/legal/CommerceAct'
import GeneralDashboard from './pages/GeneralDashboard'
import CreatorDashboard from './pages/CreatorDashboard'
import FactoryDashboard from './pages/FactoryDashboard'
import OrganizerDashboard from './pages/OrganizerDashboard'
import BattleSearch from './pages/BattleSearch'
import LocalDataViewer from './pages/dev/LocalDataViewer'
import { registerDevUtils } from './utils/devUtils'
import LiveBattle from './pages/LiveBattle'
import AccountSettings from './pages/AccountSettings'

type ViewKey =
  | 'trending'
  | 'merch'
  | 'search'
  | 'collection'
  | 'favorites'
  | 'cart'
  | 'create'
  | 'myworks'
  | 'orders'
  | 'profile'
  | 'admin'
  | 'admin-asset-policies'
  | 'admin-approvals'
  | 'partner-dashboard'
  | 'partner-products'
  | 'partner-orders'
  | 'partner-settings'
  | 'factory'
  | 'factory-order'
  | 'events'
  | 'contests'
  | 'terms'
  | 'privacy'
  | 'refunds'
  | 'commerce'
  | 'general-dashboard'
  | 'creator-dashboard'
  | 'factory-dashboard'
  | 'organizer-dashboard'
  | 'battle-search'
  | 'creator-profile'
  | 'local-data'
  | 'live-battle'
  | 'account-settings'

function App() {
  const [view, setView] = useState<ViewKey>('merch')
  const { profile } = useAuth()
  const { partner } = usePartnerAuth()
  const { isAdmin, isAdminOrModerator, adminUser } = useAdminAuth()
  const { userType, user, userProfile, loading: roleLoading } = useUserRole()
  const isPartner = Boolean(partner && partner.status === 'approved')
  const isFactoryUser = userType === 'factory'
  const isDemoMode = (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true'

  // ユーザータイプに応じて初期ビューを設定
  useEffect(() => {
    if (roleLoading) return
    if (user) {
      const viewOverride = localStorage.getItem('view_override')
      const effectiveType = (userProfile as any)?.organizer_profile
        ? 'organizer'
        : (userProfile as any)?.factory_profile
        ? 'factory'
        : userType

      switch (effectiveType) {
        case 'creator':
          navigate(viewOverride === 'general' ? 'merch' : 'creator-dashboard')
          break
        case 'factory':
          navigate('factory-dashboard')
          break
        case 'organizer':
          navigate(viewOverride === 'general' ? 'merch' : 'organizer-dashboard')
          break
        case 'general':
        default:
          navigate('general-dashboard')
          break
      }
    } else {
      // 未ログインユーザーはLPを表示
      navigate('merch')
    }
  }, [roleLoading, userType, user, (userProfile as any)?.organizer_profile, (userProfile as any)?.factory_profile])

  // セキュリティ: デモ時のみ工場ユーザーにパートナーページアクセスを許可
  const canAccessPartnerPages = isPartner || (isDemoMode && isFactoryUser)

  // 工場発注ビュー用の状態
  const [selectedProductType, setSelectedProductType] = useState<string>('tshirt')
  const [orderQuantity, setOrderQuantity] = useState<number>(10)
  const [selectedWorkId, setSelectedWorkId] = useState<string>('')
  const [currentOrderId, setCurrentOrderId] = useState<string>('')

  // ナビゲーション関数
  const isValidView = (v: string): v is ViewKey => {
    return [
      'trending','merch','search','collection','favorites','cart','create','myworks','orders','profile','admin','admin-asset-policies','admin-approvals','partner-dashboard','partner-products','partner-orders','partner-settings','factory','factory-order','events','contests','terms','privacy','refunds','commerce','general-dashboard','creator-dashboard','factory-dashboard','organizer-dashboard','battle-search','creator-profile','local-data','live-battle','account-settings'
    ].includes(v)
  }

  const navigate = (v: ViewKey) => {
    setView(v)
    try { window.location.hash = v } catch {}
  }

  // 役割に応じた許可ビューを制限（ハッシュで不正なビューが来た場合も強制補正）
  const allowedViewsFor = (role: string): ViewKey[] => {
    switch (role) {
      case 'creator':
        return ['creator-dashboard','create','myworks','orders','profile','merch','search','collection','favorites','cart','battle-search','account-settings'] as ViewKey[]
      case 'factory':
        return ['factory-dashboard','partner-orders','partner-products','partner-settings','merch','battle-search','account-settings'] as ViewKey[]
      case 'organizer':
        return ['organizer-dashboard','events','contests','merch','battle-search','account-settings'] as ViewKey[]
      default:
        return ['general-dashboard','merch','search','collection','favorites','cart','orders','battle-search','account-settings'] as ViewKey[]
    }
  }

  useEffect(() => {
    const effectiveType = (userProfile as any)?.organizer_profile
      ? 'organizer'
      : (userProfile as any)?.factory_profile
      ? 'factory'
      : userType

    const allowed = allowedViewsFor(effectiveType)
    if (!allowed.includes(view)) {
      // 強制的にロールのダッシュボードへ補正
      const fallback: Record<string, ViewKey> = {
        creator: 'creator-dashboard',
        factory: 'factory-dashboard',
        organizer: 'organizer-dashboard',
        general: 'general-dashboard',
      }
      navigate(fallback[effectiveType] || 'general-dashboard')
    }
  }, [view, userType, (userProfile as any)?.organizer_profile, (userProfile as any)?.factory_profile])

  useEffect(() => {
    // 開発者ユーティリティを初期化
    registerDevUtils()

    // WorkCardFactoryExtension からのナビゲーション
    const handler = (e: any) => {
      const { workId, productType, quantity } = e.detail || {}
      if (!workId) return
      setSelectedWorkId(workId)
      setSelectedProductType(productType || 'tshirt')
      setOrderQuantity(quantity || 10)
      setCurrentOrderId(`ORD-${Date.now()}`)
      setView('factory-order')
    }
    const navHandler = (e: any) => {
      if (e?.detail?.view) setView(e.detail.view as ViewKey)
    }
    ;(window as any).navigateTo = (v: string) => setView(v as ViewKey)
    window.addEventListener('start-factory-order', handler as any)
    window.addEventListener('navigate', navHandler as any)
    return () => {
      window.removeEventListener('start-factory-order', handler as any)
      window.removeEventListener('navigate', navHandler as any)
      try { delete (window as any).navigateTo } catch {}
    }
  }, [])

  // ハッシュナビゲーション（#view?param=... を許容）
  useEffect(() => {
    // 初期ハッシュ適用
    try {
      const raw = window.location.hash.replace(/^#/, '')
      const v = raw.split('?')[0]
      if (isValidView(v)) setView(v as ViewKey)
    } catch {}

    // ハッシュ変更監視
    const onHash = () => {
      try {
        const raw = window.location.hash.replace(/^#/, '')
        const v = raw.split('?')[0]
        if (isValidView(v)) setView(v as ViewKey)
      } catch {}
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // 本番環境でエラートラッキングサービスに送信
        if (import.meta.env.PROD) {
          console.error('App Error:', error, errorInfo)
          // Sentry.captureException(error)
        }
      }}
    >
      <NetworkErrorBoundary>
        <Suspense fallback={<SuspenseFallback />}>
          <ToastProvider>
            <CartProvider>
              <FavoritesProvider>
                <NavProvider navigate={(v) => navigate(v as ViewKey)}>
          <div className="min-h-screen bg-gray-50">
            <PartialErrorBoundary name="ヘッダー">
              <Header />
            </PartialErrorBoundary>

            <PartialErrorBoundary name="ナビゲーション">
              <Navigation
                current={view}
                onChange={(k) => setView(k as ViewKey)}
                isAdmin={isAdmin}
                isPartner={canAccessPartnerPages}
                hasProfile={Boolean(profile)}
                userType={userType}
              />
            </PartialErrorBoundary>

            <main className="mx-auto max-w-6xl">
              {view === 'general-dashboard' && (
                <PartialErrorBoundary name="一般ダッシュボード">
                  <GeneralDashboard />
                </PartialErrorBoundary>
              )}
              {view === 'creator-dashboard' && (
                <PartialErrorBoundary name="クリエイターダッシュボード">
                  <CreatorDashboard />
                </PartialErrorBoundary>
              )}
              {view === 'factory-dashboard' && (
                <PartialErrorBoundary name="工場ダッシュボード">
                  <FactoryDashboard />
                </PartialErrorBoundary>
              )}
              {view === 'organizer-dashboard' && (
                <PartialErrorBoundary name="オーガナイザーダッシュボード">
                  <OrganizerDashboard />
                </PartialErrorBoundary>
              )}
              {view === 'trending' && (
                <PartialErrorBoundary name="トレンド表示">
                  <TrendingView />
                </PartialErrorBoundary>
              )}
              {view === 'search' && (
                <PartialErrorBoundary name="クリエイター検索">
                  <CreatorSearchPage />
                </PartialErrorBoundary>
              )}
              {view === 'collection' && (
                <PartialErrorBoundary name="コレクション">
                  <CollectionPage />
                </PartialErrorBoundary>
              )}
              {view === 'favorites' && (
                <PartialErrorBoundary name="お気に入り">
                  <FavoritesPage />
                </PartialErrorBoundary>
              )}
              {view === 'cart' && (
                <PartialErrorBoundary name="ショッピングカート">
                  <CartPage />
                </PartialErrorBoundary>
              )}
              {view === 'create' && (
                <PartialErrorBoundary name="作品作成">
                  <CreateWork />
                </PartialErrorBoundary>
              )}
              {view === 'myworks' && (
                <PartialErrorBoundary name="マイ作品">
                  <MyWorks />
                </PartialErrorBoundary>
              )}
              {view === 'orders' && (
                <PartialErrorBoundary name="注文履歴">
                  <OrderHistoryPage />
                </PartialErrorBoundary>
              )}
              {view === 'profile' && (
                <PartialErrorBoundary name="プロフィール設定">
                  <ProfileSettings />
                </PartialErrorBoundary>
              )}
              {view === 'account-settings' && (
                <PartialErrorBoundary name="アカウント設定">
                  <AccountSettings />
                </PartialErrorBoundary>
              )}
              {view === 'admin' && isAdmin && (
                <PartialErrorBoundary name="管理画面">
                  <AdminDashboard />
                </PartialErrorBoundary>
              )}
              {view === 'admin-asset-policies' && isAdmin && (
                <PartialErrorBoundary name="アセットポリシー">
                  <Suspense fallback={<SuspenseFallback />}>
                    <AdminAssetPolicies />
                  </Suspense>
                </PartialErrorBoundary>
              )}
              {view === 'admin-approvals' && isAdmin && (
                <PartialErrorBoundary name="承認キュー">
                  <Suspense fallback={<SuspenseFallback />}>
                    <AdminApprovalQueue />
                  </Suspense>
                </PartialErrorBoundary>
              )}
              {view === 'partner-dashboard' && canAccessPartnerPages && (
                <PartialErrorBoundary name="パートナーダッシュボード">
                  <PartnerDashboard />
                </PartialErrorBoundary>
              )}
              {view === 'partner-products' && canAccessPartnerPages && (
                <PartialErrorBoundary name="パートナー商品">
                  <PartnerProducts />
                </PartialErrorBoundary>
              )}
              {view === 'partner-orders' && canAccessPartnerPages && (
                <PartialErrorBoundary name="パートナー注文">
                  <PartnerOrders />
                </PartialErrorBoundary>
              )}
              {view === 'partner-settings' && canAccessPartnerPages && (
                <PartialErrorBoundary name="工場設定">
                  <Suspense fallback={<SuspenseFallback />}>
                    <FactorySettings />
                  </Suspense>
                </PartialErrorBoundary>
              )}
              {view === 'factory' && (
                <PartialErrorBoundary name="工場比較">
                  <FactoryCompare />
                </PartialErrorBoundary>
              )}
              {view === 'factory-order' && (
                <PartialErrorBoundary name="工場発注">
                  <FactoryCompareContainer
                    productType={selectedProductType}
                    quantity={orderQuantity}
                    workId={selectedWorkId}
                    orderId={currentOrderId}
                    onOrderComplete={() => setView('partner-orders')}
                  />
                </PartialErrorBoundary>
              )}
              {view === 'terms' && (
                <PartialErrorBoundary name="利用規約">
                  <Terms />
                </PartialErrorBoundary>
              )}
              {view === 'privacy' && (
                <PartialErrorBoundary name="プライバシーポリシー">
                  <Privacy />
                </PartialErrorBoundary>
              )}
              {view === 'refunds' && (
                <PartialErrorBoundary name="返金ポリシー">
                  <RefundPolicy />
                </PartialErrorBoundary>
              )}
              {view === 'commerce' && (
                <PartialErrorBoundary name="特定商取引法に基づく表示">
                  <CommerceAct />
                </PartialErrorBoundary>
              )}
              {view === 'events' && (
                <PartialErrorBoundary name="イベント管理">
                  <div className="p-6">
                    <h1 className="text-2xl font-bold mb-4">イベント管理</h1>
                    <p className="text-gray-600">イベント管理機能は開発中です。</p>
                  </div>
                </PartialErrorBoundary>
              )}
              {view === 'contests' && (
                <PartialErrorBoundary name="コンテスト管理">
                  <div className="p-6">
                    <h1 className="text-2xl font-bold mb-4">コンテスト管理</h1>
                    <p className="text-gray-600">コンテスト管理機能は開発中です。</p>
                  </div>
                </PartialErrorBoundary>
              )}
              {view === 'battle-search' && (
                <PartialErrorBoundary name="バトル検索">
                  <BattleSearch />
                </PartialErrorBoundary>
              )}
              {view === 'live-battle' && (
                <PartialErrorBoundary name="ライブ観戦">
                  <LiveBattle />
                </PartialErrorBoundary>
              )}
              {view === 'creator-profile' && (
                <PartialErrorBoundary name="クリエイタープロフィール">
                  <React.Suspense fallback={<SuspenseFallback />}>
                    <CreatorProfilePage />
                  </React.Suspense>
                </PartialErrorBoundary>
              )}
              {view === 'merch' && (
                <PartialErrorBoundary name="PhotoRank">
                  <MerchContentHub />
                </PartialErrorBoundary>
              )}
              {view === 'local-data' && (
                <PartialErrorBoundary name="ローカルデータビューアー">
                  <LocalDataViewer />
                </PartialErrorBoundary>
              )}
            </main>
            <Footer />
          </div>
                </NavProvider>
              </FavoritesProvider>
            </CartProvider>
          </ToastProvider>
        </Suspense>
      </NetworkErrorBoundary>
    </ErrorBoundary>
  )
}

// Admin pages (lazy import could be added later)
const AdminAssetPolicies = React.lazy(() => import('./pages/admin/AssetPolicies'))
const AdminApprovalQueue = React.lazy(() => import('./pages/admin/AssetApprovalQueue'))
const FactorySettings = React.lazy(() => import('./pages/partner/FactorySettings'))

export default App
