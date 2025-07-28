/**
 * Analytics and monitoring utilities for the chat application
 */

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  timestamp: Date;
  context?: Record<string, any>;
}

export interface ErrorEvent {
  error: Error;
  context?: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface UsageMetrics {
  messagesPerSession: number;
  averageResponseTime: number;
  errorRate: number;
  activeUsers: number;
  conversationsCreated: number;
  featuresUsed: Record<string, number>;
}

class AnalyticsManager {
  private events: AnalyticsEvent[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private errorEvents: ErrorEvent[] = [];
  private sessionId: string;
  private userId?: string;
  private isEnabled: boolean = true;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializePerformanceObserver();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializePerformanceObserver(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            let value = 0;
            let unit: 'ms' | 'bytes' = 'ms';
            
            if (entry.duration) {
              value = entry.duration;
              unit = 'ms';
            } else if (entry.entryType === 'resource' && 'transferSize' in entry) {
              value = (entry as PerformanceResourceTiming).transferSize;
              unit = 'bytes';
            }
            
            this.recordPerformanceMetric({
              name: entry.name,
              value,
              unit,
              timestamp: new Date(entry.startTime),
              context: {
                entryType: entry.entryType,
                initiatorType: entry.entryType === 'resource' ? (entry as PerformanceResourceTiming).initiatorType : undefined
              }
            });
          }
        });

        observer.observe({ entryTypes: ['navigation', 'resource', 'measure'] });
      } catch (error) {
        console.warn('Performance observer not supported:', error);
      }
    }
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  trackEvent(name: string, properties?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const event: AnalyticsEvent = {
      name,
      properties,
      timestamp: new Date(),
      userId: this.userId,
      sessionId: this.sessionId
    };

    this.events.push(event);
    this.sendEventToEndpoint(event);
  }

  recordPerformanceMetric(metric: PerformanceMetric): void {
    if (!this.isEnabled) return;

    this.performanceMetrics.push(metric);
    
    // Send critical performance metrics immediately
    if (metric.value > 5000 && metric.unit === 'ms') {
      this.sendPerformanceAlert(metric);
    }
  }

  recordError(error: Error, context?: Record<string, any>, severity: ErrorEvent['severity'] = 'medium'): void {
    if (!this.isEnabled) return;

    const errorEvent: ErrorEvent = {
      error,
      context,
      timestamp: new Date(),
      userId: this.userId,
      sessionId: this.sessionId,
      severity
    };

    this.errorEvents.push(errorEvent);
    this.sendErrorToEndpoint(errorEvent);
  }

  getUsageMetrics(): UsageMetrics {
    const now = Date.now();
    const sessionStart = now - (24 * 60 * 60 * 1000); // Last 24 hours

    const recentEvents = this.events.filter(e => e.timestamp.getTime() > sessionStart);
    const messageEvents = recentEvents.filter(e => e.name === 'message_sent');
    const responseTimeMetrics = this.performanceMetrics.filter(m => 
      m.name === 'api_response_time' && m.timestamp.getTime() > sessionStart
    );

    return {
      messagesPerSession: messageEvents.length,
      averageResponseTime: responseTimeMetrics.length > 0 
        ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length 
        : 0,
      errorRate: this.errorEvents.length / Math.max(recentEvents.length, 1),
      activeUsers: new Set(recentEvents.map(e => e.userId).filter(Boolean)).size,
      conversationsCreated: recentEvents.filter(e => e.name === 'conversation_created').length,
      featuresUsed: this.getFeatureUsageStats(recentEvents)
    };
  }

  private getFeatureUsageStats(events: AnalyticsEvent[]): Record<string, number> {
    const featureEvents = events.filter(e => e.name.startsWith('feature_'));
    const stats: Record<string, number> = {};

    featureEvents.forEach(event => {
      const feature = event.name.replace('feature_', '');
      stats[feature] = (stats[feature] || 0) + 1;
    });

    return stats;
  }

  private async sendEventToEndpoint(event: AnalyticsEvent): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics Event:', event);
      return;
    }

    try {
      // In production, send to analytics service
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
    } catch (error) {
      console.warn('Failed to send analytics event:', error);
    }
  }

  private async sendPerformanceAlert(metric: PerformanceMetric): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Performance Alert:', metric);
      return;
    }

    try {
      await fetch('/api/monitoring/performance-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric)
      });
    } catch (error) {
      console.warn('Failed to send performance alert:', error);
    }
  }

  private async sendErrorToEndpoint(errorEvent: ErrorEvent): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Event:', errorEvent);
      return;
    }

    try {
      await fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...errorEvent,
          error: {
            message: errorEvent.error.message,
            stack: errorEvent.error.stack,
            name: errorEvent.error.name
          }
        })
      });
    } catch (error) {
      console.warn('Failed to send error event:', error);
    }
  }

  exportData(): { events: AnalyticsEvent[]; metrics: PerformanceMetric[]; errors: ErrorEvent[] } {
    return {
      events: [...this.events],
      metrics: [...this.performanceMetrics],
      errors: [...this.errorEvents]
    };
  }

  clearData(): void {
    this.events = [];
    this.performanceMetrics = [];
    this.errorEvents = [];
  }
}

