import React from 'react'
import { Collection as CollectionBody } from '@/components/buyer/Collection'

const CollectionPage: React.FC = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">コレクション</h1>
      </div>
    </div>
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
      <CollectionBody />
    </main>
  </div>
)

export default CollectionPage

