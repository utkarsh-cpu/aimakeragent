/**
 * Comprehensive error handling system for the chat application
 * Provides error categorization, recovery mechanisms, and user-friendly messages
 */

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_KEY_INVALID = 'API_KEY_INVALID',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  STREAMING_ERROR = 'STREAMING_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ChatError {
  type: ErrorType;
  message: string;
  details?: any;
  timestamp: Date;
  recoverable: boolean;
  retryAfter?: number;
  severity: ErrorSeverity;
  context?: {
    conversationId?: string;
    messageId?: string;
    model?: string;
    operation?: string;
  };
}

export interface ErrorAction {
  type: 'retry' | 'configure' | 'wait' | 'report' | 'fallback' | 'ignore';
  label: string;
  description?: string;
  retryDelay?: number;
  maxRetries?: number;
}

export interface ErrorHandlingResult {
  userMessage: string;
  actions: ErrorAction[];
  shouldLog: boolean;
  shouldReport: boolean;
  fallbackAction?: () => void;
}

export class ErrorHandler {
  private static errorCounts = new Map<string, number>();
  private static lastErrorTime = new Map<string, number>();
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly RETRY_BACKOFF_BASE = 1000; // 1 second
  private static readonly ERROR_REPORT_THRESHOLD = 5;

  /**
   * Main error handling method
   */
  static handle(error: unknown, context?: Partial<ChatError['context']>): ErrorHandlingResult {
    const chatError = this.categorizeError(error, context);
    return this.createHandlingResult(chatError);
  }

