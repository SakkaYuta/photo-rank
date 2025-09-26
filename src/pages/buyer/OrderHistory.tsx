import React from 'react'
import { OrderHistory as OrderHistoryBody } from '@/components/buyer/OrderHistory'
import { useUserRole } from '@/hooks/useUserRole'
import { useRequireAuth } from '@/hooks/useRequireAuth'

const OrderHistoryPage: React.FC = () => {
  const { user } = useUserRole()
  const { LoginGate } = useRequireAuth()
  return (
    <div className="min-h-screen bg-gray-50">
      {!user && <LoginGate />}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">注文履歴</h1>
        </div>
      </div>
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        {user ? <OrderHistoryBody /> : (
          <div className="text-gray-600">ログインすると注文履歴を参照できます</div>
        )}
      </main>
    </div>
  )
}

export default OrderHistoryPage
