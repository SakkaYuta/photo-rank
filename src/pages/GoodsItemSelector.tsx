import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Info, Check, Package, Truck, Clock, Star } from 'lucide-react';
import { resolveImageUrl } from '@/utils/imageFallback'
import { defaultImages } from '@/utils/defaultImages'
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { useUserRole } from '@/hooks/useUserRole'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { GoodsPreviewCarousel } from '@/components/goods/GoodsPreviewCarousel'
import type { PreviewSlide } from '@/components/goods/GoodsPreviewCarousel'
import GOODS_MOCKUPS from '@/config/goods-mockups'
import { getFactoryProductMockups } from '@/services/factory-mockups.service'
import { getFactoryProductById } from '@/services/partner.service'

// グッズアイテムの型定義
interface GoodsItem {
  id: string;
  name: string;
  category: string;
  description: string;
  basePrice: number;
  productionTime: string; // 製作期間
  minOrder: number; // 最小注文数
  features: string[]; // 特徴
  image: string;
  mockups?: string[]; // 他アングルのモックアップ画像
  sizes?: string[]; // サイズ展開
  colors?: string[]; // カラー展開
  materials?: string; // 素材
  printArea?: string; // 印刷可能範囲
  popularity: number; // 人気度（1-5）
  isRecommended?: boolean;
  discountRate?: number; // 割引率
}

