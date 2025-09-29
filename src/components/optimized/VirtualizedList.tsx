import React, { useState, useEffect, useRef, useMemo, memo } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  onScroll?: (scrollTop: number) => void;
}

/**
 * 仮想化リストコンポーネント
 * 大量のアイテムを効率的にレンダリング
 */
export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
  renderItem,
  className = '',
  onScroll
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 表示範囲の計算
  const visibleRange = useMemo(() => {
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
      visibleStart + Math.ceil(containerHeight / itemHeight),
      items.length - 1
    );

    return {
      start: Math.max(0, visibleStart - overscan),
      end: Math.min(items.length - 1, visibleEnd + overscan)
    };
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length]);

  // 表示するアイテム
  const visibleItems = useMemo(() => {
    const result = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      result.push({
        index: i,
        item: items[i],
        top: i * itemHeight
      });
    }
    return result;
  }, [items, visibleRange, itemHeight]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  };

  const totalHeight = items.length * itemHeight;

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ index, item, top }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top,
              left: 0,
              right: 0,
              height: itemHeight
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 仮想化グリッドコンポーネント
 */
interface VirtualizedGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  gap?: number;
  overscan?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function VirtualizedGrid<T>({
  items,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  gap = 0,
  overscan = 5,
  renderItem,
  className = ''
}: VirtualizedGridProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  // グリッドの計算
  const columnsCount = Math.floor((containerWidth + gap) / (itemWidth + gap));
  const rowsCount = Math.ceil(items.length / columnsCount);

  const visibleRange = useMemo(() => {
    const rowHeight = itemHeight + gap;
    const visibleStartRow = Math.floor(scrollTop / rowHeight);
    const visibleEndRow = Math.min(
      visibleStartRow + Math.ceil(containerHeight / rowHeight),
      rowsCount - 1
    );

    return {
      startRow: Math.max(0, visibleStartRow - overscan),
      endRow: Math.min(rowsCount - 1, visibleEndRow + overscan)
    };
  }, [scrollTop, itemHeight, gap, containerHeight, overscan, rowsCount]);

  const visibleItems = useMemo(() => {
    const result = [];
    for (let row = visibleRange.startRow; row <= visibleRange.endRow; row++) {
      for (let col = 0; col < columnsCount; col++) {
        const index = row * columnsCount + col;
        if (index < items.length) {
          result.push({
            index,
            item: items[index],
            left: col * (itemWidth + gap),
            top: row * (itemHeight + gap)
          });
        }
      }
    }
    return result;
  }, [items, visibleRange, columnsCount, itemWidth, itemHeight, gap]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const totalHeight = rowsCount * (itemHeight + gap) - gap;

  return (
    <div
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ index, item, left, top }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left,
              top,
              width: itemWidth,
              height: itemHeight
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 無限スクロール対応の仮想化リスト
 */
interface InfiniteVirtualizedListProps<T> extends VirtualizedListProps<T> {
  hasMore: boolean;
  loadMore: () => void;
  loading?: boolean;
  threshold?: number;
}

export const InfiniteVirtualizedList = memo(<T,>({
  hasMore,
  loadMore,
  loading = false,
  threshold = 1000,
  onScroll,
  ...listProps
}: InfiniteVirtualizedListProps<T>) => {
  const loadMoreRef = useRef(false);

  const handleScroll = (scrollTop: number) => {
    onScroll?.(scrollTop);

    const { containerHeight, items, itemHeight } = listProps;
    const totalHeight = items.length * itemHeight;
    const scrollBottom = scrollTop + containerHeight;

    // 下端に近づいたら追加データを読み込み
    if (
      hasMore &&
      !loading &&
      !loadMoreRef.current &&
      scrollBottom >= totalHeight - threshold
    ) {
      loadMoreRef.current = true;
      loadMore();
    }
  };

  useEffect(() => {
    if (!loading) {
      loadMoreRef.current = false;
    }
  }, [loading]);

  return (
    <VirtualizedList
      {...listProps}
      onScroll={handleScroll}
    />
  );
}) as <T>(props: InfiniteVirtualizedListProps<T>) => JSX.Element;