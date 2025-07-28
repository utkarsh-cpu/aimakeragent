/**
 * OpenRouter API Service
 * Handles communication with OpenRouter API for AI model interactions
 */

import { HttpClient, createOpenRouterClient, HttpError } from '../utils/http-client';
import { ApiKeyValidator } from '../utils/validation';
import { StreamProcessor, createStreamProcessor, StreamError } from './stream-processor';

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  timeout: number;
  retryAttempts: number;
  streamingEnabled: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  pricing: {
    prompt: number;
    completion: number;
  };
  capabilities: string[];
  provider: string;
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  isStreaming?: boolean;
  isEdited?: boolean;
  tokens?: number;
  model?: string;
  error?: string;
}

export interface SendMessageOptions {
  model: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export class OpenRouterService {
  private config: OpenRouterConfig;
  private httpClient: HttpClient;
  private abortController?: AbortController;
  private currentStreamProcessor?: StreamProcessor;

  constructor(config: OpenRouterConfig) {
    this.config = config;
    this.httpClient = createOpenRouterClient(config.apiKey, config.baseUrl);
  }

  /**
   * Send a message to OpenRouter API
   */
  async sendMessage(
    messages: Message[],
    options: SendMessageOptions
  ): Promise<Message | AsyncIterable<string>> {
    this.cancelCurrentRequest();
    this.abortController = new AbortController();

    const requestBody = {
      model: options.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: options.stream || false,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1000,
      top_p: options.topP ?? 1,
      frequency_penalty: options.frequencyPenalty ?? 0,
      presence_penalty: options.presencePenalty ?? 0
    };

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Enhanced Chat App'
        },
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        throw await this.handleApiError(response);
      }

      if (options.stream) {
        return this.handleStreamResponseWithProcessor(response);
      } else {
        const data = await response.json();
        return this.parseNonStreamResponse(data);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request was cancelled');
      }
      throw this.handleError(error);
    }
  }

  /**
   * Get available models from OpenRouter
   */
  async getModels(): Promise<ModelInfo[]> {
    try {
      const data = await this.httpClient.get('/models');
      return this.parseModelsResponse(data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Validate API key by making a test request
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    // First check format
    if (!ApiKeyValidator.isValidFormat(apiKey)) {
      return false;
    }

    try {
      const testClient = createOpenRouterClient(apiKey, this.config.baseUrl);
      await testClient.get('/models');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cancel the current request
   */
  cancelCurrentRequest(): void {
    if (this.currentStreamProcessor) {
      this.currentStreamProcessor.cancel();
      this.currentStreamProcessor = undefined;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = undefined;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OpenRouterConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update HTTP client if API key or base URL changed
    if (newConfig.apiKey || newConfig.baseUrl) {
      this.httpClient = createOpenRouterClient(this.config.apiKey, this.config.baseUrl);
    }
  }

  /**
   * Check if streaming is currently active
   */
  isStreaming(): boolean {
    return this.currentStreamProcessor?.isActive() || false;
  }

  /**
   * Handle streaming response with StreamProcessor
   */
  private async *handleStreamResponseWithProcessor(response: Response): AsyncIterable<string> {
    let tokens: string[] = [];
    let isComplete = false;
    let streamError: Error | null = null;

    this.currentStreamProcessor = createStreamProcessor({
      onToken: (token: string) => {
        tokens.push(token);
      },
      onComplete: () => {
        isComplete = true;
      },
      onError: (error: Error) => {
        streamError = error;
        isComplete = true;
      },
      onStart: () => {
        // Stream started
      }
    });

    // Start processing the stream
    this.currentStreamProcessor.processStream(response).catch(() => {
      // Error handling is done in the error callback
    });

    // Yield tokens as they arrive
    let lastIndex = 0;
    while (!isComplete) {
      // Yield any new tokens
      while (lastIndex < tokens.length) {
        yield tokens[lastIndex];
        lastIndex++;
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Yield any remaining tokens
    while (lastIndex < tokens.length) {
      yield tokens[lastIndex];
      lastIndex++;
    }

    // Throw error if one occurred
    if (streamError) {
      throw streamError;
    }

    this.currentStreamProcessor = undefined;
  }



  /**
   * Parse non-streaming response
   */
  private parseNonStreamResponse(data: any): Message {
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No response content received');
    }

    return {
      id: Date.now().toString(),
      content: choice.message?.content || '',
      role: 'assistant',
      timestamp: new Date(),
      tokens: data.usage?.total_tokens,
      model: data.model
    };
  }

  /**
   * Parse models response
   */
  private parseModelsResponse(data: any): ModelInfo[] {
    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.map((model: any) => ({
      id: model.id,
      name: model.name || model.id,
      description: model.description || '',
      contextLength: model.context_length || 4096,
      pricing: {
        prompt: model.pricing?.prompt || 0,
        completion: model.pricing?.completion || 0
      },
      capabilities: model.capabilities || [],
      provider: model.provider || 'unknown'
    }));
  }

  /**
   * Handle API errors from response
   */
  private async handleApiError(response: Response): Promise<Error> {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      // Response might not be JSON
    }

    switch (response.status) {
      case 401:
        return new Error('Invalid API key. Please check your OpenRouter API key.');
      case 429:
        return new Error('Rate limit exceeded. Please wait before making another request.');
      case 500:
        return new Error('OpenRouter server error. Please try again later.');
      default:
        return new Error(errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Handle HTTP errors
   */
  private handleHttpError(error: HttpError): Error {
    switch (error.status) {
      case 401:
        return new Error('Invalid API key. Please check your OpenRouter API key.');
      case 429:
        return new Error('Rate limit exceeded. Please wait before making another request.');
      case 500:
        return new Error('OpenRouter server error. Please try again later.');
      default:
        return new Error(error.data?.error?.message || error.message);
    }
  }

  /**
   * Handle general errors
   */
  private handleError(error: unknown): Error {
    if (error instanceof HttpError) {
      return this.handleHttpError(error);
    }

    if (error instanceof StreamError) {
      return new Error(`Streaming error: ${error.message}`);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error('An unexpected error occurred while communicating with OpenRouter');
  }
}

/**
 * Default OpenRouter configuration
 */
export const DEFAULT_OPENROUTER_CONFIG: OpenRouterConfig = {
  apiKey: '',
  baseUrl: 'https://openrouter.ai/api/v1',
  defaultModel: 'openai/gpt-3.5-turbo',
  timeout: 30000,
  retryAttempts: 3,
  streamingEnabled: true
};