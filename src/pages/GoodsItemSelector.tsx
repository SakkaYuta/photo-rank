import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { getFactoryProductById, getPartnerById, getPartnerProducts } from '@/services/partner.service'
import type { FactoryProduct } from '@/types/partner.types'

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
  const [recentGoodsIds, setRecentGoodsIds] = useState<string[]>([]);

  // 検索・フィルター用のステート
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortKey, setSortKey] = useState<string>('popular');
  const [filterSize, setFilterSize] = useState<string>('');
  const [filterColor, setFilterColor] = useState<string>('');
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');

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
          if (fp) { setFactoryPartnerId(fp.partner_id); setCurrentFactoryProduct(fp) }
        } catch (e) { console.warn('getFactoryProductById failed', e) }
      })()
    }
  }, []);

  const [factoryMockups, setFactoryMockups] = useState<Array<{ mockupUrl: string; geometry?: any }>>([])
  const [factoryPartnerId, setFactoryPartnerId] = useState<string | null>(null)
  const [factoryShippingInfo, setFactoryShippingInfo] = useState<any | null>(null)
  const [showSizeGuide, setShowSizeGuide] = useState(false)
  const sizeGuideModalRef = useRef<HTMLDivElement | null>(null)
  const sizeGuideCloseBtnRef = useRef<HTMLButtonElement | null>(null)
  
  // 作品メタデータから工場モデルがあれば工場を推定
  useEffect(() => {
    const pm = (selectedProduct as any)?.metadata?.product_model_id || (selectedProduct as any)?.product_model_id
    if (!pm) return
    ;(async () => {
      try {
        const fp = await getFactoryProductById(pm)
        if (fp) { setFactoryPartnerId(fp.partner_id); setCurrentFactoryProduct(fp) }
      } catch (e) { console.warn('getFactoryProductById (work meta) failed', e) }
    })()
  }, [selectedProduct])
  const [currentFactoryProduct, setCurrentFactoryProduct] = useState<FactoryProduct | null>(null)
  const [factoryProducts, setFactoryProducts] = useState<FactoryProduct[]>([])
  const [factoryGoods, setFactoryGoods] = useState<GoodsItem[]>([])

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

  // サイズ/カラーが1種類しかない場合は自動選択して操作を短縮
  useEffect(() => {
    if (!selectedItem) return
    if (selectedItem.sizes && selectedItem.sizes.length === 1) {
      setSelectedSize(selectedItem.sizes[0])
    }
    if (selectedItem.colors && selectedItem.colors.length === 1) {
      setSelectedColor(selectedItem.colors[0])
    }
    // 数量の初期化（念のため）
    setQuantity(Math.max(selectedItem.minOrder || 1, 1))
  }, [selectedItem])

  // サイズ表モーダルのフォーカストラップとESCクローズ
  useEffect(() => {
    if (!showSizeGuide) return
    const modal = sizeGuideModalRef.current
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowSizeGuide(false)
        return
      }
      if (e.key === 'Tab' && modal) {
        const focusables = modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null
        if (e.shiftKey) {
          if (active === first || !modal.contains(active)) {
            last.focus()
            e.preventDefault()
          }
        } else {
          if (active === last) {
            first.focus()
            e.preventDefault()
          }
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    // 初期フォーカスを閉じるボタンへ
    setTimeout(() => sizeGuideCloseBtnRef.current?.focus(), 0)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showSizeGuide])

  // 選択されたアイテムを最近見たグッズ履歴に追加
  useEffect(() => {
    if (selectedItem) {
      setRecentGoodsIds(prev => {
        const filtered = prev.filter(id => id !== selectedItem.id);
        return [selectedItem.id, ...filtered].slice(0, 5); // 最大5件まで
      });
    }
  }, [selectedItem]);

  // カテゴリ切替時は選択状態を解除（誤選択防止）
  useEffect(() => {
    setSelectedItem(null)
    setSelectedSize('')
    setSelectedColor('')
    setQuantity(1)
  }, [selectedCategory])

  // 工場の配送情報取得（送料目安表示用）
  useEffect(() => {
    let active = true
    if (!factoryPartnerId) { setFactoryShippingInfo(null); return }
    getPartnerById(factoryPartnerId)
      .then((p) => { if (active) setFactoryShippingInfo((p as any)?.shipping_info || null) })
      .catch(() => { if (active) setFactoryShippingInfo(null) })
    return () => { active = false }
  }, [factoryPartnerId])

  // 工場商品の取得とUI用へのマッピング
  useEffect(() => {
    let active = true
    if (!factoryPartnerId) { setFactoryProducts([]); setFactoryGoods([]); return }
    getPartnerProducts(factoryPartnerId)
      .then((list) => {
        if (!active) return
        setFactoryProducts(list)
        const feeRate = 0.1
        const margin = (selectedProduct as any)?.metadata?.creator_margin || null
        const toMarginYen = (baseCost: number) => {
          if (!margin) return 0
          if (margin.type === 'percent') return Math.floor(baseCost * ((Number(margin.value)||0)/100))
          return Number(margin.value)||0
        }
        const mapped: GoodsItem[] = list.map((fp: any) => {
          const opt: any = fp.options || {}
          const baseCost = fp.base_cost
          const estPrice = Math.max(0, Math.floor(baseCost * (1 + feeRate) + toMarginYen(baseCost)))
          return {
            id: fp.id,
            name: opt.display_name || opt.product_name || fp.product_type,
            category: opt.category || 'homeware',
            description: opt.description || '',
            basePrice: estPrice,
            productionTime: opt.production_time || `${fp.lead_time_days}日`,
            minOrder: fp.minimum_quantity ?? 1,
            features: Array.isArray(opt.features) ? opt.features : [],
            image: opt.image_url || opt.image || defaultImages.product,
            mockups: [],
            sizes: Array.isArray(opt.sizes) ? opt.sizes : undefined,
            colors: Array.isArray(opt.colors) ? opt.colors : undefined,
            materials: opt.materials || undefined,
            printArea: opt.print_area || opt.printArea || undefined,
            popularity: 4,
            isRecommended: !!opt.is_recommended,
            discountRate: typeof opt.discount_rate === 'number' ? opt.discount_rate : undefined,
            ...( { __factoryId: fp.partner_id, __factoryProductId: fp.id, __leadDays: fp.lead_time_days, __maxQty: fp.maximum_quantity ?? undefined, __baseCost: baseCost } as any )
          } as any
        })
        setFactoryGoods(mapped)
      })
      .catch((e) => { console.warn('getPartnerProducts failed', e); if (active) { setFactoryProducts([]); setFactoryGoods([]) } })
    return () => { active = false }
  }, [factoryPartnerId, selectedProduct])

  // 製作期間またはリードタイムからお届け目安を推定
  const getEstimatedDelivery = (productionTime?: string, leadDays?: number) => {
    if (typeof leadDays === 'number' && leadDays > 0) {
      const addDays = (d: number) => {
        const dt = new Date(); dt.setDate(dt.getDate() + d)
        const m = dt.getMonth() + 1, day = dt.getDate()
        return `${m}月${day}日`
      }
      return `${addDays(leadDays)} 以降お届け目安`
    }
    if (!productionTime) return ''
    const match = productionTime.match(/(\d+)[^\d]+(\d+)?/)
    const addDays = (d: number) => {
      const dt = new Date(); dt.setDate(dt.getDate() + d)
      const m = dt.getMonth() + 1, day = dt.getDate()
      return `${m}月${day}日`
    }
    if (match) {
      const min = parseInt(match[1], 10)
      const max = match[2] ? parseInt(match[2], 10) : min
      return `${addDays(min)} 〜 ${addDays(max)} お届け目安`
    }
    return ''
  }

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
  const filteredItems = useMemo(() => {
    // ベース候補（工場商品があれば優先、なければ静的）
    let items: GoodsItem[] = factoryGoods.length > 0 ? factoryGoods : goodsItems;

    // 作品のenabled_familiesでタイプを絞る
    const ef = (selectedProduct as any)?.metadata?.enabled_families || (selectedProduct as any)?.enabled_families || undefined
    if (ef && Array.isArray(ef) && ef.length > 0) {
      items = items.filter(it => ef.some((f: string) => (it.id || '').includes(f) || ((it as any).product_type || '').includes(f)))
    }

    // カテゴリフィルター
    if (selectedCategory !== 'all') {
      items = items.filter(item => item.category === selectedCategory);
    }

    // 検索クエリフィルター
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        (item.materials && item.materials.toLowerCase().includes(query))
      );
    }

    // サイズフィルター
    if (filterSize) {
      items = items.filter(item => item.sizes?.includes(filterSize));
    }

    // カラーフィルター
    if (filterColor) {
      items = items.filter(item => item.colors?.includes(filterColor));
    }

    // 価格フィルター
    const minPrice = priceMin ? parseInt(priceMin, 10) : 0;
    const maxPrice = priceMax ? parseInt(priceMax, 10) : Infinity;
    items = items.filter(item => item.basePrice >= minPrice && item.basePrice <= maxPrice);

    // ソート
    switch (sortKey) {
      case 'popular':
        items.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        break;
      case 'recommended':
        items.sort((a, b) => Number(!!b.isRecommended) - Number(!!a.isRecommended));
        break;
      case 'priceLow':
        items.sort((a, b) => a.basePrice - b.basePrice);
        break;
      case 'priceHigh':
        items.sort((a, b) => b.basePrice - a.basePrice);
        break;
      default:
        break;
    }

    return items;
  }, [goodsItems, factoryGoods, selectedProduct, selectedCategory, searchQuery, filterSize, filterColor, priceMin, priceMax, sortKey]);

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
      factoryId: factoryPartnerId || (selectedItem as any).__factoryId || undefined,
      factoryProductId: (selectedItem as any).__factoryProductId || undefined,
      workId: selectedProduct?.id || undefined,
      variant: {
        size: selectedSize || undefined,
        color: selectedColor || undefined,
      },
      constraints: {
        minOrder: selectedItem.minOrder,
        maxOrder: (selectedItem as any).__maxQty || undefined,
      }
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

  const canAddToCart = !!(selectedItem && (!selectedItem.sizes || selectedSize) && (!selectedItem.colors || selectedColor))

  return (
    <div className={`min-h-screen bg-gray-50 ${selectedItem ? 'pb-28' : ''}`}>
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

      {/* 最近見たグッズ */}
      {recentGoodsIds.length > 0 && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="text-sm text-gray-600 mb-2">最近見たグッズ</div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recentGoodsIds.map(id => {
                const it = goodsItems.find(x=>x.id===id)
                if (!it) return null
                return (
                  <button key={id} className="min-w-[160px] bg-gray-50 rounded border hover:shadow px-3 py-2 text-left" onClick={()=>{ setSelectedItem(it); setQuantity(Math.max(it.minOrder||1,1)); setSelectedSize(''); setSelectedColor('') }}>
                    <img src={it.image} alt={it.name} className="w-full h-24 object-cover rounded" />
                    <div className="mt-1 text-sm text-black truncate">{it.name}</div>
                    <div className="text-xs text-gray-600">¥{it.basePrice.toLocaleString()}</div>
                  </button>
                )
              })}
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
          {/* 検索/並び替え/絞り込み */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">キーワード検索</label>
              <input value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="グッズ名や説明で検索" className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">並び替え</label>
              <select value={sortKey} onChange={(e)=> setSortKey(e.target.value as any)} className="w-full px-3 py-2 border rounded">
                <option value="popular">人気順</option>
                <option value="recommended">おすすめ</option>
                <option value="priceLow">価格が安い</option>
                <option value="priceHigh">価格が高い</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">サイズ</label>
                <select value={filterSize} onChange={(e)=> setFilterSize(e.target.value)} className="w-full px-3 py-2 border rounded">
                  <option value="">すべて</option>
                  {Array.from(new Set((factoryGoods.length>0?factoryGoods:goodsItems).flatMap(i=>i.sizes||[]))).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">カラー</label>
                <select value={filterColor} onChange={(e)=> setFilterColor(e.target.value)} className="w-full px-3 py-2 border rounded">
                  <option value="">すべて</option>
                  {Array.from(new Set((factoryGoods.length>0?factoryGoods:goodsItems).flatMap(i=>i.colors||[]))).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">価格（最小）</label>
                <input value={priceMin} onChange={(e)=> setPriceMin(e.target.value)} type="number" className="w-full px-3 py-2 border rounded" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">価格（最大）</label>
                <input value={priceMax} onChange={(e)=> setPriceMax(e.target.value)} type="number" className="w-full px-3 py-2 border rounded" placeholder="10000" />
              </div>
            </div>
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
                // 別アイテムを選択した際に、前の選択状態（数量・サイズ・カラー）を引き継がないように初期化
                setSelectedItem(item)
                setQuantity(Math.max(item.minOrder || 1, 1))
                setSelectedSize('')
                setSelectedColor('')
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
              <h2 className="text-xl font-bold text-black">グッズの詳細設定</h2>
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
                  <h3 className="text-xl font-semibold mb-2 text-black">{selectedItem.name}</h3>
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
                        <span className="ml-2 font-medium text-black">{selectedItem.materials}</span>
                      </div>
                    )}
                    {selectedItem.printArea && (
                      <div>
                        <span className="text-gray-500">印刷範囲:</span>
                        <span className="ml-2 font-medium text-black">{selectedItem.printArea}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">製作期間:</span>
                      <span className="ml-2 font-medium text-black">{selectedItem.productionTime}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">最小注文数:</span>
                      <span className="ml-2 font-medium text-black">{selectedItem.minOrder}個</span>
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
                      <button type="button" className="ml-3 text-xs underline text-blue-600" onClick={() => setShowSizeGuide(true)}>サイズ表を見る</button>
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
                    数量（最小: {selectedItem.minOrder}個{(selectedItem as any).__maxQty ? ` / 最大: ${(selectedItem as any).__maxQty}個` : ''}）
                  </label>
                  <div className="flex items-center gap-4">
                      <button
                      onClick={() => setQuantity(Math.max(selectedItem.minOrder, Math.min(quantity - 1, (selectedItem as any).__maxQty || Number.MAX_SAFE_INTEGER)))}
                      className="w-10 h-10 border-2 border-gray-400 bg-white rounded-lg hover:bg-gray-100 text-black font-medium"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || selectedItem.minOrder
                        const max = (selectedItem as any).__maxQty || Number.MAX_SAFE_INTEGER
                        setQuantity(Math.max(selectedItem.minOrder, Math.min(v, max)))
                      }}
                      className="w-20 px-3 py-2 border-2 border-gray-400 bg-white rounded-lg text-center text-black focus:border-blue-500 focus:outline-none"
                      min={selectedItem.minOrder}
                    />
                    <button
                      onClick={() => {
                        const max = (selectedItem as any).__maxQty || Number.MAX_SAFE_INTEGER
                        setQuantity(Math.min(quantity + 1, max))
                      }}
                      className="w-10 h-10 border-2 border-gray-400 bg-white rounded-lg hover:bg-gray-100 text-black font-medium"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* 価格表示 */}
              <div className="border-t pt-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">単価（見込）</span>
                  <span className="font-medium text-black">
                    ¥{selectedItem.basePrice.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">数量</span>
                  <span className="font-medium text-black">×{quantity}{(selectedItem as any).__maxQty ? `（最大${(selectedItem as any).__maxQty}）` : ''}</span>
                </div>
                {/* 送料目安 */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">送料（目安）</span>
                  <span className="font-medium text-black">
                    {factoryShippingInfo?.fee_general_jpy ? `¥${Number(factoryShippingInfo.fee_general_jpy).toLocaleString()}` : 'カートで計算'}
                  </span>
                </div>
                {/* お届け目安 */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">お届け目安</span>
                  <span className="font-medium text-black">{getEstimatedDelivery(selectedItem.productionTime, (currentFactoryProduct as any)?.lead_time_days) || '製作期間に準じます'}</span>
                </div>
                <div className="text-xs text-gray-500 mb-2">表記は工場のリードタイムに基づく目安です（状況により前後する場合があります）。</div>
                {selectedItem.discountRate && (
                  <div className="flex items-center justify-between mb-2 text-green-600">
                    <span>割引（{selectedItem.discountRate}%OFF）</span>
                    <span>-¥{Math.floor(selectedItem.basePrice * quantity * selectedItem.discountRate / 100).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-lg font-bold border-t pt-2">
                  <span className="text-black">合計</span>
                  <span className="text-2xl text-black">
                    ¥{calculatePrice().toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">税込・送料別（カートで確定）</div>
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

              {/* 推薦/回遊セクション */}
              <div className="mt-10">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">この作品の他グッズ</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {((factoryGoods.length>0?factoryGoods:goodsItems)
                    .filter(i=> (i as any).id!==selectedItem.id)
                    .filter(i=> {
                      const sameFactory = (i as any).__factoryId && (selectedItem as any).__factoryId && (i as any).__factoryId === (selectedItem as any).__factoryId
                      const sameCategory = i.category === selectedItem.category
                      return sameFactory || sameCategory
                    })
                    .slice(0,3)).map(i => (
                    <button key={(i as any).id || i.name} className="text-left bg-gray-50 rounded border hover:shadow p-2" onClick={()=>{ setSelectedItem(i); setQuantity(Math.max(i.minOrder||1,1)); setSelectedSize(''); setSelectedColor('') }}>
                      <img src={i.image} alt={i.name} className="w-full h-24 object-cover rounded" />
                      <div className="mt-1 text-sm text-black truncate">{i.name}</div>
                      <div className="text-xs text-gray-600">¥{i.basePrice.toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">よく一緒に購入される</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {((factoryGoods.length>0?factoryGoods:goodsItems)
                    .filter(i=> (i as any).id!==selectedItem.id)
                    .sort((a,b)=> Number(!!b.isRecommended) - Number(!!a.isRecommended) || (b.popularity||0)-(a.popularity||0))
                    .slice(0,3)).map(i => (
                    <button key={(i as any).id || i.name} className="text-left bg-gray-50 rounded border hover:shadow p-2" onClick={()=>{ setSelectedItem(i); setQuantity(Math.max(i.minOrder||1,1)); setSelectedSize(''); setSelectedColor('') }}>
                      <img src={i.image} alt={i.name} className="w-full h-24 object-cover rounded" />
                      <div className="mt-1 text-sm text-gray-900 truncate">{i.name}</div>
                      <div className="text-xs text-gray-600">¥{i.basePrice.toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* サイズ表モーダル */}
      {showSizeGuide && selectedItem?.sizes && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" aria-hidden={!showSizeGuide}>
          <div ref={sizeGuideModalRef} role="dialog" aria-modal="true" aria-labelledby="size-guide-title" className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 id="size-guide-title" className="text-lg font-semibold text-gray-900">サイズ表</h3>
              <button ref={sizeGuideCloseBtnRef} className="text-gray-500 hover:text-gray-800" onClick={() => setShowSizeGuide(false)} aria-label="サイズ表を閉じる">×</button>
            </div>
            <div className="space-y-2 text-sm text-gray-800">
              <p>対応サイズ（目安）:</p>
              <div className="flex flex-wrap gap-2">
                {selectedItem.sizes.map((s) => (
                  <span key={s} className="px-2 py-1 bg-gray-100 rounded">{s}</span>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">※商品により実寸は前後します。詳しいサイズ実測や採寸ガイドは商品ページの仕様に準じます。</p>
            </div>
            <div className="mt-6 text-right">
              <button className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700" onClick={() => setShowSizeGuide(false)}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* 下部固定の合計バー */}
      {selectedItem && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t shadow-lg z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-gray-600 truncate">{selectedItem.name}{selectedSize ? ` / ${selectedItem.sizes ? selectedSize : ''}` : ''}{selectedColor ? ` / ${selectedItem.colors ? selectedColor : ''}` : ''}</div>
                <div className="flex items-center gap-3">
                  <div className="text-xl font-bold text-black">¥{calculatePrice().toLocaleString()}</div>
                  <div className="text-xs text-gray-500">税込・送料別{factoryShippingInfo?.fee_general_jpy ? `（送料目安 ¥${Number(factoryShippingInfo.fee_general_jpy).toLocaleString()}）` : ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="hidden sm:inline-flex px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddToCart}
                  disabled={!canAddToCart}
                  className={`px-5 py-3 rounded-lg text-white font-medium flex items-center gap-2 ${canAddToCart ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-300 cursor-not-allowed'}`}
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
