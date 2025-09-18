import React, { useState, useEffect, Suspense } from 'react'
import { Header } from './components/common/Header'
import { Navigation } from './components/common/Navigation'
import { TrendingView } from './components/buyer/TrendingView'
import { CreatorSearch } from './components/buyer/CreatorSearch'
import { Collection } from './components/buyer/Collection'
import { CreateWork } from './components/creator/CreateWork'
import { MyWorks } from './components/creator/MyWorks'
import { OrderHistory } from './components/goods/OrderHistory'
import { Favorites } from './components/buyer/Favorites'
import { CartView } from './components/buyer/CartView'
import { AdminDashboard } from './pages/AdminDashboard'
import { PartnerDashboard } from './pages/partner/PartnerDashboard'
import { PartnerProducts } from './pages/partner/PartnerProducts'
import { PartnerOrders } from './pages/partner/PartnerOrders'
import { FactoryCompare } from './components/factory/FactoryCompare'
import { FactoryCompareContainer } from '@/components/factory/FactoryCompareContainer'
import { useAuth } from './hooks/useAuth'
import { usePartnerAuth } from './hooks/usePartnerAuth'
import { useAdminAuth } from './hooks/useAdminAuth'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NetworkErrorBoundary } from './components/NetworkErrorBoundary'
import { SuspenseFallback } from './components/SuspenseFallback'
import { PartialErrorBoundary } from './components/PartialErrorBoundary'
import { ToastProvider } from './contexts/ToastContext'
import { CartProvider } from './contexts/CartContext'
import { FavoritesProvider } from './contexts/FavoritesContext'

type ViewKey =
  | 'trending'
  | 'search'
  | 'collection'
  | 'favorites'
  | 'cart'
  | 'create'
  | 'myworks'
  | 'orders'
  | 'admin'
  | 'partner-dashboard'
  | 'partner-products'
  | 'partner-orders'
  | 'factory-picker'
  | 'factory'
  | 'factory-order'

function App() {
  const [view, setView] = useState<ViewKey>('trending')
  const { profile } = useAuth()
  const { partner } = usePartnerAuth()
  const { isAdmin, isAdminOrModerator, adminUser } = useAdminAuth()
  const isPartner = Boolean(partner && partner.status === 'approved')

  // 工場発注ビュー用の状態
  const [selectedProductType, setSelectedProductType] = useState<string>('tshirt')
  const [orderQuantity, setOrderQuantity] = useState<number>(10)
  const [selectedWorkId, setSelectedWorkId] = useState<string>('')
  const [currentOrderId, setCurrentOrderId] = useState<string>('')

  useEffect(() => {
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
    window.addEventListener('start-factory-order', handler as any)
    window.addEventListener('navigate', navHandler as any)
    return () => {
      window.removeEventListener('start-factory-order', handler as any)
      window.removeEventListener('navigate', navHandler as any)
    }
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
          <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
            <PartialErrorBoundary name="ヘッダー">
              <Header />
            </PartialErrorBoundary>

            <PartialErrorBoundary name="ナビゲーション">
              <Navigation
                current={view}
                onChange={(k) => setView(k as ViewKey)}
                isAdmin={isAdmin}
                isPartner={isPartner}
                hasProfile={Boolean(profile)}
              />
            </PartialErrorBoundary>

            <main className="mx-auto max-w-6xl">
              {view === 'trending' && (
                <PartialErrorBoundary name="トレンド表示">
                  <TrendingView />
                </PartialErrorBoundary>
              )}
              {view === 'search' && (
                <PartialErrorBoundary name="クリエイター検索">
                  <CreatorSearch />
                </PartialErrorBoundary>
              )}
              {view === 'collection' && (
                <PartialErrorBoundary name="コレクション">
                  <Collection />
                </PartialErrorBoundary>
              )}
              {view === 'favorites' && (
                <PartialErrorBoundary name="お気に入り">
                  <Favorites />
                </PartialErrorBoundary>
              )}
              {view === 'cart' && (
                <PartialErrorBoundary name="ショッピングカート">
                  <CartView />
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
                  <OrderHistory />
                </PartialErrorBoundary>
              )}
              {view === 'admin' && isAdmin && (
                <PartialErrorBoundary name="管理画面">
                  <AdminDashboard />
                </PartialErrorBoundary>
              )}
              {view === 'partner-dashboard' && isPartner && (
                <PartialErrorBoundary name="パートナーダッシュボード">
                  <PartnerDashboard />
                </PartialErrorBoundary>
              )}
              {view === 'partner-products' && isPartner && (
                <PartialErrorBoundary name="パートナー商品">
                  <PartnerProducts />
                </PartialErrorBoundary>
              )}
              {view === 'partner-orders' && isPartner && (
                <PartialErrorBoundary name="パートナー注文">
                  <PartnerOrders />
                </PartialErrorBoundary>
              )}
              {view === 'factory-picker' && profile && (
                <div className="p-6 text-sm text-gray-500">
                  旧FactoryPickerは廃止予定です。新UI「工場比較」をご利用ください。
                </div>
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
            </main>
          </div>
              </FavoritesProvider>
            </CartProvider>
          </ToastProvider>
        </Suspense>
      </NetworkErrorBoundary>
    </ErrorBoundary>
  )
}

export default App
