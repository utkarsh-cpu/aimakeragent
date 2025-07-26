/**
 * Settings management utilities for validation, migration, and persistence
 */

import {
  ChatSettings,
  DEFAULT_CHAT_SETTINGS,
  SettingsValidationResult,
  SettingsMigration,
  SettingsBackup,
  SETTINGS_METADATA
} from '../types/settings';

/**
 * Custom error types for better error handling
 */
export class SettingsValidationError extends Error {
  constructor(public errors: string[], public warnings: string[] = []) {
    super(`Settings validation failed: ${errors.join(', ')}`);
    this.name = 'SettingsValidationError';
  }
}

export class SettingsMigrationError extends Error {
  constructor(message: string, public fromVersion?: string, public toVersion?: string) {
    super(message);
    this.name = 'SettingsMigrationError';
  }
}

export class SettingsPersistenceError extends Error {
  constructor(message: string, public operation: 'load' | 'save' | 'backup' | 'restore') {
    super(message);
    this.name = 'SettingsPersistenceError';
  }
}



/**
 * Current settings version for migration tracking
 */
export const CURRENT_SETTINGS_VERSION = '1.0.0';

/**
 * Validation rule interface for better extensibility
 */
interface ValidationRule<T = any> {
  field: string;
  validate: (value: T) => string | null;
  isWarning?: boolean;
}

/**
 * Settings validation utilities using Strategy pattern
 */
export class SettingsValidator {
  private static readonly validationRules: ValidationRule[] = [
    // Model settings
    {
      field: 'temperature',
      validate: (value: number) => 
        (value < 0 || value > 1) ? 'Temperature must be between 0 and 1' : null
    },
    {
      field: 'maxTokens',
      validate: (value: number) => 
        (value < 1 || value > 10000) ? 'Max tokens must be between 1 and 10000' : null
    },
    {
      field: 'topP',
      validate: (value: number) => 
        (value < 0 || value > 1) ? 'Top P must be between 0 and 1' : null
    },
    {
      field: 'frequencyPenalty',
      validate: (value: number) => 
        (value < -2 || value > 2) ? 'Frequency penalty must be between -2 and 2' : null
    },
    {
      field: 'presencePenalty',
      validate: (value: number) => 
        (value < -2 || value > 2) ? 'Presence penalty must be between -2 and 2' : null
    },
    // UI settings
    {
      field: 'fontSize',
      validate: (value: number) => 
        (value < 8 || value > 24) ? 'Font size must be between 8 and 24' : null
    },
    {
      field: 'sidebarWidth',
      validate: (value: number) => 
        (value < 150 || value > 600) ? 'Sidebar width must be between 150 and 600' : null
    },
    {
      field: 'messageSpacing',
      validate: (value: number) => 
        (value < 4 || value > 48) ? 'Message spacing must be between 4 and 48' : null
    },
    // System settings
    {
      field: 'conversationHistory',
      validate: (value: number) => 
        (value < 1 || value > 200) ? 'Conversation history must be between 1 and 200' : null
    },
    {
      field: 'systemPrompt',
      validate: (value: string) => 
        value.length > 2000 ? 'System prompt is very long and may affect performance' : null,
      isWarning: true
    },
    {
      field: 'theme',
      validate: (value: string) => 
        !['light', 'dark', 'system'].includes(value) ? 'Theme must be light, dark, or system' : null
    },
    {
      field: 'language',
      validate: (value: string) => {
        const validLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'];
        return !validLanguages.includes(value) ? 'Invalid language selection' : null;
      }
    }
  ];

  /**
   * Validate complete settings object using rule-based approach
   */
  static validate(settings: Partial<ChatSettings>): SettingsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate API configuration
    if (settings.openRouter) {
      const apiValidation = this.validateApiConfig(settings.openRouter);
      errors.push(...apiValidation.errors);
      warnings.push(...apiValidation.warnings);
    }

