/**
 * Bundle analysis utilities for optimization
 */

export interface BundleChunk {
  name: string;
  size: number;
  loadTime: number;
  dependencies: string[];
  isLazy: boolean;
  cacheHit: boolean;
}

export interface BundleReport {
  totalSize: number;
  chunks: BundleChunk[];
  duplicatedModules: string[];
  unusedExports: string[];
  recommendations: string[];
  loadingWaterfall: { chunk: string; startTime: number; endTime: number }[];
}

class BundleAnalyzer {
  private chunks: Map<string, BundleChunk> = new Map();
  private loadingWaterfall: { chunk: string; startTime: number; endTime: number }[] = [];
  private moduleRegistry: Map<string, string[]> = new Map(); // module -> chunks that use it

  /**
   * Track chunk loading
   */
  trackChunkLoad(chunkName: string, size: number, loadTime: number, isLazy: boolean = false): void {
    const startTime = performance.now() - loadTime;
    const endTime = performance.now();

    this.chunks.set(chunkName, {
      name: chunkName,
      size,
      loadTime,
      dependencies: [],
      isLazy,
      cacheHit: false
    });

    this.loadingWaterfall.push({
      chunk: chunkName,
      startTime,
      endTime
    });
  }

  /**
   * Track module usage across chunks
   */
  trackModuleUsage(moduleName: string, chunkName: string): void {
    if (!this.moduleRegistry.has(moduleName)) {
      this.moduleRegistry.set(moduleName, []);
    }
    
    const chunks = this.moduleRegistry.get(moduleName)!;
    if (!chunks.includes(chunkName)) {
      chunks.push(chunkName);
    }
  }

  /**
   * Analyze bundle and generate report
   */
  generateReport(): BundleReport {
    const chunks = Array.from(this.chunks.values());
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    
    // Find duplicated modules (used in multiple chunks)
    const duplicatedModules = Array.from(this.moduleRegistry.entries())
      .filter(([, chunks]) => chunks.length > 1)
      .map(([module]) => module);

    // Generate recommendations
    const recommendations = this.generateRecommendations(chunks, duplicatedModules);

    return {
      totalSize,
      chunks,
      duplicatedModules,
      unusedExports: [], // Would need static analysis to determine
      recommendations,
      loadingWaterfall: [...this.loadingWaterfall]
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(chunks: BundleChunk[], duplicatedModules: string[]): string[] {
    const recommendations: string[] = [];

    // Large chunk recommendations
    const largeChunks = chunks.filter(chunk => chunk.size > 500 * 1024); // 500KB
    if (largeChunks.length > 0) {
      recommendations.push(
        `Consider splitting large chunks: ${largeChunks.map(c => c.name).join(', ')}`
      );
    }

    // Duplication recommendations
    if (duplicatedModules.length > 0) {
      recommendations.push(
        `Extract common modules to shared chunks: ${duplicatedModules.slice(0, 5).join(', ')}${
          duplicatedModules.length > 5 ? ` and ${duplicatedModules.length - 5} more` : ''
        }`
      );
    }

    // Lazy loading recommendations
    const eagerChunks = chunks.filter(chunk => !chunk.isLazy && chunk.size > 100 * 1024);
    if (eagerChunks.length > 0) {
      recommendations.push(
        `Consider lazy loading: ${eagerChunks.map(c => c.name).join(', ')}`
      );
    }

    // Loading performance recommendations
    const slowChunks = chunks.filter(chunk => chunk.loadTime > 1000);
    if (slowChunks.length > 0) {
      recommendations.push(
        `Optimize slow-loading chunks: ${slowChunks.map(c => c.name).join(', ')}`
      );
    }

    return recommendations;
  }

  /**
   * Get chunk loading timeline
   */
  getLoadingTimeline(): { chunk: string; startTime: number; duration: number }[] {
    return this.loadingWaterfall.map(item => ({
      chunk: item.chunk,
      startTime: item.startTime,
      duration: item.endTime - item.startTime
    }));
  }

  /**
   * Get size breakdown by category
   */
  getSizeBreakdown(): {
    vendor: number;
    application: number;
    lazy: number;
    total: number;
  } {
    const chunks = Array.from(this.chunks.values());
    
    const vendor = chunks
      .filter(chunk => chunk.name.includes('vendor') || chunk.name.includes('node_modules'))
      .reduce((sum, chunk) => sum + chunk.size, 0);
    
    const lazy = chunks
      .filter(chunk => chunk.isLazy)
      .reduce((sum, chunk) => sum + chunk.size, 0);
    
    const total = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    const application = total - vendor;

    return { vendor, application, lazy, total };
  }

  /**
   * Clear analysis data
   */
  clear(): void {
    this.chunks.clear();
    this.loadingWaterfall = [];
    this.moduleRegistry.clear();
  }
}

// Global bundle analyzer instance
export const bundleAnalyzer = new BundleAnalyzer();

// Hook into module loading to track chunks
if (typeof window !== 'undefined') {
  // Track resource loading
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'resource') {
        const resourceEntry = entry as PerformanceResourceTiming;
        
        if (resourceEntry.name.includes('.js') && !resourceEntry.name.includes('hot-update')) {
          const chunkName = extractChunkName(resourceEntry.name);
          const size = resourceEntry.transferSize || 0;
          const loadTime = resourceEntry.responseEnd - resourceEntry.requestStart;
          const isLazy = resourceEntry.name.includes('lazy') || resourceEntry.name.includes('chunk');
          
          bundleAnalyzer.trackChunkLoad(chunkName, size, loadTime, isLazy);
        }
      }
    }
  });

  try {
    observer.observe({ entryTypes: ['resource'] });
  } catch (error) {
    console.warn('Could not observe resource loading:', error);
  }
}

function extractChunkName(url: string): string {
  const parts = url.split('/');
  const filename = parts[parts.length - 1];
  return filename.split('?')[0].replace(/\.[a-f0-9]+\./, '.'); // Remove hash
}

// Utility functions for bundle optimization
export function preloadCriticalChunks(chunkNames: string[]): Promise<void[]> {
  const promises = chunkNames.map(chunkName => {
    return new Promise<void>((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = chunkName;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to preload ${chunkName}`));
      document.head.appendChild(link);
    });
  });

  return Promise.all(promises);
}

export function prefetchLazyChunks(chunkNames: string[]): void {
  chunkNames.forEach(chunkName => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = chunkName;
    document.head.appendChild(link);
  });
}

// React hook for bundle analysis
export function useBundleAnalyzer() {
  const getReport = () => bundleAnalyzer.generateReport();
  const getTimeline = () => bundleAnalyzer.getLoadingTimeline();
  const getSizeBreakdown = () => bundleAnalyzer.getSizeBreakdown();

  return { getReport, getTimeline, getSizeBreakdown };
}