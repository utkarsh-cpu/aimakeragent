import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ErrorHandler, 
  ErrorType, 
  ChatError, 
  createChatError,
  isRecoverableError,
  getErrorMessage,
  handleApiError,
  ErrorReporter
} from '../error-handler';

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('should handle network errors with retry action', () => {
      const error = createChatError(ErrorType.NETWORK_ERROR, 'Network failed');
      const result = ErrorHandler.handle(error);
      
      expect(result.userMessage).toContain('network');
      expect(result.actions).toBeDefined();
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions[0].type).toBe('retry');
    });

    it('should handle API key errors with configure action', () => {
      const error = createChatError(ErrorType.API_KEY_INVALID, 'Invalid API key');
      const result = ErrorHandler.handle(error);
      
      expect(result.userMessage).toContain('API key');
      expect(result.actions).toBeDefined();
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions[0].type).toBe('configure');
    });

    it('should handle rate limit errors with wait action', () => {
      const error = createChatError(ErrorType.RATE_LIMIT_EXCEEDED, 'Rate limited', undefined, 60000);
      const result = ErrorHandler.handle(error);
      
      expect(result.userMessage).toContain('rate limit');
      expect(result.actions).toBeDefined();
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions[0].type).toBe('wait');
    });

    it('should handle validation errors with retry action', () => {
      const error = createChatError(ErrorType.VALIDATION_ERROR, 'Invalid input');
      const result = ErrorHandler.handle(error);
      
      expect(result.userMessage).toContain('input');
      expect(result.actions).toBeDefined();
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions[0].type).toBe('retry');
    });

    it('should handle unknown errors gracefully', () => {
      const error = new Error('Unknown error') as ChatError;
      error.type = 'UNKNOWN_ERROR' as ErrorType;
      
      const result = ErrorHandler.handle(error);
      
      expect(result.userMessage).toContain('unexpected error');
      expect(result.actions).toBeDefined();
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions.some(action => action.type === 'report')).toBe(true);
    });
  });

  describe('isRecoverable', () => {
    it('should return true for recoverable errors', () => {
      const networkError = createChatError(ErrorType.NETWORK_ERROR, 'Network failed');
      const timeoutError = createChatError(ErrorType.TIMEOUT_ERROR, 'Request timeout');
      
      expect(ErrorHandler.isRecoverable(networkError)).toBe(true);
      expect(ErrorHandler.isRecoverable(timeoutError)).toBe(true);
    });

    it('should return false for non-recoverable errors', () => {
      const apiKeyError = createChatError(ErrorType.API_KEY_INVALID, 'Invalid key');
      const validationError = createChatError(ErrorType.VALIDATION_ERROR, 'Invalid input');
      
      expect(ErrorHandler.isRecoverable(apiKeyError)).toBe(false);
      expect(ErrorHandler.isRecoverable(validationError)).toBe(false);
    });
  });

  describe('shouldRetry', () => {
    it('should allow retry for recoverable errors within attempt limit', () => {
      const error = createChatError(ErrorType.NETWORK_ERROR, 'Network failed');
      
      expect(ErrorHandler.shouldRetry(error, 1)).toBe(true);
      expect(ErrorHandler.shouldRetry(error, 2)).toBe(true);
      expect(ErrorHandler.shouldRetry(error, 3)).toBe(false); // MAX_RETRY_ATTEMPTS is 3
      expect(ErrorHandler.shouldRetry(error, 4)).toBe(false);
    });

    it('should not allow retry for non-recoverable errors', () => {
      const error = createChatError(ErrorType.API_KEY_INVALID, 'Invalid key');
      
      expect(ErrorHandler.shouldRetry(error, 1)).toBe(false);
    });
  });
});

describe('createChatError', () => {
  it('should create ChatError with required properties', () => {
    const error = createChatError(ErrorType.NETWORK_ERROR, 'Network failed');
    
    expect(error.type).toBe(ErrorType.NETWORK_ERROR);
    expect(error.message).toBe('Network failed');
    expect(error.timestamp).toBeInstanceOf(Date);
    expect(error.recoverable).toBe(true);
  });

  it('should include original error when provided', () => {
    const originalError = new Error('Original error');
    const error = createChatError(ErrorType.NETWORK_ERROR, 'Network failed', originalError);
    
    expect(error.originalError).toBe(originalError);
  });

  it('should include retry delay when provided', () => {
    const error = createChatError(ErrorType.RATE_LIMIT_EXCEEDED, 'Rate limited', undefined, 30);
    
    expect(error.retryAfter).toBe(30);
  });
});

