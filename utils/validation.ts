/**
 * Input validation utilities for the chat application
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface TokenCountResult {
  tokenCount: number;
  characterCount: number;
  isOverLimit: boolean;
  isNearLimit: boolean;
}

export class InputValidator {
  private static readonly MAX_MESSAGE_LENGTH = 50000;
  private static readonly MAX_TOKENS = 4000;
  private static readonly NEAR_LIMIT_THRESHOLD = 0.9;

  /**
   * Validate a message for basic requirements
   */
  static validateMessage(content: string): ValidationResult {
    if (!content || typeof content !== 'string') {
      return {
        isValid: false,
        error: 'Message cannot be empty'
      };
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return {
        isValid: false,
        error: 'Message cannot be empty'
      };
    }

    if (content.length > this.MAX_MESSAGE_LENGTH) {
      return {
        isValid: false,
        error: `Message is too long (${content.length}/${this.MAX_MESSAGE_LENGTH} characters)`
      };
    }

    const warnings: string[] = [];
    
    // Check for potential issues
    if (content.length > this.MAX_MESSAGE_LENGTH * 0.8) {
      warnings.push('Message is approaching the character limit');
    }

    if (this.countTokens(content) > this.MAX_TOKENS * 0.9) {
      warnings.push('Message is approaching the token limit');
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Count tokens in a message (rough estimation)
   */
  static countTokens(content: string): number {
    if (!content) return 0;
    
    // Rough estimation: 1 token ≈ 4 characters for English text
    // This is a simplified version - in production you'd use a proper tokenizer
    const words = content.split(/\s+/).filter(word => word.length > 0);
    const characters = content.length;
    
    // Use a combination of word count and character count for better estimation
    return Math.ceil(Math.max(words.length * 1.3, characters / 4));
  }

  /**
   * Get token count information
   */
  static getTokenCount(content: string): TokenCountResult {
    const tokenCount = this.countTokens(content);
    const characterCount = content.length;
    const isOverLimit = tokenCount > this.MAX_TOKENS;
    const isNearLimit = tokenCount > this.MAX_TOKENS * this.NEAR_LIMIT_THRESHOLD;

    return {
      tokenCount,
      characterCount,
      isOverLimit,
      isNearLimit
    };
  }

  /**
   * Validate API key format
   */
  static validateApiKey(apiKey: string): ValidationResult {
    if (!apiKey || typeof apiKey !== 'string') {
      return {
        isValid: false,
        error: 'API key is required'
      };
    }

    const trimmed = apiKey.trim();
    if (trimmed.length === 0) {
      return {
        isValid: false,
        error: 'API key cannot be empty'
      };
    }

    // Basic format validation for OpenRouter API keys
    if (!trimmed.startsWith('sk-or-')) {
      return {
        isValid: false,
        error: 'Invalid API key format. OpenRouter API keys should start with "sk-or-"'
      };
    }

    if (trimmed.length < 20) {
      return {
        isValid: false,
        error: 'API key appears to be too short'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate model name
   */
  static validateModel(model: string): ValidationResult {
    if (!model || typeof model !== 'string') {
      return {
        isValid: false,
        error: 'Model name is required'
      };
    }

    const trimmed = model.trim();
    if (trimmed.length === 0) {
      return {
        isValid: false,
        error: 'Model name cannot be empty'
      };
    }

    // Basic format validation (provider/model-name)
    if (!trimmed.includes('/')) {
      return {
        isValid: false,
        error: 'Model name should be in format "provider/model-name"'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate temperature parameter
   */
  static validateTemperature(temperature: number): ValidationResult {
    if (typeof temperature !== 'number' || isNaN(temperature)) {
      return {
        isValid: false,
        error: 'Temperature must be a number'
      };
    }

    if (temperature < 0 || temperature > 2) {
      return {
        isValid: false,
        error: 'Temperature must be between 0 and 2'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate max tokens parameter
   */
  static validateMaxTokens(maxTokens: number): ValidationResult {
    if (typeof maxTokens !== 'number' || isNaN(maxTokens)) {
      return {
        isValid: false,
        error: 'Max tokens must be a number'
      };
    }

    if (maxTokens < 1) {
      return {
        isValid: false,
        error: 'Max tokens must be at least 1'
      };
    }

    if (maxTokens > 32000) {
      return {
        isValid: false,
        error: 'Max tokens cannot exceed 32,000'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate conversation title
   */
  static validateTitle(title: string): ValidationResult {
    if (!title || typeof title !== 'string') {
      return {
        isValid: false,
        error: 'Title is required'
      };
    }

    const trimmed = title.trim();
    if (trimmed.length === 0) {
      return {
        isValid: false,
        error: 'Title cannot be empty'
      };
    }

    if (trimmed.length > 100) {
      return {
        isValid: false,
        error: 'Title cannot exceed 100 characters'
      };
    }

    return { isValid: true };
  }

  /**
   * Sanitize user input
   */
  static sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove potentially dangerous characters but preserve formatting
    return input
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .trim();
  }

  /**
   * Check if content contains potentially sensitive information
   */
  static checkForSensitiveInfo(content: string): string[] {
    const warnings: string[] = [];
    
    // Check for potential API keys
    if (/sk-[a-zA-Z0-9]{20,}/g.test(content)) {
      warnings.push('Content may contain an API key');
    }

    // Check for potential passwords
    if (/password[:\s]*[^\s]{8,}/gi.test(content)) {
      warnings.push('Content may contain a password');
    }

    // Check for potential email addresses
    if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g.test(content)) {
      warnings.push('Content contains email addresses');
    }

    // Check for potential phone numbers
    if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g.test(content)) {
      warnings.push('Content may contain phone numbers');
    }

    return warnings;
  }
}

/**
 * File validation utilities
 */
export class FileValidator {
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly ALLOWED_TYPES = [
    'text/plain',
    'text/markdown',
    'application/json',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ];

  /**
   * Validate uploaded file
   */
  static validateFile(file: File): ValidationResult {
    if (!file) {
      return {
        isValid: false,
        error: 'No file provided'
      };
    }

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File size exceeds limit (${Math.round(file.size / 1024 / 1024)}MB / ${Math.round(this.MAX_FILE_SIZE / 1024 / 1024)}MB)`
      };
    }

    // Check file type
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return {
        isValid: false,
        error: `File type not supported: ${file.type}`
      };
    }

    // Check file name
    if (file.name.length > 255) {
      return {
        isValid: false,
        error: 'File name is too long'
      };
    }

    return { isValid: true };
  }

  /**
   * Get allowed file types for display
   */
  static getAllowedTypes(): string[] {
    return [...this.ALLOWED_TYPES];
  }

  /**
   * Get max file size in MB
   */
  static getMaxFileSize(): number {
    return Math.round(this.MAX_FILE_SIZE / 1024 / 1024);
  }
}

/**
 * API Key validation utilities
 */
export class ApiKeyValidator {
  /**
   * Check if API key format is valid
   */
  static isValidFormat(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    const trimmed = apiKey.trim();
    
    // OpenRouter API keys start with 'sk-or-' or general OpenAI format 'sk-'
    return (trimmed.startsWith('sk-or-') || trimmed.startsWith('sk-')) && trimmed.length >= 20;
  }

  /**
   * Sanitize API key (trim whitespace)
   */
  static sanitize(apiKey: string): string {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key provided');
    }

    const trimmed = apiKey.trim();
    
    if (!this.isValidFormat(trimmed)) {
      throw new Error('Invalid API key format');
    }

    return trimmed;
  }

  /**
   * Mask API key for display
   */
  static mask(apiKey: string): string {
    if (!apiKey || typeof apiKey !== 'string') {
      return '';
    }

    const trimmed = apiKey.trim();
    if (trimmed.length < 8) {
      return '*'.repeat(trimmed.length);
    }

    return trimmed.substring(0, 4) + '*'.repeat(trimmed.length - 8) + trimmed.substring(trimmed.length - 4);
  }

  /**
   * Validate API key and return detailed result
   */
  static validate(apiKey: string): ValidationResult {
    return InputValidator.validateApiKey(apiKey);
  }

  /**
   * Get validation error message for API key
   */
  static getValidationError(apiKey: string): string | null {
    const result = this.validate(apiKey);
    return result.isValid ? null : result.error;
  }
}

/**
 * Configuration validation utilities
 */
export class ConfigValidator {
  /**
   * Validate OpenRouter configuration
   */
  static validateOpenRouterConfig(config: any): ValidationResult {
    if (!config || typeof config !== 'object') {
      return {
        isValid: false,
        error: 'Configuration must be an object'
      };
    }

    // Validate API key
    if (!config.apiKey) {
      return {
        isValid: false,
        error: 'API key is required'
      };
    }

    const apiKeyResult = ApiKeyValidator.validate(config.apiKey);
    if (!apiKeyResult.isValid) {
      return apiKeyResult;
    }

    // Validate base URL
    if (config.baseUrl && typeof config.baseUrl !== 'string') {
      return {
        isValid: false,
        error: 'Base URL must be a string'
      };
    }

    if (config.baseUrl && !this.isValidUrl(config.baseUrl)) {
      return {
        isValid: false,
        error: 'Base URL must be a valid URL'
      };
    }

    // Validate timeout
    if (config.timeout !== undefined) {
      if (typeof config.timeout !== 'number' || config.timeout < 1000) {
        return {
          isValid: false,
          error: 'Timeout must be a number >= 1000ms'
        };
      }
    }

    // Validate retry attempts
    if (config.retryAttempts !== undefined) {
      if (typeof config.retryAttempts !== 'number' || config.retryAttempts < 0 || config.retryAttempts > 10) {
        return {
          isValid: false,
          error: 'Retry attempts must be a number between 0 and 10'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Validate model configuration
   */
  static validateModelConfig(config: any): ValidationResult {
    if (!config || typeof config !== 'object') {
      return {
        isValid: false,
        error: 'Model configuration must be an object'
      };
    }

    if (!config.model || typeof config.model !== 'string') {
      return {
        isValid: false,
        error: 'Model name is required and must be a string'
      };
    }

    if (config.temperature !== undefined) {
      if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
        return {
          isValid: false,
          error: 'Temperature must be a number between 0 and 2'
        };
      }
    }

    if (config.maxTokens !== undefined) {
      const maxTokensResult = InputValidator.validateMaxTokens(config.maxTokens);
      if (!maxTokensResult.isValid) {
        return maxTokensResult;
      }
    }

    return { isValid: true };
  }

  /**
   * Check if URL is valid
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Model parameter validation utilities
 */
export class ModelParameterValidator {
  /**
   * Validate temperature parameter
   */
  static validateTemperature(temperature: number): ValidationResult {
    if (typeof temperature !== 'number' || isNaN(temperature)) {
      return {
        isValid: false,
        error: 'Temperature must be a number'
      };
    }

    if (temperature < 0 || temperature > 2) {
      return {
        isValid: false,
        error: 'Temperature must be between 0 and 2'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate top-p parameter
   */
  static validateTopP(topP: number): ValidationResult {
    if (typeof topP !== 'number' || isNaN(topP)) {
      return {
        isValid: false,
        error: 'Top-p must be a number'
      };
    }

    if (topP < 0 || topP > 1) {
      return {
        isValid: false,
        error: 'Top-p must be between 0 and 1'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate frequency penalty parameter
   */
  static validateFrequencyPenalty(penalty: number): ValidationResult {
    if (typeof penalty !== 'number' || isNaN(penalty)) {
      return {
        isValid: false,
        error: 'Frequency penalty must be a number'
      };
    }

    if (penalty < -2 || penalty > 2) {
      return {
        isValid: false,
        error: 'Frequency penalty must be between -2 and 2'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate presence penalty parameter
   */
  static validatePresencePenalty(penalty: number): ValidationResult {
    if (typeof penalty !== 'number' || isNaN(penalty)) {
      return {
        isValid: false,
        error: 'Presence penalty must be a number'
      };
    }

    if (penalty < -2 || penalty > 2) {
      return {
        isValid: false,
        error: 'Presence penalty must be between -2 and 2'
      };
    }

    return { isValid: true };
  }
}