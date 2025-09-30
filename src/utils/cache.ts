/**
 * インメモリキャッシュシステム
 * APIレスポンスをキャッシュしてSupabase負荷を軽減
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in ms
}

class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  private maxSize = 500; // 最大キャッシュエントリ数

  /**
   * キャッシュにデータを設定
   */
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    // キャッシュサイズ制限
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * キャッシュからデータを取得
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // TTL チェック
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * キャッシュからデータを削除
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * パターンマッチで複数のキーを削除
   */
  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keysToDelete = Array.from(this.cache.keys()).filter(key =>
      regex.test(key)
    );

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * 期限切れのキャッシュをクリーンアップ
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((item, key) => {
      if (now - item.timestamp > item.ttl) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.cache.delete(key));

    // まだサイズが大きい場合は古いものから削除
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toDelete = entries.slice(0, Math.floor(this.maxSize * 0.3));
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * 全キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * キャッシュ統計情報
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let totalSize = 0;

    this.cache.forEach(item => {
      if (now - item.timestamp <= item.ttl) {
        validEntries++;
      }
      totalSize++;
    });

    return {
      totalEntries: totalSize,
      validEntries,
      expiredEntries: totalSize - validEntries,
      hitRatio: validEntries / Math.max(totalSize, 1)
    };
  }
}

// シングルトンインスタンス
export const cache = new MemoryCache();

/**
 * キャッシュキー生成ヘルパー
 */
export const cacheKeys = {
  products: (filters?: any, sort?: any, page?: number) =>
    `products:${JSON.stringify({ filters, sort, page })}`,

  product: (id: string) => `product:${id}`,

  userProfile: (userId: string) => `profile:${userId}`,

  works: (creatorId: string, page?: number) =>
    `works:${creatorId}:${page || 0}`,

  battles: (status?: string, page?: number) =>
    `battles:${status || 'all'}:${page || 0}`,

  orders: (userId: string, page?: number) =>
    `orders:${userId}:${page || 0}`,

  favorites: (userId: string) => `favorites:${userId}`,

  cart: (userId: string) => `cart:${userId}`,

  stats: (type: string, period?: string) =>
    `stats:${type}:${period || 'day'}`
};

/**
 * Cache TTL 設定（ミリ秒）
 */
export const cacheTTL = {
  veryShort: 3 * 1000,       // 3秒 - 超短期（SWR/ポーリング）
  short: 1 * 60 * 1000,      // 1分 - リアルタイム性が重要
  medium: 5 * 60 * 1000,     // 5分 - 一般的なデータ
  long: 30 * 60 * 1000,      // 30分 - 変更頻度が低い
  veryLong: 2 * 60 * 60 * 1000, // 2時間 - 静的に近いデータ
};

/**
 * バトル系キャッシュの無効化ヘルパ
 */
export function invalidateBattleCache(battleId: string) {
  if (!battleId) return
  try { cache.delete(`battle-status:${battleId}`) } catch {}
}

export function invalidateBattleListsCache() {
  try { cache.deletePattern(`^list-battles:`) } catch {}
}

export function invalidateInvitesCache() {
  try { cache.delete('list-my-battle-invitations') } catch {}
}
