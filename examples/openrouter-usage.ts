/**
 * Example usage of OpenRouter API integration
 * This file demonstrates how to use the OpenRouter service
 */

import { 
  OpenRouterService, 
  DEFAULT_OPENROUTER_CONFIG,
  ConfigManager,
  ApiKeyValidator 
} from '../services';

// Example 1: Basic service initialization
export function initializeOpenRouterService(apiKey: string): OpenRouterService {
  // Validate API key first
  const validation = ApiKeyValidator.getValidationError(apiKey);
  if (validation) {
    throw new Error(`Invalid API key: ${validation}`);
  }

  // Create service with custom config
  const config = {
    ...DEFAULT_OPENROUTER_CONFIG,
    apiKey,
    defaultModel: 'openai/gpt-3.5-turbo',
    streamingEnabled: true
  };

  return new OpenRouterService(config);
}

// Example 2: Using ConfigManager for persistent settings
export function setupConfigManager(apiKey: string): void {
  const configManager = ConfigManager.getInstance();
  
  // Set API key (will be stored securely)
  configManager.setApiKey(apiKey);
  
  // Update other configuration
  configManager.updateConfig({
    defaultModel: 'openai/gpt-4',
    streamingEnabled: true,
    timeout: 30000
  });
  
  // Subscribe to config changes
  const unsubscribe = configManager.subscribe((config) => {
    console.log('Configuration updated:', config);
  });
  
  // Later, unsubscribe when component unmounts
  // unsubscribe();
}

// Example 3: Sending a message
export async function sendMessage(
  service: OpenRouterService,
  userMessage: string
): Promise<void> {
  try {
    const messages = [
      {
        id: '1',
        content: 'You are a helpful assistant.',
        role: 'system' as const,
        timestamp: new Date()
      },
      {
        id: '2',
        content: userMessage,
        role: 'user' as const,
        timestamp: new Date()
      }
    ];

    const response = await service.sendMessage(messages, {
      model: 'openai/gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
      stream: false
    });

    console.log('AI Response:', response);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Example 4: Streaming response
export async function sendStreamingMessage(
  service: OpenRouterService,
  userMessage: string
): Promise<void> {
  try {
    const messages = [
      {
        id: '1',
        content: userMessage,
        role: 'user' as const,
        timestamp: new Date()
      }
    ];

    const stream = await service.sendMessage(messages, {
      model: 'openai/gpt-3.5-turbo',
      temperature: 0.7,
      stream: true
    });

    if (Symbol.asyncIterator in stream) {
      let fullResponse = '';
      for await (const chunk of stream) {
        fullResponse += chunk;
        console.log('Streaming chunk:', chunk);
      }
      console.log('Complete response:', fullResponse);
    }
  } catch (error) {
    console.error('Error with streaming:', error);
  }
}

// Example 5: Getting available models
export async function listAvailableModels(service: OpenRouterService): Promise<void> {
  try {
    const models = await service.getModels();
    console.log('Available models:', models);
    
    // Filter models by provider
    const openAIModels = models.filter(model => model.provider === 'openai');
    console.log('OpenAI models:', openAIModels);
  } catch (error) {
    console.error('Error fetching models:', error);
  }
}

// Example 6: API key validation
export async function validateApiKey(service: OpenRouterService, apiKey: string): Promise<boolean> {
  try {
    const isValid = await service.validateApiKey(apiKey);
    console.log('API key is valid:', isValid);
    return isValid;
  } catch (error) {
    console.error('Error validating API key:', error);
    return false;
  }
}