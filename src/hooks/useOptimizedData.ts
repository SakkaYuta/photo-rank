import { useState, useEffect, useCallback, useRef } from 'react';
import { cache, cacheKeys, cacheTTL } from '@/utils/cache';

interface OptimizedDataOptions<T> {
  cacheKey: string;
  ttl?: number;
  enabled?: boolean;
  refetchOnMount?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: (data: T) => void;
}

interface OptimizedDataResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

/**
 * キャッシュ機能付きの最適化されたデータフェッチングフック
 */
export function useOptimizedData<T>(
  fetcher: () => Promise<T>,
  options: OptimizedDataOptions<T>
): OptimizedDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const {
    cacheKey,
    ttl = cacheTTL.medium,
    enabled = true,
    refetchOnMount = true,
    onError,
    onSuccess
  } = options;

  // 同一キーへの重複フェッチを合流させる（コンポーネント間での同時要求を1本化）
  // モジュールスコープで共有
  const inflightRef = (useOptimizedData as any)._inflight || new Map<string, Promise<any>>();
  ;(useOptimizedData as any)._inflight = inflightRef;

  // データ取得関数
  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    // キャッシュから取得を試行
    if (!forceRefresh) {
      const cachedData = cache.get<T>(cacheKey);
      if (cachedData) {
        setData(cachedData);
        onSuccess?.(cachedData);
        return;
      }
    }

    // 既存のリクエストをキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      let p = inflightRef.get(cacheKey) as Promise<T> | undefined
      if (!p) {
        p = fetcher();
        inflightRef.set(cacheKey, p);
      }
      const result = await p;

      if (!mountedRef.current) return;

      // データをキャッシュに保存
      cache.set(cacheKey, result, ttl);

      setData(result);
      onSuccess?.(result);
    } catch (err) {
      if (!mountedRef.current) return;

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      inflightRef.delete(cacheKey)
    }
  }, [fetcher, cacheKey, ttl, enabled, onError, onSuccess]);

  // キャッシュ無効化
  const invalidate = useCallback(() => {
    cache.delete(cacheKey);
  }, [cacheKey]);

  // 強制再取得
  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  // 初期データ取得
  useEffect(() => {
    if (enabled && refetchOnMount) {
      fetchData();
    }

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData, enabled, refetchOnMount]);

  return {
    data,
    loading,
    error,
    refetch,
    invalidate
  };
}

/**
 * 複数のデータソースを最適化して取得するフック
 */
export function useOptimizedBatchData<T extends Record<string, any>>(
  fetchers: { [K in keyof T]: () => Promise<T[K]> },
  options: { [K in keyof T]: OptimizedDataOptions<T[K]> }
): { [K in keyof T]: OptimizedDataResult<T[K]> } {
  const results = {} as { [K in keyof T]: OptimizedDataResult<T[K]> };

  for (const key in fetchers) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    results[key] = useOptimizedData(fetchers[key], options[key]);
  }

  return results;
}

/**
 * ページネーション付きデータフェッチング
 */
export function useOptimizedPagination<T>(
  fetcher: (page: number, limit: number) => Promise<{ data: T[]; total: number }>,
  baseKey: string,
  initialPage = 0,
  pageSize = 20
) {
  const [page, setPage] = useState(initialPage);
  const [allData, setAllData] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const cacheKey = `${baseKey}:${page}:${pageSize}`;

  const { data, loading, error, refetch } = useOptimizedData(
    () => fetcher(page, pageSize),
    {
      cacheKey,
      ttl: cacheTTL.medium,
      onSuccess: (result) => {
        if (page === 0) {
          setAllData(result.data);
        } else {
          setAllData(prev => [...prev, ...result.data]);
        }
        setHasMore(result.data.length === pageSize);
      }
    }
  );

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [loading, hasMore]);

  const reset = useCallback(() => {
    setPage(0);
    setAllData([]);
    setHasMore(true);
    // キャッシュパターンをクリア
    cache.deletePattern(`^${baseKey}:`);
  }, [baseKey]);

  return {
    data: allData,
    loading,
    error,
    hasMore,
    loadMore,
    reset,
    refetch: () => {
      reset();
      return refetch();
    }
  };
}