  /**
   * Categorize an error into a ChatError
   */
  static categorizeError(error: unknown, context?: Partial<ChatError['context']>): ChatError {
    const timestamp = new Date();
    
    // Handle known error types
    if (error instanceof Error) {
      // Network errors
      if (error.message.includes('fetch') || error.message.includes('network') || 
          error.message.includes('timeout') || error.name === 'AbortError') {
        return {
          type: ErrorType.NETWORK_ERROR,
          message: error.message,
          timestamp,
          recoverable: true,
          severity: ErrorSeverity.MEDIUM,
          context
        };
      }

      // API key errors
      if (error.message.includes('API key') || error.message.includes('401') || 
          error.message.includes('Unauthorized')) {
        return {
          type: ErrorType.API_KEY_INVALID,
          message: error.message,
          timestamp,
          recoverable: true,
          severity: ErrorSeverity.HIGH,
          context
        };
      }

      // Rate limit errors
      if (error.message.toLowerCase().includes('rate limit') || error.message.includes('429') ||
          error.message.toLowerCase().includes('too many requests')) {
        const retryAfter = this.extractRetryAfter(error.message);
        return {
          type: ErrorType.RATE_LIMIT_EXCEEDED,
          message: error.message,
          timestamp,
          recoverable: true,
          retryAfter,
          severity: ErrorSeverity.MEDIUM,
          context
        };
      }

      // Model unavailable errors
      if (error.message.includes('model') && (error.message.includes('unavailable') || 
          error.message.includes('not found') || error.message.includes('404'))) {
        return {
          type: ErrorType.MODEL_UNAVAILABLE,
          message: error.message,
          timestamp,
          recoverable: true,
          severity: ErrorSeverity.MEDIUM,
          context
        };
      }

      // Streaming errors
      if (error.message.includes('stream') || error.message.includes('SSE') ||
          error.message.includes('EventSource')) {
        return {
          type: ErrorType.STREAMING_ERROR,
          message: error.message,
          timestamp,
          recoverable: true,
          severity: ErrorSeverity.LOW,
          context
        };
      }

      // Validation errors
      if (error.message.includes('validation') || error.message.includes('invalid') ||
          error.message.includes('required')) {
        return {
          type: ErrorType.VALIDATION_ERROR,
          message: error.message,
          timestamp,
          recoverable: true,
          severity: ErrorSeverity.LOW,
          context
        };
      }

      // Storage errors
      if (error.message.includes('storage') || error.message.includes('localStorage') ||
          error.message.includes('quota')) {
        return {
          type: ErrorType.STORAGE_ERROR,
          message: error.message,
          timestamp,
          recoverable: true,
          severity: ErrorSeverity.HIGH,
          context
        };
      }

      // Server errors
      if (error.message.includes('500') || error.message.includes('502') ||
          error.message.includes('503') || error.message.includes('504')) {
        return {
          type: ErrorType.SERVER_ERROR,
          message: error.message,
          timestamp,
          recoverable: true,
          severity: ErrorSeverity.HIGH,
          context
        };
      }

      // Timeout errors
      if (error.message.includes('timeout') || error.name === 'TimeoutError') {
        return {
          type: ErrorType.TIMEOUT_ERROR,
          message: error.message,
          timestamp,
          recoverable: true,
          severity: ErrorSeverity.MEDIUM,
          context
        };
      }
    }

    // Handle HTTP errors with status codes
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const httpError = error as { status: number; message?: string };
      
      switch (httpError.status) {
        case 401:
          return {
            type: ErrorType.API_KEY_INVALID,
            message: 'Invalid API key or authentication failed',
            timestamp,
            recoverable: true,
            severity: ErrorSeverity.HIGH,
            context
          };
        case 429:
          return {
            type: ErrorType.RATE_LIMIT_EXCEEDED,
            message: 'Rate limit exceeded. Please wait before making another request.',
            timestamp,
            recoverable: true,
            retryAfter: 60000, // 1 minute default
            severity: ErrorSeverity.MEDIUM,
            context
          };
        case 402:
          return {
            type: ErrorType.QUOTA_EXCEEDED,
            message: 'API quota exceeded. Please check your billing.',
            timestamp,
            recoverable: false,
            severity: ErrorSeverity.CRITICAL,
            context
          };
        case 404:
          return {
            type: ErrorType.MODEL_UNAVAILABLE,
            message: 'The requested model is not available',
            timestamp,
            recoverable: true,
            severity: ErrorSeverity.MEDIUM,
            context
          };
        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: ErrorType.SERVER_ERROR,
            message: 'Server error occurred. Please try again later.',
            timestamp,
            recoverable: true,
            severity: ErrorSeverity.HIGH,
            context
          };
      }
    }

    // Default unknown error
    return {
      type: ErrorType.UNKNOWN_ERROR,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      details: error,
      timestamp,
      recoverable: false,
      severity: ErrorSeverity.MEDIUM,
      context
    };
  }

  /**
   * Create error handling result with actions
   */
  private static createHandlingResult(error: ChatError): ErrorHandlingResult {
    const errorKey = `${error.type}_${error.context?.operation || 'unknown'}`;
    const errorCount = this.getErrorCount(errorKey);
    
    const result: ErrorHandlingResult = {
      userMessage: this.getUserFriendlyMessage(error),
      actions: this.getErrorActions(error, errorCount),
      shouldLog: error.severity !== ErrorSeverity.LOW,
      shouldReport: errorCount >= this.ERROR_REPORT_THRESHOLD || error.severity === ErrorSeverity.CRITICAL
    };

    // Increment error count
    this.incrementErrorCount(errorKey);

    return result;
  }

  /**
   * Get user-friendly error message
   */
  private static getUserFriendlyMessage(error: ChatError): string {
    switch (error.type) {
      case ErrorType.NETWORK_ERROR:
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      
      case ErrorType.API_KEY_INVALID:
        return 'Your API key is invalid or has expired. Please update your API key in settings.';
      
      case ErrorType.RATE_LIMIT_EXCEEDED:
        const waitTime = error.retryAfter ? Math.ceil(error.retryAfter / 1000) : 60;
        return `You've made too many requests. Please wait ${waitTime} seconds before trying again.`;
      
      case ErrorType.MODEL_UNAVAILABLE:
        return 'The selected AI model is currently unavailable. Try selecting a different model or try again later.';
      
      case ErrorType.STREAMING_ERROR:
        return 'There was an issue with the streaming response. The message will be completed without streaming.';
      
      case ErrorType.VALIDATION_ERROR:
        return 'Please check your input and try again. Some required information may be missing or invalid.';
      
      case ErrorType.STORAGE_ERROR:
        return 'Unable to save your data locally. Your browser storage may be full or disabled.';
      
      case ErrorType.TIMEOUT_ERROR:
        return 'The request took too long to complete. Please try again with a shorter message or different model.';
      
      case ErrorType.QUOTA_EXCEEDED:
        return 'Your API quota has been exceeded. Please check your billing or upgrade your plan.';
      
      case ErrorType.SERVER_ERROR:
        return 'The server is experiencing issues. Please try again in a few minutes.';
      
      default:
        return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
    }
  }

  /**
   * Get available actions for an error
   */
  private static getErrorActions(error: ChatError, errorCount: number): ErrorAction[] {
    const actions: ErrorAction[] = [];

    switch (error.type) {
      case ErrorType.NETWORK_ERROR:
        if (errorCount < this.MAX_RETRY_ATTEMPTS) {
          actions.push({
            type: 'retry',
            label: 'Retry',
            description: 'Try sending the message again',
            retryDelay: this.calculateRetryDelay(errorCount),
            maxRetries: this.MAX_RETRY_ATTEMPTS
          });
        }
        actions.push({
          type: 'fallback',
          label: 'Use Offline Mode',
          description: 'Continue working offline'
        });
        break;

      case ErrorType.API_KEY_INVALID:
        actions.push({
          type: 'configure',
          label: 'Update API Key',
          description: 'Open settings to update your API key'
        });
        break;

      case ErrorType.RATE_LIMIT_EXCEEDED:
        actions.push({
          type: 'wait',
          label: 'Wait and Retry',
          description: `Wait ${Math.ceil((error.retryAfter || 60000) / 1000)} seconds`,
          retryDelay: error.retryAfter || 60000
        });
        break;

      case ErrorType.MODEL_UNAVAILABLE:
        actions.push({
          type: 'configure',
          label: 'Select Different Model',
          description: 'Choose an available model from settings'
        });
        if (errorCount < this.MAX_RETRY_ATTEMPTS) {
          actions.push({
            type: 'retry',
            label: 'Try Again',
            description: 'The model might be available now',
            retryDelay: this.calculateRetryDelay(errorCount)
          });
        }
        break;

      case ErrorType.STREAMING_ERROR:
        actions.push({
          type: 'fallback',
          label: 'Continue Without Streaming',
          description: 'Get the complete response at once'
        });
        break;

      case ErrorType.VALIDATION_ERROR:
        actions.push({
          type: 'retry',
          label: 'Try Again',
          description: 'Check your input and retry'
        });
        break;

      case ErrorType.STORAGE_ERROR:
        actions.push({
          type: 'fallback',
          label: 'Continue Without Saving',
          description: 'Your conversation won\'t be saved'
        });
        break;

      case ErrorType.TIMEOUT_ERROR:
        if (errorCount < this.MAX_RETRY_ATTEMPTS) {
          actions.push({
            type: 'retry',
            label: 'Retry',
            description: 'Try with a shorter message',
            retryDelay: this.calculateRetryDelay(errorCount)
          });
        }
        break;

      case ErrorType.QUOTA_EXCEEDED:
        actions.push({
          type: 'configure',
          label: 'Check Billing',
          description: 'Review your API usage and billing'
        });
        break;

      case ErrorType.SERVER_ERROR:
        if (errorCount < this.MAX_RETRY_ATTEMPTS) {
          actions.push({
            type: 'retry',
            label: 'Try Again',
            description: 'The server might be working now',
            retryDelay: this.calculateRetryDelay(errorCount)
          });
        }
        break;

      default:
        if (error.recoverable && errorCount < this.MAX_RETRY_ATTEMPTS) {
          actions.push({
            type: 'retry',
            label: 'Try Again',
            retryDelay: this.calculateRetryDelay(errorCount)
          });
        }
        actions.push({
          type: 'report',
          label: 'Report Issue',
          description: 'Help us improve by reporting this error'
        });
        break;
    }

    return actions;
  }

  /**
   * Check if an error is recoverable
   */
  static isRecoverable(error: ChatError): boolean {
    return error.recoverable && error.type !== ErrorType.QUOTA_EXCEEDED;
  }

  /**
   * Check if we should retry an error
   */
  static shouldRetry(error: ChatError, attemptCount: number): boolean {
    if (!error.recoverable || attemptCount >= this.MAX_RETRY_ATTEMPTS) {
      return false;
    }

    // Don't retry certain error types
    const nonRetryableErrors = [
      ErrorType.API_KEY_INVALID,
      ErrorType.QUOTA_EXCEEDED,
      ErrorType.VALIDATION_ERROR
    ];

    return !nonRetryableErrors.includes(error.type);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  static calculateRetryDelay(attemptCount: number): number {
    return this.RETRY_BACKOFF_BASE * Math.pow(2, attemptCount);
  }

  /**
   * Get error count for a specific error key
   */
  private static getErrorCount(errorKey: string): number {
    return this.errorCounts.get(errorKey) || 0;
  }

  /**
   * Increment error count for a specific error key
   */
  private static incrementErrorCount(errorKey: string): void {
    const currentCount = this.getErrorCount(errorKey);
    this.errorCounts.set(errorKey, currentCount + 1);
    this.lastErrorTime.set(errorKey, Date.now());
  }

  /**
   * Reset error count for a specific error key
   */
  static resetErrorCount(errorKey: string): void {
    this.errorCounts.delete(errorKey);
    this.lastErrorTime.delete(errorKey);
  }

  /**
   * Clear old error counts (older than 1 hour)
   */
  static clearOldErrorCounts(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const [key, timestamp] of this.lastErrorTime.entries()) {
      if (timestamp < oneHourAgo) {
        this.errorCounts.delete(key);
        this.lastErrorTime.delete(key);
      }
    }
  }

  /**
   * Sanitize error for logging (remove sensitive information)
   */
  static sanitizeError(error: ChatError): ChatError {
    const sanitized = { ...error };
    
    if (sanitized.context) {
      const sanitizedContext = { ...sanitized.context };
      
      // Redact sensitive fields
      const sensitiveFields = ['apiKey', 'password', 'token', 'secret', 'key'];
      for (const field of sensitiveFields) {
        if (field in sanitizedContext) {
          (sanitizedContext as any)[field] = '[REDACTED]';
        }
      }
      
      sanitized.context = sanitizedContext;
    }
    
    return sanitized;
  }

  /**
   * Extract retry-after value from error message
   */
  private static extractRetryAfter(message: string): number | undefined {
    const match = message.match(/(?:retry.*?|after\s+)(\d+)/i);
    if (match) {
      return parseInt(match[1]) * 1000; // Convert to milliseconds
    }
    return undefined;
  }

  /**
   * Create a recovery function for specific error types
   */
  static createRecoveryFunction(error: ChatError, onRetry?: () => void, onFallback?: () => void): () => void {
    return () => {
      switch (error.type) {
        case ErrorType.STREAMING_ERROR:
          onFallback?.();
          break;
        case ErrorType.NETWORK_ERROR:
        case ErrorType.TIMEOUT_ERROR:
        case ErrorType.SERVER_ERROR:
          if (this.shouldRetry(error, this.getErrorCount(`${error.type}_${error.context?.operation || 'unknown'}`))) {
            setTimeout(() => onRetry?.(), this.calculateRetryDelay(this.getErrorCount(`${error.type}_${error.context?.operation || 'unknown'}`)));
          } else {
            onFallback?.();
          }
          break;
        default:
          onRetry?.();
          break;
      }
    };
  }
}

/**
 * Error logging utility
 */
export class ErrorLogger {
  private static logs: ChatError[] = [];
  private static readonly MAX_LOGS = 100;

  /**
   * Log an error
   */
  static log(error: ChatError): void {
    this.logs.unshift(error);
    
    // Keep only the most recent logs
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(0, this.MAX_LOGS);
    }

    // Console log for development
    if (process.env.NODE_ENV === 'development') {
      console.error('Chat Error:', error);
    }
  }

  /**
   * Get recent error logs
   */
  static getLogs(limit: number = 10): ChatError[] {
    return this.logs.slice(0, limit);
  }

  /**
   * Clear error logs
   */
  static clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export error logs for debugging
   */
  static exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}
/**
 
* Create a ChatError instance
 */
export function createChatError(
  type: ErrorType,
  message: string,
  originalError?: Error,
  retryAfter?: number,
  context?: Partial<ChatError['context']>
): ChatError {
  const error = {
    type,
    message,
    details: originalError,
    timestamp: new Date(),
    recoverable: isRecoverableError(type),
    retryAfter,
    severity: getErrorSeverity(type),
    context,
    originalError,
    stack: new Error().stack
  } as ChatError & { originalError?: Error; stack?: string };
  
  return error;
}

/**
 * Check if an error type is recoverable
 */
export function isRecoverableError(errorType: ErrorType): boolean {
  const recoverableTypes = [
    ErrorType.NETWORK_ERROR,
    ErrorType.TIMEOUT_ERROR,
    ErrorType.SERVER_ERROR,
    ErrorType.STREAMING_ERROR,
    ErrorType.RATE_LIMIT_EXCEEDED,
    ErrorType.MODEL_UNAVAILABLE,
    ErrorType.STORAGE_ERROR
  ];
  
  return recoverableTypes.includes(errorType);
}

/**
 * Get error severity for error type
 */
function getErrorSeverity(errorType: ErrorType): ErrorSeverity {
  switch (errorType) {
    case ErrorType.QUOTA_EXCEEDED:
      return ErrorSeverity.CRITICAL;
    case ErrorType.API_KEY_INVALID:
    case ErrorType.SERVER_ERROR:
    case ErrorType.STORAGE_ERROR:
      return ErrorSeverity.HIGH;
    case ErrorType.NETWORK_ERROR:
    case ErrorType.TIMEOUT_ERROR:
    case ErrorType.RATE_LIMIT_EXCEEDED:
    case ErrorType.MODEL_UNAVAILABLE:
      return ErrorSeverity.MEDIUM;
    case ErrorType.STREAMING_ERROR:
    case ErrorType.VALIDATION_ERROR:
      return ErrorSeverity.LOW;
    default:
      return ErrorSeverity.MEDIUM;
  }
}

/**
 * Get user-friendly error message for error type
 */
export function getErrorMessage(errorType: ErrorType): string {
  switch (errorType) {
    case ErrorType.NETWORK_ERROR:
      return 'Unable to connect to the server. Please check your network connection.';
    case ErrorType.API_KEY_INVALID:
      return 'Your API key is invalid or has expired. Please update your API key.';
    case ErrorType.RATE_LIMIT_EXCEEDED:
      return 'You have exceeded the rate limit. Please wait before making another request.';
    case ErrorType.MODEL_UNAVAILABLE:
      return 'The selected model is currently unavailable. Please try a different model.';
    case ErrorType.STREAMING_ERROR:
      return 'There was an issue with streaming. The response will be delivered normally.';
    case ErrorType.VALIDATION_ERROR:
      return 'Please check your input and try again.';
    case ErrorType.STORAGE_ERROR:
      return 'Unable to save data locally. Your browser storage may be full.';
    case ErrorType.TIMEOUT_ERROR:
      return 'The request timed out. Please try again.';
    case ErrorType.QUOTA_EXCEEDED:
      return 'Your API quota has been exceeded. Please check your billing.';
    case ErrorType.SERVER_ERROR:
      return 'The server is experiencing issues. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Handle API errors and convert to ChatError
 */
export function handleApiError(error: any): ChatError {
  if (error.status) {
    switch (error.status) {
      case 401:
        return createChatError(ErrorType.API_KEY_INVALID, 'Invalid API key', error);
      case 429:
        return createChatError(ErrorType.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', error, 60000);
      case 400:
        return createChatError(ErrorType.VALIDATION_ERROR, 'Invalid request', error);
      case 500:
      case 502:
      case 503:
      case 504:
        return createChatError(ErrorType.SERVER_ERROR, 'Server error', error);
      default:
        return createChatError(ErrorType.UNKNOWN_ERROR, error.message || 'Unknown error', error);
    }
  }

  if (error.name === 'AbortError' || error.message?.includes('aborted')) {
    return createChatError(ErrorType.NETWORK_ERROR, 'Request was aborted', error);
  }

  if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
    return createChatError(ErrorType.TIMEOUT_ERROR, 'Request timed out', error);
  }

  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return createChatError(ErrorType.NETWORK_ERROR, 'Network error', error);
  }

  return createChatError(ErrorType.UNKNOWN_ERROR, error.message || 'Unknown error', error);
}

/**
 * Error reporting utility
 */
export class ErrorReporter {
  private static errorStats = new Map<ErrorType, number>();

  /**
   * Report an error
   */
  static report(error: ChatError): void {
    // Update statistics
    const currentCount = this.errorStats.get(error.type) || 0;
    this.errorStats.set(error.type, currentCount + 1);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ChatError:', error);
    }

    // In production, this would send to error tracking service
    // For now, just store locally
    ErrorLogger.log(error);
  }

  /**
   * Get error statistics
   */
  static getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [type, count] of this.errorStats.entries()) {
      stats[type] = count;
    }
    return stats;
  }

  /**
   * Get error metrics
   */
  static getMetrics(): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    mostCommonError?: ErrorType;
  } {
    const errorsByType: Record<ErrorType, number> = Object.values(ErrorType).reduce((acc, type) => {
      acc[type] = 0;
      return acc;
    }, {} as Record<ErrorType, number>);
    let totalErrors = 0;
    let mostCommonError: ErrorType | undefined;
    let maxCount = 0;

    for (const [type, count] of this.errorStats.entries()) {
      errorsByType[type] = count;
      totalErrors += count;
      if (count > maxCount) {
        maxCount = count;
        mostCommonError = type;
      }
    }

    return {
      totalErrors,
      errorsByType,
      mostCommonError,
    };
  }

  /**
   * Clear error statistics
   */
  static clearStats(): void {
    this.errorStats.clear();
  }

  /**
   * Clear error metrics
   */
  static clearMetrics(): void {
    this.errorStats.clear();
  }
}

// Add missing methods to ErrorHandler class
declare module './error-handler' {
  namespace ErrorHandler {
    function getRetryDelay(error: ChatError, attemptCount: number): number;
  }
}

// Extend ErrorHandler with missing methods
Object.assign(ErrorHandler, {
  getRetryDelay(error: ChatError, attemptCount: number): number {
    if (error.retryAfter) {
      return error.retryAfter;
    }
    return ErrorHandler.calculateRetryDelay(attemptCount);
  }
});