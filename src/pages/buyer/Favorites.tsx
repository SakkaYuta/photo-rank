import React from 'react'
import { Favorites as FavoritesBody } from '@/components/buyer/Favorites'

const FavoritesPage: React.FC = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">お気に入り</h1>
      </div>
    </div>
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
      <FavoritesBody />
    </main>
  </div>
)

export default FavoritesPage

