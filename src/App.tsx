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
import { useAuth } from './hooks/useAuth'
import { usePartnerAuth } from './hooks/usePartnerAuth'

type ViewKey = 'trending' | 'search' | 'collection' | 'create' | 'myworks' | 'orders' | 'admin' | 'partner-dashboard' | 'partner-products' | 'partner-orders'

function App() {
  const [view, setView] = useState<ViewKey>('trending')
  const { profile } = useAuth()
  const { partner } = usePartnerAuth()
  const isAdmin = Boolean(profile?.display_name && profile.display_name.toLowerCase().includes('admin'))
  const isPartner = Boolean(partner && partner.status === 'approved')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header />
      <Navigation 
        current={view} 
        onChange={(k) => setView(k as ViewKey)} 
        isAdmin={isAdmin} 
        isPartner={isPartner}
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
      </main>
    </div>
  )
}

export default App
