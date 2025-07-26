/**
 * Stream Processor for handling Server-Sent Events (SSE) responses
 * Provides robust chunk parsing, token extraction, and error handling for streaming AI responses
 */

export interface StreamingHandler {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
  onStart: () => void;
}

export enum StreamErrorType {
  PARSE_ERROR = 'PARSE_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CANCELLATION_ERROR = 'CANCELLATION_ERROR'
}

export class StreamError extends Error {
  constructor(
    public type: StreamErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'StreamError';
  }
}

export class StreamProcessor {
  private handler: StreamingHandler;
  private buffer: string = '';
  private fullResponse: string = '';
  private isActive: boolean = false;
  private abortController?: AbortController;
  private timeoutId?: NodeJS.Timeout;
  private readonly timeout: number;

  constructor(handler: StreamingHandler, timeout: number = 30000) {
    this.handler = handler;
    this.timeout = timeout;
  }

  /**
   * Start processing a streaming response
   */
  async processStream(response: Response): Promise<void> {
    if (this.isActive) {
      throw new StreamError(StreamErrorType.CONNECTION_ERROR, 'Stream processor is already active');
    }

    this.isActive = true;
    this.buffer = '';
    this.fullResponse = '';
    this.abortController = new AbortController();

    // Set up timeout
    this.timeoutId = setTimeout(() => {
      this.error(new StreamError(StreamErrorType.TIMEOUT_ERROR, 'Stream processing timed out'));
    }, this.timeout);

    try {
      this.handler.onStart();
      await this.readStream(response);
    } catch (error) {
      if (error instanceof StreamError) {
        this.error(error);
      } else {
        this.error(new StreamError(
          StreamErrorType.CONNECTION_ERROR,
          'Failed to process stream',
          error instanceof Error ? error : new Error(String(error))
        ));
      }
    }
  }

  /**
   * Process a single chunk of data
   */
  processChunk(chunk: string): void {
    if (!this.isActive) {
      return;
    }

    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const token = this.parseSSEChunk(line);
      if (token !== null) {
        this.fullResponse += token;
        this.handler.onToken(token);
      }
    }
  }

  /**
   * Complete the stream processing
   */
  complete(): void {
    if (!this.isActive) {
      return;
    }

    this.cleanup();
    this.handler.onComplete(this.fullResponse);
  }

  /**
   * Handle stream error
   */
  error(error: Error): void {
    if (!this.isActive) {
      return;
    }

    this.cleanup();
    this.handler.onError(error);
  }

  /**
   * Cancel the current stream
   */
  cancel(): void {
    if (!this.isActive) {
      return;
    }

    if (this.abortController) {
      this.abortController.abort();
    }

    this.error(new StreamError(StreamErrorType.CANCELLATION_ERROR, 'Stream was cancelled'));
  }

  /**
   * Check if the processor is currently active
   */
  isProcessing(): boolean {
    return this.isActive;
  }

  /**
   * Parse a Server-Sent Events chunk
   */
  private parseSSEChunk(line: string): string | null {
    const trimmed = line.trim();
    
    if (!trimmed.startsWith('data: ')) {
      return null;
    }

    const data = trimmed.slice(6);
    
    // Check for stream completion
    if (data === '[DONE]') {
      this.complete();
      return null;
    }

    try {
      const parsed = JSON.parse(data);
      return this.extractContent(parsed);
    } catch (error) {
      // Log parse errors but don't fail the entire stream
      console.warn('Failed to parse SSE chunk:', data, error);
      return null;
    }
  }

  /**
   * Extract content from parsed JSON data
   */
  private extractContent(data: any): string {
    // Handle OpenRouter/OpenAI format
    const choice = data.choices?.[0];
    if (choice) {
      // Check for delta content (streaming format)
      if (choice.delta?.content) {
        return choice.delta.content;
      }
      
      // Check for message content (non-streaming format)
      if (choice.message?.content) {
        return choice.message.content;
      }
    }

    // Handle other potential formats
    if (data.content) {
      return data.content;
    }

    if (data.text) {
      return data.text;
    }

    return '';
  }

  /**
   * Read the stream using ReadableStream API
   */
  private async readStream(response: Response): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new StreamError(StreamErrorType.CONNECTION_ERROR, 'No response body available for streaming');
    }

    const decoder = new TextDecoder();

    try {
      while (this.isActive) {
        const { done, value } = await reader.read();
        
        if (done) {
          this.complete();
          break;
        }

        if (this.abortController?.signal.aborted) {
          throw new StreamError(StreamErrorType.CANCELLATION_ERROR, 'Stream was cancelled');
        }

        const chunk = decoder.decode(value, { stream: true });
        this.processChunk(chunk);
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Clean up resources and reset state
   */
  private cleanup(): void {
    this.isActive = false;
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    
    this.abortController = undefined;
  }
}

/**
 * Utility function to create a StreamProcessor with common error handling
 */
export function createStreamProcessor(
  onToken: (token: string) => void,
  onComplete: (fullResponse: string) => void,
  onError: (error: Error) => void,
  onStart?: () => void,
  timeout?: number
): StreamProcessor {
  const handler: StreamingHandler = {
    onToken,
    onComplete,
    onError,
    onStart: onStart || (() => {})
  };

  return new StreamProcessor(handler, timeout);
}

/**
 * Helper function to determine if an error is recoverable
 */
export function isRecoverableStreamError(error: Error): boolean {
  if (error instanceof StreamError) {
    return error.type === StreamErrorType.TIMEOUT_ERROR || 
           error.type === StreamErrorType.CONNECTION_ERROR;
  }
  return false;
}