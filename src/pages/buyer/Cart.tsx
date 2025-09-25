import React from 'react'
import { CartView } from '@/components/buyer/CartView'
import { useUserRole } from '@/hooks/useUserRole'
import { ArrowLeft } from 'lucide-react'

const CartPage: React.FC = () => {
  const { userType } = useUserRole()

  const getDashboardRoute = () => {
    switch (userType) {
      case 'creator':
        return 'creator-dashboard'
      case 'factory':
        return 'factory-dashboard'
      case 'organizer':
        return 'organizer-dashboard'
      default:
        return 'general-dashboard'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">カート</h1>
            <button
              onClick={() => import('@/utils/navigation').then(m => m.navigate(getDashboardRoute()))}
              className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              マイダッシュボードに戻る
            </button>
          </div>
        </div>
      </div>
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <CartView />
      </main>
    </div>
  )
}

export default CartPage
