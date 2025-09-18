import React, { useState } from 'react';
import { useUserRole } from '../hooks/useUserRole';
import { Search, Heart, ShoppingCart, Sparkles, Users, TrendingUp } from 'lucide-react';
import { AuthModal } from '../components/auth/AuthModal';

const GeneralHomepage: React.FC = () => {
  const { user } = useUserRole();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleViewWorks = () => {
    // クリエイター検索ページに遷移
    window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'search' } }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Hero Section */}
      <section className="relative px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            あなたの写真を
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
              アートプリント
            </span>
            に
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            クリエイターの素晴らしい作品を発見し、高品質なプリントで手に入れよう。
            あなたのお気に入りの写真も、プロ仕様のプリントサービスで作品に変身。
          </p>

          {!user && (
            <div className="space-x-4">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
              >
                今すぐ始める
              </button>
              <button
                onClick={handleViewWorks}
                className="px-8 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-gray-400 transition-colors"
              >
                作品を見る
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-16 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Photo-Rankの特徴
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">豊富な作品検索</h3>
              <p className="text-gray-600">
                カテゴリ、価格、クリエイター別で簡単に作品を見つけられます。
                お気に入りの写真がきっと見つかります。
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">高品質プリント</h3>
              <p className="text-gray-600">
                プロ仕様の印刷技術で、写真の美しさを最大限に引き出します。
                長期保存にも対応した高品質な仕上がり。
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">お気に入り管理</h3>
              <p className="text-gray-600">
                気になる作品をお気に入りに保存して、後でゆっくり検討できます。
                コレクション機能でテーマ別に整理も。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Categories */}
      <section className="px-6 py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            人気のカテゴリ
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: '風景', count: '1,234', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop' },
              { name: 'ポートレート', count: '892', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=200&fit=crop' },
              { name: '都市', count: '756', image: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=300&h=200&fit=crop' },
              { name: '自然', count: '643', image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=200&fit=crop' }
            ].map((category) => (
              <div key={category.name} className="relative group cursor-pointer overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-shadow">
                <img
                  src={category.image}
                  alt={category.name}
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black bg-opacity-30 group-hover:bg-opacity-40 transition-opacity">
                  <div className="absolute bottom-4 left-4 text-white">
                    <h3 className="text-xl font-semibold">{category.name}</h3>
                    <p className="text-sm opacity-90">{category.count}点の作品</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-6 py-16 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">
            Photo-Rankの実績
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6">
              <div className="text-4xl font-bold text-purple-600 mb-2">10,000+</div>
              <p className="text-gray-600">アップロード作品数</p>
            </div>
            <div className="p-6">
              <div className="text-4xl font-bold text-blue-600 mb-2">2,500+</div>
              <p className="text-gray-600">登録クリエイター</p>
            </div>
            <div className="p-6">
              <div className="text-4xl font-bold text-green-600 mb-2">50,000+</div>
              <p className="text-gray-600">プリント販売数</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-gradient-to-r from-purple-600 to-blue-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl font-bold mb-6">
            今すぐPhoto-Rankを始めよう
          </h2>
          <p className="text-xl mb-8 opacity-90">
            素晴らしい写真作品との出会いがあなたを待っています
          </p>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="px-8 py-3 bg-white text-purple-600 font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            無料で登録する
          </button>
        </div>
      </section>

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <AuthModal onClose={() => setIsAuthModalOpen(false)} />
      )}
    </div>
  );
};

export default GeneralHomepage;