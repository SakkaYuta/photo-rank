import React from 'react'
import { CartView } from '@/components/buyer/CartView'

const CartPage: React.FC = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">カート</h1>
      </div>
    </div>
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
      <CartView />
    </main>
  </div>
)

export default CartPage

