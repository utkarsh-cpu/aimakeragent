/**
 * Performance monitoring utilities for the chat application
 */

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  apiResponseTime: number;
}

export class PerformanceMonitor {
  private static metrics: Map<string, PerformanceMetrics[]> = new Map();
  private static readonly MAX_METRICS_PER_COMPONENT = 100;

  /**
   * Start performance measurement
   */
  static startMeasure(componentName: string): () => void {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

    return () => {
      const endTime = performance.now();
      const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      this.recordMetric(componentName, {
        renderTime: endTime - startTime,
        memoryUsage: endMemory - startMemory,
        cacheHitRate: 0, // To be updated by cache systems
        apiResponseTime: 0, // To be updated by API calls
      });
    };
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
    }
  }

  /**
   * Get performance summary for a component
   */
  static getSummary(componentName: string): {
    averageRenderTime: number;
    maxRenderTime: number;
    averageMemoryUsage: number;
    sampleCount: number;
  } | null {
    const metrics = this.metrics.get(componentName);
    if (!metrics || metrics.length === 0) return null;

    const renderTimes = metrics.map(m => m.renderTime);
    const memoryUsages = metrics.map(m => m.memoryUsage);

    return {
      averageRenderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
      maxRenderTime: Math.max(...renderTimes),
      averageMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
      sampleCount: metrics.length,
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
}