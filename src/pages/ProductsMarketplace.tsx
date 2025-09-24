import React, { useState, useEffect } from 'react';
import { ShoppingCart, Heart, Eye, Star, Filter, Search, TrendingUp, Clock, Award } from 'lucide-react';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useToast } from '@/contexts/ToastContext';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  image_url: string;
  creator_id: string;
  creator_name: string;
  creator_avatar?: string;
  category: string; // 旧: プロダクト種別（Tシャツ等）
  persona?: 'streamer' | 'actor' | 'gravure' | 'idol' | 'cosplay' | 'model' | 'creator'; // 新カテゴリ
  views: number;
  likes: number;
  sales: number;
  rating: number;
  created_at: string;
  is_trending?: boolean;
  discount_percentage?: number;
  stock_quantity: number;
  product_types: string[];
}

const ProductsMarketplace: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'price_low' | 'price_high' | 'rating'>('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { add, remove, has } = useFavorites();
  const { showToast } = useToast();

  // カテゴリー（新）: 配信者/俳優・女優/グラビア/アイドル/コスプレ/モデル/クリエイター
  const categories = [
    { id: 'all', name: 'すべて' },
    { id: 'streamer', name: '配信者' },
    { id: 'actor', name: '俳優・女優' },
    { id: 'gravure', name: 'グラビア' },
    { id: 'idol', name: 'アイドル' },
    { id: 'cosplay', name: 'コスプレ' },
    { id: 'model', name: 'モデル' },
    { id: 'creator', name: 'クリエイター' },
  ] as const

  // モックデータの生成（新カテゴリ: persona を付与）
  useEffect(() => {
    const mockProducts: Product[] = [
      {
        id: '1',
        title: '推しの夢幻アート Tシャツ',
        description: '幻想的なデザインが特徴的な推し活グッズ。高品質プリントで色褪せしにくい。',
        price: 3500,
        image_url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=400&fit=crop',
        creator_id: 'creator1',
        creator_name: 'アートクリエイター結',
        creator_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
        category: 'tshirt',
        persona: 'creator',
        views: 1250,
        likes: 89,
        sales: 34,
        rating: 4.8,
        created_at: '2024-01-15',
        is_trending: true,
        discount_percentage: 15,
        stock_quantity: 50,
        product_types: ['Tシャツ', 'パーカー']
      },
      {
        id: '2',
        title: 'キラキラ推しステッカーセット',
        description: 'きらめく推しデザインのステッカー5枚セット。防水加工済み。',
        price: 1200,
        image_url: 'https://images.unsplash.com/photo-1558470598-a5dda9640f68?w=400&h=400&fit=crop',
        creator_id: 'creator2',
        creator_name: 'ステッカー工房',
        category: 'sticker',
        persona: 'idol',
        views: 890,
        likes: 67,
        sales: 156,
        rating: 4.9,
        created_at: '2024-01-20',
        stock_quantity: 200,
        product_types: ['ステッカー']
      },
      {
        id: '3',
        title: '推しカラーマグカップ',
        description: '推しカラーで染まった特別なマグカップ。電子レンジ・食洗機対応。',
        price: 2800,
        image_url: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop',
        creator_id: 'creator3',
        creator_name: 'カフェグッズ専門店',
        category: 'mug',
        persona: 'streamer',
        views: 567,
        likes: 45,
        sales: 78,
        rating: 4.7,
        created_at: '2024-01-18',
        stock_quantity: 75,
        product_types: ['マグカップ', 'タンブラー']
      },
      {
        id: '4',
        title: 'ネオンサイバー推しフォンケース',
        description: 'サイバーパンク風デザインのスマホケース。衝撃吸収素材使用。',
        price: 3200,
        image_url: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=400&h=400&fit=crop',
        creator_id: 'creator1',
        creator_name: 'アートクリエイター結',
        creator_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
        category: 'phone_case',
        persona: 'cosplay',
        views: 2100,
        likes: 123,
        sales: 89,
        rating: 4.6,
        created_at: '2024-01-22',
        is_trending: true,
        stock_quantity: 100,
        product_types: ['iPhone', 'Android']
      },
      {
        id: '5',
        title: '推し活応援ポスター A2サイズ',
        description: '高画質印刷の大型ポスター。部屋を推し色に染めよう！',
        price: 2500,
        image_url: 'https://images.unsplash.com/photo-1561070791-36c11767b26a?w=400&h=400&fit=crop',
        creator_id: 'creator4',
        creator_name: 'ポスターアート社',
        category: 'poster',
        persona: 'actor',
        views: 456,
        likes: 34,
        sales: 23,
        rating: 4.5,
        created_at: '2024-01-19',
        stock_quantity: 150,
        product_types: ['A2', 'A3', 'B2']
      },
      {
        id: '6',
        title: '推しトートバッグ - エコ素材',
        description: '環境に優しい素材を使用した大容量トートバッグ。',
        price: 2200,
        image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=400&fit=crop',
        creator_id: 'creator5',
        creator_name: 'エコバッグ工房',
        category: 'bag',
        persona: 'model',
        views: 789,
        likes: 56,
        sales: 67,
        rating: 4.8,
        created_at: '2024-01-21',
        discount_percentage: 10,
        stock_quantity: 80,
        product_types: ['トート', 'ショルダー']
      },
      {
        id: '7',
        title: 'ホログラムアクリルスタンド',
        description: 'キラキラ輝くホログラム加工のアクリルスタンド。デスクに最適！',
        price: 1800,
        image_url: 'https://images.unsplash.com/photo-1609207825181-52d3214556dd?w=400&h=400&fit=crop',
        creator_id: 'creator6',
        creator_name: 'アクリル工房きらり',
        category: 'acrylic',
        persona: 'gravure',
        views: 1456,
        likes: 178,
        sales: 234,
        rating: 4.9,
        created_at: '2024-01-17',
        is_trending: true,
        stock_quantity: 120,
        product_types: ['10cm', '15cm', '20cm']
      },
      {
        id: '8',
        title: 'レトロポップ推しTシャツ',
        description: '80年代風レトロポップなデザインTシャツ。ヴィンテージ加工済み。',
        price: 4200,
        image_url: 'https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=400&h=400&fit=crop',
        creator_id: 'creator7',
        creator_name: 'レトロデザイン社',
        category: 'tshirt',
        persona: 'creator',
        views: 987,
        likes: 76,
        sales: 45,
        rating: 4.7,
        created_at: '2024-01-16',
        stock_quantity: 60,
        product_types: ['Tシャツ', 'ロンT']
      }
    ];

    setProducts(mockProducts);
    setFilteredProducts(mockProducts);
    setLoading(false);
  }, []);

  // フィルタリングと検索の処理
  useEffect(() => {
    let filtered = [...products];

    // カテゴリーフィルタ（新カテゴリ: persona）。該当しない場合は全件表示。
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.persona === (selectedCategory as any));
    }

    // 検索フィルタ
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.creator_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // ソート処理
    switch (sortBy) {
      case 'popular':
        filtered.sort((a, b) => b.sales - a.sales);
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'price_low':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price_high':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
    }

    setFilteredProducts(filtered);
  }, [products, selectedCategory, searchTerm, sortBy]);

  const toFactoryType = (category: string): string => {
    switch (category) {
      case 'tshirt': return 'tshirt'
      case 'sticker': return 'sticker'
      case 'mug': return 'mug'
      case 'phone_case': return 'phone_case'
      case 'poster': return 'poster'
      case 'bag': return 'bag'
      case 'acrylic': return 'acrylic'
      default: return 'tshirt'
    }
  }

  const handleGoodsify = (product: Product) => {
    // グッズアイテム選択ページへ遷移
    const productData = encodeURIComponent(JSON.stringify(product));
    window.location.hash = `goods-item-selector?productId=${product.id}&data=${productData}`;
    showToast({ message: 'グッズアイテムを選択してください', variant: 'success' })
  }

  const handleToggleFavorite = (product: Product) => {
    if (has(product.id)) {
      remove(product.id)
      showToast({ message: 'お気に入りから削除しました', variant: 'default' })
    } else {
      add(product.id)
      showToast({ message: 'お気に入りに追加しました', variant: 'success' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">商品マーケットプレイス</h1>
              <p className="text-sm text-gray-600 mt-1">クリエイターの作品を探そう</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-2 border rounded-lg hover:bg-gray-50"
                title={viewMode === 'grid' ? 'リスト表示' : 'グリッド表示'}
              >
                {viewMode === 'grid' ? '⚏' : '⚎'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="商品名、クリエイター名で検索..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="popular">人気順</option>
              <option value="newest">新着順</option>
              <option value="price_low">価格が安い順</option>
              <option value="price_high">価格が高い順</option>
              <option value="rating">評価が高い順</option>
            </select>
          </div>

          {/* Category Filters */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products Grid/List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">該当する商品が見つかりませんでした</p>
          </div>
        ) : (
          <div className={viewMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
          }>
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className={viewMode === 'grid'
                  ? 'bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow overflow-hidden'
                  : 'bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow overflow-hidden flex'
                }
              >
                {/* Product Image */}
                <div className={viewMode === 'grid' ? 'relative aspect-square' : 'relative w-48 h-48 flex-shrink-0'}>
                  <img
                    src={product.image_url}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                  {product.is_trending && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      トレンド
                    </div>
                  )}
                  {product.discount_percentage && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                      -{product.discount_percentage}%
                    </div>
                  )}
                  <button
                    onClick={() => handleToggleFavorite(product)}
                    className="absolute bottom-2 right-2 p-2 bg-white rounded-full shadow-md hover:shadow-lg transition-shadow"
                  >
                    <Heart className={`w-5 h-5 ${has(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                  </button>
                </div>

                {/* Product Info */}
                <div className={viewMode === 'grid' ? 'p-4' : 'flex-1 p-4 flex flex-col justify-between'}>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.title}</h3>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>

                    {/* Creator Info */}
                    <div className="flex items-center gap-2 mb-3">
                      {product.creator_avatar && (
                        <img
                          src={product.creator_avatar}
                          alt={product.creator_name}
                          className="w-6 h-6 rounded-full"
                        />
                      )}
                      <span className="text-sm text-gray-600">{product.creator_name}</span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {product.views.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {product.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" />
                        {product.sales}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        {product.rating}
                      </span>
                    </div>

                    {/* Product Types */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {product.product_types.map((type, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-xs rounded-full">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Goodsify Action */}
                  <div className={viewMode === 'grid' ? '' : 'flex items-center justify-between'}>
                    {product.stock_quantity < 10 && (
                      <span className="text-xs text-red-500 mb-2 inline-block">残り{product.stock_quantity}点</span>
                    )}
                    <button
                      onClick={() => handleGoodsify(product)}
                      disabled={product.stock_quantity === 0}
                      className={`w-full py-2 rounded-lg font-medium transition-colors ${
                        product.stock_quantity === 0
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      {product.stock_quantity === 0 ? '在庫切れ' : 'グッズ化する'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsMarketplace;
