import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface VirtualScrollConfig {
  itemHeight: number;
  containerHeight: number;
  overscan: number;
  threshold: number;
}

export interface VirtualScrollItem {
  index: number;
  style: React.CSSProperties;
  isVisible: boolean;
}

export interface VirtualScrollResult {
  visibleItems: VirtualScrollItem[];
  totalHeight: number;
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
  scrollToTop: (behavior?: ScrollBehavior) => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  containerRef: React.RefObject<HTMLElement | null>;
  handleScroll: (event: Event) => void;
  setScrollElement: (element: HTMLElement | null) => void | (() => void);
}

export class VirtualScrollManager {
  public config: VirtualScrollConfig;
  private visibleRange: { start: number; end: number } = { start: 0, end: 0 };
  private scrollElement: HTMLElement | null = null;
  private lastScrollTop: number = 0;

  constructor(config: VirtualScrollConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<VirtualScrollConfig>) {
    this.config = { ...this.config, ...config };
  }

  setScrollElement(element: HTMLElement | null) {
    this.scrollElement = element;
  }

  getTotalHeight(itemCount: number): number {
    return itemCount * this.config.itemHeight;
  }

  getItemOffset(index: number): number {
    return index * this.config.itemHeight;
  }

  calculateVisibleItems(
    scrollTop: number,
    totalItems: number,
  ): {
    startIndex: number;
    endIndex: number;
    offsetY: number;
  } {
    const { itemHeight, containerHeight, overscan } = this.config;

    if (totalItems === 0 || containerHeight <= 0) {
      return { startIndex: 0, endIndex: 0, offsetY: 0 };
    }

    const actualScrollTop = Math.max(0, scrollTop);

    const startIndex = Math.max(
      0,
      Math.floor(actualScrollTop / itemHeight) - overscan,
    );
    const visibleItemCount = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(
      totalItems - 1,
      startIndex + visibleItemCount + overscan * 2,
    );

    const offsetY = startIndex * itemHeight;

    this.visibleRange = { start: startIndex, end: endIndex };

    return { startIndex, endIndex, offsetY };
  }

  getItemStyle(index: number, offsetY: number): React.CSSProperties {
    const { itemHeight } = this.config;

    return {
      position: "absolute",
      top: offsetY + (index - this.visibleRange.start) * itemHeight,
      left: 0,
      right: 0,
      height: itemHeight,
    };
  }

  shouldUpdate(newScrollTop: number): boolean {
    const { threshold } = this.config;
    const shouldUpdate =
      Math.abs(newScrollTop - this.lastScrollTop) > threshold;

    if (shouldUpdate) {
      this.lastScrollTop = newScrollTop;
    }

    return shouldUpdate;
  }

  scrollToIndex(index: number, behavior: ScrollBehavior = "smooth") {
    if (!this.scrollElement) return;

    const { itemHeight } = this.config;
    const targetScrollTop = index * itemHeight;

    this.scrollElement.scrollTo({
      top: targetScrollTop,
      behavior,
    });
  }

  scrollToTop(behavior: ScrollBehavior = "smooth") {
    if (!this.scrollElement) return;

    this.scrollElement.scrollTo({
      top: 0,
      behavior,
    });
  }

  scrollToBottom(behavior: ScrollBehavior = "smooth") {
    if (!this.scrollElement) return;

    this.scrollElement.scrollTo({
      top: this.scrollElement.scrollHeight,
      behavior,
    });
  }
}

