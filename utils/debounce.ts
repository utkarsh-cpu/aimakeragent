import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Debounce function that delays execution until after delay milliseconds
 * have elapsed since the last time it was invoked
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function that limits execution to at most once per delay milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        func(...args);
      }, delay - (now - lastCall));
    }
  };
}

/**
 * React hook for debounced values
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * React hook for debounced callbacks
 */
export function useDebounceCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay, ...deps]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * React hook for throttled callbacks
 */
export function useThrottleCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): (...args: Parameters<T>) => void {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastCallRef.current >= delay) {
        lastCallRef.current = now;
        callback(...args);
      } else if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          timeoutRef.current = null;
          callback(...args);
        }, delay - (now - lastCallRef.current));
      }
    },
    [callback, delay, ...deps]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

/**
 * React hook for debounced search functionality
 */
export function useDebouncedSearch<T>(
  items: T[],
  searchTerm: string,
  searchFunction: (items: T[], term: string) => T[],
  delay: number = 300
): {
  results: T[];
  isSearching: boolean;
  debouncedTerm: string;
} {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<T[]>(items);
  const debouncedTerm = useDebounce(searchTerm, delay);

  // Memoize search function to prevent unnecessary re-renders
  const memoizedSearchFunction = useCallback(searchFunction, [searchFunction]);

  useEffect(() => {
    if (searchTerm !== debouncedTerm) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [searchTerm, debouncedTerm]);

  useEffect(() => {
    if (debouncedTerm.trim() === '') {
      setResults(items);
    } else {
      const searchResults = memoizedSearchFunction(items, debouncedTerm);
      setResults(searchResults);
    }
    setIsSearching(false);
  }, [debouncedTerm, items, memoizedSearchFunction]);

  return useMemo(() => ({
    results,
    isSearching,
    debouncedTerm,
  }), [results, isSearching, debouncedTerm]);
}

/**
 * React hook for optimized re-rendering with debounced state updates
 */
export function useOptimizedState<T>(
  initialValue: T,
  delay: number = 100
): [T, T, (value: T) => void] {
  const [immediateValue, setImmediateValue] = useState<T>(initialValue);
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const setValue = useCallback((value: T) => {
    setImmediateValue(value);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
  }, [delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [immediateValue, debouncedValue, setValue];
}

/**
 * React hook for performance monitoring and optimization
 */
export function usePerformanceMonitor(name: string, threshold: number = 16) {
  const startTimeRef = useRef<number>();
  const renderCountRef = useRef<number>(0);

  const startMeasure = useCallback(() => {
    startTimeRef.current = performance.now();
  }, []);

  const endMeasure = useCallback(() => {
    if (startTimeRef.current) {
      const duration = performance.now() - startTimeRef.current;
      renderCountRef.current++;
      
      if (duration > threshold) {
        console.warn(
          `Performance warning: ${name} took ${duration.toFixed(2)}ms (render #${renderCountRef.current})`
        );
      }
      
      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development' && renderCountRef.current % 100 === 0) {
        console.log(
          `Performance info: ${name} average render time over last 100 renders: ${duration.toFixed(2)}ms`
        );
      }
    }
  }, [name, threshold]);

  useEffect(() => {
    startMeasure();
    return endMeasure;
  });

  return { startMeasure, endMeasure };
}

/**
 * React hook for memory usage optimization with conversation-specific logic
 */
export function useMemoryOptimization<T>(
  data: T[],
  maxItems: number = 1000,
  cleanupThreshold: number = 1200
): T[] {
  const [optimizedData, setOptimizedData] = useState<T[]>(data);

  useEffect(() => {
    if (data.length > cleanupThreshold) {
      // Keep only the most recent items
      const recentData = data.slice(-maxItems);
      setOptimizedData(recentData);
      
      // Log memory optimization in development
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `Memory optimization: Reduced data from ${data.length} to ${recentData.length} items`
        );
      }
    } else {
      setOptimizedData(data);
    }
  }, [data, maxItems, cleanupThreshold]);

  return optimizedData;
}

/**
 * React hook for conversation memory management using the centralized memory manager
 */
