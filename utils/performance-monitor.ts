/**
 * Performance monitoring utilities for the chat application
 */

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  apiResponseTime: number;
  bundleSize?: number;
  chunkLoadTime?: number;
}

export interface BundleAnalytics {
  totalSize: number;
  chunkSizes: Map<string, number>;
  loadTimes: Map<string, number>;
  cacheHitRate: number;
}

export class PerformanceMonitor {
  private static metrics: Map<string, PerformanceMetrics[]> = new Map();
  private static bundleAnalytics: BundleAnalytics = {
    totalSize: 0,
    chunkSizes: new Map(),
    loadTimes: new Map(),
    cacheHitRate: 0
  };
  private static readonly MAX_METRICS_PER_COMPONENT = 100;
  private static observer: PerformanceObserver | null = null;

  /**
   * Initialize performance monitoring
   */
  static initialize(): void {
    if (typeof window === 'undefined') return;

    // Set up Performance Observer for navigation and resource timing
    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handlePerformanceEntry(entry);
        }
      });

      this.observer.observe({ entryTypes: ['navigation', 'resource', 'measure'] });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }

    // Monitor bundle loading
    this.monitorBundleLoading();

    // Set up memory monitoring
    this.startMemoryMonitoring();
  }

  /**
   * Handle performance entries from PerformanceObserver
   */
  private static handlePerformanceEntry(entry: PerformanceEntry): void {
    if (entry.entryType === 'resource') {
      const resourceEntry = entry as PerformanceResourceTiming;
      
      // Track chunk loading times
      if (resourceEntry.name.includes('.js') || resourceEntry.name.includes('.css')) {
        const chunkName = this.extractChunkName(resourceEntry.name);
        const loadTime = resourceEntry.responseEnd - resourceEntry.requestStart;
        
        this.bundleAnalytics.loadTimes.set(chunkName, loadTime);
        
        // Estimate chunk size from transfer size
        if (resourceEntry.transferSize) {
          this.bundleAnalytics.chunkSizes.set(chunkName, resourceEntry.transferSize);
          this.bundleAnalytics.totalSize += resourceEntry.transferSize;
        }
      }
    } else if (entry.entryType === 'navigation') {
      const navEntry = entry as PerformanceNavigationTiming;
      this.recordMetric('navigation', {
        renderTime: navEntry.loadEventEnd - navEntry.navigationStart,
        memoryUsage: 0,
        cacheHitRate: 0,
        apiResponseTime: navEntry.responseEnd - navEntry.requestStart
      });
    }
  }

  /**
   * Extract chunk name from resource URL
   */
  private static extractChunkName(url: string): string {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.split('?')[0]; // Remove query parameters
  }

  /**
   * Monitor bundle loading performance
   */
  private static monitorBundleLoading(): void {
    // Monitor dynamic imports
    const originalImport = window.import || (() => Promise.resolve());
    
    // Override dynamic import to track loading times
    if (typeof window !== 'undefined') {
      (window as any).import = async (specifier: string) => {
        const startTime = performance.now();
        try {
          const result = await originalImport(specifier);
          const loadTime = performance.now() - startTime;
          
          this.recordMetric('dynamic-import', {
            renderTime: loadTime,
            memoryUsage: 0,
            cacheHitRate: 0,
            apiResponseTime: 0,
            chunkLoadTime: loadTime
          });
          
          return result;
        } catch (error) {
          const loadTime = performance.now() - startTime;
          this.recordMetric('dynamic-import-error', {
            renderTime: loadTime,
            memoryUsage: 0,
            cacheHitRate: 0,
            apiResponseTime: 0,
            chunkLoadTime: loadTime
          });
          throw error;
        }
      };
    }
  }

  /**
   * Start memory monitoring
   */
  private static startMemoryMonitoring(): void {
    if (typeof window === 'undefined') return;

    setInterval(() => {
      if ((performance as any).memory) {
        const memory = (performance as any).memory;
        this.recordMetric('memory', {
          renderTime: 0,
          memoryUsage: memory.usedJSHeapSize,
          cacheHitRate: 0,
          apiResponseTime: 0
        });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Start performance measurement
   */
  static startMeasure(componentName: string): () => void {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

    // Use Performance API mark for better tracking
    performance.mark(`${componentName}-start`);

    return () => {
      const endTime = performance.now();
      const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      performance.mark(`${componentName}-end`);
      performance.measure(`${componentName}-duration`, `${componentName}-start`, `${componentName}-end`);
      
      this.recordMetric(componentName, {
        renderTime: endTime - startTime,
        memoryUsage: endMemory - startMemory,
        cacheHitRate: 0, // To be updated by cache systems
        apiResponseTime: 0, // To be updated by API calls
      });
    };
  }

  /**
   * Measure async operation
   */
  static async measureAsync<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const endMeasure = this.startMeasure(operationName);
    try {
      const result = await operation();
      return result;
    } finally {
      endMeasure();
    }
  }

  /**
   * Record performance metric
   */
  static recordMetric(componentName: string, metric: Partial<PerformanceMetrics>): void {
    if (!this.metrics.has(componentName)) {
      this.metrics.set(componentName, []);
    }

    const componentMetrics = this.metrics.get(componentName)!;
    const fullMetric: PerformanceMetrics = {
      renderTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      apiResponseTime: 0,
      ...metric,
    };

    componentMetrics.push(fullMetric);

    // Keep only recent metrics
    if (componentMetrics.length > this.MAX_METRICS_PER_COMPONENT) {
      componentMetrics.shift();
    }

    // Log performance warnings in development
    if (process.env.NODE_ENV === 'development') {
      if (fullMetric.renderTime > 16) {
        console.warn(`Performance warning: ${componentName} render took ${fullMetric.renderTime.toFixed(2)}ms`);
      }
      if (fullMetric.memoryUsage > 1024 * 1024) { // 1MB
        console.warn(`Memory warning: ${componentName} used ${(fullMetric.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
      }
    }
  }

  /**
   * Record API response time
   */
  static recordApiCall(endpoint: string, responseTime: number, success: boolean): void {
    this.recordMetric(`api-${endpoint}`, {
      renderTime: 0,
      memoryUsage: 0,
      cacheHitRate: success ? 1 : 0,
      apiResponseTime: responseTime
    });
  }

  /**
   * Record cache hit/miss
   */
  static recordCacheAccess(cacheName: string, hit: boolean): void {
    this.recordMetric(`cache-${cacheName}`, {
      renderTime: 0,
      memoryUsage: 0,
      cacheHitRate: hit ? 1 : 0,
      apiResponseTime: 0
    });
  }

  /**
   * Get performance summary for a component
   */
  static getSummary(componentName: string): {
    averageRenderTime: number;
    maxRenderTime: number;
    averageMemoryUsage: number;
    averageApiResponseTime: number;
    cacheHitRate: number;
    sampleCount: number;
  } | null {
    const metrics = this.metrics.get(componentName);
    if (!metrics || metrics.length === 0) return null;

    const renderTimes = metrics.map(m => m.renderTime);
    const memoryUsages = metrics.map(m => m.memoryUsage);
    const apiResponseTimes = metrics.map(m => m.apiResponseTime);
    const cacheHits = metrics.filter(m => m.cacheHitRate > 0).length;

    return {
      averageRenderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
      maxRenderTime: Math.max(...renderTimes),
      averageMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
      averageApiResponseTime: apiResponseTimes.reduce((a, b) => a + b, 0) / apiResponseTimes.length,
      cacheHitRate: cacheHits / metrics.length,
      sampleCount: metrics.length,
    };
  }

  /**
   * Get bundle analytics
   */
  static getBundleAnalytics(): BundleAnalytics {
    return { ...this.bundleAnalytics };
  }

  /**
   * Get all performance data
   */
  static getAllMetrics(): Map<string, PerformanceMetrics[]> {
    return new Map(this.metrics);
  }

  /**
   * Export performance data
   */
  static exportData(): {
    metrics: Record<string, PerformanceMetrics[]>;
    bundleAnalytics: BundleAnalytics;
    timestamp: string;
  } {
    const metricsObj: Record<string, PerformanceMetrics[]> = {};
    this.metrics.forEach((value, key) => {
      metricsObj[key] = [...value];
    });

    return {
      metrics: metricsObj,
      bundleAnalytics: { ...this.bundleAnalytics },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear metrics for a component
   */
  static clearMetrics(componentName?: string): void {
    if (componentName) {
      this.metrics.delete(componentName);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Cleanup and stop monitoring
   */
  static cleanup(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// React hook for component performance monitoring
export function usePerformanceMonitor(componentName: string) {
  const startMeasure = () => PerformanceMonitor.startMeasure(componentName);
  const recordMetric = (metric: Partial<PerformanceMetrics>) => 
    PerformanceMonitor.recordMetric(componentName, metric);
  const getSummary = () => PerformanceMonitor.getSummary(componentName);

  return { startMeasure, recordMetric, getSummary };
}

// Initialize performance monitoring when module loads
if (typeof window !== 'undefined') {
  PerformanceMonitor.initialize();
}