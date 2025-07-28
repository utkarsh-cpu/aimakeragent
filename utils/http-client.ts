/**
 * HTTP Client utilities for API requests with retry logic and error handling
 */

export interface HttpClientConfig {
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retryAttempts?: number;
  signal?: AbortSignal;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: Response,
    public data?: any
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class HttpClient {
  private config: HttpClientConfig;

  constructor(config: HttpClientConfig = {}) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      headers: {
        'Content-Type': 'application/json'
      },
      ...config
    };
  }

  /**
   * Make an HTTP request with retry logic
   */
  async request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    const fullUrl = this.config.baseUrl ? `${this.config.baseUrl}${url}` : url;
    const retryAttempts = options.retryAttempts ?? this.config.retryAttempts ?? 3;

    let lastError: Error;

    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        return await this.makeRequest<T>(fullUrl, options);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (error instanceof HttpError) {
          if (error.status === 401 || error.status === 403 || error.status === 404) {
            throw error;
          }
        }

        // Don't retry if this is the last attempt
        if (attempt === retryAttempts) {
          throw error;
        }

        // Wait before retrying with exponential backoff
        const delay = (this.config.retryDelay ?? 1000) * Math.pow(2, attempt);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Make a single HTTP request
   */
  private async makeRequest<T>(url: string, options: RequestOptions): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? this.config.timeout);

    // Combine signals if one is provided
    let signal = controller.signal;
    if (options.signal) {
      signal = this.combineSignals([controller.signal, options.signal]);
    }

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          ...this.config.headers,
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          // Response might not be JSON
        }

        throw new HttpError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          response,
          errorData
        );
      }

      // Handle different response types
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      } else if (contentType?.includes('text/')) {
        return await response.text() as unknown as T;
      } else {
        return response as unknown as T;
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        throw new Error('Request timeout');
      }

      throw error;
    }
  }

  /**
   * GET request
   */
  async get<T = any>(url: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = any>(url: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  /**
   * PUT request
   */
  async put<T = any>(url: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'PUT', body });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(url: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'PATCH', body });
  }

  /**
   * Update client configuration
   */
  updateConfig(config: Partial<HttpClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Combine multiple AbortSignals
   */
  private combineSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }

      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    return controller.signal;
  }
}

/**
 * Default HTTP client instance
 */
export const httpClient = new HttpClient();

/**
 * Create a specialized HTTP client for OpenRouter API
 */
export function createOpenRouterClient(apiKey: string, baseUrl: string = 'https://openrouter.ai/api/v1'): HttpClient {
  return new HttpClient({
    baseUrl,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Enhanced Chat App'
    },
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  });
}

/**
 * Network status utilities
 */
export class NetworkStatus {
  private static listeners: Set<(isOnline: boolean) => void> = new Set();
  private static isOnline = navigator.onLine;

  static {
    // Initialize network status listeners
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners();
    });
  }

  /**
   * Check if the browser is online
   */
  static getStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Subscribe to network status changes
   */
  static subscribe(listener: (isOnline: boolean) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Test network connectivity by making a request
   */
  static async testConnectivity(url: string = 'https://httpbin.org/get'): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Notify all listeners of status changes
   */
  private static notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.isOnline);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    });
  }
}