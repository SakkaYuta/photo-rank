/**
 * 画像最適化とCDN統合システム
 * パフォーマンス向上とSupabase Storage負荷軽減
 */

// 画像サイズとフォーマット設定
interface ImageConfig {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'auto';
  resize?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside';
}

// プリセット設定
export const imagePresets = {
  thumbnail: { width: 150, height: 150, quality: 80, format: 'webp' as const },
  card: { width: 400, height: 400, quality: 85, format: 'webp' as const },
  banner: { width: 800, height: 400, quality: 90, format: 'webp' as const },
  hero: { width: 1200, height: 600, quality: 90, format: 'webp' as const },
  avatar: { width: 100, height: 100, quality: 80, format: 'webp' as const },
  gallery: { width: 600, height: 600, quality: 85, format: 'webp' as const }
};

/**
 * 画像URLを最適化（Supabase Storageの変換機能を活用）
 */
export function optimizeImageUrl(
  originalUrl: string,
  config: ImageConfig = {},
  preset?: keyof typeof imagePresets
): string {
  if (!originalUrl) return originalUrl;

  // プリセットがある場合は適用
  const finalConfig = preset ? { ...imagePresets[preset], ...config } : config;

  // Supabase Storage URLの場合
  if (originalUrl.includes('supabase') && originalUrl.includes('/storage/')) {
    return buildSupabaseTransformUrl(originalUrl, finalConfig);
  }

  // 外部URL（Unsplash等）の場合
  if (originalUrl.includes('unsplash.com')) {
    return buildUnsplashUrl(originalUrl, finalConfig);
  }

  // CDNを通さない場合はそのまま返す
  return originalUrl;
}

/**
 * Supabase Storage変換URLを構築
 */
function buildSupabaseTransformUrl(url: string, config: ImageConfig): string {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams();

    if (config.width) params.set('width', config.width.toString());
    if (config.height) params.set('height', config.height.toString());
    if (config.quality) params.set('quality', config.quality.toString());
    if (config.format && config.format !== 'auto') params.set('format', config.format);
    if (config.resize) params.set('resize', config.resize);

    // WebP対応ブラウザの場合は自動でWebPに変換
    if (supportsWebP() && !config.format) {
      params.set('format', 'webp');
    }

    if (params.toString()) {
      urlObj.search = params.toString();
    }

    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Unsplash URL最適化
 */
function buildUnsplashUrl(url: string, config: ImageConfig): string {
  try {
    const urlObj = new URL(url);

    if (config.width && config.height) {
      urlObj.searchParams.set('w', config.width.toString());
      urlObj.searchParams.set('h', config.height.toString());
      urlObj.searchParams.set('fit', 'crop');
    } else if (config.width) {
      urlObj.searchParams.set('w', config.width.toString());
    } else if (config.height) {
      urlObj.searchParams.set('h', config.height.toString());
    }

    if (config.quality) {
      urlObj.searchParams.set('q', config.quality.toString());
    }

    // WebP対応ブラウザの場合
    if (supportsWebP() && (!config.format || config.format === 'auto')) {
      urlObj.searchParams.set('fm', 'webp');
    }

    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * WebP対応チェック（ブラウザ）
 */
function supportsWebP(): boolean {
  if (typeof window === 'undefined') return false;

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

/**
 * 画像プリロード
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * 複数画像をバッチでプリロード
 */
export async function preloadImages(
  urls: string[],
  concurrent = 3
): Promise<void> {
  const batches: string[][] = [];

  // 同時実行数でバッチに分割
  for (let i = 0; i < urls.length; i += concurrent) {
    batches.push(urls.slice(i, i + concurrent));
  }

  // バッチごとに順次実行
  for (const batch of batches) {
    await Promise.allSettled(batch.map(preloadImage));
  }
}

/**
 * レスポンシブ画像セット生成
 */
export function generateResponsiveImageSet(
  originalUrl: string,
  sizes: number[] = [400, 800, 1200]
): { src: string; srcSet: string; sizes: string } {
  const srcSet = sizes
    .map(size => {
      const optimizedUrl = optimizeImageUrl(originalUrl, { width: size, quality: 85 });
      return `${optimizedUrl} ${size}w`;
    })
    .join(', ');

  return {
    src: optimizeImageUrl(originalUrl, { width: sizes[0], quality: 85 }),
    srcSet,
    sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
  };
}

/**
 * 画像遅延読み込み用Intersection Observer
 */
export class LazyImageLoader {
  private observer: IntersectionObserver | null = null;

  constructor(
    private options: IntersectionObserverInit = {
      rootMargin: '50px 0px',
      threshold: 0.01
    }
  ) {
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(this.handleIntersection.bind(this), options);
    }
  }

  observe(element: HTMLImageElement): void {
    if (this.observer) {
      this.observer.observe(element);
    } else {
      // フォールバック：即座に読み込み
      this.loadImage(element);
    }
  }

  unobserve(element: HTMLImageElement): void {
    if (this.observer) {
      this.observer.unobserve(element);
    }
  }

  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        this.loadImage(img);
        this.observer?.unobserve(img);
      }
    });
  }

  private loadImage(img: HTMLImageElement): void {
    const src = img.dataset.src;
    const srcSet = img.dataset.srcset;

    if (src) {
      img.src = src;
      img.removeAttribute('data-src');
    }

    if (srcSet) {
      img.srcset = srcSet;
      img.removeAttribute('data-srcset');
    }

    img.classList.remove('lazy');
    img.classList.add('loaded');
  }
}

// グローバルインスタンス
export const globalLazyLoader = new LazyImageLoader();

/**
 * CSS用の最適化された背景画像URL
 */
export function getBackgroundImageUrl(
  url: string,
  config: ImageConfig = {}
): string {
  const optimizedUrl = optimizeImageUrl(url, config);
  return `url('${optimizedUrl}')`;
}

/**
 * アバター画像の最適化
 */
export function optimizeAvatarUrl(url: string, size: number = 100): string {
  return optimizeImageUrl(url, {
    width: size,
    height: size,
    quality: 80,
    format: 'webp',
    resize: 'cover'
  });
}

/**
 * 商品画像の最適化
 */
export function optimizeProductImageUrl(
  url: string,
  variant: 'thumbnail' | 'card' | 'hero' = 'card'
): string {
  return optimizeImageUrl(url, {}, variant);
}