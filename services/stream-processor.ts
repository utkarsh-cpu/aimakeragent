/**
 * Stream processing utilities for handling SSE responses
 */

export interface StreamHandler {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
  onStart: () => void;
}

export class StreamError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'StreamError';
  }
}

export class StreamProcessor {
  private handler: StreamHandler;
  private buffer: string = '';
  private fullResponse: string = '';
  private isProcessing: boolean = false;

  constructor(handler: StreamHandler) {
    this.handler = handler;
  }

  /**
   * Start processing stream
   */
  start(): void {
    if (this.isProcessing) {
      throw new StreamError('Stream is already being processed');
    }
    
    this.isProcessing = true;
    this.buffer = '';
    this.fullResponse = '';
    this.handler.onStart();
  }

  /**
   * Process a chunk of stream data
   */
  processChunk(chunk: string): void {
    if (!this.isProcessing) {
      throw new StreamError('Stream is not active');
    }

    this.buffer += chunk;
    
    // Process complete lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      this.processLine(line);
    }
  }

  /**
   * Process a single line of SSE data
   */
  private processLine(line: string): void {
    const trimmed = line.trim();
    
    if (!trimmed || trimmed.startsWith(':')) {
      return; // Skip empty lines and comments
    }

    if (trimmed === 'data: [DONE]') {
      this.complete();
      return;
    }

    if (trimmed.startsWith('data: ')) {
      const data = trimmed.substring(6);
      
      try {
        const parsed = JSON.parse(data);
        const content = this.extractContent(parsed);
        
        if (content) {
          this.fullResponse += content;
          this.handler.onToken(content);
        }
      } catch (error) {
        console.warn('Failed to parse SSE data:', data, error);
      }
    }
  }

  /**
   * Extract content from parsed SSE data
   */
  private extractContent(data: any): string {
    // Handle OpenRouter/OpenAI format
    if (data.choices && data.choices[0] && data.choices[0].delta) {
      return data.choices[0].delta.content || '';
    }

    // Handle other formats
    if (data.content) {
      return data.content;
    }

    if (data.text) {
      return data.text;
    }

    return '';
  }

  /**
   * Complete the stream processing
   */
  complete(): void {
    if (!this.isProcessing) {
      return;
    }

    this.isProcessing = false;
    this.handler.onComplete(this.fullResponse);
  }

  /**
   * Handle stream error
   */
  error(error: Error): void {
    this.isProcessing = false;
    this.handler.onError(error);
  }

  /**
   * Cancel stream processing
   */
  cancel(): void {
    if (this.isProcessing) {
      this.isProcessing = false;
      this.error(new StreamError('Stream was cancelled', 'CANCELLED'));
    }
  }

  /**
   * Check if stream is currently processing
   */
  isActive(): boolean {
    return this.isProcessing;
  }

  /**
   * Get current full response
   */
  getFullResponse(): string {
    return this.fullResponse;
  }

  /**
   * Process a stream response
   */
  async processStream(response: Response): Promise<void> {
    if (!response.body) {
      throw new StreamError('Response has no body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      this.start();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          this.complete();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        this.processChunk(chunk);
      }
    } catch (error) {
      this.error(error instanceof Error ? error : new Error(String(error)));
    } finally {
      reader.releaseLock();
    }
  }
}

/**
 * Create a stream processor with handlers
 */
export function createStreamProcessor(handlers: StreamHandler): StreamProcessor {
  return new StreamProcessor(handlers);
}

/**
 * Process a ReadableStream response
 */
export async function processStreamResponse(
  response: Response,
  handlers: StreamHandler
): Promise<void> {
  if (!response.body) {
    throw new StreamError('Response has no body');
  }

  const processor = createStreamProcessor(handlers);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    processor.start();

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        processor.complete();
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      processor.processChunk(chunk);
    }
  } catch (error) {
    processor.error(error instanceof Error ? error : new Error(String(error)));
  } finally {
    reader.releaseLock();
  }
}

/**
 * Create a mock stream processor for testing
 */
export function createMockStreamProcessor(): {
  processChunk: any;
  complete: any;
  error: any;
  cancel: any;
  isProcessing: any;
} {
  // Only use jest mocks if jest is available
  if (typeof jest !== 'undefined') {
    return {
      processChunk: jest.fn(),
      complete: jest.fn(),
      error: jest.fn(),
      cancel: jest.fn(),
      isProcessing: jest.fn(() => false),
    };
  }
  
  // Fallback for non-test environments
  return {
    processChunk: () => {},
    complete: () => {},
    error: () => {},
    cancel: () => {},
    isProcessing: () => false,
  };
}