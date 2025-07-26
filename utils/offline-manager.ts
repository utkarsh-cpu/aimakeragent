/**
 * Offline support and request queuing system
 * Handles network status detection, request queuing, and automatic retry
 */

import { ErrorHandler, ErrorType, ErrorSeverity } from './error-handler';

export interface QueuedRequest {
  id: string;
  url: string;
  options: RequestInit;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  priority: 'low' | 'medium' | 'high';
  context?: {
    conversationId?: string;
    messageId?: string;
    operation?: string;
  };
}

export interface OfflineStatus {
  isOnline: boolean;
  lastOnline: Date | null;
  lastOffline: Date | null;
  connectionType?: string;
  effectiveType?: string;
}

export interface RetryConfig {
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

export class OfflineManager {
  private static instance: OfflineManager | null = null;
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private statusListeners: Set<(status: OfflineStatus) => void> = new Set();
  private status: OfflineStatus;
  private retryConfig: RetryConfig;
  private queueProcessingInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.status = {
      isOnline: navigator.onLine,
      lastOnline: navigator.onLine ? new Date() : null,
      lastOffline: navigator.onLine ? null : new Date()
    };

    this.retryConfig = {
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      jitter: true
    };

    this.initializeNetworkListeners();
    this.startQueueProcessing();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OfflineManager {
    if (!this.instance) {
      this.instance = new OfflineManager();
    }
    return this.instance;
  }

  /**
   * Initialize network event listeners
   */
  private initializeNetworkListeners(): void {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Enhanced connection detection if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', this.handleConnectionChange.bind(this));
        this.updateConnectionInfo();
      }
    }
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    this.status = {
      ...this.status,
      isOnline: true,
      lastOnline: new Date()
    };
    
    this.notifyStatusListeners();
    this.processQueue();
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.status = {
      ...this.status,
      isOnline: false,
      lastOffline: new Date()
    };
    
