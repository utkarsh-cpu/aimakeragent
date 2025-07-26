/**
 * UI optimization utilities for enhanced performance and user experience
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// Loading states and skeleton screens
export interface LoadingState {
  isLoading: boolean;
  progress?: number;
  message?: string;
  error?: string;
}

export function useLoadingState(initialState: boolean = false): [
  LoadingState,
  (state: Partial<LoadingState>) => void
] {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: initialState
  });

  const updateLoadingState = useCallback((state: Partial<LoadingState>) => {
    setLoadingState(prev => ({ ...prev, ...state }));
  }, []);

  return [loadingState, updateLoadingState];
}

// Skeleton screen component utilities
export interface SkeletonConfig {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
  className?: string;
}

export function createSkeletonStyles(config: SkeletonConfig = {}): React.CSSProperties {
  return {
    width: config.width || '100%',
    height: config.height || '1rem',
    borderRadius: config.borderRadius || '0.25rem',
    backgroundColor: 'var(--skeleton-bg, #e2e8f0)',
    animation: config.animation === 'pulse' 
      ? 'skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      : config.animation === 'wave'
      ? 'skeleton-wave 1.6s linear infinite'
      : 'none',
    backgroundImage: config.animation === 'wave' 
      ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)'
      : undefined,
    backgroundSize: config.animation === 'wave' ? '200px 100%' : undefined,
    backgroundRepeat: 'no-repeat'
  };
}

// Animation utilities
export interface AnimationConfig {
  duration?: number;
  easing?: string;
  delay?: number;
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
}

export function useAnimation(
  elementRef: React.RefObject<HTMLElement>,
  keyframes: Keyframe[],
  config: AnimationConfig = {}
): {
  play: () => void;
  pause: () => void;
  cancel: () => void;
  isPlaying: boolean;
} {
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<Animation | null>(null);

  const play = useCallback(() => {
    if (elementRef.current && !isPlaying) {
      animationRef.current = elementRef.current.animate(keyframes, {
        duration: config.duration || 300,
        easing: config.easing || 'ease-out',
        delay: config.delay || 0,
        fill: config.fillMode || 'forwards'
      });

      animationRef.current.addEventListener('finish', () => {
        setIsPlaying(false);
      });

      setIsPlaying(true);
    }
  }, [elementRef, keyframes, config, isPlaying]);

  const pause = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const cancel = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.cancel();
      setIsPlaying(false);
    }
  }, []);

  return { play, pause, cancel, isPlaying };
}

// Micro-interactions
export function useMicroInteraction(
  trigger: 'hover' | 'click' | 'focus',
  animation: Keyframe[],
  config: AnimationConfig = {}
) {
  const elementRef = useRef<HTMLElement>(null);
  const { play } = useAnimation(elementRef, animation, config);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTrigger = () => play();

    element.addEventListener(trigger, handleTrigger);
    return () => element.removeEventListener(trigger, handleTrigger);
  }, [trigger, play]);

  return elementRef;
}

// Bundle size optimization
export function lazyImport<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(importFn);
}

export function createChunkedImport<T>(
  importFn: () => Promise<T>,
  chunkName?: string
): () => Promise<T> {
  return () => {
    if (chunkName) {
      // Add webpack magic comment for chunk naming
      return import(/* webpackChunkName: "[chunkName]" */ importFn as any);
    }
    return importFn();
  };
}

// Performance optimization hooks
export function useOptimizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps);
}

export function useOptimizedMemo<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  return useMemo(factory, deps);
}

export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(((...args: any[]) => {
    return callbackRef.current(...args);
  }) as T, []);
}

// Image optimization
export interface ImageOptimizationConfig {
  lazy?: boolean;
  placeholder?: string;
  quality?: number;
  format?: 'webp' | 'avif' | 'auto';
  sizes?: string;
  priority?: boolean;
}

export function useOptimizedImage(
  src: string,
  config: ImageOptimizationConfig = {}
): {
  src: string;
  loading: 'lazy' | 'eager';
  onLoad: () => void;
  onError: () => void;
  isLoaded: boolean;
  hasError: boolean;
} {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const optimizedSrc = useMemo(() => {
    // In a real implementation, this would generate optimized image URLs
    // For now, return the original src
    return src;
  }, [src, config]);

  const onLoad = useCallback(() => {
    setIsLoaded(true);
    setHasError(false);
  }, []);

  const onError = useCallback(() => {
    setHasError(true);
    setIsLoaded(false);
  }, []);

  return {
    src: optimizedSrc,
    loading: config.lazy !== false ? 'lazy' : 'eager',
    onLoad,
    onError,
    isLoaded,
    hasError
  };
}

