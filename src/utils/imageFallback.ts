import { defaultImages } from '@/utils/defaultImages'

export function resolveImageUrl(primary?: string | null, fallbacks: string[] = []): string {
  for (const url of [primary, ...fallbacks]) {
    if (url && typeof url === 'string' && url.trim().length > 0) return url
  }
  // 最終手段は空文字（呼び出し側でStorageのデフォルトを必ず渡す想定）
  return ''
}

export type ImageContext =
  | 'avatar'
  | 'product-card'
  | 'work-card'
  | 'creator-grid'
  | 'content-grid'
  | 'battle-banner'
  | 'cart-item'
  | 'approval'
  | 'goods-item'
  | 'marketplace-item'
  | 'modal-preview'

export function resolveImageByContext(ctx: ImageContext, primary?: string | null, extraFallbacks: string[] = []) {
  const ctxMap: Record<ImageContext, string[]> = {
    avatar: [defaultImages.avatar],
    'product-card': [defaultImages.product, defaultImages.work, defaultImages.content],
    'work-card': [defaultImages.work, defaultImages.product, defaultImages.content],
    'creator-grid': [defaultImages.creator, defaultImages.avatar],
    'content-grid': [defaultImages.content, defaultImages.product],
    'battle-banner': [defaultImages.content],
    'cart-item': [defaultImages.product, defaultImages.work],
    approval: [defaultImages.work, defaultImages.product],
    'goods-item': [defaultImages.product],
    'marketplace-item': [defaultImages.product, defaultImages.work],
    'modal-preview': [defaultImages.work, defaultImages.product],
  }
  const fallbacks = [...(ctxMap[ctx] || []), ...extraFallbacks]
  return resolveImageUrl(primary, fallbacks)
}