export function useVirtualScroll<T>(
  items: T[],
  config: VirtualScrollConfig,
): VirtualScrollResult {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(
    config.containerHeight,
  );
  const managerRef = useRef<VirtualScrollManager>();
  const scrollElementRef = useRef<HTMLElement | null>(null);

  // Initialize manager
  if (!managerRef.current) {
    managerRef.current = new VirtualScrollManager(config);
  }

  // Update config when it changes
  useEffect(() => {
    managerRef.current?.updateConfig({ ...config, containerHeight });
  }, [config, containerHeight]);

  // Set scroll element reference
  const setScrollElement = useCallback((element: HTMLElement | null) => {
    scrollElementRef.current = element;
    managerRef.current?.setScrollElement(element);

    if (element) {
      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          setContainerHeight(entry.contentRect.height);
        }
      });

      resizeObserver.observe(element);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, []);

  // Handle scroll events
  const handleScroll = useCallback((event: Event) => {
    const target = event.target as HTMLElement;
    const newScrollTop = target.scrollTop;

    if (managerRef.current?.shouldUpdate(newScrollTop)) {
      setScrollTop(newScrollTop);
    }
  }, []);

  // Attach scroll listener
  useEffect(() => {
    const element = scrollElementRef.current;
    if (element) {
      element.addEventListener("scroll", handleScroll, { passive: true });
      return () => element.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  // Calculate visible items
  const visibleItems = useMemo(() => {
    if (!managerRef.current) return [];

    const { startIndex, endIndex, offsetY } =
      managerRef.current.calculateVisibleItems(scrollTop, items.length);

    const result: VirtualScrollItem[] = [];

    for (let i = startIndex; i <= endIndex; i++) {
      if (i >= 0 && i < items.length) {
        result.push({
          index: i,
          style: managerRef.current.getItemStyle(i, offsetY),
          isVisible: true,
        });
      }
    }

    return result;
  }, [items.length, scrollTop]);

  // Calculate total height
  const totalHeight = useMemo(() => {
    return items.length * config.itemHeight;
  }, [items.length, config.itemHeight]);

  // Scroll functions
  const scrollToIndex = useCallback(
    (index: number, behavior?: ScrollBehavior) => {
      managerRef.current?.scrollToIndex(index, behavior);
    },
    [],
  );

  const scrollToTop = useCallback((behavior?: ScrollBehavior) => {
    managerRef.current?.scrollToTop(behavior);
  }, []);

  const scrollToBottom = useCallback((behavior?: ScrollBehavior) => {
    managerRef.current?.scrollToBottom(behavior);
  }, []);

  return {
    visibleItems,
    totalHeight,
    scrollToIndex,
    scrollToTop,
    scrollToBottom,
    containerRef: scrollElementRef,
    handleScroll,
    setScrollElement,
  };
}

// Hook for measuring dynamic item heights
export function useDynamicVirtualScroll<T>(
  items: T[],
  estimatedItemHeight: number,
  overscan: number = 5,
) {
  const [itemHeights, setItemHeights] = useState<Map<number, number>>(
    new Map(),
  );
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const scrollElementRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Measure item height
  const measureItem = useCallback(
    (index: number, element: HTMLElement | null) => {
      if (element) {
        itemRefs.current.set(index, element);
        const height = element.getBoundingClientRect().height;

        setItemHeights((prev) => {
          const newHeights = new Map(prev);
          if (newHeights.get(index) !== height) {
            newHeights.set(index, height);
            return newHeights;
          }
          return prev;
        });
      } else {
        itemRefs.current.delete(index);
      }
    },
    [],
  );

  // Calculate cumulative heights
  const cumulativeHeights = useMemo(() => {
    const heights: number[] = [0];
    let totalHeight = 0;

    for (let i = 0; i < items.length; i++) {
      const height = itemHeights.get(i) || estimatedItemHeight;
      totalHeight += height;
      heights.push(totalHeight);
    }

    return heights;
  }, [items.length, itemHeights, estimatedItemHeight]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    if (cumulativeHeights.length === 0) return { start: 0, end: 0 };

    const scrollBottom = scrollTop + containerHeight;

    // Binary search for start index
    let start = 0;
    let end = cumulativeHeights.length - 1;

    while (start < end) {
      const mid = Math.floor((start + end) / 2);
      if (cumulativeHeights[mid] < scrollTop) {
        start = mid + 1;
      } else {
        end = mid;
      }
    }

    const startIndex = Math.max(0, start - 1 - overscan);

    // Binary search for end index
    start = 0;
    end = cumulativeHeights.length - 1;

    while (start < end) {
      const mid = Math.floor((start + end) / 2);
      if (cumulativeHeights[mid] <= scrollBottom) {
        start = mid + 1;
      } else {
        end = mid;
      }
    }

    const endIndex = Math.min(items.length - 1, start + overscan);

    return { start: startIndex, end: endIndex };
  }, [scrollTop, containerHeight, cumulativeHeights, items.length, overscan]);

  // Generate visible items
  const visibleItems = useMemo(() => {
    const result: VirtualScrollItem[] = [];

    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      if (i >= 0 && i < items.length) {
        result.push({
          index: i,
          style: {
            position: "absolute",
            top: cumulativeHeights[i],
            left: 0,
            right: 0,
            height: itemHeights.get(i) || estimatedItemHeight,
          },
          isVisible: true,
        });
      }
    }

    return result;
  }, [
    visibleRange,
    items.length,
    cumulativeHeights,
    itemHeights,
    estimatedItemHeight,
  ]);

  const totalHeight = cumulativeHeights[cumulativeHeights.length - 1] || 0;

  // Scroll functions
  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      if (!scrollElementRef.current || index < 0 || index >= items.length)
        return;

      const targetScrollTop = cumulativeHeights[index];
      scrollElementRef.current.scrollTo({
        top: targetScrollTop,
        behavior,
      });
    },
    [cumulativeHeights, items.length],
  );

  const scrollToTop = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!scrollElementRef.current) return;

    scrollElementRef.current.scrollTo({
      top: 0,
      behavior,
    });
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (!scrollElementRef.current) return;

      scrollElementRef.current.scrollTo({
        top: totalHeight,
        behavior,
      });
    },
    [totalHeight],
  );

  // Handle scroll events
  const handleScroll = useCallback((event: Event) => {
    const target = event.target as HTMLElement;
    setScrollTop(target.scrollTop);
  }, []);

  // Set scroll element and attach listeners
  const setScrollElement = useCallback(
    (element: HTMLElement | null) => {
      scrollElementRef.current = element;

      if (element) {
        // Attach scroll listener
        element.addEventListener("scroll", handleScroll, { passive: true });

        // Observe container size changes
        const resizeObserver = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (entry) {
            setContainerHeight(entry.contentRect.height);
          }
        });

        resizeObserver.observe(element);

        return () => {
          element.removeEventListener("scroll", handleScroll);
          resizeObserver.disconnect();
        };
      }
    },
    [handleScroll],
  );

  return {
    visibleItems,
    totalHeight,
    scrollToIndex,
    scrollToTop,
    scrollToBottom,
    setScrollElement,
    measureItem,
  };
}