    this.notifyStatusListeners();
  }

  /**
   * Manually trigger status change (for testing)
   */
  triggerStatusChange(isOnline: boolean): void {
    if (isOnline) {
      this.handleOnline();
    } else {
      this.handleOffline();
    }
  }

  /**
   * Handle connection change (for enhanced detection)
   */
  private handleConnectionChange(): void {
    this.updateConnectionInfo();
    this.notifyStatusListeners();
  }

  /**
   * Update connection information
   */
  private updateConnectionInfo(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        this.status = {
          ...this.status,
          connectionType: connection.type,
          effectiveType: connection.effectiveType
        };
      }
    }
  }

  /**
   * Get current offline status
   */
  getStatus(): OfflineStatus {
    return { ...this.status };
  }

  /**
   * Subscribe to status changes
   */
  subscribe(listener: (status: OfflineStatus) => void): () => void {
    this.statusListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Test network connectivity
   */
  async testConnectivity(timeout: number = 5000): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      // Fallback test with a reliable external service
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        await fetch('https://httpbin.org/get', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache',
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Queue a request for later execution
   */
  queueRequest(
    url: string, 
    options: RequestInit, 
    priority: 'low' | 'medium' | 'high' = 'medium',
    context?: QueuedRequest['context']
  ): string {
    const request: QueuedRequest = {
      id: this.generateRequestId(),
      url,
      options: { ...options },
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3,
      priority,
      context
    };

    // Insert request based on priority
    this.insertRequestByPriority(request);
    
    // Try to process immediately if online (but don't await it)
    if (this.status.isOnline) {
      setTimeout(() => this.processQueue(), 0);
    }

    return request.id;
  }

  /**
   * Remove a request from the queue
   */
  removeRequest(requestId: string): boolean {
    const index = this.requestQueue.findIndex(req => req.id === requestId);
    if (index !== -1) {
      this.requestQueue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get queued requests
   */
  getQueuedRequests(): QueuedRequest[] {
    return [...this.requestQueue];
  }

  /**
   * Clear all queued requests
   */
  clearQueue(): void {
    this.requestQueue = [];
  }

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || !this.status.isOnline || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.requestQueue.length > 0 && this.status.isOnline) {
        const request = this.requestQueue.shift()!;
        
        try {
          await this.executeRequest(request);
        } catch (error) {
          await this.handleRequestError(request, error);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Execute a queued request
   */
  private async executeRequest(request: QueuedRequest): Promise<Response> {
    const response = await fetch(request.url, request.options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  }

  /**
   * Handle request execution error
   */
  private async handleRequestError(request: QueuedRequest, error: unknown): Promise<void> {
    const chatError = ErrorHandler.categorizeError(error, request.context);
    
    // Check if we should retry
    if (ErrorHandler.shouldRetry(chatError, request.retryCount) && request.retryCount < request.maxRetries) {
      request.retryCount++;
      
      // Calculate retry delay
      const delay = this.calculateRetryDelay(request.retryCount);
      
      // Re-queue the request with delay
      setTimeout(() => {
        this.insertRequestByPriority(request);
        this.processQueue();
      }, delay);
    } else {
      // Max retries reached or non-retryable error
      console.error('Request failed permanently:', {
        requestId: request.id,
        error: chatError,
        retryCount: request.retryCount
      });
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    let delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, retryCount - 1),
      this.retryConfig.maxDelay
    );

    // Add jitter to prevent thundering herd
    if (this.retryConfig.jitter) {
      delay += Math.random() * 1000;
    }

    return delay;
  }

  /**
   * Insert request into queue based on priority
   */
  private insertRequestByPriority(request: QueuedRequest): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const requestPriority = priorityOrder[request.priority];

    let insertIndex = this.requestQueue.length;
    
    for (let i = 0; i < this.requestQueue.length; i++) {
      const queuedPriority = priorityOrder[this.requestQueue[i].priority];
      if (requestPriority < queuedPriority) {
        insertIndex = i;
        break;
      }
    }

    this.requestQueue.splice(insertIndex, 0, request);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Notify all status listeners
   */
  private notifyStatusListeners(): void {
    this.statusListeners.forEach(listener => {
      try {
        listener(this.getStatus());
      } catch (error) {
        console.error('Error in offline status listener:', error);
      }
    });
  }

  /**
   * Start periodic queue processing
   */
  private startQueueProcessing(): void {
    // Process queue every 30 seconds
    this.queueProcessingInterval = setInterval(() => {
      if (this.status.isOnline && this.requestQueue.length > 0) {
        this.processQueue();
      }
    }, 30000);
  }

  /**
   * Stop queue processing
   */
  private stopQueueProcessing(): void {
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
      this.queueProcessingInterval = null;
    }
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    totalRequests: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
    oldestRequest: Date | null;
    averageRetryCount: number;
  } {
    const stats = {
      totalRequests: this.requestQueue.length,
      highPriority: 0,
      mediumPriority: 0,
      lowPriority: 0,
      oldestRequest: null as Date | null,
      averageRetryCount: 0
    };

    if (this.requestQueue.length === 0) {
      return stats;
    }

    let totalRetries = 0;
    let oldestTimestamp = Date.now();

    for (const request of this.requestQueue) {
      // Count by priority
      switch (request.priority) {
        case 'high':
          stats.highPriority++;
          break;
        case 'medium':
          stats.mediumPriority++;
          break;
        case 'low':
          stats.lowPriority++;
          break;
      }

      // Track retries
      totalRetries += request.retryCount;

      // Find oldest request
      if (request.timestamp.getTime() < oldestTimestamp) {
        oldestTimestamp = request.timestamp.getTime();
        stats.oldestRequest = request.timestamp;
      }
    }

    stats.averageRetryCount = totalRetries / this.requestQueue.length;

    return stats;
  }

  /**
   * Cleanup and destroy the manager
   */
  destroy(): void {
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.removeEventListener('change', this.handleConnectionChange.bind(this));
      }
    }

    this.stopQueueProcessing();
    this.statusListeners.clear();
    this.requestQueue = [];
    OfflineManager.instance = null;
  }
}

/**
 * Enhanced fetch function with offline support
 */
export async function fetchWithOfflineSupport(
  url: string,
  options: RequestInit = {},
  priority: 'low' | 'medium' | 'high' = 'medium',
  context?: QueuedRequest['context']
): Promise<Response> {
  const offlineManager = OfflineManager.getInstance();
  const status = offlineManager.getStatus();

  // If online, try direct fetch first
  if (status.isOnline) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      
      // If request failed but we're still "online", test connectivity
      const isActuallyOnline = await offlineManager.testConnectivity();
      if (!isActuallyOnline) {
        // Queue the request for later
        offlineManager.queueRequest(url, options, priority, context);
        throw new Error('Network unavailable - request queued for retry');
      }
      
      return response;
    } catch (error) {
      // Network error - queue for retry
      if (error instanceof TypeError && error.message.includes('fetch')) {
        offlineManager.queueRequest(url, options, priority, context);
        throw new Error('Network error - request queued for retry');
      }
      throw error;
    }
  } else {
    // Offline - queue the request
    offlineManager.queueRequest(url, options, priority, context);
    throw new Error('Offline - request queued for when connection is restored');
  }
}

/**
 * Hook for React components to use offline status
 */
export function useOfflineStatus() {
  const [status, setStatus] = useState<OfflineStatus>(() => 
    OfflineManager.getInstance().getStatus()
  );

  useEffect(() => {
    const offlineManager = OfflineManager.getInstance();
    const unsubscribe = offlineManager.subscribe(setStatus);
    
    return unsubscribe;
  }, []);

  return status;
}

// Import React hooks
import { useState, useEffect } from 'react';