export function useConversationMemoryOptimization<T extends { id: string; lastMessage?: Date }>(
  conversations: T[],
  config?: Partial<import('./memory-manager').MemoryConfig>
): T[] {
  const [optimizedConversations, setOptimizedConversations] = useState<T[]>(conversations);

  useEffect(() => {
    let isMounted = true;
    
    // Import memory manager dynamically to avoid circular dependencies
    import('./memory-manager').then(({ ConversationMemoryManager }) => {
      if (!isMounted) return;
      
      try {
        const manager = new ConversationMemoryManager(config);
        
        // Convert generic type to Conversation type for the manager
        const conversationsAsConversations = conversations as any[];
        const optimized = manager.optimizeConversations(conversationsAsConversations);
        
        setOptimizedConversations(optimized as unknown as T[]);
      } catch (error) {
        console.error('Error optimizing conversations:', error);
        // Fallback to original conversations on error
        setOptimizedConversations(conversations);
      }
    }).catch(error => {
      if (isMounted) {
        console.error('Error importing memory manager:', error);
        setOptimizedConversations(conversations);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [conversations, config]);

  return optimizedConversations;
}

/**
 * React hook for efficient list updates with batching
 */
export function useBatchedUpdates<T>(
  initialItems: T[],
  batchSize: number = 10,
  delay: number = 100
): {
  items: T[];
  addItem: (item: T) => void;
  addItems: (items: T[]) => void;
  clearItems: () => void;
  pendingCount: number;
} {
  const [items, setItems] = useState<T[]>(initialItems);
  const [pendingItems, setPendingItems] = useState<T[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const addItem = useCallback((item: T) => {
    setPendingItems(current => {
      const newPending = [...current, item];
      
      // Auto-flush if batch size reached
      if (newPending.length >= batchSize) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        setItems(currentItems => [...currentItems, ...newPending]);
        return [];
      }
      
      // Schedule flush
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        setItems(currentItems => [...currentItems, ...newPending]);
        setPendingItems([]);
      }, delay);
      
      return newPending;
    });
  }, [batchSize, delay]);

  const addItems = useCallback((newItems: T[]) => {
    if (newItems.length >= batchSize) {
      // Add immediately if batch size exceeded
      setItems(current => [...current, ...newItems]);
    } else {
      setPendingItems(current => {
        const combined = [...current, ...newItems];
        
        if (combined.length >= batchSize) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          
          setItems(currentItems => [...currentItems, ...combined]);
          return [];
        }
        
        // Schedule flush
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
          setItems(currentItems => [...currentItems, ...combined]);
          setPendingItems([]);
        }, delay);
        
        return combined;
      });
    }
  }, [batchSize, delay]);

  const clearItems = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setItems([]);
    setPendingItems([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    items,
    addItem,
    addItems,
    clearItems,
    pendingCount: pendingItems.length,
  };
}

/**
 * React hook for intelligent re-rendering optimization
 */
export function useRenderOptimization<T>(
  value: T,
  compareFn?: (prev: T, next: T) => boolean,
  delay: number = 50
): T {
  const [optimizedValue, setOptimizedValue] = useState<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastValueRef = useRef<T>(value);

  const defaultCompare = useCallback((prev: T, next: T) => {
    if (typeof prev === 'object' && typeof next === 'object' && prev !== null && next !== null) {
      return JSON.stringify(prev) === JSON.stringify(next);
    }
    return prev === next;
  }, []);

  const compare = compareFn || defaultCompare;

  useEffect(() => {
    if (!compare(lastValueRef.current, value)) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setOptimizedValue(value);
        lastValueRef.current = value;
      }, delay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, compare, delay]);

  return optimizedValue;
}

/**
 * React hook for search optimization with caching
 */
export function useOptimizedSearch<T>(
  items: T[],
  searchTerm: string,
  searchFunction: (items: T[], term: string) => T[],
  options: {
    delay?: number;
    cacheSize?: number;
    minSearchLength?: number;
  } = {}
): {
  results: T[];
  isSearching: boolean;
  debouncedTerm: string;
  cacheHit: boolean;
} {
  const { delay = 300, cacheSize = 50, minSearchLength = 1 } = options;
  
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<T[]>(items);
  const [cacheHit, setCacheHit] = useState(false);
  const debouncedTerm = useDebounce(searchTerm, delay);
  
  // Cache for search results
  const cacheRef = useRef<Map<string, T[]>>(new Map());
  const itemsHashRef = useRef<string>('');

  // Generate hash for items to detect changes
  const itemsHash = useMemo(() => {
    return JSON.stringify(items.map(item => 
      typeof item === 'object' && item !== null && 'id' in item 
        ? (item as any).id 
        : item
    ));
  }, [items]);

  // Clear cache when items change
  useEffect(() => {
    if (itemsHashRef.current !== itemsHash) {
      cacheRef.current.clear();
      itemsHashRef.current = itemsHash;
    }
  }, [itemsHash]);

  useEffect(() => {
    if (searchTerm !== debouncedTerm) {
      setIsSearching(true);
      setCacheHit(false);
    } else {
      setIsSearching(false);
    }
  }, [searchTerm, debouncedTerm]);

  useEffect(() => {
    if (debouncedTerm.trim().length < minSearchLength) {
      setResults(items);
      setCacheHit(false);
      setIsSearching(false);
      return;
    }

    // Check cache first
    const cached = cacheRef.current.get(debouncedTerm);
    if (cached) {
      setResults(cached);
      setCacheHit(true);
      setIsSearching(false);
      return;
    }

    // Perform search
    const searchResults = searchFunction(items, debouncedTerm);
    setResults(searchResults);
    setCacheHit(false);
    setIsSearching(false);

    // Cache results
    if (cacheRef.current.size >= cacheSize) {
      // Remove oldest entry
      const firstKey = cacheRef.current.keys().next().value;
      if (firstKey !== undefined) {
        cacheRef.current.delete(firstKey);
      }
    }
    cacheRef.current.set(debouncedTerm, searchResults);
  }, [debouncedTerm, items, searchFunction, minSearchLength, cacheSize]);

  return {
    results,
    isSearching,
    debouncedTerm,
    cacheHit,
  };
}

