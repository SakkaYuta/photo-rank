import React, { useState, useRef, useEffect, memo } from 'react';
import { optimizeImageUrl, generateResponsiveImageSet, LazyImageLoader } from '@/utils/imageOptimization';

interface OptimizedImageProps {
  src: string;
  alt: string;
  preset?: 'thumbnail' | 'card' | 'banner' | 'hero' | 'avatar' | 'gallery';
  width?: number;
  height?: number;
  quality?: number;
  className?: string;
  lazy?: boolean;
  responsive?: boolean;
  fallback?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * 最適化された画像コンポーネント
 * - 自動WebP変換
 * - 遅延読み込み
 * - レスポンシブ対応
 * - フォールバック機能
 */
export const OptimizedImage = memo<OptimizedImageProps>(({
  src,
  alt,
  preset,
  width,
  height,
  quality,
  className = '',
  lazy = true,
  responsive = false,
  fallback,
  onLoad,
  onError
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const lazyLoaderRef = useRef<LazyImageLoader | null>(null);

  // 最適化された画像URL
  const optimizedSrc = optimizeImageUrl(src, {
    width,
    height,
    quality,
    format: 'auto'
  }, preset);

  // レスポンシブ画像セット
  const responsiveSet = responsive ? generateResponsiveImageSet(src) : null;

  useEffect(() => {
    if (lazy && imgRef.current) {
      if (!lazyLoaderRef.current) {
        lazyLoaderRef.current = new LazyImageLoader();
      }
      lazyLoaderRef.current.observe(imgRef.current);

      return () => {
        if (imgRef.current && lazyLoaderRef.current) {
          lazyLoaderRef.current.unobserve(imgRef.current);
        }
      };
    }
  }, [lazy]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // エラー時のフォールバック
  if (hasError && fallback) {
    return (
      <img
        src={fallback}
        alt={alt}
        className={className}
        onLoad={handleLoad}
      />
    );
  }

  // 基本的なimg属性
  const imgProps = {
    ref: imgRef,
    alt,
    className: `${className} ${!isLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`,
    onLoad: handleLoad,
    onError: handleError,
    loading: lazy ? ('lazy' as const) : ('eager' as const)
  };

  if (lazy) {
    // 遅延読み込み
    return (
      <img
        {...imgProps}
        data-src={responsive ? responsiveSet?.src : optimizedSrc}
        data-srcset={responsive ? responsiveSet?.srcSet : undefined}
        sizes={responsive ? responsiveSet?.sizes : undefined}
        className={`${imgProps.className} lazy`}
      />
    );
  }

  // 即座に読み込み
  return (
    <img
      {...imgProps}
      src={responsive ? responsiveSet?.src : optimizedSrc}
      srcSet={responsive ? responsiveSet?.srcSet : undefined}
      sizes={responsive ? responsiveSet?.sizes : undefined}
    />
  );
});

OptimizedImage.displayName = 'OptimizedImage';