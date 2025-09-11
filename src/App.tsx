import { useState } from 'react'
import { Header } from './components/common/Header'
import { Navigation } from './components/common/Navigation'
import { TrendingView } from './components/buyer/TrendingView'
import { EventList } from './components/buyer/EventList'
import { CreatorSearch } from './components/buyer/CreatorSearch'
import { Collection } from './components/buyer/Collection'
import { CreateWork } from './components/creator/CreateWork'
import { MyWorks } from './components/creator/MyWorks'
import { OrderHistory } from './components/goods/OrderHistory'
import { AdminDashboard } from './pages/AdminDashboard'
import { useAuth } from './hooks/useAuth'

type ViewKey = 'trending' | 'events' | 'search' | 'collection' | 'create' | 'myworks' | 'orders' | 'admin'

function App() {
  const [view, setView] = useState<ViewKey>('trending')
  const { profile } = useAuth()
  const isAdmin = Boolean(profile?.display_name && profile.display_name.toLowerCase().includes('admin'))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header />
      <Navigation current={view} onChange={(k) => setView(k as ViewKey)} isAdmin={isAdmin} />
      <main className="mx-auto max-w-6xl">
        {view === 'trending' && <TrendingView />}
        {view === 'events' && <EventList />}
        {view === 'search' && <CreatorSearch />}
        {view === 'collection' && <Collection />}
        {view === 'create' && <CreateWork />}
        {view === 'myworks' && <MyWorks />}
        {view === 'orders' && <OrderHistory />}
        {view === 'admin' && isAdmin && <AdminDashboard />}
      </main>
    </div>
  )
}

export default App
