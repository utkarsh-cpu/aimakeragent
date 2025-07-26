/**
 * Tests for StreamProcessor class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamProcessor, createStreamProcessor, StreamError, StreamErrorType, isRecoverableStreamError } from '../stream-processor';

describe('StreamProcessor', () => {
  let mockHandler: {
    onToken: ReturnType<typeof vi.fn>;
    onComplete: ReturnType<typeof vi.fn>;
    onError: ReturnType<typeof vi.fn>;
    onStart: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockHandler = {
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
      onStart: vi.fn()
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create a StreamProcessor with handler', () => {
      const processor = new StreamProcessor(mockHandler);
      expect(processor).toBeInstanceOf(StreamProcessor);
      expect(processor.isProcessing()).toBe(false);
    });
  });

  describe('processChunk', () => {
    it('should parse SSE chunks and extract tokens', () => {
      const processor = new StreamProcessor(mockHandler);
      
      // Simulate starting the processor
      processor['isActive'] = true;
      
      const chunk = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
      processor.processChunk(chunk);
      
      expect(mockHandler.onToken).toHaveBeenCalledWith('Hello');
    });

    it('should handle multiple lines in a chunk', () => {
      const processor = new StreamProcessor(mockHandler);
      processor['isActive'] = true;
      
      const chunk = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" World"}}]}\n\n';
      processor.processChunk(chunk);
      
      expect(mockHandler.onToken).toHaveBeenCalledTimes(2);
      expect(mockHandler.onToken).toHaveBeenNthCalledWith(1, 'Hello');
      expect(mockHandler.onToken).toHaveBeenNthCalledWith(2, ' World');
    });

    it('should handle [DONE] signal', () => {
      const processor = new StreamProcessor(mockHandler);
      processor['isActive'] = true;
      
      const chunk = 'data: [DONE]\n\n';
      processor.processChunk(chunk);
      
      expect(mockHandler.onComplete).toHaveBeenCalledWith('');
      expect(processor.isProcessing()).toBe(false);
    });

    it('should ignore invalid JSON chunks', () => {
      const processor = new StreamProcessor(mockHandler);
      processor['isActive'] = true;
      
      const chunk = 'data: invalid json\n\n';
      processor.processChunk(chunk);
      
      expect(mockHandler.onToken).not.toHaveBeenCalled();
      expect(mockHandler.onError).not.toHaveBeenCalled();
    });

    it('should not process chunks when inactive', () => {
      const processor = new StreamProcessor(mockHandler);
      
      const chunk = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
      processor.processChunk(chunk);
      
      expect(mockHandler.onToken).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('should call onComplete with full response', () => {
      const processor = new StreamProcessor(mockHandler);
      processor['isActive'] = true;
      processor['fullResponse'] = 'Hello World';
      
      processor.complete();
      
      expect(mockHandler.onComplete).toHaveBeenCalledWith('Hello World');
      expect(processor.isProcessing()).toBe(false);
    });

    it('should not call onComplete when inactive', () => {
      const processor = new StreamProcessor(mockHandler);
      
      processor.complete();
      
      expect(mockHandler.onComplete).not.toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should call onError and cleanup', () => {
      const processor = new StreamProcessor(mockHandler);
      processor['isActive'] = true;
      
      const error = new Error('Test error');
      processor.error(error);
      
      expect(mockHandler.onError).toHaveBeenCalledWith(error);
      expect(processor.isProcessing()).toBe(false);
    });

    it('should not call onError when inactive', () => {
      const processor = new StreamProcessor(mockHandler);
      
      const error = new Error('Test error');
      processor.error(error);
      
      expect(mockHandler.onError).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should cancel active stream', () => {
      const processor = new StreamProcessor(mockHandler);
      processor['isActive'] = true;
      
      processor.cancel();
      
      expect(mockHandler.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: StreamErrorType.CANCELLATION_ERROR,
          message: 'Stream was cancelled'
        })
      );
      expect(processor.isProcessing()).toBe(false);
    });

    it('should not cancel inactive stream', () => {
      const processor = new StreamProcessor(mockHandler);
      
      processor.cancel();
      
      expect(mockHandler.onError).not.toHaveBeenCalled();
    });
  });

  describe('timeout handling', () => {
    it('should timeout after specified duration', () => {
      const processor = new StreamProcessor(mockHandler, 1000);
      processor['isActive'] = true;
      processor['timeoutId'] = setTimeout(() => {
        processor.error(new StreamError(StreamErrorType.TIMEOUT_ERROR, 'Stream processing timed out'));
      }, 1000);
      
      vi.advanceTimersByTime(1000);
      
      expect(mockHandler.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: StreamErrorType.TIMEOUT_ERROR,
          message: 'Stream processing timed out'
        })
      );
    });
  });

  describe('parseSSEChunk', () => {
    it('should extract content from OpenRouter format', () => {
      const processor = new StreamProcessor(mockHandler);
      processor['isActive'] = true;
      
      const result = processor['parseSSEChunk']('data: {"choices":[{"delta":{"content":"test"}}]}');
      expect(result).toBe('test');
    });

    it('should return null for non-data lines', () => {
      const processor = new StreamProcessor(mockHandler);
      
      const result = processor['parseSSEChunk']('event: message');
      expect(result).toBeNull();
    });

    it('should handle [DONE] signal', () => {
      const processor = new StreamProcessor(mockHandler);
      processor['isActive'] = true;
      
      const result = processor['parseSSEChunk']('data: [DONE]');
      expect(result).toBeNull();
      expect(mockHandler.onComplete).toHaveBeenCalled();
    });
  });

  describe('extractContent', () => {
    it('should extract delta content', () => {
      const processor = new StreamProcessor(mockHandler);
      
      const data = { choices: [{ delta: { content: 'test content' } }] };
      const result = processor['extractContent'](data);
      expect(result).toBe('test content');
    });

    it('should extract message content', () => {
      const processor = new StreamProcessor(mockHandler);
      
      const data = { choices: [{ message: { content: 'test message' } }] };
      const result = processor['extractContent'](data);
      expect(result).toBe('test message');
    });

    it('should extract direct content', () => {
      const processor = new StreamProcessor(mockHandler);
      
      const data = { content: 'direct content' };
      const result = processor['extractContent'](data);
      expect(result).toBe('direct content');
    });

    it('should extract text field', () => {
      const processor = new StreamProcessor(mockHandler);
      
      const data = { text: 'text content' };
      const result = processor['extractContent'](data);
      expect(result).toBe('text content');
    });

    it('should return empty string for unknown format', () => {
      const processor = new StreamProcessor(mockHandler);
      
      const data = { unknown: 'field' };
      const result = processor['extractContent'](data);
      expect(result).toBe('');
    });
  });
});

describe('createStreamProcessor', () => {
  it('should create a StreamProcessor with provided callbacks', () => {
    const onToken = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();
    const onStart = vi.fn();
    
    const processor = createStreamProcessor(onToken, onComplete, onError, onStart, 5000);
    
    expect(processor).toBeInstanceOf(StreamProcessor);
  });

  it('should use default onStart if not provided', () => {
    const onToken = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();
    
    const processor = createStreamProcessor(onToken, onComplete, onError);
    
    expect(processor).toBeInstanceOf(StreamProcessor);
  });
});

describe('StreamError', () => {
  it('should create StreamError with type and message', () => {
    const error = new StreamError(StreamErrorType.PARSE_ERROR, 'Parse failed');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(StreamError);
    expect(error.type).toBe(StreamErrorType.PARSE_ERROR);
    expect(error.message).toBe('Parse failed');
    expect(error.name).toBe('StreamError');
  });

  it('should include original error', () => {
    const originalError = new Error('Original');
    const error = new StreamError(StreamErrorType.CONNECTION_ERROR, 'Connection failed', originalError);
    
    expect(error.originalError).toBe(originalError);
  });
});

describe('isRecoverableStreamError', () => {
  it('should return true for recoverable StreamError types', () => {
    const timeoutError = new StreamError(StreamErrorType.TIMEOUT_ERROR, 'Timeout');
    const connectionError = new StreamError(StreamErrorType.CONNECTION_ERROR, 'Connection failed');
    
    expect(isRecoverableStreamError(timeoutError)).toBe(true);
    expect(isRecoverableStreamError(connectionError)).toBe(true);
  });

  it('should return false for non-recoverable StreamError types', () => {
    const parseError = new StreamError(StreamErrorType.PARSE_ERROR, 'Parse failed');
    const cancelError = new StreamError(StreamErrorType.CANCELLATION_ERROR, 'Cancelled');
    
    expect(isRecoverableStreamError(parseError)).toBe(false);
    expect(isRecoverableStreamError(cancelError)).toBe(false);
  });

  it('should return false for non-StreamError', () => {
    const regularError = new Error('Regular error');
    
    expect(isRecoverableStreamError(regularError)).toBe(false);
  });
});