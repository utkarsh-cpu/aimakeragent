/**
 * Settings management utilities
 */

import { ChatSettings, DEFAULT_CHAT_SETTINGS } from '../types/settings';
import { ErrorHandler } from './error-handler';

export interface SettingsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fixedSettings?: ChatSettings;
}

export class SettingsManager {
  private static readonly SETTINGS_KEY = 'chat_settings';
  private static readonly SETTINGS_VERSION = '1.0.0';

  /**
   * Get current settings from storage
   */
  static getSettings(): ChatSettings {
    try {
      const stored = localStorage.getItem(this.SETTINGS_KEY);
      if (!stored) {
        return { ...DEFAULT_CHAT_SETTINGS };
      }

      const parsed = JSON.parse(stored);

      // Merge with defaults to ensure all properties exist
      return {
        ...DEFAULT_CHAT_SETTINGS,
        ...parsed,
        openRouter: {
          ...DEFAULT_CHAT_SETTINGS.openRouter,
          ...parsed.openRouter,
        },
      };
    } catch (error) {
      console.error('Settings persistence error: Failed to load settings:', error);
      return { ...DEFAULT_CHAT_SETTINGS };
    }
  }

  /**
   * Save settings to storage
   */
  static saveSettings(settings: ChatSettings): void {
    try {
      const validation = this.validateSettings(settings);
      const settingsToSave = validation.fixedSettings || settings;

      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settingsToSave));
    } catch (error) {
      const handledError = ErrorHandler.handle(error, { operation: 'save_settings' });
      throw new Error(handledError.userMessage);
    }
  }

  /**
   * Reset settings to defaults
   */
  static resetSettings(): void {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(DEFAULT_CHAT_SETTINGS));
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  }

  /**
   * Update specific setting
   */
  static updateSetting<K extends keyof ChatSettings>(
    key: K,
    value: ChatSettings[K]
  ): void {
    const currentSettings = this.getSettings();
    const updatedSettings = {
      ...currentSettings,
      [key]: value,
    };
    this.saveSettings(updatedSettings);
  }

  /**
   * Update nested setting (like openRouter.apiKey)
   */
  static updateNestedSetting<T extends keyof ChatSettings>(
    parentKey: T,
    childKey: keyof ChatSettings[T],
    value: any
  ): void {
    const currentSettings = this.getSettings();
    const updatedSettings = {
      ...currentSettings,
      [parentKey]: {
        ...(currentSettings[parentKey] as any),
        [childKey]: value,
      },
    };
    this.saveSettings(updatedSettings);
  }

  /**
   * Validate settings
   */
  static validateSettings(settings: ChatSettings): SettingsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fixedSettings = { ...settings };

    // Validate theme
    const validThemes = ['light', 'dark', 'system'];
    if (!validThemes.includes(settings.theme)) {
      warnings.push(`Invalid theme: ${settings.theme}`);
      fixedSettings.theme = 'system';
    }

    // Validate model
    if (!settings.model || typeof settings.model !== 'string') {
      warnings.push('Invalid model setting');
      fixedSettings.model = DEFAULT_CHAT_SETTINGS.model;
    }

    // Validate numeric settings
    const numericValidations = [
      { key: 'temperature', min: 0, max: 2, default: 0.7 },
      { key: 'maxTokens', min: 1, max: 100000, default: 1000 },
      { key: 'topP', min: 0, max: 1, default: 1 },
      { key: 'frequencyPenalty', min: -2, max: 2, default: 0 },
      { key: 'presencePenalty', min: -2, max: 2, default: 0 },
      { key: 'fontSize', min: 10, max: 24, default: 14 },
      { key: 'sidebarWidth', min: 200, max: 600, default: 300 },
      { key: 'messageSpacing', min: 4, max: 32, default: 16 },
      { key: 'conversationHistory', min: 5, max: 200, default: 50 },
    ];

    for (const validation of numericValidations) {
      const value = (settings as any)[validation.key];
      if (
        typeof value !== 'number' ||
        isNaN(value) ||
        value < validation.min ||
        value > validation.max
      ) {
        warnings.push(`Invalid ${validation.key}: ${value}`);
        (fixedSettings as any)[validation.key] = validation.default;
      }
    }

    // Validate boolean settings
    const booleanKeys = [
      'streamingEnabled',
      'autoSave',
      'soundEnabled',
      'notificationsEnabled',
      'autoTitle',
      'debugMode',
      'experimentalFeatures',
    ];

    for (const key of booleanKeys) {
      const value = (settings as any)[key];
      if (typeof value !== 'boolean') {
        warnings.push(`Invalid ${key}: ${value}`);
        (fixedSettings as any)[key] = (DEFAULT_CHAT_SETTINGS as any)[key];
      }
    }

    // Validate OpenRouter config
    if (!settings.openRouter || typeof settings.openRouter !== 'object') {
      warnings.push('Invalid OpenRouter configuration');
      fixedSettings.openRouter = { ...DEFAULT_CHAT_SETTINGS.openRouter };
    } else {
      const openRouterConfig = { ...settings.openRouter };

      if (typeof openRouterConfig.apiKey !== 'string') {
        openRouterConfig.apiKey = '';
      }

      if (typeof openRouterConfig.baseUrl !== 'string' || !openRouterConfig.baseUrl) {
        openRouterConfig.baseUrl = DEFAULT_CHAT_SETTINGS.openRouter.baseUrl;
      }

      if (typeof openRouterConfig.defaultModel !== 'string' || !openRouterConfig.defaultModel) {
        openRouterConfig.defaultModel = DEFAULT_CHAT_SETTINGS.openRouter.defaultModel;
      }

      if (typeof openRouterConfig.timeout !== 'number' || openRouterConfig.timeout < 1000) {
        openRouterConfig.timeout = DEFAULT_CHAT_SETTINGS.openRouter.timeout;
      }

      if (typeof openRouterConfig.retryAttempts !== 'number' || openRouterConfig.retryAttempts < 0) {
        openRouterConfig.retryAttempts = DEFAULT_CHAT_SETTINGS.openRouter.retryAttempts;
      }

      if (typeof openRouterConfig.streamingEnabled !== 'boolean') {
        openRouterConfig.streamingEnabled = DEFAULT_CHAT_SETTINGS.openRouter.streamingEnabled;
      }

      fixedSettings.openRouter = openRouterConfig;
    }

    // Validate system prompt
    if (typeof settings.systemPrompt !== 'string') {
      warnings.push('Invalid system prompt');
      fixedSettings.systemPrompt = DEFAULT_CHAT_SETTINGS.systemPrompt;
    }

    // Validate language
    if (typeof settings.language !== 'string') {
      warnings.push('Invalid language setting');
      fixedSettings.language = DEFAULT_CHAT_SETTINGS.language;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fixedSettings: warnings.length > 0 ? fixedSettings : undefined,
    };
  }

  /**
   * Export settings to JSON
   */
  static exportSettings(): string {
    const settings = this.getSettings();
    const exportData = {
      settings,
      version: this.SETTINGS_VERSION,
      timestamp: new Date().toISOString(),
      metadata: {
        userAgent: navigator.userAgent,
        appVersion: '1.0.0',
        exportReason: 'user_export',
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import settings from JSON
   */
  static importSettings(jsonData: string): boolean {
    try {
      const importData = JSON.parse(jsonData);

      if (!importData.settings) {
        throw new Error('Invalid settings format');
      }

      const validation = this.validateSettings(importData.settings);
      const settingsToImport = validation.fixedSettings || importData.settings;

      this.saveSettings(settingsToImport);
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }

  /**
   * Get settings backup
   */
  static createSettingsBackup(): string {
    const settings = this.getSettings();
    const backupId = `settings_backup_${Date.now()}`;

    try {
      localStorage.setItem(backupId, JSON.stringify({
        settings,
        timestamp: new Date().toISOString(),
        version: this.SETTINGS_VERSION,
      }));

      return backupId;
    } catch (error) {
      throw new Error('Failed to create settings backup');
    }
  }

  /**
   * Restore settings from backup
   */
  static restoreSettingsBackup(backupId: string): boolean {
    try {
      const backupData = localStorage.getItem(backupId);
      if (!backupData) return false;

      const backup = JSON.parse(backupData);
      if (backup.settings) {
        this.saveSettings(backup.settings);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to restore settings backup:', error);
      return false;
    }
  }

  /**
   * Check if settings need migration
   */
  static needsMigration(): boolean {
    try {
      const stored = localStorage.getItem(this.SETTINGS_KEY);
      if (!stored) return false;

      const parsed = JSON.parse(stored);
      return !parsed.version || parsed.version !== this.SETTINGS_VERSION;
    } catch {
      return true;
    }
  }

  /**
   * Migrate settings to current version
   */
  static migrateSettings(): void {
    try {
      const currentSettings = this.getSettings();
      const validation = this.validateSettings(currentSettings);

      if (validation.fixedSettings) {
        this.saveSettings(validation.fixedSettings);
      }
    } catch (error) {
      console.error('Settings migration failed:', error);
      this.resetSettings();
    }
  }

  /**
   * Load settings (alias for getSettings)
   */
  static load(): ChatSettings {
    return this.getSettings();
  }

  /**
   * Save settings (alias for saveSettings)
   */
  static save(settings: ChatSettings): void {
    this.saveSettings(settings);
  }

  /**
   * Reset settings to defaults
   */
  static reset(): ChatSettings {
    const defaultSettings = { ...DEFAULT_CHAT_SETTINGS };
    this.saveSettings(defaultSettings);
    return defaultSettings;
  }

  /**
   * Export settings to file
   */
  static export(settings: ChatSettings, reason?: string): void {
    try {
      const exportData = {
        version: this.SETTINGS_VERSION,
        timestamp: new Date().toISOString(),
        reason: reason || 'Manual export',
        settings: settings
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export settings:', error);
      throw new Error('Failed to export settings');
    }
  }

  /**
   * Import settings from file
   */
  static async import(file: File): Promise<ChatSettings> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate import data structure
      if (!data.settings) {
        throw new Error('Invalid settings file format');
      }

      // Merge with defaults to ensure all properties exist
      const importedSettings: ChatSettings = {
        ...DEFAULT_CHAT_SETTINGS,
        ...data.settings,
        openRouter: {
          ...DEFAULT_CHAT_SETTINGS.openRouter,
          ...data.settings.openRouter,
        },
      };

      return importedSettings;
    } catch (error) {
      console.error('Failed to import settings:', error);
      throw new Error('Failed to import settings: ' + (error as Error).message);
    }
  }

  /**
   * Create backup of current settings
   */
  static backup(settings: ChatSettings): void {
    try {
      const backupKey = `${this.SETTINGS_KEY}_backup_${Date.now()}`;
      const backupData = {
        timestamp: new Date().toISOString(),
        settings: settings
      };

      localStorage.setItem(backupKey, JSON.stringify(backupData));

      // Keep only last 5 backups
      this.cleanupBackups();
    } catch (error) {
      console.error('Failed to create settings backup:', error);
    }
  }

  /**
   * Clean up old backups
   */
  private static cleanupBackups(): void {
    try {
      const backupKeys: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.SETTINGS_KEY}_backup_`)) {
          backupKeys.push(key);
        }
      }

      // Sort by timestamp (newest first)
      backupKeys.sort((a, b) => {
        const timestampA = parseInt(a.split('_').pop() || '0');
        const timestampB = parseInt(b.split('_').pop() || '0');
        return timestampB - timestampA;
      });

      // Remove old backups (keep only 5 most recent)
      for (let i = 5; i < backupKeys.length; i++) {
        localStorage.removeItem(backupKeys[i]);
      }
    } catch (error) {
      console.error('Failed to cleanup backups:', error);
    }
  }
}

/**
 * Settings validation utilities
 */
export class SettingsValidator {
  /**
   * Validate settings object
   */
  static validate(settings: any): SettingsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!settings || typeof settings !== 'object') {
      return {
        isValid: false,
        errors: ['Settings must be an object'],
        warnings: []
      };
    }

    // Validate theme
    if (settings.theme && !['light', 'dark', 'system'].includes(settings.theme)) {
      errors.push('Theme must be "light", "dark", or "system"');
    }

    // Validate model
    if (settings.model && typeof settings.model !== 'string') {
      errors.push('Model must be a string');
    }

    // Validate temperature
    if (settings.temperature !== undefined) {
      if (typeof settings.temperature !== 'number' || settings.temperature < 0 || settings.temperature > 2) {
        errors.push('Temperature must be a number between 0 and 2');
      }
    }

    // Validate max tokens
    if (settings.maxTokens !== undefined) {
      if (typeof settings.maxTokens !== 'number' || settings.maxTokens < 1 || settings.maxTokens > 32000) {
        errors.push('Max tokens must be a number between 1 and 32000');
      }
    }

    // Validate OpenRouter config
    if (settings.openRouter) {
      if (typeof settings.openRouter !== 'object') {
        errors.push('OpenRouter config must be an object');
      } else {
        if (settings.openRouter.apiKey && typeof settings.openRouter.apiKey !== 'string') {
          errors.push('OpenRouter API key must be a string');
        }
        if (settings.openRouter.baseUrl && typeof settings.openRouter.baseUrl !== 'string') {
          errors.push('OpenRouter base URL must be a string');
        }
        if (settings.openRouter.timeout !== undefined) {
          if (typeof settings.openRouter.timeout !== 'number' || settings.openRouter.timeout < 1000) {
            errors.push('OpenRouter timeout must be a number >= 1000');
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Fix common settings issues
   */
  static fix(settings: any): ChatSettings {
    const fixed: ChatSettings = { ...DEFAULT_CHAT_SETTINGS };

    if (settings && typeof settings === 'object') {
      // Fix theme
      if (['light', 'dark', 'system'].includes(settings.theme)) {
        fixed.theme = settings.theme;
      }

      // Fix model
      if (typeof settings.model === 'string') {
        fixed.model = settings.model;
      }

      // Fix temperature
      if (typeof settings.temperature === 'number' && settings.temperature >= 0 && settings.temperature <= 2) {
        fixed.temperature = settings.temperature;
      }

      // Fix max tokens
      if (typeof settings.maxTokens === 'number' && settings.maxTokens >= 1 && settings.maxTokens <= 32000) {
        fixed.maxTokens = settings.maxTokens;
      }

      // Fix OpenRouter config
      if (settings.openRouter && typeof settings.openRouter === 'object') {
        fixed.openRouter = {
          ...DEFAULT_CHAT_SETTINGS.openRouter,
          ...settings.openRouter
        };
      }
    }

    return fixed;
  }
}

/**
 * Settings migration utilities
 */
export class SettingsMigrator {
  /**
   * Migrate settings from older versions
   */
  static migrate(settings: any, fromVersion: string, toVersion: string): ChatSettings {
    // For now, just return fixed settings
    // In the future, add version-specific migration logic
    return SettingsValidator.fix(settings);
  }

  /**
   * Check if migration is needed
   */
  static needsMigration(settings: any): boolean {
    // Simple check - if settings don't have version or have old version
    return !settings?.version || settings.version !== SettingsManager['SETTINGS_VERSION'];
  }
}