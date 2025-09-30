import React, { useState, useEffect, Suspense } from 'react'
import { Header } from './components/common/Header'
import { Navigation } from './components/common/Navigation'
import { TrendingView } from './components/buyer/TrendingView'
import CreatorSearchPage from './pages/buyer/CreatorSearch'
import MerchContentHub from './pages/MerchContentHub'
import CreatorProfilePage from './pages/buyer/CreatorProfile'
import CreatorGoodsPage from './pages/buyer/CreatorGoods'
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
import { PaymentMethods } from './pages/PaymentMethods'
import { Receipt } from './pages/Receipt'
import { Refunds } from './pages/Refunds'
import { FAQ } from './pages/FAQ'
import GeneralDashboard from './pages/GeneralDashboard'
import CreatorDashboard from './pages/CreatorDashboard'
import FactoryDashboard from './pages/FactoryDashboard'
import OrganizerDashboard from './pages/OrganizerDashboard'
import BattleSearch from './pages/BattleSearch'
import { registerDevUtils } from './utils/devUtils'
import { NAV_EVENT, viewToHash, parseHash } from '@/utils/navigation'
import { allowedViews as ROUTES, isValidView, ROUTES_META, type RoleKey, defaultViewFor } from '@/routes'
import LiveBattle from './pages/LiveBattle'
import LiveEventOffers from './pages/LiveEventOffers'
import { BattleRoom } from './pages/BattleRoom'
import AccountSettings from './pages/AccountSettings'
import ProductsMarketplace from './pages/ProductsMarketplace'
import AuthCallbackGate from './components/auth/AuthCallbackGate'
import GoodsItemSelector from './pages/GoodsItemSelector'
import FactoryCatalog from './pages/FactoryCatalog'
import FactoryItemDetail from './pages/FactoryItemDetail'
import OrganizerSupport from './pages/organizer/OrganizerSupport'
import LeaveRequest from './pages/organizer/LeaveRequest'
import InvoiceSettings from './pages/organizer/InvoiceSettings'
import OrganizerRevenue from './pages/organizer/RevenueManagement'
import OrganizerGuidelines from './pages/organizer/OrganizerGuidelines'

type ViewKey = typeof ROUTES[number]