const GoodsItemSelector: React.FC = () => {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [goodsItems, setGoodsItems] = useState<GoodsItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<GoodsItem | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const { addToCart } = useCart();
  const { showToast } = useToast();
  const { user } = useUserRole();
  const { requireAuth, LoginGate } = useRequireAuth();

  // URLパラメータから商品IDを取得
  useEffect(() => {
    // ハッシュ (#goods-item-selector?data=...) からクエリを取得（フォールバックでsearchも見る）
    let qs = ''
    try {
      const raw = window.location.hash.replace(/^#/, '')
      qs = raw.includes('?') ? raw.split('?')[1] : ''
    } catch {}
    const params = new URLSearchParams(qs || window.location.search)
    const productId = params.get('productId')
    const factoryProductId = params.get('factoryProductId') || undefined
    const productData = params.get('data')

    if (productData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(productData));
        setSelectedProduct(decoded);
      } catch (e) {
        console.error('Failed to parse product data:', e);
      }
    }

    // グッズアイテムデータをロード
    loadGoodsItems();
    if (factoryProductId) {
      // 先に取得して state などに乗せる（スライド生成時に使用）
      ;(async () => {
        try {
          const mocks = await getFactoryProductMockups(factoryProductId)
          ;(window as any).__FACTORY_MOCKS__ = mocks // 開発デバッグ用
          setFactoryMockups(mocks.map(m => ({ mockupUrl: m.image_url, geometry: (m as any).geometry } as any)))
        } catch (e) { console.warn('factoryProductId provided but fetch failed', e) }
        try {
          const fp = await getFactoryProductById(factoryProductId)
          if (fp) setFactoryPartnerId(fp.partner_id)
        } catch (e) { console.warn('getFactoryProductById failed', e) }
      })()
    }
  }, []);

  const [factoryMockups, setFactoryMockups] = useState<Array<{ mockupUrl: string; geometry?: any }>>([])
  const [factoryPartnerId, setFactoryPartnerId] = useState<string | null>(null)

  const loadGoodsItems = () => {
    // グッズアイテムのマスターデータ
    const items: GoodsItem[] = [
      // アパレル系
      {
        id: 'tshirt-standard',
        name: 'スタンダードTシャツ',
        category: 'apparel',
        description: '定番の綿100%Tシャツ。着心地が良く、幅広い年齢層に人気。',
        basePrice: 2800,
        productionTime: '7〜10日',
        minOrder: 1,
        features: ['綿100%', '豊富なサイズ展開', 'フルカラープリント対応'],
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
        sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        colors: ['ホワイト', 'ブラック', 'グレー', 'ネイビー', 'レッド'],
        materials: '綿100%',
        printArea: '前面・背面・袖',
        popularity: 5,
        isRecommended: true
      },
      {
        id: 'hoodie-premium',
        name: 'プレミアムパーカー',
        category: 'apparel',
        description: '厚手の裏起毛パーカー。秋冬シーズンの人気アイテム。',
        basePrice: 4800,
        productionTime: '10〜14日',
        minOrder: 1,
        features: ['裏起毛', '大きめポケット', 'フード紐付き'],
        image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop',
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        colors: ['ブラック', 'グレー', 'ネイビー', 'バーガンディ'],
        materials: '綿80%、ポリエステル20%',
        printArea: '前面・背面',
        popularity: 4
      },
      {
        id: 'longtee-basic',
        name: 'ロングスリーブTシャツ',
        category: 'apparel',
        description: '長袖の定番Tシャツ。オールシーズン活躍する万能アイテム。',
        basePrice: 3200,
        productionTime: '7〜10日',
        minOrder: 1,
        features: ['綿100%', 'リブ袖口', 'サイドシームレス'],
        image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=400&fit=crop',
        sizes: ['S', 'M', 'L', 'XL'],
        colors: ['ホワイト', 'ブラック', 'グレー'],
        materials: '綿100%',
        printArea: '前面・背面・袖',
        popularity: 3
      },

      // 小物・アクセサリー系
      {
        id: 'sticker-vinyl',
        name: 'ビニールステッカー',
        category: 'accessories',
        description: '防水・耐候性に優れたステッカー。屋外使用も可能。',
        basePrice: 300,
        productionTime: '3〜5日',
        minOrder: 10,
        features: ['防水加工', 'UV耐性', 'カスタムカット'],
        image: 'https://images.unsplash.com/photo-1558470598-a5dda9640f68?w=400&h=400&fit=crop',
        sizes: ['5cm', '10cm', '15cm'],
        materials: 'ビニール',
        printArea: '全面',
        popularity: 5,
        isRecommended: true,
        discountRate: 20
      },
      {
        id: 'badge-pin',
        name: '缶バッジ',
        category: 'accessories',
        description: 'オリジナルデザインの缶バッジ。コレクションにも最適。',
        basePrice: 200,
        productionTime: '5〜7日',
        minOrder: 20,
        features: ['光沢仕上げ', '安全ピン付き', '錆びにくい'],
        image: 'https://images.unsplash.com/photo-1611339555312-e607c8352fd7?w=400&h=400&fit=crop',
        sizes: ['32mm', '44mm', '57mm', '76mm'],
        materials: 'スチール',
        printArea: '全面',
        popularity: 4
      },
      {
        id: 'keychain-acrylic',
        name: 'アクリルキーホルダー',
        category: 'accessories',
        description: '透明感のあるアクリル製キーホルダー。両面印刷対応。',
        basePrice: 600,
        productionTime: '7〜10日',
        minOrder: 5,
        features: ['両面印刷', 'カスタムシェイプ', '丈夫なリング'],
        image: 'https://images.unsplash.com/photo-1609207825181-52d3214556dd?w=400&h=400&fit=crop',
        sizes: ['5cm', '7cm', '10cm'],
        materials: 'アクリル',
        printArea: '両面',
        popularity: 4
      },

      // スタンド・ディスプレイ系
      {
        id: 'acrylic-stand',
        name: 'アクリルスタンド',
        category: 'display',
        description: 'デスクに飾れるアクリルスタンド。推し活グッズの定番。',
        basePrice: 1800,
        productionTime: '10〜14日',
        minOrder: 1,
        features: ['高透明度', '安定した台座', 'UV印刷'],
        image: 'https://images.unsplash.com/photo-1609207825181-52d3214556dd?w=400&h=400&fit=crop',
        sizes: ['10cm', '15cm', '20cm'],
        materials: 'アクリル',
        printArea: '片面',
        popularity: 5,
        isRecommended: true
      },
      {
        id: 'photo-frame',
        name: 'フォトフレーム',
        category: 'display',
        description: '高品質な木製フレーム。思い出の写真を美しく飾れます。',
        basePrice: 2400,
        productionTime: '7〜10日',
        minOrder: 1,
        features: ['天然木使用', 'ガラス面', '壁掛け対応'],
        image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400&h=400&fit=crop',
        sizes: ['A5', 'A4', 'A3'],
        colors: ['ナチュラル', 'ブラウン', 'ホワイト'],
        materials: '木材・ガラス',
        printArea: '内部写真',
        popularity: 3
      },

      // 日用品・雑貨系
      {
        id: 'mug-ceramic',
        name: 'セラミックマグカップ',
        category: 'homeware',
        description: '毎日使える定番マグカップ。電子レンジ・食洗機対応。',
        basePrice: 1800,
        productionTime: '7〜10日',
        minOrder: 1,
        features: ['電子レンジ対応', '食洗機対応', '330ml容量'],
        image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop',
        colors: ['ホワイト', 'ブラック'],
        materials: 'セラミック',
        printArea: '全周',
        popularity: 5,
        isRecommended: true
      },
      {
        id: 'tumbler-stainless',
        name: 'ステンレスタンブラー',
        category: 'homeware',
        description: '保温・保冷対応のステンレスタンブラー。アウトドアにも最適。',
        basePrice: 3200,
        productionTime: '10〜14日',
        minOrder: 1,
        features: ['真空断熱', '結露しない', '350ml容量'],
        image: 'https://images.unsplash.com/photo-1570784332176-19ec21cc4a7e?w=400&h=400&fit=crop',
        colors: ['シルバー', 'ブラック', 'ホワイト'],
        materials: 'ステンレス',
        printArea: '側面',
        popularity: 4
      },
      {
        id: 'tote-bag',
        name: 'キャンバストートバッグ',
        category: 'homeware',
        description: '厚手のキャンバス生地を使用した丈夫なトートバッグ。',
        basePrice: 2200,
        productionTime: '7〜10日',
        minOrder: 1,
        features: ['大容量', '内ポケット付き', '肩掛け可能'],
        image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=400&fit=crop',
        sizes: ['M (35×35cm)', 'L (40×40cm)'],
        colors: ['ナチュラル', 'ブラック', 'ネイビー'],
        materials: 'キャンバス（綿100%）',
        printArea: '両面',
        popularity: 4
      },
      {
        id: 'pouch-canvas',
        name: 'キャンバスポーチ',
        category: 'homeware',
        description: '小物収納に便利なポーチ。化粧品や文具の整理に最適。',
        basePrice: 1200,
        productionTime: '5〜7日',
        minOrder: 1,
        features: ['ファスナー付き', '裏地付き', 'マチ付き'],
        image: 'https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6?w=400&h=400&fit=crop',
        sizes: ['S (15×10cm)', 'M (20×15cm)', 'L (25×20cm)'],
        colors: ['ナチュラル', 'ブラック'],
        materials: 'キャンバス',
        printArea: '表面',
        popularity: 3
      },

      // スマホ・デジタル系
      {
        id: 'phone-case',
        name: 'スマホケース',
        category: 'digital',
        description: 'オリジナルデザインのスマホケース。各機種対応。',
        basePrice: 2800,
        productionTime: '7〜10日',
        minOrder: 1,
        features: ['衝撃吸収', 'ワイヤレス充電対応', '各機種対応'],
        image: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=400&h=400&fit=crop',
        sizes: ['iPhone 15/14/13', 'Android各種'],
        colors: ['クリア', 'ブラック', 'ホワイト'],
        materials: 'TPU/ポリカーボネート',
        printArea: '背面',
        popularity: 5,
        isRecommended: true
      },
      {
        id: 'mouse-pad',
        name: 'マウスパッド',
        category: 'digital',
        description: '滑らかな操作性のマウスパッド。デスクのアクセントにも。',
        basePrice: 1500,
        productionTime: '5〜7日',
        minOrder: 1,
        features: ['滑り止め加工', '防水加工', 'エッジ保護'],
        image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=400&h=400&fit=crop',
        sizes: ['22×18cm', '30×25cm', '40×30cm'],
        materials: 'ラバー・布',
        printArea: '表面',
        popularity: 3
      },

      // ポスター・印刷物系
      {
        id: 'poster-matte',
        name: 'マットポスター',
        category: 'prints',
        description: '高品質印刷のポスター。反射が少なく見やすい。',
        basePrice: 2000,
        productionTime: '5〜7日',
        minOrder: 1,
        features: ['高解像度印刷', 'マット仕上げ', '色褪せ防止'],
        image: 'https://images.unsplash.com/photo-1561070791-36c11767b26a?w=400&h=400&fit=crop',
        sizes: ['A3', 'A2', 'B2', 'A1'],
        materials: 'マット紙',
        printArea: '全面',
        popularity: 4
      },
      {
        id: 'tapestry',
        name: 'タペストリー',
        category: 'prints',
        description: '部屋の雰囲気を変える布製タペストリー。取り付け簡単。',
        basePrice: 3500,
        productionTime: '10〜14日',
        minOrder: 1,
        features: ['布製', '軽量', '取り付け棒付き'],
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop',
        sizes: ['60×90cm', '90×120cm', '120×150cm'],
        materials: 'ポリエステル布',
        printArea: '全面',
        popularity: 3
      }
    ];

    setGoodsItems(items);
  };

  // カテゴリー一覧
  const categories = [
    { id: 'all', name: 'すべて' },
    { id: 'apparel', name: 'アパレル' },
    { id: 'accessories', name: 'アクセサリー' },
    { id: 'display', name: 'ディスプレイ' },
    { id: 'homeware', name: '日用品' },
    { id: 'digital', name: 'デジタル' },
    { id: 'prints', name: '印刷物' }
  ];

  // フィルタリングされたアイテム
  const filteredItems = selectedCategory === 'all'
    ? goodsItems
    : goodsItems.filter(item => item.category === selectedCategory);

  // カートに追加
  const handleAddToCart = () => {
    if (!requireAuth()) {
      showToast({ message: 'これ以上進めるには会員ログインが必要です', variant: 'warning' })
      return
    }
    if (!selectedItem) return;

    // サイズとカラーの検証
    if (selectedItem.sizes && !selectedSize) {
      showToast({ message: 'サイズを選択してください', variant: 'error' })
      return;
    }
    if (selectedItem.colors && !selectedColor) {
      showToast({ message: 'カラーを選択してください', variant: 'error' })
      return;
    }

    const cartItem = {
      id: `${selectedProduct?.id || 'goods'}-${selectedItem.id}-${Date.now()}`,
      title: `${selectedProduct?.title || '商品'} - ${selectedItem.name}`,
      price: calculatePrice(),
      imageUrl: selectedProduct?.image_url || selectedItem.image,
      factoryId: factoryPartnerId || undefined,
    }

    addToCart(cartItem, quantity)
    showToast({ message: 'カートに追加しました', variant: 'success' })

    // 選択をリセット
    setSelectedItem(null);
    setQuantity(1);
    setSelectedSize('');
    setSelectedColor('');
  };

  // 価格計算
  const calculatePrice = () => {
    if (!selectedItem) return 0;
    const baseTotal = selectedItem.basePrice * quantity;
    const discount = selectedItem.discountRate ? baseTotal * (selectedItem.discountRate / 100) : 0;
    return Math.floor(baseTotal - discount);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">グッズアイテムを選択</h1>
              {selectedProduct && (
                <p className="text-sm text-gray-600 mt-1">
                  「{selectedProduct.title}」のグッズを作成
                </p>
              )}
            </div>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              ← 戻る
            </button>
          </div>
        </div>
      </div>

      {/* 選択中の商品プレビュー */}
      {selectedProduct && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center gap-4">
              <img
                src={selectedProduct.image_url}
                alt={selectedProduct.title}
                className="w-20 h-20 object-cover rounded-lg"
              />
              <div>
                <h3 className="font-semibold text-gray-900">{selectedProduct.title}</h3>
                <p className="text-sm text-gray-600">by {selectedProduct.creator_name}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* カテゴリーフィルター */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* グッズアイテム一覧 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow overflow-hidden cursor-pointer"
              onClick={() => {
                if (!requireAuth()) {
                  showToast({ message: 'これ以上進めるには会員ログインが必要です', variant: 'warning' })
                  return
                }
                setSelectedItem(item)
              }}
            >
              {/* バッジ */}
              {item.isRecommended && (
                <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">
                  おすすめ
                </div>
              )}
              {item.discountRate && (
                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">
                  -{item.discountRate}%
                </div>
              )}

              {/* 画像 */}
              <div className="relative aspect-square">
                <img
                  src={resolveImageUrl(item.image, [defaultImages.product])}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                  <h3 className="text-white font-semibold text-lg">{item.name}</h3>
                </div>
              </div>

              {/* 情報 */}
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-3">{item.description}</p>

                {/* 特徴 */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {item.features.slice(0, 3).map((feature, index) => (
                    <span key={index} className="px-2 py-1 bg-gray-100 text-xs rounded-full text-gray-800">
                      {feature}
                    </span>
                  ))}
                </div>

                {/* メタ情報 */}
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.productionTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    最小{item.minOrder}個〜
                  </span>
                </div>

                {/* 人気度 */}
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < item.popularity
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="text-xs text-gray-600 ml-1">({item.popularity}.0)</span>
                </div>

                {/* 価格 */}
                <div className="flex items-center justify-between">
                  {item.discountRate ? (
                    <div>
                      <span className="text-sm text-gray-400 line-through">
                        ¥{item.basePrice.toLocaleString()}
                      </span>
                      <span className="text-lg font-bold text-red-500 ml-2">
                        ¥{Math.floor(item.basePrice * (1 - item.discountRate / 100)).toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <span className="text-lg font-bold text-gray-900">
                      ¥{item.basePrice.toLocaleString()}〜
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 共通ログインゲート */}
      <LoginGate />

      {/* 選択モーダル */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">グッズの詳細設定</h2>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="flex gap-6 mb-6">
                {(() => {
                  // Config優先（工場登録の基本モックアップがある想定）
                  const cfg = GOODS_MOCKUPS[selectedItem.id]
                  const cfgSlides = cfg?.slides || []
                  const hasFactory = factoryMockups.length > 0
                  const mockups = hasFactory
                    ? factoryMockups.map(s => s.mockupUrl)
                    : (cfgSlides.length > 0 ? cfgSlides.map(s => s.mockupUrl) : (selectedItem.mockups && selectedItem.mockups.length > 0 ? selectedItem.mockups : [selectedItem.image]))
                  // 作品側のギャラリー（存在すれば優先的に取り込む）
                  const gallery: string[] = (
                    (selectedProduct?.images as string[] | undefined)
                    || (selectedProduct?.image_urls as string[] | undefined)
                    || (selectedProduct?.gallery as string[] | undefined)
                    || []
                  ).filter(Boolean)
                  const artVariantsAll = [
                    selectedProduct?.image_url,
                    selectedProduct?.thumbnail_url,
                    ...gallery,
                  ].filter(Boolean) as string[]
                  // 重複排除して最大10件に制限（スライド側でもガードするが念のため）
                  const artVariants = Array.from(new Set(artVariantsAll)).slice(0, 10)
                  let slides: PreviewSlide[] = [
                    // 他アングルモックアップ（デフォルトのアート）。Configにgeometryがあれば引き継ぐ。
                    ...mockups.map((m, idx) => ({ mockupUrl: m, variantId: selectedItem.id, geometry: (hasFactory ? factoryMockups[idx]?.geometry : cfgSlides[idx]?.geometry) })),
                    // 作品の別バリエーション（1枚目のモックアップを基準に差し替え）
                    ...artVariants.slice(1).map((a) => ({ mockupUrl: mockups[0], variantId: selectedItem.id, artUrl: a, geometry: (hasFactory ? factoryMockups[0]?.geometry : cfgSlides[0]?.geometry) })),
                    // 作品のみ
                    { artOnly: true },
                  ]
                  slides = slides.slice(0, 10)
                  return (
                    <GoodsPreviewCarousel size={192} artUrl={artVariants[0]} slides={slides} enableSwipe autoplayMs={3500} />
                  )
                })()}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{selectedItem.name}</h3>
                  <p className="text-gray-600 mb-4">{selectedItem.description}</p>

                  {/* 特徴 */}
                  <div className="mb-4">
                    <h4 className="font-medium text-sm text-gray-700 mb-2">特徴</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedItem.features.map((feature, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 詳細情報 */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedItem.materials && (
                      <div>
                        <span className="text-gray-500">素材:</span>
                        <span className="ml-2 font-medium">{selectedItem.materials}</span>
                      </div>
                    )}
                    {selectedItem.printArea && (
                      <div>
                        <span className="text-gray-500">印刷範囲:</span>
                        <span className="ml-2 font-medium">{selectedItem.printArea}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">製作期間:</span>
                      <span className="ml-2 font-medium">{selectedItem.productionTime}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">最小注文数:</span>
                      <span className="ml-2 font-medium">{selectedItem.minOrder}個</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* オプション選択 */}
              <div className="space-y-4 mb-6">
                {/* サイズ選択 */}
                {selectedItem.sizes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      サイズ <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.sizes.map(size => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`px-4 py-2 border rounded-lg transition-colors ${
                            selectedSize === size
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* カラー選択 */}
                {selectedItem.colors && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      カラー <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.colors.map(color => (
                        <button
                          key={color}
                          onClick={() => setSelectedColor(color)}
                          className={`px-4 py-2 border rounded-lg transition-colors ${
                            selectedColor === color
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 数量選択 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    数量（最小注文数: {selectedItem.minOrder}個）
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setQuantity(Math.max(selectedItem.minOrder, quantity - 1))}
                      className="w-10 h-10 border rounded-lg hover:bg-gray-50"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(selectedItem.minOrder, parseInt(e.target.value) || selectedItem.minOrder))}
                      className="w-20 px-3 py-2 border rounded-lg text-center"
                      min={selectedItem.minOrder}
                    />
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-10 h-10 border rounded-lg hover:bg-gray-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* 価格表示 */}
              <div className="border-t pt-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">単価</span>
                  <span className="font-medium">
                    ¥{selectedItem.basePrice.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">数量</span>
                  <span className="font-medium">×{quantity}</span>
                </div>
                {selectedItem.discountRate && (
                  <div className="flex items-center justify-between mb-2 text-green-600">
                    <span>割引（{selectedItem.discountRate}%OFF）</span>
                    <span>-¥{Math.floor(selectedItem.basePrice * quantity * selectedItem.discountRate / 100).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-lg font-bold border-t pt-2">
                  <span>合計</span>
                  <span className="text-2xl text-purple-600">
                    ¥{calculatePrice().toLocaleString()}
                  </span>
                </div>
              </div>

              {/* アクションボタン */}
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddToCart}
                  disabled={
                    (selectedItem.sizes && !selectedSize) ||
                    (selectedItem.colors && !selectedColor)
                  }
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-5 h-5" />
                  カートに追加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoodsItemSelector;