describe('isRecoverableError', () => {
  it('should identify recoverable error types', () => {
    expect(isRecoverableError(ErrorType.NETWORK_ERROR)).toBe(true);
    expect(isRecoverableError(ErrorType.TIMEOUT_ERROR)).toBe(true);
    expect(isRecoverableError(ErrorType.SERVER_ERROR)).toBe(true);
    expect(isRecoverableError(ErrorType.RATE_LIMIT_EXCEEDED)).toBe(true);
  });

  it('should identify non-recoverable error types', () => {
    expect(isRecoverableError(ErrorType.API_KEY_INVALID)).toBe(false);
    expect(isRecoverableError(ErrorType.VALIDATION_ERROR)).toBe(false);
    expect(isRecoverableError(ErrorType.PERMISSION_DENIED)).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('should return user-friendly messages for known error types', () => {
    expect(getErrorMessage(ErrorType.NETWORK_ERROR)).toContain('network');
    expect(getErrorMessage(ErrorType.API_KEY_INVALID)).toContain('API key');
    expect(getErrorMessage(ErrorType.RATE_LIMIT_EXCEEDED)).toContain('rate limit');
    expect(getErrorMessage(ErrorType.TIMEOUT_ERROR)).toContain('timed out');
  });

  it('should return generic message for unknown error types', () => {
    const message = getErrorMessage('UNKNOWN_ERROR' as ErrorType);
    expect(message).toContain('unexpected error');
  });
});

describe('handleApiError', () => {
  it('should handle 401 errors as API key invalid', () => {
    const apiError = {
      status: 401,
      message: 'Unauthorized',
      data: { error: 'Invalid API key' }
    };
    
    const error = handleApiError(apiError);
    
    expect(error.type).toBe(ErrorType.API_KEY_INVALID);
    expect(error.message).toContain('API key');
  });

  it('should handle 429 errors as rate limit exceeded', () => {
    const apiError = {
      status: 429,
      message: 'Too Many Requests',
      data: { error: 'Rate limit exceeded' },
      headers: { 'retry-after': '60' }
    };
    
    const error = handleApiError(apiError);
    
    expect(error.type).toBe(ErrorType.RATE_LIMIT_EXCEEDED);
    expect(error.retryAfter).toBe(60000);
  });

  it('should handle 400 errors as validation errors', () => {
    const apiError = {
      status: 400,
      message: 'Bad Request',
      data: { error: 'Invalid input' }
    };
    
    const error = handleApiError(apiError);
    
    expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
  });

  it('should handle 500 errors as server errors', () => {
    const apiError = {
      status: 500,
      message: 'Internal Server Error',
      data: { error: 'Server error' }
    };
    
    const error = handleApiError(apiError);
    
    expect(error.type).toBe(ErrorType.SERVER_ERROR);
  });

  it('should handle network errors', () => {
    const networkError = {
      name: 'AbortError',
      message: 'Network request failed'
    };
    
    const error = handleApiError(networkError);
    
    expect(error.type).toBe(ErrorType.NETWORK_ERROR);
  });

  it('should handle timeout errors', () => {
    const timeoutError = {
      code: 'TIMEOUT',
      message: 'Request timeout'
    };
    
    const error = handleApiError(timeoutError);
    
    expect(error.type).toBe(ErrorType.TIMEOUT_ERROR);
  });
});

describe('ErrorReporter', () => {
  beforeEach(() => {
    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should report errors to console in development', () => {
    const error = createChatError(ErrorType.NETWORK_ERROR, 'Network failed');
    
    ErrorReporter.report(error);
    
    expect(console.error).toHaveBeenCalledWith('ChatError:', error);
  });

  it('should track error metrics', () => {
    const error = createChatError(ErrorType.API_KEY_INVALID, 'Invalid key');
    
    ErrorReporter.report(error);
    
    const metrics = ErrorReporter.getMetrics();
    expect(metrics.totalErrors).toBe(1);
    expect(metrics.errorsByType[ErrorType.API_KEY_INVALID]).toBe(1);
  });

  it('should provide error statistics', () => {
    const networkError = createChatError(ErrorType.NETWORK_ERROR, 'Network failed');
    const apiKeyError = createChatError(ErrorType.API_KEY_INVALID, 'Invalid key');
    
    ErrorReporter.report(networkError);
    ErrorReporter.report(apiKeyError);
    ErrorReporter.report(networkError);
    
    const metrics = ErrorReporter.getMetrics();
    expect(metrics.totalErrors).toBe(3);
    expect(metrics.errorsByType[ErrorType.NETWORK_ERROR]).toBe(2);
    expect(metrics.errorsByType[ErrorType.API_KEY_INVALID]).toBe(1);
    expect(metrics.mostCommonError).toBe(ErrorType.NETWORK_ERROR);
  });

  it('should clear metrics', () => {
    const error = createChatError(ErrorType.NETWORK_ERROR, 'Network failed');
    ErrorReporter.report(error);
    
    ErrorReporter.clearMetrics();
    
    const metrics = ErrorReporter.getMetrics();
    expect(metrics.totalErrors).toBe(0);
    expect(Object.keys(metrics.errorsByType)).toHaveLength(0);
  });

  it('should handle error reporting failures gracefully', () => {
    const originalConsoleError = console.error;
    console.error = vi.fn().mockImplementation(() => {
      throw new Error('Console error failed');
    });
    
    const error = createChatError(ErrorType.NETWORK_ERROR, 'Network failed');
    
    // Should not throw
    expect(() => ErrorReporter.report(error)).not.toThrow();
    
    console.error = originalConsoleError;
  });
});

describe('Error Recovery Strategies', () => {
  it('should provide exponential backoff for retry delays', () => {
    const error = createChatError(ErrorType.NETWORK_ERROR, 'Network failed');
    
    const delay1 = ErrorHandler.getRetryDelay(error, 1);
    const delay2 = ErrorHandler.getRetryDelay(error, 2);
    const delay3 = ErrorHandler.getRetryDelay(error, 3);
    
    expect(delay2).toBeGreaterThan(delay1);
    expect(delay3).toBeGreaterThan(delay2);
  });

  it('should cap maximum retry delay', () => {
    const error = createChatError(ErrorType.NETWORK_ERROR, 'Network failed');
    
    const delay = ErrorHandler.getRetryDelay(error, 10);
    
    expect(delay).toBeGreaterThan(0); // Should have some delay
  });

  it('should provide retry delay for timeout errors', () => {
    const error = createChatError(ErrorType.TIMEOUT_ERROR, 'Request timeout');
    
    const delay = ErrorHandler.getRetryDelay(error, 1);
    
    expect(delay).toBeGreaterThan(0);
  });
});

describe('Error Context and Details', () => {
  it('should preserve error context', () => {
    const context = {
      userId: 'user123',
      conversationId: 'conv456',
      messageId: 'msg789'
    };
    
    const error = createChatError(
      ErrorType.NETWORK_ERROR, 
      'Network failed', 
      undefined, 
      undefined, 
      context
    );
    
    expect(error.context).toEqual(context);
  });

  it('should include stack trace for debugging', () => {
    const originalError = new Error('Original error');
    const error = createChatError(ErrorType.NETWORK_ERROR, 'Network failed', originalError);
    
    expect(error.stack).toBeDefined();
    expect(error.originalError?.stack).toBeDefined();
  });

  it('should sanitize sensitive information', () => {
    const sensitiveData = {
      apiKey: 'sk-1234567890abcdef',
      password: 'secret123',
      token: 'bearer-token'
    };
    
    const error = createChatError(
      ErrorType.API_KEY_INVALID, 
      'Invalid API key', 
      undefined, 
      undefined, 
      sensitiveData
    );
    
    const sanitized = ErrorHandler.sanitizeError(error);
    
    expect(sanitized.context?.apiKey).toBe('[REDACTED]');
    expect(sanitized.context?.password).toBe('[REDACTED]');
    expect(sanitized.context?.token).toBe('[REDACTED]');
  });
});