function App() {
  // 先に /auth/callback をハンドリング（ハッシュルーターに入る前に処理）
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/callback')) {
    return <AuthCallbackGate />
  }
  const [view, setView] = useState<ViewKey>('merch')
  const { profile } = useAuth()
  const { partner } = usePartnerAuth()
  const { isAdmin, isAdminOrModerator, adminUser } = useAdminAuth()
  const { userType, user, userProfile, loading: roleLoading } = useUserRole()
  const isPartner = Boolean(partner && partner.status === 'approved')
  const isFactoryUser = userType === 'factory'
  const isDemoMode = (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true'

  // ログイン後のデフォルト遷移先をルートメタに基づいて設定
  useEffect(() => {
    if (roleLoading) return
    const isAdminUser = !!isAdmin
    let role: RoleKey | 'guest' = 'guest'
    if (user) {
      role = (userType as RoleKey) || 'general'
      if ((userProfile as any)?.organizer_profile) role = 'organizer'
      else if ((userProfile as any)?.factory_profile || userType === 'factory') role = 'factory'
      else if (userType === 'creator') role = 'creator'
      if (isAdminUser) role = 'admin'
    }
    navigate(defaultViewFor(role))
  }, [roleLoading, user, userProfile, userType])

  // セキュリティ: デモ時のみ工場ユーザーにパートナーページアクセスを許可
  const canAccessPartnerPages = isPartner || (isDemoMode && isFactoryUser)

  // 工場発注ビュー用の状態
  const [selectedProductType, setSelectedProductType] = useState<string>('tshirt')
  const [orderQuantity, setOrderQuantity] = useState<number>(10)
  const [selectedWorkId, setSelectedWorkId] = useState<string>('')
  const [currentOrderId, setCurrentOrderId] = useState<string>('')

  // ナビゲーション関数（検証は routes.ts に集約）

  const navigate = (v: ViewKey) => {
    setView(v)
    try { window.location.hash = viewToHash(v) } catch {}
  }

  // 役割に応じた許可ビューを制限（ハッシュで不正なビューが来た場合も強制補正）
  const allowedViewsFor = (role: string): ViewKey[] => {
    const r = (role as RoleKey) || 'general'
    return (ROUTES as readonly ViewKey[]).filter((view) => {
      const meta = ROUTES_META[view]
      // Auth gate: if requireAuth and no user, allow only public
      if (meta.requireAuth && !user) return false
      // Role gate: if roles specified, must include role; otherwise all roles allowed
      if (meta.roles && !meta.roles.includes(r)) return false
      return true
    }) as ViewKey[]
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
        // ログアウト（ゲスト相当）や一般ロールはトップへ
        general: 'merch',
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
      if (e?.detail?.view) {
        setView(e.detail.view as ViewKey)
        // persona パラメータがある場合、URLハッシュに追加
        if (e.detail.view === 'products-marketplace' && e.detail.persona) {
          window.location.hash = viewToHash(e.detail.view, { persona: e.detail.persona })
        }
      }
    }
    ;(window as any).navigateTo = (v: string) => setView(v as ViewKey)
    window.addEventListener('start-factory-order', handler as any)
    window.addEventListener(NAV_EVENT, navHandler as any)
    return () => {
      window.removeEventListener('start-factory-order', handler as any)
      window.removeEventListener(NAV_EVENT, navHandler as any)
      try { delete (window as any).navigateTo } catch {}
    }
  }, [])

  // ハッシュナビゲーション（#view?param=... を許容）
  useEffect(() => {
    // 初期ハッシュ適用
    try {
      const { view: v } = parseHash()
      if (isValidView(v)) setView(v as ViewKey)
    } catch {}

    // ハッシュ変更監視
    const onHash = () => {
      try {
        const { view: v } = parseHash()
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
              <Header currentView={view} />
            </PartialErrorBoundary>

            {view !== 'merch' && (
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
            )}

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
              {view === 'admin-refunds' && isAdmin && (
                <PartialErrorBoundary name="返金管理">
                  <Suspense fallback={<SuspenseFallback />}>
                    <AdminRefundRequests />
                  </Suspense>
                </PartialErrorBoundary>
              )}
              {view === 'admin-refunds' && isAdmin && (
                <PartialErrorBoundary name="返金管理">
                  <Suspense fallback={<SuspenseFallback />}>
                    <AdminRefundRequests />
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
              {view === 'payment-methods' && (
                <PartialErrorBoundary name="お支払い方法">
                  <PaymentMethods />
                </PartialErrorBoundary>
              )}
              {view === 'receipt' && (
                <PartialErrorBoundary name="領収書発行">
                  <Receipt />
                </PartialErrorBoundary>
              )}
              {view === 'faq' && (
                <PartialErrorBoundary name="よくある質問">
                  <FAQ />
                </PartialErrorBoundary>
              )}
              {view === 'refunds' && (
                <PartialErrorBoundary name="返品・交換">
                  <Refunds />
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
              {view === 'organizer-revenue' && (
                <PartialErrorBoundary name="売上管理">
                  <OrganizerRevenue />
                </PartialErrorBoundary>
              )}
              {view === 'organizer-support' && (
                <PartialErrorBoundary name="オーガナイザー窓口">
                  <OrganizerSupport />
                </PartialErrorBoundary>
              )}
              {view === 'organizer-leave' && (
                <PartialErrorBoundary name="所属解除申請">
                  <LeaveRequest />
                </PartialErrorBoundary>
              )}
              {view === 'organizer-invoice' && (
                <PartialErrorBoundary name="インボイス設定">
                  <InvoiceSettings />
                </PartialErrorBoundary>
              )}
              {view === 'organizer-guidelines' && (
                <PartialErrorBoundary name="規約・ガイドライン">
                  <OrganizerGuidelines />
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
              {view === 'live-offers' && (
                <PartialErrorBoundary name="ライブ限定アイテム">
                  <LiveEventOffers />
                </PartialErrorBoundary>
              )}
              {view === 'live-battle' && (
                <PartialErrorBoundary name="ライブ観戦">
                  <LiveBattle />
                </PartialErrorBoundary>
              )}
              {view === 'battle-room' && (
                <PartialErrorBoundary name="バトル申請">
                  <BattleRoom />
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
              {view === 'products-marketplace' && (
                <PartialErrorBoundary name="商品マーケットプレイス">
                  <ProductsMarketplace />
                </PartialErrorBoundary>
              )}
              {view === 'creator-goods' && (
                <PartialErrorBoundary name="クリエイター作品一覧">
                  <CreatorGoodsPage />
                </PartialErrorBoundary>
              )}
              {view === 'goods-item-selector' && (
                <PartialErrorBoundary name="グッズアイテム選択">
                  <GoodsItemSelector />
                </PartialErrorBoundary>
              )}
              {view === 'factory-catalog' && (
                <PartialErrorBoundary name="工場カタログ">
                  <FactoryCatalog />
                </PartialErrorBoundary>
              )}
              {view === 'factory-item-detail' && (
                <PartialErrorBoundary name="工場アイテム詳細">
                  <FactoryItemDetail />
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
const AdminRefundRequests = React.lazy(() => import('./pages/admin/RefundRequests'))
const FactorySettings = React.lazy(() => import('./pages/partner/FactorySettings'))

export default App