// CSS-in-JS optimization
export function createOptimizedStyles<T extends Record<string, React.CSSProperties>>(
  styles: T
): T {
  // In a real implementation, this would optimize CSS properties
  // For now, return the styles as-is
  return styles;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// Responsive design utilities
export function useResponsiveValue<T>(
  values: {
    base: T;
    sm?: T;
    md?: T;
    lg?: T;
    xl?: T;
  }
): T {
  const isSmall = useMediaQuery('(min-width: 640px)');
  const isMedium = useMediaQuery('(min-width: 768px)');
  const isLarge = useMediaQuery('(min-width: 1024px)');
  const isExtraLarge = useMediaQuery('(min-width: 1280px)');

  return useMemo(() => {
    if (isExtraLarge && values.xl !== undefined) return values.xl;
    if (isLarge && values.lg !== undefined) return values.lg;
    if (isMedium && values.md !== undefined) return values.md;
    if (isSmall && values.sm !== undefined) return values.sm;
    return values.base;
  }, [values, isSmall, isMedium, isLarge, isExtraLarge]);
}

// Theme optimization
export interface ThemeConfig {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  typography: Record<string, React.CSSProperties>;
  breakpoints: Record<string, string>;
  animations: Record<string, string>;
}

export function useOptimizedTheme(theme: ThemeConfig): ThemeConfig {
  return useMemo(() => {
    // Optimize theme by creating CSS custom properties
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      
      // Set color custom properties
      Object.entries(theme.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
      });

      // Set spacing custom properties
      Object.entries(theme.spacing).forEach(([key, value]) => {
        root.style.setProperty(`--spacing-${key}`, value);
      });
    }

    return theme;
  }, [theme]);
}

// Performance monitoring for UI
export function useRenderPerformance(componentName: string): void {
  const renderCount = useRef(0);
  const startTime = useRef<number>(0);

  useEffect(() => {
    renderCount.current += 1;
    startTime.current = performance.now();
  });

  useEffect(() => {
    const endTime = performance.now();
    const renderTime = endTime - startTime.current;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`${componentName} render #${renderCount.current}: ${renderTime.toFixed(2)}ms`);
    }

    // Report to analytics if render time is concerning
    if (renderTime > 16) { // More than one frame at 60fps
      console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
    }
  });
}

// Intersection Observer optimization
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
): {
  isIntersecting: boolean;
  entry: IntersectionObserverEntry | null;
} {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        setEntry(entry);
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef, options]);

  return { isIntersecting, entry };
}

// Scroll optimization
export function useOptimizedScroll(
  callback: (scrollY: number) => void,
  throttleMs: number = 16
): void {
  const callbackRef = useRef(callback);
  const throttleRef = useRef<number | null>(null);

  callbackRef.current = callback;

  useEffect(() => {
    const handleScroll = () => {
      if (throttleRef.current) return;

      throttleRef.current = requestAnimationFrame(() => {
        callbackRef.current(window.scrollY);
        throttleRef.current = null;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (throttleRef.current) {
        cancelAnimationFrame(throttleRef.current);
      }
    };
  }, []);
}

// CSS animations
export const optimizedAnimations = {
  fadeIn: [
    { opacity: 0, transform: 'translateY(10px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ],
  fadeOut: [
    { opacity: 1, transform: 'translateY(0)' },
    { opacity: 0, transform: 'translateY(-10px)' }
  ],
  slideIn: [
    { transform: 'translateX(-100%)' },
    { transform: 'translateX(0)' }
  ],
  slideOut: [
    { transform: 'translateX(0)' },
    { transform: 'translateX(100%)' }
  ],
  scaleIn: [
    { transform: 'scale(0.9)', opacity: 0 },
    { transform: 'scale(1)', opacity: 1 }
  ],
  scaleOut: [
    { transform: 'scale(1)', opacity: 1 },
    { transform: 'scale(0.9)', opacity: 0 }
  ],
  bounce: [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-10px)' },
    { transform: 'translateY(0)' }
  ],
  shake: [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-5px)' },
    { transform: 'translateX(5px)' },
    { transform: 'translateX(0)' }
  ]
};

// CSS classes for common optimizations
export const optimizedClasses = {
  // GPU acceleration
  gpuAccelerated: 'transform-gpu will-change-transform',
  
  // Smooth scrolling
  smoothScroll: 'scroll-smooth',
  
  // Optimized text rendering
  optimizedText: 'text-rendering-optimizeLegibility font-feature-settings-normal',
  
  // Reduced motion
  respectMotion: 'motion-reduce:transition-none motion-reduce:animation-none',
  
  // Focus optimization
  focusOptimized: 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
  
  // Loading states
  skeleton: 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded',
  
  // Hover optimizations
  hoverOptimized: 'transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-800'
};

// Bundle size analysis helper
export function analyzeBundleSize(): void {
  if (process.env.NODE_ENV === 'development') {
    // This would integrate with webpack-bundle-analyzer or similar
    console.log('Bundle analysis would run here in a real implementation');
  }
}

// Performance budget checker
export interface PerformanceBudget {
  maxBundleSize: number; // in KB
  maxRenderTime: number; // in ms
  maxMemoryUsage: number; // in MB
}

export function checkPerformanceBudget(budget: PerformanceBudget): {
  bundleSize: { current: number; limit: number; passed: boolean };
  renderTime: { current: number; limit: number; passed: boolean };
  memoryUsage: { current: number; limit: number; passed: boolean };
} {
  // In a real implementation, these would be actual measurements
  const currentBundleSize = 0; // Would be calculated from build stats
  const currentRenderTime = 0; // Would be measured from performance API
  const currentMemoryUsage = 0; // Would be from performance.memory

  return {
    bundleSize: {
      current: currentBundleSize,
      limit: budget.maxBundleSize,
      passed: currentBundleSize <= budget.maxBundleSize
    },
    renderTime: {
      current: currentRenderTime,
      limit: budget.maxRenderTime,
      passed: currentRenderTime <= budget.maxRenderTime
    },
    memoryUsage: {
      current: currentMemoryUsage,
      limit: budget.maxMemoryUsage,
      passed: currentMemoryUsage <= budget.maxMemoryUsage
    }
  };
}