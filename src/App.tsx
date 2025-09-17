import { useState } from 'react'
import { Header } from './components/common/Header'
import { Navigation } from './components/common/Navigation'
import { TrendingView } from './components/buyer/TrendingView'
import { CreatorSearch } from './components/buyer/CreatorSearch'
import { Collection } from './components/buyer/Collection'
import { CreateWork } from './components/creator/CreateWork'
import { MyWorks } from './components/creator/MyWorks'
import { OrderHistory } from './components/goods/OrderHistory'
import { AdminDashboard } from './pages/AdminDashboard'
import { PartnerDashboard } from './pages/partner/PartnerDashboard'
import { PartnerProducts } from './pages/partner/PartnerProducts'
import { PartnerOrders } from './pages/partner/PartnerOrders'
import { FactoryCompare } from './components/factory/FactoryCompare'
import { FactoryCompareContainer } from '@/components/factory/FactoryCompareContainer'
import { useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { usePartnerAuth } from './hooks/usePartnerAuth'

type ViewKey =
  | 'trending'
  | 'search'
  | 'collection'
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
  const isAdmin = Boolean(profile?.display_name && profile.display_name.toLowerCase().includes('admin'))
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header />
      <Navigation 
        current={view} 
        onChange={(k) => setView(k as ViewKey)} 
        isAdmin={isAdmin} 
        isPartner={isPartner}
        hasProfile={Boolean(profile)}
      />
      <main className="mx-auto max-w-6xl">
        {view === 'trending' && <TrendingView />}
        {view === 'search' && <CreatorSearch />}
        {view === 'collection' && <Collection />}
        {view === 'create' && <CreateWork />}
        {view === 'myworks' && <MyWorks />}
        {view === 'orders' && <OrderHistory />}
        {view === 'admin' && isAdmin && <AdminDashboard />}
        {view === 'partner-dashboard' && isPartner && <PartnerDashboard />}
        {view === 'partner-products' && isPartner && <PartnerProducts />}
        {view === 'partner-orders' && isPartner && <PartnerOrders />}
        {view === 'factory-picker' && profile && <div className="p-6 text-sm text-gray-500">旧FactoryPickerは廃止予定です。新UI「工場比較」をご利用ください。</div>}
        {view === 'factory' && <FactoryCompare />}
        {view === 'factory-order' && (
          <FactoryCompareContainer
            productType={selectedProductType}
            quantity={orderQuantity}
            workId={selectedWorkId}
            orderId={currentOrderId}
            onOrderComplete={() => setView('partner-orders')}
          />
        )}
      </main>
    </div>
  )
}

export default App