// Chat-specific analytics helpers
export class ChatAnalytics {
  private analytics: AnalyticsManager;

  constructor(analytics: AnalyticsManager) {
    this.analytics = analytics;
  }

  trackMessageSent(messageLength: number, model: string, responseTime?: number): void {
    this.analytics.trackEvent('message_sent', {
      messageLength,
      model,
      responseTime
    });

    if (responseTime) {
      this.analytics.recordPerformanceMetric({
        name: 'api_response_time',
        value: responseTime,
        unit: 'ms',
        timestamp: new Date(),
        context: { model }
      });
    }
  }

  trackConversationCreated(): void {
    this.analytics.trackEvent('conversation_created');
  }

  trackFeatureUsed(feature: string, context?: Record<string, any>): void {
    this.analytics.trackEvent(`feature_${feature}`, context);
  }

  trackSettingsChanged(setting: string, oldValue: any, newValue: any): void {
    this.analytics.trackEvent('settings_changed', {
      setting,
      oldValue,
      newValue
    });
  }

  trackError(error: Error, context?: Record<string, any>): void {
    this.analytics.recordError(error, context);
  }

  trackStreamingPerformance(tokensPerSecond: number, totalTokens: number): void {
    this.analytics.recordPerformanceMetric({
      name: 'streaming_tokens_per_second',
      value: tokensPerSecond,
      unit: 'count',
      timestamp: new Date(),
      context: { totalTokens }
    });
  }

  trackMemoryUsage(): void {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
      const memory = (performance as any).memory;
      this.analytics.recordPerformanceMetric({
        name: 'memory_usage',
        value: memory.usedJSHeapSize,
        unit: 'bytes',
        timestamp: new Date(),
        context: {
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        }
      });
    }
  }
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private analytics: AnalyticsManager;
  private observers: Map<string, PerformanceObserver> = new Map();

  constructor(analytics: AnalyticsManager) {
    this.analytics = analytics;
  }

  static getInstance(analytics: AnalyticsManager): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor(analytics);
    }
    return PerformanceMonitor.instance;
  }

  startMeasure(name: string): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      performance.mark(`${name}_start`);
    }
  }

  endMeasure(name: string): number {
    if (typeof window !== 'undefined' && 'performance' in window) {
      performance.mark(`${name}_end`);
      performance.measure(name, `${name}_start`, `${name}_end`);
      
      const measure = performance.getEntriesByName(name, 'measure')[0];
      if (measure) {
        this.analytics.recordPerformanceMetric({
          name,
          value: measure.duration,
          unit: 'ms',
          timestamp: new Date()
        });
        return measure.duration;
      }
    }
    return 0;
  }

  measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.startMeasure(name);
    return fn().finally(() => {
      this.endMeasure(name);
    });
  }

  measureSync<T>(name: string, fn: () => T): T {
    this.startMeasure(name);
    try {
      return fn();
    } finally {
      this.endMeasure(name);
    }
  }

  observeLongTasks(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.analytics.recordPerformanceMetric({
              name: 'long_task',
              value: entry.duration,
              unit: 'ms',
              timestamp: new Date(),
              context: {
                startTime: entry.startTime,
                name: entry.name
              }
            });
          }
        });

        observer.observe({ entryTypes: ['longtask'] });
        this.observers.set('longtask', observer);
      } catch (error) {
        console.warn('Long task observer not supported:', error);
      }
    }
  }

  observeLayoutShifts(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.analytics.recordPerformanceMetric({
              name: 'cumulative_layout_shift',
              value: (entry as any).value,
              unit: 'count',
              timestamp: new Date(),
              context: {
                hadRecentInput: (entry as any).hadRecentInput
              }
            });
          }
        });

        observer.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('layout-shift', observer);
      } catch (error) {
        console.warn('Layout shift observer not supported:', error);
      }
    }
  }

  disconnect(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}

// Global analytics instance
export const analytics = new AnalyticsManager();
export const chatAnalytics = new ChatAnalytics(analytics);
export const performanceMonitor = PerformanceMonitor.getInstance(analytics);

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  performanceMonitor.observeLongTasks();
  performanceMonitor.observeLayoutShifts();
  
  // Track memory usage periodically
  setInterval(() => {
    chatAnalytics.trackMemoryUsage();
  }, 30000); // Every 30 seconds
}