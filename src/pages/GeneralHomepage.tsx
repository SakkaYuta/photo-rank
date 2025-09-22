import React, { useState } from 'react';
import { useUserRole } from '../hooks/useUserRole';
import { Search, Heart, ShoppingCart, Sparkles, Users, TrendingUp, Zap, Globe, Gamepad2 } from 'lucide-react';
import { AuthModal } from '../components/auth/AuthModal';

const GeneralHomepage: React.FC = () => {
  const { user } = useUserRole();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleViewWorks = () => {
    // バトル検索ページに遷移
    window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'battle-search' } }));
  };

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Hero Section */}
      <section className="relative px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 mb-6">
            推し活を
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
              グッズバトル
            </span>
            で盛り上げよう
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            お気に入りの画像から45種類のオリジナルグッズを作成・販売。
            リアルタイムバトルで競い合い、ファンと一緒に推し活を楽しもう！
          </p>

          {!user && (
            <div className="space-x-4">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
              >
                グッズ作成を始める
              </button>
              <button
                onClick={handleViewWorks}
                className="px-8 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-gray-400 transition-colors"
              >
                バトルを見る
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
                <Globe className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">URLから簡単グッズ化</h3>
              <p className="text-gray-900">
                お気に入りの画像URLを入力するだけで、自動で権利チェック。
                45種類のグッズから選んですぐに注文できます。
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gamepad2 className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">リアルタイムバトル</h3>
              <p className="text-gray-900">
                クリエイター同士がリアルタイムでバトル！ファンの応援でポイント獲得。
                勝者には売上の20%ボーナスをプレゼント。
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">応援チケット・特典</h3>
              <p className="text-gray-900">
                100円の応援チケットでバトルをサポート。
                サイン入りグッズ権利やカスタムオプションを獲得。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Categories */}
      <section className="px-6 py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            人気のグッズカテゴリ
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Tシャツ・アパレル', count: '234', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=200&fit=crop' },
              { name: 'アクリルスタンド', count: '189', image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=300&h=200&fit=crop' },
              { name: 'ステッカー・バッジ', count: '156', image: 'https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=300&h=200&fit=crop' },
              { name: 'マグカップ・雑貨', count: '143', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop' }
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
              <div className="text-2xl sm:text-4xl font-bold text-purple-600 mb-2">1,200+</div>
              <p className="text-gray-900">作成グッズ数</p>
            </div>
            <div className="p-6">
              <div className="text-2xl sm:text-4xl font-bold text-blue-600 mb-2">350+</div>
              <p className="text-gray-900">登録クリエイター</p>
            </div>
            <div className="p-6">
              <div className="text-2xl sm:text-4xl font-bold text-green-600 mb-2">85</div>
              <p className="text-gray-900">バトル開催数</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-gradient-to-r from-purple-600 to-blue-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-2xl sm:text-4xl font-bold mb-6">
            あなたもPhoto-Rankの一員に
          </h2>
          <p className="text-xl mb-8 opacity-90">
            クリエイターとして推し活グッズを作成・販売、ファンとしてお気に入りグッズを購入・応援。みんなで推し活を盛り上げよう！
          </p>
          <div className="space-x-4">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-8 py-3 bg-white text-purple-600 font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
            >
              クリエイター登録
            </button>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-8 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-purple-600 transition-all"
            >
              ファン登録
            </button>
          </div>
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
