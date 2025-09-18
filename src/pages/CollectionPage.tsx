import React, { useState, useEffect } from 'react';
import { useUserRole } from '../hooks/useUserRole';
import { fetchUserCollections, Collection } from '../services/dashboardService';
import { User, Calendar, CreditCard, ChevronRight, Grid3X3 } from 'lucide-react';

const CollectionPage: React.FC = () => {
  const { user } = useUserRole();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCollections = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const data = await fetchUserCollections(user.id);
        setCollections(data);
      } catch (error) {
        console.error('Failed to fetch collections:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCollections();
  }, [user?.id]);

  const formatPrice = (price: number) => {
    return `¥${price.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="h-8 bg-gray-200 rounded animate-pulse w-48 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-96"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse mb-4"></div>
                <div className="h-5 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">コレクション</h1>
          <p className="text-gray-600">
            購入したクリエイターの作品をコレクション別に管理できます
          </p>
        </div>

        {collections.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
              >
                {/* Creator Info */}
                <div className="flex items-center mb-4">
                  <img
                    src={collection.creator_avatar}
                    alt={collection.creator_name}
                    className="w-16 h-16 rounded-full object-cover mr-4"
                  />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {collection.creator_name}
                    </h3>
                    <p className="text-gray-500 text-sm">
                      {collection.work_count}作品を購入
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>

                {/* Collection Stats */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <CreditCard className="w-4 h-4 mr-2" />
                    <span>総支払額: {formatPrice(collection.total_spent)}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>最初の購入: {formatDate(collection.first_purchase_date)}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>最新の購入: {formatDate(collection.latest_purchase_date)}</span>
                  </div>
                </div>

                {/* Works Preview */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">作品プレビュー</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {collection.works.slice(0, 3).map((work, index) => (
                      <div
                        key={work.id}
                        className="aspect-square rounded-lg overflow-hidden bg-gray-100"
                      >
                        <img
                          src={work.image_url}
                          alt={work.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {collection.work_count > 3 && (
                      <div className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center">
                        <div className="text-center">
                          <Grid3X3 className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                          <span className="text-xs text-gray-500">
                            +{collection.work_count - 3}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              まだコレクションがありません
            </h3>
            <p className="text-gray-600 mb-6">
              クリエイターの作品を購入すると、ここにコレクションが表示されます
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'search' } }))}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              作品を探す
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionPage;