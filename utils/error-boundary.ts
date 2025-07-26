/**
 * Enhanced error boundary utilities with better error categorization
 */

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  STORAGE = 'storage',
  RENDERING = 'rendering',
  API = 'api',
  UNKNOWN = 'unknown'
}

export interface ErrorInfo {
  message: string;
  stack?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context?: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

export class ErrorReporter {
  private static errors: ErrorInfo[] = [];
  private static readonly MAX_ERRORS = 100;

  /**
   * Report an error with context
   */
  static reportError(
    error: Error,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: Record<string, any>
  ): void {
    const errorInfo: ErrorInfo = {
      message: error.message,
      stack: error.stack,
      category,
      severity,
      context,
      timestamp: new Date(),
      sessionId: this.getSessionId(),
    };

    this.errors.push(errorInfo);

    // Keep only recent errors
    if (this.errors.length > this.MAX_ERRORS) {
      this.errors.shift();
    }

    // Log based on severity
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        console.error('CRITICAL ERROR:', errorInfo);
        break;
      case ErrorSeverity.HIGH:
        console.error('HIGH SEVERITY ERROR:', errorInfo);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('MEDIUM SEVERITY ERROR:', errorInfo);
        break;
      case ErrorSeverity.LOW:
        console.log('LOW SEVERITY ERROR:', errorInfo);
        break;
    }

    // In production, you might want to send to an error tracking service
    if (process.env.NODE_ENV === 'production' && severity === ErrorSeverity.CRITICAL) {
      this.sendToErrorService(errorInfo);
    }
  }

  /**
   * Get error statistics
   */
  static getErrorStats(): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recentErrors: ErrorInfo[];
  } {
    const errorsByCategory = {} as Record<ErrorCategory, number>;
    const errorsBySeverity = {} as Record<ErrorSeverity, number>;

    // Initialize counters
    Object.values(ErrorCategory).forEach(category => {
      errorsByCategory[category] = 0;
    });
    Object.values(ErrorSeverity).forEach(severity => {
      errorsBySeverity[severity] = 0;
    });

    // Count errors
    this.errors.forEach(error => {
      errorsByCategory[error.category]++;
      errorsBySeverity[error.severity]++;
    });

    return {
      totalErrors: this.errors.length,
      errorsByCategory,
      errorsBySeverity,
      recentErrors: this.errors.slice(-10), // Last 10 errors
    };
  }

  private static getSessionId(): string {
    // Simple session ID generation
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private static sendToErrorService(errorInfo: ErrorInfo): void {
    // Placeholder for error service integration
    // In a real app, you'd send to Sentry, LogRocket, etc.
    console.log('Would send to error service:', errorInfo);
  }
}

/**
 * React Error Boundary Hook
 */
export function useErrorHandler() {
  return (
    error: Error,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: Record<string, any>
  ) => {
    ErrorReporter.reportError(error, category, severity, context);
  };
}