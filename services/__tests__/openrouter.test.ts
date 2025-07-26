/**
 * Basic tests for OpenRouter service
 * Note: These are unit tests that don't make actual API calls
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenRouterService, DEFAULT_OPENROUTER_CONFIG } from '../openrouter';
import { ApiKeyValidator } from '../../utils/validation';

// Mock the HTTP client
vi.mock('../../utils/http-client', () => ({
  createOpenRouterClient: vi.fn(() => ({
    get: vi.fn(),
    post: vi.fn()
  })),
  HttpError: class HttpError extends Error {
    constructor(message: string, public status: number, public data?: any) {
      super(message);
    }
  }
}));

describe('OpenRouterService', () => {
  let service: OpenRouterService;
  
  beforeEach(() => {
    service = new OpenRouterService({
      ...DEFAULT_OPENROUTER_CONFIG,
      apiKey: 'sk-or-test-key-123456789012345678901234567890'
    });
  });

  describe('constructor', () => {
    it('should create service with provided config', () => {
      expect(service).toBeInstanceOf(OpenRouterService);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig = { defaultModel: 'gpt-4' };
      service.updateConfig(newConfig);
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });
  });

  describe('cancelCurrentRequest', () => {
    it('should cancel current request without error', () => {
      service.cancelCurrentRequest();
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });
  });
});

describe('ApiKeyValidator', () => {
  describe('isValidFormat', () => {
    it('should validate OpenRouter API key format', () => {
      expect(ApiKeyValidator.isValidFormat('sk-or-1234567890abcdef1234567890abcdef12345678')).toBe(true);
      expect(ApiKeyValidator.isValidFormat('sk-1234567890abcdef1234567890')).toBe(true);
      expect(ApiKeyValidator.isValidFormat('invalid-key')).toBe(false);
      expect(ApiKeyValidator.isValidFormat('')).toBe(false);
    });
  });

  describe('sanitize', () => {
    it('should sanitize API key', () => {
      expect(ApiKeyValidator.sanitize('  sk-or-1234567890abcdef1234567890abcdef12345678  ')).toBe('sk-or-1234567890abcdef1234567890abcdef12345678');
    });

    it('should throw error for invalid keys', () => {
      expect(() => ApiKeyValidator.sanitize('')).toThrow();
      expect(() => ApiKeyValidator.sanitize('short')).toThrow();
    });
  });
});