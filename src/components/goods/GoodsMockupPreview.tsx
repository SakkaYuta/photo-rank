import React from 'react'
import { resolveImageUrl } from '@/utils/imageFallback'
import { defaultImages } from '@/utils/defaultImages'

export type Geometry = {
  // パーセンテージ指定（コンテナ基準）
  x: number // 左からの位置（%）
  y: number // 上からの位置（%）
  width: number // 幅（%）
  rotation?: number // 回転（deg）
  skewX?: number // 斜め（deg）
  skewY?: number // 斜め（deg）
  opacity?: number // 0-1
  blendMode?: React.CSSProperties['mixBlendMode']
  maskUrl?: string | null // マスク画像（白=表示、黒=非表示）
}

// グッズ種別ごとの簡易プリント領域（デモ用途）
const GEOMETRIES: Record<string, Geometry> = {
  'tshirt-standard': { x: 20, y: 22, width: 60, opacity: 0.95, blendMode: 'multiply' },
  'hoodie-premium': { x: 22, y: 24, width: 56, opacity: 0.95, blendMode: 'multiply' },
  'longtee-basic': { x: 22, y: 24, width: 58, opacity: 0.95, blendMode: 'multiply' },
  'sticker-vinyl': { x: 10, y: 10, width: 80, opacity: 1 },
  'badge-pin': { x: 20, y: 20, width: 60, opacity: 1 },
  'keychain-acrylic': { x: 15, y: 15, width: 70, opacity: 1 },
  'acrylic-stand': { x: 10, y: 10, width: 80, opacity: 1 },
  'photo-frame': { x: 18, y: 18, width: 64, opacity: 1 },
  'mug-ceramic': { x: 22, y: 28, width: 56, opacity: 0.9, blendMode: 'multiply', skewY: -2 },
  'tumbler-stainless': { x: 30, y: 20, width: 40, opacity: 0.9, blendMode: 'multiply' },
  'tote-bag': { x: 18, y: 22, width: 64, opacity: 0.95, blendMode: 'multiply' },
  'pouch-canvas': { x: 18, y: 30, width: 64, opacity: 0.95, blendMode: 'multiply' },
  'phone-case': { x: 28, y: 8, width: 44, opacity: 1 },
  'mouse-pad': { x: 10, y: 15, width: 80, opacity: 1 },
  'poster-matte': { x: 8, y: 8, width: 84, opacity: 1 },
  'tapestry': { x: 10, y: 10, width: 80, opacity: 1 },
}

export type GoodsMockupPreviewProps = {
  mockupUrl?: string | null
  artUrl?: string | null
  variantId?: string // GoodsItem.id
  size?: number // px, 正方形の最大辺。デフォルト 192
  artOnly?: boolean // 背景なしで作品だけを中央表示
  geometry?: Geometry // スライド固有のジオメトリ（variantIdの既定値を上書き）
}

export const GoodsMockupPreview: React.FC<GoodsMockupPreviewProps> = ({
  mockupUrl,
  artUrl,
  variantId,
  size = 192,
  artOnly = false,
  geometry,
}) => {
  const base = resolveImageUrl(mockupUrl, [defaultImages.product])
  const art = resolveImageUrl(artUrl, [defaultImages.work, defaultImages.content])
  const geo = geometry || (variantId && GEOMETRIES[variantId]) || { x: 15, y: 15, width: 70, opacity: 0.95, blendMode: 'multiply' }

  // 透過PNGなどにも対応できるよう、<img>ベースのCSS合成（CanvasはCORSで汚染される可能性があるため未使用）
  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${geo.x}%`,
    top: `${geo.y}%`,
    width: `${geo.width}%`,
    transform: `rotate(${geo.rotation || 0}deg) skew(${geo.skewX || 0}deg, ${geo.skewY || 0}deg)`,
    opacity: geo.opacity ?? 1,
    mixBlendMode: geo.blendMode,
    WebkitMaskImage: geo.maskUrl ? `url(${geo.maskUrl})` : undefined,
    maskImage: geo.maskUrl ? `url(${geo.maskUrl})` : undefined,
    WebkitMaskRepeat: geo.maskUrl ? 'no-repeat' : undefined,
    maskRepeat: geo.maskUrl ? 'no-repeat' : undefined,
    WebkitMaskSize: geo.maskUrl ? '100% 100%' : undefined,
    maskSize: geo.maskUrl ? '100% 100%' : undefined,
  }

  if (artOnly) {
    return (
      <div className="relative rounded-lg overflow-hidden bg-gray-50 grid place-items-center" style={{ width: size, height: size }}>
        {art ? (
          <img src={art} alt="作品プレビュー" className="max-w-full max-h-full object-contain" />
        ) : (
          <div className="text-xs text-gray-500">作品画像が見つかりません</div>
        )}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-black/5 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="relative rounded-lg overflow-hidden bg-gray-100" style={{ width: size, height: size }} aria-label="商品プレビュー">
      <img src={base} alt="ベースモックアップ" className="absolute inset-0 w-full h-full object-cover" />
      {art && <img src={art} alt="デザインプレビュー" className="object-cover" style={overlayStyle} />}
      {!art && <div className="absolute inset-0 grid place-items-center text-xs text-gray-500">作品画像が見つかりません</div>}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-black/5 rounded-lg" />
    </div>
  )
}

export default GoodsMockupPreview