    // Apply validation rules
    for (const rule of this.validationRules) {
      const value = (settings as any)[rule.field];
      if (value !== undefined) {
        const error = rule.validate(value);
        if (error) {
          if (rule.isWarning) {
            warnings.push(error);
          } else {
            errors.push(error);
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
   * Validate API configuration
   */
  private static validateApiConfig(config: any): SettingsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.apiKey && typeof config.apiKey !== 'string') {
      errors.push('API key must be a string');
    } else if (config.apiKey && !config.apiKey.startsWith('sk-or-') && !config.apiKey.startsWith('sk-')) {
      errors.push('Invalid API key format');
    }

    if (config.baseUrl && typeof config.baseUrl !== 'string') {
      errors.push('Base URL must be a string');
    }

    if (config.timeout !== undefined) {
      if (typeof config.timeout !== 'number' || config.timeout < 1000 || config.timeout > 120000) {
        errors.push('Timeout must be between 1000 and 120000 milliseconds');
      }
    }

    if (config.retryAttempts !== undefined) {
      if (typeof config.retryAttempts !== 'number' || config.retryAttempts < 0 || config.retryAttempts > 10) {
        errors.push('Retry attempts must be between 0 and 10');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate individual setting field
   */
  static validateField(key: keyof ChatSettings, value: any): string | null {
    const metadata = SETTINGS_METADATA.find(m => m.key === key);
    if (!metadata) return null;

    if (metadata.validation) {
      return metadata.validation(value);
    }

    // Default validation based on type
    switch (metadata.type) {
      case 'number':
      case 'slider':
        if (typeof value !== 'number') return 'Must be a number';
        if (metadata.min !== undefined && value < metadata.min) {
          return `Must be at least ${metadata.min}`;
        }
        if (metadata.max !== undefined && value > metadata.max) {
          return `Must be at most ${metadata.max}`;
        }
        break;

      case 'string':
      case 'textarea':
        if (typeof value !== 'string') return 'Must be a string';
        break;

      case 'boolean':
        if (typeof value !== 'boolean') return 'Must be true or false';
        break;

      case 'select':
        if (metadata.options) {
          const validValues = metadata.options.map(o => o.value);
          if (!validValues.includes(value)) {
            return `Must be one of: ${validValues.join(', ')}`;
          }
        }
        break;
    }

    return null;
  }
}

/**
 * Settings migration utilities
 */
export class SettingsMigrator {
  private static migrations: SettingsMigration[] = [
    // Example migration from legacy format
    {
      fromVersion: '0.9.0',
      toVersion: '1.0.0',
      migrationFunction: (oldSettings: any): ChatSettings => {
        return {
          ...DEFAULT_CHAT_SETTINGS,
          // Map old settings to new structure
          model: oldSettings.model || DEFAULT_CHAT_SETTINGS.model,
          temperature: oldSettings.temperature || DEFAULT_CHAT_SETTINGS.temperature,
          systemPrompt: oldSettings.systemPrompt || DEFAULT_CHAT_SETTINGS.systemPrompt,
          theme: oldSettings.theme || DEFAULT_CHAT_SETTINGS.theme,
          fontSize: oldSettings.fontSize || DEFAULT_CHAT_SETTINGS.fontSize,
          language: oldSettings.language || DEFAULT_CHAT_SETTINGS.language,
          streamingEnabled: oldSettings.streamingEnabled ?? DEFAULT_CHAT_SETTINGS.streamingEnabled,
          maxTokens: oldSettings.maxTokens || DEFAULT_CHAT_SETTINGS.maxTokens,
          openRouter: {
            ...DEFAULT_CHAT_SETTINGS.openRouter,
            apiKey: oldSettings.apiKey || ''
          }
        };
      }
    }
  ];

  /**
   * Migrate settings from old version to current
   */
  static migrate(settings: any, fromVersion?: string): ChatSettings {
    if (!fromVersion) {
      // Try to detect version or assume legacy
      fromVersion = this.detectVersion(settings);
    }

    let currentSettings = settings;
    let currentVersion = fromVersion;

    // Apply migrations in sequence
    for (const migration of this.migrations) {
      if (currentVersion === migration.fromVersion) {
        currentSettings = migration.migrationFunction(currentSettings);
        currentVersion = migration.toVersion;
      }
    }

    // Ensure all required fields are present
    return SettingsMigrator.ensureComplete(currentSettings);
  }

  /**
   * Detect settings version from structure
   */
  private static detectVersion(settings: any): string {
    // Check for new structure
    if (settings.openRouter && typeof settings.openRouter === 'object') {
      return '1.0.0';
    }

    // Check for legacy structure
    if (settings.apiKey && typeof settings.apiKey === 'string') {
      return '0.9.0';
    }

    // Default to current version if structure is unknown
    return CURRENT_SETTINGS_VERSION;
  }

  /**
   * Ensure settings object has all required fields
   */
  static ensureComplete(settings: Partial<ChatSettings>): ChatSettings {
    return {
      ...DEFAULT_CHAT_SETTINGS,
      ...settings,
      openRouter: {
        ...DEFAULT_CHAT_SETTINGS.openRouter,
        ...settings.openRouter
      }
    };
  }
}

/**
 * Settings storage abstraction
 */
class SettingsStorage {
  private static readonly STORAGE_KEY = 'chat_settings';
  private static readonly VERSION_KEY = 'settings_version';

  static load(): { settings: any; version: string | null } {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const version = localStorage.getItem(this.VERSION_KEY);
      
      return {
        settings: stored ? JSON.parse(stored) : null,
        version
      };
    } catch (error) {
      throw new SettingsPersistenceError(
        `Failed to load settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'load'
      );
    }
  }

  static save(settings: ChatSettings, version: string): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
      localStorage.setItem(this.VERSION_KEY, version);
    } catch (error) {
      throw new SettingsPersistenceError(
        `Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'save'
      );
    }
  }
}

/**
 * Settings persistence manager
 */
export class SettingsManager {
  private static readonly BACKUP_PREFIX = 'settings_backup_';

  /**
   * Load settings from storage
   */
  static load(): ChatSettings {
    try {
      const { settings: stored, version } = SettingsStorage.load();

      if (!stored) {
        return DEFAULT_CHAT_SETTINGS;
      }

      // Migrate if necessary
      if (version !== CURRENT_SETTINGS_VERSION) {
        const migrated = SettingsMigrator.migrate(stored, version || undefined);
        this.save(migrated); // Save migrated settings
        return migrated;
      }

      // Validate loaded settings
      const validation = SettingsValidator.validate(stored);
      if (!validation.isValid) {
        console.warn('Invalid settings loaded, using defaults:', validation.errors);
        return DEFAULT_CHAT_SETTINGS;
      }

      return SettingsMigrator.ensureComplete(stored);
    } catch (error) {
      if (error instanceof SettingsPersistenceError) {
        console.error('Settings persistence error:', error.message);
      } else {
        console.error('Unexpected error loading settings:', error);
      }
      return DEFAULT_CHAT_SETTINGS;
    }
  }

  /**
   * Save settings to storage
   */
  static save(settings: ChatSettings): void {
    try {
      // Validate before saving
      const validation = SettingsValidator.validate(settings);
      if (!validation.isValid) {
        throw new SettingsValidationError(validation.errors, validation.warnings);
      }

      SettingsStorage.save(settings, CURRENT_SETTINGS_VERSION);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * Reset settings to defaults
   */
  static reset(): ChatSettings {
    const defaults = { ...DEFAULT_CHAT_SETTINGS };
    this.save(defaults);
    return defaults;
  }

  /**
   * Export settings to JSON file
   */
  static export(settings: ChatSettings, reason?: string): void {
    const backup: SettingsBackup = {
      version: CURRENT_SETTINGS_VERSION,
      timestamp: new Date(),
      settings,
      metadata: {
        userAgent: navigator.userAgent,
        appVersion: CURRENT_SETTINGS_VERSION,
        exportReason: reason
      }
    };

    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `chat-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /**
   * Import settings from JSON file
   */
  static async import(file: File): Promise<ChatSettings> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const imported = JSON.parse(content);

          let settings: ChatSettings;

          // Check if it's a backup format
          if (imported.version && imported.settings) {
            settings = imported.settings;
          } else {
            // Assume it's raw settings
            settings = imported;
          }

          // Migrate if necessary
          const migrated = SettingsMigrator.migrate(settings);

          // Validate
          const validation = SettingsValidator.validate(migrated);
          if (!validation.isValid) {
            reject(new Error(`Invalid settings file: ${validation.errors.join(', ')}`));
            return;
          }

          resolve(migrated);
        } catch (error) {
          reject(new Error('Failed to parse settings file'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read settings file'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Create backup of current settings
   */
  static backup(settings: ChatSettings): void {
    const timestamp = new Date().toISOString();
    const backupKey = `${this.BACKUP_PREFIX}${timestamp}`;

    try {
      localStorage.setItem(backupKey, JSON.stringify({
        timestamp,
        settings,
        version: CURRENT_SETTINGS_VERSION
      }));

      // Clean up old backups (keep only last 5)
      this.cleanupBackups();
    } catch (error) {
      console.warn('Failed to create settings backup:', error);
    }
  }

  /**
   * Restore settings from backup
   */
  static restore(timestamp: string): ChatSettings | null {
    try {
      const backupKey = `${this.BACKUP_PREFIX}${timestamp}`;
      const backup = localStorage.getItem(backupKey);

      if (!backup) return null;

      const parsed = JSON.parse(backup);
      return SettingsMigrator.migrate(parsed.settings, parsed.version);
    } catch (error) {
      console.error('Failed to restore settings backup:', error);
      return null;
    }
  }

  /**
   * List available backups
   */
  static listBackups(): Array<{ timestamp: string; date: Date }> {
    const backups: Array<{ timestamp: string; date: Date }> = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.BACKUP_PREFIX)) {
        const timestamp = key.replace(this.BACKUP_PREFIX, '');
        backups.push({
          timestamp,
          date: new Date(timestamp)
        });
      }
    }

    return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /**
   * Clean up old backups
   */
  private static cleanupBackups(): void {
    const backups = this.listBackups();

    // Keep only the 5 most recent backups
    if (backups.length > 5) {
      const toDelete = backups.slice(5);
      toDelete.forEach(backup => {
        localStorage.removeItem(`${this.BACKUP_PREFIX}${backup.timestamp}`);
      });
    }
  }
}