/**
 * React hook for input field optimization with smart debouncing
 */
export function useOptimizedInput(
  initialValue: string = '',
  options: {
    debounceDelay?: number;
    validateDelay?: number;
    maxLength?: number;
    validator?: (value: string) => boolean;
  } = {}
): {
  value: string;
  debouncedValue: string;
  isValid: boolean;
  isValidating: boolean;
  setValue: (value: string) => void;
  reset: () => void;
} {
  const { 
    debounceDelay = 150, 
    validateDelay = 300, 
    maxLength, 
    validator 
  } = options;

  const [value, setValue] = useState(initialValue);
  const [isValid, setIsValid] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  
  const debouncedValue = useDebounce(value, debounceDelay);
  const validationValue = useDebounce(value, validateDelay);

  // Validation effect
  useEffect(() => {
    if (!validator) {
      setIsValid(true);
      setIsValidating(false);
      return;
    }

    if (validationValue !== value) {
      setIsValidating(true);
      return;
    }

    setIsValidating(false);
    
    let valid = true;
    
    if (maxLength && value.length > maxLength) {
      valid = false;
    }
    
    if (valid && validator) {
      valid = validator(value);
    }
    
    setIsValid(valid);
  }, [value, validationValue, validator, maxLength]);

  const reset = useCallback(() => {
    setValue(initialValue);
    setIsValid(true);
    setIsValidating(false);
  }, [initialValue]);

  return {
    value,
    debouncedValue,
    isValid,
    isValidating,
    setValue,
    reset,
  };
}

/**
 * React hook for component update optimization
 */
export function useUpdateOptimization<T extends Record<string, any>>(
  props: T,
  dependencies: (keyof T)[] = []
): T {
  const memoizedProps = useMemo(() => {
    if (dependencies.length === 0) {
      return props;
    }
    
    // Only include specified dependencies
    const optimizedProps = {} as T;
    dependencies.forEach(key => {
      optimizedProps[key] = props[key];
    });
    
    return optimizedProps;
  }, dependencies.map(key => props[key]));

  return memoizedProps;
}

/**
 * React hook for lazy loading with intersection observer
 */
export function useLazyLoading(
  threshold: number = 0.1,
  rootMargin: string = '50px'
): {
  ref: React.RefObject<HTMLDivElement>;
  isVisible: boolean;
  hasBeenVisible: boolean;
} {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsVisible(visible);
        
        if (visible && !hasBeenVisible) {
          setHasBeenVisible(true);
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin, hasBeenVisible]);

  return { ref, isVisible, hasBeenVisible };
}

/**
 * React hook for efficient list rendering with windowing
 */
export function useVirtualizedList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
): {
  visibleItems: Array<{ item: T; index: number; style: React.CSSProperties }>;
  totalHeight: number;
  scrollToIndex: (index: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
} {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = useMemo(() => {
    const result = [];
    for (let i = startIndex; i <= endIndex; i++) {
      result.push({
        item: items[i],
        index: i,
        style: {
          position: 'absolute' as const,
          top: i * itemHeight,
          height: itemHeight,
          width: '100%',
        },
      });
    }
    return result;
  }, [items, startIndex, endIndex, itemHeight]);

  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback(
    throttle((e: Event) => {
      const target = e.target as HTMLDivElement;
      setScrollTop(target.scrollTop);
    }, 16), // ~60fps
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollToIndex = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;

    const targetScrollTop = index * itemHeight;
    container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
    });
  }, [itemHeight]);

  return {
    visibleItems,
    totalHeight,
    scrollToIndex,
    containerRef,
  };
}