/**
 * Create a virtual scroll manager with default configuration
 */
export function createVirtualScrollManager(
  config?: Partial<VirtualScrollConfig>,
): VirtualScrollManager {
  const defaultConfig: VirtualScrollConfig = {
    itemHeight: 60,
    containerHeight: 400,
    overscan: 5,
    threshold: 50,
  };

  return new VirtualScrollManager({ ...defaultConfig, ...config });
}

interface ItemWithContent {
  content?: string;
  text?: string;
}

/**
 * Calculate optimal item height based on content
 */
export function calculateOptimalItemHeight(
  items: ItemWithContent[],
  containerWidth: number,
): number {
  if (!items || items.length === 0) {
    return 60; // Default height
  }

  // Sample a few items to estimate height
  const sampleSize = Math.min(10, items.length);
  const sampleItems = items.slice(0, sampleSize);

  let totalEstimatedHeight = 0;

  for (const item of sampleItems) {
    const content = item.content || item.text || String(item);
    const estimatedHeight = estimateItemHeight(content, containerWidth);
    totalEstimatedHeight += estimatedHeight;
  }

  const averageHeight = totalEstimatedHeight / sampleSize;

  // Ensure minimum height
  return Math.max(60, Math.ceil(averageHeight));
}

/**
 * Estimate item height based on content
 */
export function estimateItemHeight(
  content: string,
  containerWidth: number = 400,
): number {
  if (!content) {
    return 60; // Minimum height
  }

  const baseHeight = 60;
  const lineHeight = 20;
  const charactersPerLine = Math.floor(containerWidth / 8); // Rough estimate

  // Count line breaks
  const explicitLines = (content.match(/\n/g) || []).length + 1;

  // Estimate wrapped lines
  const wrappedLines = Math.ceil(content.length / charactersPerLine);

  // Use the larger of the two estimates
  const totalLines = Math.max(explicitLines, wrappedLines);

  // Add extra height for markdown formatting
  let extraHeight = 0;
  if (content.includes("```")) {
    extraHeight += 40; // Code blocks need more space
  }
  if (content.includes("#")) {
    extraHeight += 20; // Headers need more space
  }
  if (content.includes("*") || content.includes("_")) {
    extraHeight += 10; // Formatted text might need slightly more space
  }

  return Math.max(baseHeight, totalLines * lineHeight + extraHeight);
}
