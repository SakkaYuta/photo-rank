import { useState, useEffect, useCallback, useMemo } from 'react'

// パフォーマンス最適化されたデータフェッチフック
export interface UseOptimizedQueryOptions<T> {
  queryKey: string
  queryFn: () => Promise<T>
  dependencies?: unknown[]
  staleTime?: number // キャッシュが古くなる時間（ミリ秒）
  cacheTime?: number // キャッシュが削除される時間（ミリ秒）
  refetchOnWindowFocus?: boolean
  enabled?: boolean
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  staleTime: number
}

// グローバルキャッシュ
const queryCache = new Map<string, CacheEntry<unknown>>()

export function useOptimizedQuery<T>({
  queryKey,
  queryFn,
  dependencies = [],
  staleTime = 5 * 60 * 1000, // 5分
  cacheTime = 10 * 60 * 1000, // 10分
  refetchOnWindowFocus = false,
  enabled = true
}: UseOptimizedQueryOptions<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // キャッシュからデータを取得
  const getCachedData = useCallback((): T | null => {
    const cached = queryCache.get(queryKey) as CacheEntry<T> | undefined
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > cached.staleTime) {
      // データが古い場合は削除
      queryCache.delete(queryKey)
      return null
    }

    return cached.data
  }, [queryKey])

  // データをキャッシュに保存
  const setCachedData = useCallback((newData: T) => {
    queryCache.set(queryKey, {
      data: newData,
      timestamp: Date.now(),
      staleTime
    })
  }, [queryKey, staleTime])

  // メモ化されたクエリ実行関数
  const executeQuery = useCallback(async () => {
    if (!enabled) return

    // まずキャッシュを確認
    const cachedData = getCachedData()
    if (cachedData) {
      setData(cachedData)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await queryFn()
      setData(result)
      setCachedData(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [enabled, getCachedData, queryFn, setCachedData])

  // 依存関係が変更された時のリフェッチ
  useEffect(() => {
    executeQuery()
  }, [executeQuery, ...dependencies])

  // ウィンドウフォーカス時のリフェッチ
  useEffect(() => {
    if (!refetchOnWindowFocus) return

    const handleFocus = () => {
      executeQuery()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [executeQuery, refetchOnWindowFocus])

  // 古いキャッシュエントリの定期的な削除
  useEffect(() => {
    const cleanup = () => {
      const now = Date.now()
      for (const [key, entry] of queryCache.entries()) {
        if (now - entry.timestamp > cacheTime) {
          queryCache.delete(key)
        }
      }
    }

    const interval = setInterval(cleanup, 60000) // 1分毎にクリーンアップ
    return () => clearInterval(interval)
  }, [cacheTime])

  const refetch = useCallback(() => {
    queryCache.delete(queryKey) // キャッシュを削除してからリフェッチ
    executeQuery()
  }, [queryKey, executeQuery])

  return useMemo(() => ({
    data,
    loading,
    error,
    refetch
  }), [data, loading, error, refetch])
}

// 無限スクロール用の最適化フック
export function useInfiniteQuery<T>({
  queryKey,
  queryFn,
  pageSize = 20,
  enabled = true
}: {
  queryKey: string
  queryFn: (page: number, pageSize: number) => Promise<{ data: T[], hasMore: boolean }>
  pageSize?: number
  enabled?: boolean
}) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [page, setPage] = useState(1)

  const loadMore = useCallback(async () => {
    if (!enabled || loading || !hasMore) return

    setLoading(true)
    setError(null)

    try {
      const result = await queryFn(page, pageSize)
      setData(prev => [...prev, ...result.data])
      setHasMore(result.hasMore)
      setPage(prev => prev + 1)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [enabled, loading, hasMore, queryFn, page, pageSize])

  const reset = useCallback(() => {
    setData([])
    setPage(1)
    setHasMore(true)
    setError(null)
  }, [])

  useEffect(() => {
    if (enabled && data.length === 0) {
      loadMore()
    }
  }, [enabled, data.length, loadMore])

  return useMemo(() => ({
    data,
    loading,
    error,
    hasMore,
    loadMore,
    reset
  }), [data, loading, error, hasMore, loadMore, reset])
}