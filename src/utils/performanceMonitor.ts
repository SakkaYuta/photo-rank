import React from 'react'

/**
 * パフォーマンス監視システム
 * アプリケーションの負荷とパフォーマンスを追跡
 */

interface PerformanceMetrics {
  timestamp: number;
  cacheHitRatio: number;
  apiCallCount: number;
  renderTime: number;
  memoryUsage: number;
  dbQueryCount: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private apiCallCount = 0;
  private dbQueryCount = 0;
  private renderStartTimes = new Map<string, number>();

  /**
   * APIコール数を記録
   */
  recordApiCall(): void {
    this.apiCallCount++;
  }

  /**
   * DBクエリ数を記録
   */
  recordDbQuery(): void {
    this.dbQueryCount++;
  }

  /**
   * レンダリング開始時間を記録
   */
  startRender(componentName: string): void {
    this.renderStartTimes.set(componentName, performance.now());
  }

  /**
   * レンダリング終了時間を記録
   */
  endRender(componentName: string): number {
    const startTime = this.renderStartTimes.get(componentName);
    if (startTime) {
      const renderTime = performance.now() - startTime;
      this.renderStartTimes.delete(componentName);
      return renderTime;
    }
    return 0;
  }

  /**
   * メモリ使用量を取得
   */
  getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * キャッシュヒット率を計算
   */
  calculateCacheHitRatio(): number {
    // cache.ts のグローバルインスタンスから統計を取得
    try {
      const { cache } = require('./cache');
      const stats = cache.getStats();
      return stats.hitRatio || 0;
    } catch {
      return 0;
    }
  }

  /**
   * 現在のメトリクスを記録
   */
  recordMetrics(): PerformanceMetrics {
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      cacheHitRatio: this.calculateCacheHitRatio(),
      apiCallCount: this.apiCallCount,
      renderTime: Array.from(this.renderStartTimes.values()).reduce((sum, time) => sum + (performance.now() - time), 0),
      memoryUsage: this.getMemoryUsage(),
      dbQueryCount: this.dbQueryCount
    };

    this.metrics.push(metrics);

    // 古いメトリクスを削除（最新100件のみ保持）
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    return metrics;
  }

  /**
   * パフォーマンス統計を取得
   */
  getPerformanceStats() {
    const recent = this.metrics.slice(-10); // 最新10件

    if (recent.length === 0) {
      return {
        avgCacheHitRatio: 0,
        avgApiCallsPerMinute: 0,
        avgRenderTime: 0,
        memoryTrend: 'stable' as const,
        performanceGrade: 'A' as const
      };
    }

    const avgCacheHitRatio = recent.reduce((sum, m) => sum + m.cacheHitRatio, 0) / recent.length;
    const avgApiCallsPerMinute = recent.reduce((sum, m) => sum + m.apiCallCount, 0) / recent.length;
    const avgRenderTime = recent.reduce((sum, m) => sum + m.renderTime, 0) / recent.length;

    // メモリトレンド
    const memoryTrend = recent.length > 1
      ? recent[recent.length - 1].memoryUsage > recent[0].memoryUsage * 1.1
        ? 'increasing' as const
        : recent[recent.length - 1].memoryUsage < recent[0].memoryUsage * 0.9
        ? 'decreasing' as const
        : 'stable' as const
      : 'stable' as const;

    // パフォーマンスグレード
    let performanceGrade: 'A' | 'B' | 'C' | 'D' = 'A';
    if (avgCacheHitRatio < 0.5 || avgRenderTime > 100 || avgApiCallsPerMinute > 30) {
      performanceGrade = 'B';
    }
    if (avgCacheHitRatio < 0.3 || avgRenderTime > 200 || avgApiCallsPerMinute > 50) {
      performanceGrade = 'C';
    }
    if (avgCacheHitRatio < 0.1 || avgRenderTime > 500 || avgApiCallsPerMinute > 100) {
      performanceGrade = 'D';
    }

    return {
      avgCacheHitRatio,
      avgApiCallsPerMinute,
      avgRenderTime,
      memoryTrend,
      performanceGrade
    };
  }

  /**
   * パフォーマンス最適化の推奨事項
   */
  getOptimizationRecommendations(): string[] {
    const stats = this.getPerformanceStats();
    const recommendations: string[] = [];

    if (stats.avgCacheHitRatio < 0.5) {
      recommendations.push('キャッシュ効率を改善してください。TTLの調整やキー戦略の見直しを検討。');
    }

    if (stats.avgApiCallsPerMinute > 30) {
      recommendations.push('API呼び出し数が多すぎます。バッチング機能の利用を検討。');
    }

    if (stats.avgRenderTime > 100) {
      recommendations.push('レンダリング時間が長いです。useMemo、useCallbackの追加を検討。');
    }

    if (stats.memoryTrend === 'increasing') {
      recommendations.push('メモリ使用量が増加傾向です。メモリリークの可能性を確認。');
    }

    if (recommendations.length === 0) {
      recommendations.push('パフォーマンスは良好です！現在の最適化設定を維持してください。');
    }

    return recommendations;
  }

  /**
   * 定期的なメトリクス記録を開始
   */
  startPeriodicRecording(intervalMs: number = 30000): () => void {
    const interval = setInterval(() => {
      this.recordMetrics();
    }, intervalMs);

    return () => clearInterval(interval);
  }

  /**
   * パフォーマンス警告しきい値チェック
   */
  checkThresholds(): { type: 'warning' | 'error'; message: string }[] {
    const alerts: { type: 'warning' | 'error'; message: string }[] = [];
    const latest = this.metrics[this.metrics.length - 1];

    if (!latest) return alerts;

    if (latest.cacheHitRatio < 0.2) {
      alerts.push({
        type: 'error',
        message: `キャッシュヒット率が低すぎます: ${(latest.cacheHitRatio * 100).toFixed(1)}%`
      });
    }

    if (latest.apiCallCount > 50) {
      alerts.push({
        type: 'warning',
        message: `API呼び出し数が多いです: ${latest.apiCallCount}回/分`
      });
    }

    if (latest.renderTime > 200) {
      alerts.push({
        type: 'warning',
        message: `レンダリング時間が長いです: ${latest.renderTime.toFixed(1)}ms`
      });
    }

    return alerts;
  }
}

// グローバルインスタンス
export const performanceMonitor = new PerformanceMonitor();

/**
 * React Hook: パフォーマンス監視
 */
export function usePerformanceMonitor() {
  const recordApiCall = () => performanceMonitor.recordApiCall();
  const recordDbQuery = () => performanceMonitor.recordDbQuery();
  const startRender = (componentName: string) => performanceMonitor.startRender(componentName);
  const endRender = (componentName: string) => performanceMonitor.endRender(componentName);

  return {
    recordApiCall,
    recordDbQuery,
    startRender,
    endRender,
    getStats: () => performanceMonitor.getPerformanceStats(),
    getRecommendations: () => performanceMonitor.getOptimizationRecommendations()
  };
}

/**
 * HOC: コンポーネントのレンダリング時間を監視
 */
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';

  return function PerformanceMonitoredComponent(props: P) {
    React.useEffect(() => {
      performanceMonitor.startRender(displayName);
      return () => {
        performanceMonitor.endRender(displayName);
      };
    });

    return React.createElement(WrappedComponent, props);
  };
}
