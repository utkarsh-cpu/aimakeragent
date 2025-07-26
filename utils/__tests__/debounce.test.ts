import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { 
  debounce, 
  throttle, 
  useDebounce, 
  useDebounceCallback, 
  useThrottleCallback,
  useDebouncedSearch,
  useOptimizedState,
  useMemoryOptimization,
  useBatchedUpdates
} from '../debounce';

// Mock timers
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  it('should delay function execution', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('test');
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('should reset delay on subsequent calls', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('first');
    vi.advanceTimersByTime(50);
    
    debouncedFn('second');
    vi.advanceTimersByTime(50);
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(mockFn).toHaveBeenCalledWith('second');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  it('should limit function execution frequency', () => {
    const mockFn = vi.fn();
    const throttledFn = throttle(mockFn, 100);

    throttledFn('first');
    expect(mockFn).toHaveBeenCalledWith('first');

    throttledFn('second');
    expect(mockFn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledWith('second');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should execute immediately on first call', () => {
    const mockFn = vi.fn();
    const throttledFn = throttle(mockFn, 100);

    throttledFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });
});

describe('useDebounce', () => {
  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 100 } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated', delay: 100 });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe('updated');
  });

  it('should reset timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 100 } }
    );

    rerender({ value: 'first', delay: 100 });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    rerender({ value: 'second', delay: 100 });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toBe('second');
  });
});

describe('useDebounceCallback', () => {
  it('should debounce callback execution', () => {
    const mockCallback = vi.fn();
    const { result } = renderHook(() => 
      useDebounceCallback(mockCallback, 100)
    );

    act(() => {
      result.current('test');
    });

    expect(mockCallback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(mockCallback).toHaveBeenCalledWith('test');
  });

  it('should cancel previous timeout on new calls', () => {
    const mockCallback = vi.fn();
    const { result } = renderHook(() => 
      useDebounceCallback(mockCallback, 100)
    );

    act(() => {
      result.current('first');
      vi.advanceTimersByTime(50);
      result.current('second');
      vi.advanceTimersByTime(100);
    });

    expect(mockCallback).toHaveBeenCalledWith('second');
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });
});

describe('useThrottleCallback', () => {
  it('should throttle callback execution', () => {
    const mockCallback = vi.fn();
    const { result } = renderHook(() => 
      useThrottleCallback(mockCallback, 100)
    );

    act(() => {
      result.current('first');
    });

    expect(mockCallback).toHaveBeenCalledWith('first');

    act(() => {
      result.current('second');
    });

    expect(mockCallback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(mockCallback).toHaveBeenCalledWith('second');
    expect(mockCallback).toHaveBeenCalledTimes(2);
  });
});

describe('useDebouncedSearch', () => {
  const mockItems = [
    { id: 1, name: 'Apple' },
    { id: 2, name: 'Banana' },
    { id: 3, name: 'Cherry' },
  ];

  const mockSearchFunction = (items: typeof mockItems, term: string) => 
    items.filter(item => item.name.toLowerCase().includes(term.toLowerCase()));

  it('should return all items when search term is empty', () => {
    const { result } = renderHook(() => 
      useDebouncedSearch(mockItems, '', mockSearchFunction, 100)
    );

    expect(result.current.results).toEqual(mockItems);
    expect(result.current.isSearching).toBe(false);
  });

  it('should debounce search and show loading state', () => {
    const { result, rerender } = renderHook(
      ({ searchTerm }) => useDebouncedSearch(mockItems, searchTerm, mockSearchFunction, 100),
      { initialProps: { searchTerm: '' } }
    );

    rerender({ searchTerm: 'app' });
    expect(result.current.isSearching).toBe(true);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isSearching).toBe(false);
    expect(result.current.results).toEqual([{ id: 1, name: 'Apple' }]);
  });
});

describe('useOptimizedState', () => {
  it('should provide immediate and debounced values', () => {
    const { result } = renderHook(() => useOptimizedState('initial', 100));

    const [immediate, debounced, setValue] = result.current;
    expect(immediate).toBe('initial');
    expect(debounced).toBe('initial');

    act(() => {
      setValue('updated');
    });

    const [newImmediate, newDebounced] = result.current;
    expect(newImmediate).toBe('updated');
    expect(newDebounced).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const [finalImmediate, finalDebounced] = result.current;
    expect(finalImmediate).toBe('updated');
    expect(finalDebounced).toBe('updated');
  });
});

describe('useMemoryOptimization', () => {
  it('should return original data when under threshold', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const { result } = renderHook(() => 
      useMemoryOptimization(data, 1000, 1200)
    );

    expect(result.current).toEqual(data);
  });

  it('should optimize data when over threshold', () => {
    const data = Array.from({ length: 1300 }, (_, i) => ({ id: i }));
    const { result } = renderHook(() => 
      useMemoryOptimization(data, 1000, 1200)
    );

    expect(result.current).toHaveLength(1000);
    expect(result.current[0]).toEqual({ id: 300 }); // Last 1000 items
    expect(result.current[999]).toEqual({ id: 1299 });
  });

  it('should update when data changes', () => {
    const initialData = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const { result, rerender } = renderHook(
      ({ data }) => useMemoryOptimization(data, 1000, 1200),
      { initialProps: { data: initialData } }
    );

    expect(result.current).toHaveLength(100);

    const newData = Array.from({ length: 1300 }, (_, i) => ({ id: i }));
    rerender({ data: newData });

    expect(result.current).toHaveLength(1000);
  });
});

describe('useBatchedUpdates', () => {
  it('should batch items when under batch size', () => {
    const { result } = renderHook(() => 
      useBatchedUpdates([], 5, 100)
    );

    act(() => {
      result.current.addItem({ id: 1 });
      result.current.addItem({ id: 2 });
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.pendingCount).toBe(2);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.pendingCount).toBe(0);
  });

  it('should flush immediately when batch size reached', () => {
    const { result } = renderHook(() => 
      useBatchedUpdates([], 2, 100)
    );

    act(() => {
      result.current.addItem({ id: 1 });
      result.current.addItem({ id: 2 });
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.pendingCount).toBe(0);
  });

  it('should handle adding multiple items at once', () => {
    const { result } = renderHook(() => 
      useBatchedUpdates([], 5, 100)
    );

    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

    act(() => {
      result.current.addItems(items);
    });

    expect(result.current.pendingCount).toBe(3);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.items).toHaveLength(3);
  });

  it('should clear all items', () => {
    const { result } = renderHook(() => 
      useBatchedUpdates([{ id: 1 }], 5, 100)
    );

    act(() => {
      result.current.addItem({ id: 2 });
      result.current.clearItems();
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.pendingCount).toBe(0);
  });
});

describe('Performance and Edge Cases', () => {
  it('should handle rapid debounce calls efficiently', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 10);

    // Simulate rapid calls
    for (let i = 0; i < 1000; i++) {
      debouncedFn(i);
    }

    expect(mockFn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(999);
  });

  it('should handle zero delay gracefully', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 0);

    debouncedFn('test');

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('should handle negative delay gracefully', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, -100);

    debouncedFn('test');

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(mockFn).toHaveBeenCalledWith('test');
  });
});