import type { Geometry } from '@/components/goods/GoodsMockupPreview'

export type GoodsMockupSlide = {
  mockupUrl: string
  geometry?: Geometry
  label?: string
}

export type GoodsMockupConfig = {
  variantId: string // equals GoodsItem.id
  slides: GoodsMockupSlide[]
}

// サンプル設定（本番では Supabase の factory_product_mockups を優先して取得する想定）
export const GOODS_MOCKUPS: Record<string, GoodsMockupConfig> = {
  'tshirt-standard': {
    variantId: 'tshirt-standard',
    slides: [
      {
        mockupUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=800&fit=crop',
        geometry: { x: 20, y: 22, width: 60, opacity: 0.95, blendMode: 'multiply' },
        label: '正面'
      },
      {
        mockupUrl: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800&h=800&fit=crop',
        geometry: { x: 22, y: 24, width: 56, opacity: 0.95, blendMode: 'multiply' },
        label: '斜め'
      },
    ],
  },
  'mug-ceramic': {
    variantId: 'mug-ceramic',
    slides: [
      {
        mockupUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&h=800&fit=crop',
        geometry: { x: 22, y: 28, width: 56, opacity: 0.9, blendMode: 'multiply', skewY: -2 },
        label: '正面'
      },
      {
        mockupUrl: 'https://images.unsplash.com/photo-1498804103079-a6351b050096?w=800&h=800&fit=crop',
        geometry: { x: 20, y: 30, width: 60, opacity: 0.9, blendMode: 'multiply' },
        label: '斜め'
      },
    ],
  },
}

export default GOODS_MOCKUPS

