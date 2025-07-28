/**
 * Configuration management utilities for OpenRouter integration
 */

import { OpenRouterConfig, DEFAULT_OPENROUTER_CONFIG, ModelInfo } from '../services/openrouter';
import { ApiKeyStorage, SettingsStorage } from './storage';
import { ConfigValidator } from './validation';

/**
 * Configuration Manager for OpenRouter settings
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: OpenRouterConfig;
  private listeners: Set<(config: OpenRouterConfig) => void> = new Set();

  private constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Get current configuration
   */
  getConfig(): OpenRouterConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<OpenRouterConfig>): void {
    const newConfig = { ...this.config, ...updates };

    // Validate the new configuration
    const validation = ConfigValidator.validateOpenRouterConfig(newConfig);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.error || 'Unknown validation error'}`);
    }

    this.config = newConfig;
    this.saveConfig();
    this.notifyListeners();
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    ApiKeyStorage.store(apiKey);
    this.updateConfig({ apiKey });
  }

  /**
   * Get API key
   */
  getApiKey(): string {
    return this.config.apiKey;
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    return Boolean(this.config.apiKey);
  }

  /**
   * Remove API key
   */
  removeApiKey(): void {
    ApiKeyStorage.remove();
    this.updateConfig({ apiKey: '' });
  }

  /**
   * Reset to default configuration
   */
  resetToDefaults(): void {
    this.config = { ...DEFAULT_OPENROUTER_CONFIG };
    this.saveConfig();
    this.notifyListeners();
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(listener: (config: OpenRouterConfig) => void): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Load configuration from storage
   */
  private loadConfig(): OpenRouterConfig {
    const storedApiKey = ApiKeyStorage.retrieve();
    const storedConfig = SettingsStorage.retrieve() || {};

    return {
      ...DEFAULT_OPENROUTER_CONFIG,
      ...storedConfig,
      apiKey: storedApiKey || ''
    };
  }

  /**
   * Save configuration to storage
   */
  private saveConfig(): void {
    // Save API key separately for security
    if (this.config.apiKey) {
      ApiKeyStorage.store(this.config.apiKey);
    }

    // Save other config without API key
    const { apiKey, ...configWithoutKey } = this.config;
    SettingsStorage.store(configWithoutKey);
  }

  /**
   * Notify all listeners of configuration changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getConfig());
      } catch (error) {
        console.error('Error in config listener:', error);
      }
    });
  }
}

/**
 * Hook for React components to use configuration
 */
export function useOpenRouterConfig() {
  const configManager = ConfigManager.getInstance();

  return {
    config: configManager.getConfig(),
    updateConfig: (updates: Partial<OpenRouterConfig>) => configManager.updateConfig(updates),
    setApiKey: (apiKey: string) => configManager.setApiKey(apiKey),
    getApiKey: () => configManager.getApiKey(),
    hasApiKey: () => configManager.hasApiKey(),
    removeApiKey: () => configManager.removeApiKey(),
    resetToDefaults: () => configManager.resetToDefaults(),
    subscribe: (listener: (config: OpenRouterConfig) => void) => configManager.subscribe(listener)
  };
}

/**
 * Hook for managing OpenRouter models with caching
 */
export function useOpenRouterModels() {
  const configManager = ConfigManager.getInstance();
  const modelCache = ModelCacheManager.getInstance();

  const getModels = async (forceRefresh = false): Promise<ModelInfo[]> => {
    // Try to get from cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedModels = modelCache.getCachedModels();
      if (cachedModels) {
        return cachedModels;
      }
    }

    // If no cache or force refresh, fetch from API
    const config = configManager.getConfig();
    if (!config.apiKey) {
      throw new Error('API key is required to fetch models');
    }

    try {
      // Import OpenRouterService dynamically to avoid circular dependency
      const { OpenRouterService } = await import('../services/openrouter');
      const service = new OpenRouterService(config);
      const models = await service.getModels();

      // Cache the results
      modelCache.cacheModels(models);

      return models;
    } catch (error) {
      // If API fails, try to return cached models as fallback
      const cachedModels = modelCache.getCachedModels();
      if (cachedModels) {
        console.warn('API failed, using cached models:', error);
        return cachedModels;
      }
      throw error;
    }
  };

  const clearModelCache = () => {
    modelCache.clearCache();
  };

  const isCacheValid = () => {
    return modelCache.isCacheValid();
  };

  const getCacheAge = () => {
    return modelCache.getCacheAge();
  };

  return {
    getModels,
    clearModelCache,
    isCacheValid,
    getCacheAge
  };
}

/**
 * Environment configuration utilities
 */
export class EnvironmentConfig {
  /**
   * Check if running in development mode
   */
  static isDevelopment(): boolean {
    return (import.meta as any).env?.DEV || false;
  }

  /**
   * Check if running in production mode
   */
  static isProduction(): boolean {
    return (import.meta as any).env?.PROD || false;
  }

  /**
   * Get environment variable
   */
  static getEnvVar(key: string, defaultValue?: string): string | undefined {
    return (import.meta as any).env?.[key] || defaultValue;
  }

  /**
   * Get application version
   */
  static getVersion(): string {
    return (import.meta as any).env?.PACKAGE_VERSION || '1.0.0';
  }

  /**
   * Get build timestamp
   */
  static getBuildTime(): string {
    return (import.meta as any).env?.BUILD_TIME || new Date().toISOString();
  }
}

/**
 * Model cache manager for OpenRouter models
 */
export class ModelCacheManager {
  private static instance: ModelCacheManager;
  private static readonly CACHE_KEY = 'openrouter_models_cache';
  private static readonly CACHE_DURATION = 1000 * 60 * 60; // 1 hour

  private constructor() { }

  static getInstance(): ModelCacheManager {
    if (!ModelCacheManager.instance) {
      ModelCacheManager.instance = new ModelCacheManager();
    }
    return ModelCacheManager.instance;
  }

  /**
   * Get cached models if they exist and are not expired
   */
  getCachedModels(): ModelInfo[] | null {
    try {
      const cached = localStorage.getItem(ModelCacheManager.CACHE_KEY);
      if (!cached) return null;

      const { models, timestamp } = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is expired
      if (now - timestamp > ModelCacheManager.CACHE_DURATION) {
        this.clearCache();
        return null;
      }

      return models;
    } catch (error) {
      console.warn('Failed to read model cache:', error);
      this.clearCache();
      return null;
    }
  }

  /**
   * Cache models with timestamp
   */
  cacheModels(models: ModelInfo[]): void {
    try {
      const cacheData = {
        models,
        timestamp: Date.now()
      };
      localStorage.setItem(ModelCacheManager.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache models:', error);
    }
  }

  /**
   * Clear the model cache
   */
  clearCache(): void {
    localStorage.removeItem(ModelCacheManager.CACHE_KEY);
  }

  /**
   * Check if cache exists and is valid
   */
  isCacheValid(): boolean {
    return this.getCachedModels() !== null;
  }

  /**
   * Get cache age in milliseconds
   */
  getCacheAge(): number | null {
    try {
      const cached = localStorage.getItem(ModelCacheManager.CACHE_KEY);
      if (!cached) return null;

      const { timestamp } = JSON.parse(cached);
      return Date.now() - timestamp;
    } catch (error) {
      return null;
    }
  }
}

/**
 * Feature flags for experimental functionality
 */
export class FeatureFlags {
  private static flags: Record<string, boolean> = {
    STREAMING_ENABLED: true,
    VOICE_INPUT: false,
    ADVANCED_SEARCH: true,
    CONVERSATION_EXPORT: true,
    DARK_MODE: true,
    MOBILE_OPTIMIZATIONS: true,
    ACCESSIBILITY_FEATURES: true,
    PERFORMANCE_MONITORING: false,
    DEBUG_MODE: EnvironmentConfig.isDevelopment()
  };

  /**
   * Check if a feature is enabled
   */
  static isEnabled(feature: string): boolean {
    return this.flags[feature] ?? false;
  }

  /**
   * Enable a feature
   */
  static enable(feature: string): void {
    this.flags[feature] = true;
  }

  /**
   * Disable a feature
   */
  static disable(feature: string): void {
    this.flags[feature] = false;
  }

  /**
   * Get all feature flags
   */
  static getAll(): Record<string, boolean> {
    return { ...this.flags };
  }

  /**
   * Set multiple feature flags
   */
  static setFlags(flags: Record<string, boolean>): void {
    this.flags = { ...this.flags, ...flags };
  }
}