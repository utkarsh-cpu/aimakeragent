/**
 * Data validation and recovery system
 * Handles conversation data validation, backup, and recovery
 */

import { Conversation, Message, MessageEdit } from '../types/conversation';
import { ChatSettings } from '../types/settings';
import { ErrorHandler, ErrorType, ErrorSeverity } from './error-handler';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  fixedData?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  fixable: boolean;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface BackupData {
  conversations: Conversation[];
  settings: ChatSettings;
  timestamp: Date;
  version: string;
  checksum: string;
}

export interface RecoveryOptions {
  validateData: boolean;
  fixCorruption: boolean;
  createBackup: boolean;
  mergeStrategy: 'replace' | 'merge' | 'keep-both';
}

export class DataValidator {
  private static readonly CURRENT_VERSION = '1.0.0';
  private static readonly MAX_MESSAGE_LENGTH = 100000;
  private static readonly MAX_CONVERSATION_MESSAGES = 10000;

  /**
   * Validate a conversation object
   */
  static validateConversation(conversation: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let fixedData: Partial<Conversation> | null = null;

    // Check if conversation exists
    if (!conversation) {
      return {
        isValid: false,
        errors: [{ field: 'conversation', message: 'Conversation is null or undefined', severity: 'error', fixable: false }],
        warnings: []
      };
    }

    // Validate required fields
    if (!conversation.id || typeof conversation.id !== 'string') {
      errors.push({
        field: 'id',
        message: 'Conversation ID is missing or invalid',
        severity: 'error',
        fixable: true
      });

      if (!fixedData) fixedData = { ...conversation };
      fixedData!.id = this.generateId();
    }

    if (!conversation.title || typeof conversation.title !== 'string') {
      errors.push({
        field: 'title',
        message: 'Conversation title is missing or invalid',
        severity: 'error',
        fixable: true
      });

      if (!fixedData) fixedData = { ...conversation };
      fixedData!.title = 'Untitled Conversation';
    }

    // Validate messages array
    if (!Array.isArray(conversation.messages)) {
      errors.push({
        field: 'messages',
        message: 'Messages must be an array',
        severity: 'error',
        fixable: true
      });

      if (!fixedData) fixedData = { ...conversation };
      fixedData!.messages = [];
    } else {
      // Validate individual messages
      const validMessages: Message[] = [];

      for (let i = 0; i < conversation.messages.length; i++) {
        const messageResult = this.validateMessage(conversation.messages[i], i);

        if (messageResult.isValid) {
          validMessages.push(messageResult.fixedData || conversation.messages[i]);
        } else {
          errors.push(...messageResult.errors);
          warnings.push(...messageResult.warnings);

          if (messageResult.fixedData) {
            validMessages.push(messageResult.fixedData);
          }
        }
      }

      if (validMessages.length !== conversation.messages.length) {
        if (!fixedData) fixedData = { ...conversation };
        fixedData!.messages = validMessages;
      }

      // Check message count
      if (conversation.messages.length > this.MAX_CONVERSATION_MESSAGES) {
        warnings.push({
          field: 'messages',
          message: `Conversation has ${conversation.messages.length} messages, which exceeds recommended limit of ${this.MAX_CONVERSATION_MESSAGES}`,
          suggestion: 'Consider archiving older messages'
        });
      }
    }

    // Validate lastMessage timestamp
    if (!conversation.lastMessage || !(conversation.lastMessage instanceof Date)) {
      warnings.push({
        field: 'lastMessage',
        message: 'Last message date is missing or invalid',
        suggestion: 'Will be set to current date'
      });

      if (!fixedData) fixedData = { ...conversation };
      fixedData!.lastMessage = new Date();
    }



    // Validate metadata
    if (!conversation.metadata || typeof conversation.metadata !== 'object') {
      warnings.push({
        field: 'metadata',
        message: 'Metadata is missing or invalid',
        suggestion: 'Default metadata will be applied'
      });

      if (!fixedData) fixedData = { ...conversation };
      fixedData!.metadata = {
        messageCount: fixedData!.messages?.length || 0,
        tokenCount: 0,
        isFavorite: false,
        isArchived: false,
        tags: [],
        autoTitleGenerated: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date()
      };
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fixedData: fixedData || undefined
    };
  }

  /**
   * Validate a message object
   */
  static validateMessage(message: any, index?: number): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let fixedData: Partial<Message> | null = null;
    const fieldPrefix = index !== undefined ? `messages[${index}]` : 'message';

    if (!message) {
      return {
        isValid: false,
        errors: [{ field: fieldPrefix, message: 'Message is null or undefined', severity: 'error', fixable: false }],
        warnings: []
      };
    }

    // Validate required fields
    if (!message.id || typeof message.id !== 'string') {
      errors.push({
        field: `${fieldPrefix}.id`,
        message: 'Message ID is missing or invalid',
        severity: 'error',
        fixable: true
      });

      if (!fixedData) fixedData = { ...message };
      fixedData!.id = this.generateId();
    }

    if (!message.content || typeof message.content !== 'string') {
      errors.push({
        field: `${fieldPrefix}.content`,
        message: 'Message content is missing or invalid',
        severity: 'error',
        fixable: true
      });

      if (!fixedData) fixedData = { ...message };
      fixedData!.content = '';
    } else if (message.content.length > this.MAX_MESSAGE_LENGTH) {
      warnings.push({
        field: `${fieldPrefix}.content`,
        message: `Message content exceeds maximum length of ${this.MAX_MESSAGE_LENGTH} characters`,
        suggestion: 'Content will be truncated'
      });

      if (!fixedData) fixedData = { ...message };
      fixedData!.content = message.content.substring(0, this.MAX_MESSAGE_LENGTH - 15) + '... [truncated]';
    }

    // Validate role
    const validRoles = ['user', 'assistant', 'system'];
    if (!message.role || !validRoles.includes(message.role)) {
      errors.push({
        field: `${fieldPrefix}.role`,
        message: `Message role must be one of: ${validRoles.join(', ')}`,
        severity: 'error',
        fixable: true
      });

      if (!fixedData) fixedData = { ...message };
      fixedData!.role = 'user';
    }

    // Validate timestamp
    if (!message.timestamp || !(message.timestamp instanceof Date)) {
      errors.push({
        field: `${fieldPrefix}.timestamp`,
        message: 'Message timestamp is missing or invalid',
        severity: 'error',
        fixable: true
      });

      if (!fixedData) fixedData = { ...message };
      fixedData!.timestamp = new Date();
    }

    // Validate optional fields
    if (message.editHistory && !Array.isArray(message.editHistory)) {
      warnings.push({
        field: `${fieldPrefix}.editHistory`,
        message: 'Edit history must be an array',
        suggestion: 'Edit history will be reset'
      });

      if (!fixedData) fixedData = { ...message };
      fixedData!.editHistory = [];
    }

    if (message.tokens && (typeof message.tokens !== 'number' || message.tokens < 0)) {
      warnings.push({
        field: `${fieldPrefix}.tokens`,
        message: 'Token count must be a positive number',
        suggestion: 'Token count will be reset'
      });

      if (!fixedData) fixedData = { ...message };
      fixedData!.tokens = undefined;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fixedData: fixedData || undefined
    };
  }

  /**
   * Validate settings object
   */
  static validateSettings(settings: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let fixedData: Partial<ChatSettings> | null = null;

    if (!settings || typeof settings !== 'object') {
      return {
        isValid: false,
        errors: [{ field: 'settings', message: 'Settings object is missing or invalid', severity: 'error', fixable: true }],
        warnings: [],
        fixedData: this.getDefaultSettings()
      };
    }

    // Validate theme
    const validThemes = ['light', 'dark', 'system'];
    if (!settings.theme || !validThemes.includes(settings.theme)) {
      warnings.push({
        field: 'theme',
        message: `Theme must be one of: ${validThemes.join(', ')}`,
        suggestion: 'Will default to system theme'
      });

      if (!fixedData) fixedData = { ...settings };
      fixedData!.theme = 'system';
    }

    // Validate model
    if (!settings.model || typeof settings.model !== 'string') {
      warnings.push({
        field: 'model',
        message: 'Model must be a valid string',
        suggestion: 'Will default to GPT-3.5 Turbo'
      });

      if (!fixedData) fixedData = { ...settings };
      fixedData!.model = 'openai/gpt-3.5-turbo';
    }

    // Validate numeric settings
    const numericFields = [
      { field: 'temperature', min: 0, max: 2, default: 0.7 },
      { field: 'maxTokens', min: 1, max: 100000, default: 1000 },
      { field: 'topP', min: 0, max: 1, default: 1 },
      { field: 'frequencyPenalty', min: -2, max: 2, default: 0 },
      { field: 'presencePenalty', min: -2, max: 2, default: 0 },
      { field: 'fontSize', min: 12, max: 24, default: 14 }
    ];

    for (const { field, min, max, default: defaultValue } of numericFields) {
      const value = settings[field];
      if (typeof value !== 'number' || value < min || value > max || isNaN(value)) {
        warnings.push({
          field,
          message: `${field} must be a number between ${min} and ${max}`,
          suggestion: `Will default to ${defaultValue}`
        });

        if (!fixedData) fixedData = { ...settings };
        (fixedData as any)[field] = defaultValue;
      }
    }

    // Validate boolean settings
    const booleanFields = ['streamingEnabled', 'autoSave', 'soundEnabled', 'notificationsEnabled', 'autoTitle', 'debugMode', 'experimentalFeatures'];
    for (const field of booleanFields) {
      if (typeof settings[field] !== 'boolean') {
        warnings.push({
          field,
          message: `${field} must be a boolean`,
          suggestion: 'Will default to appropriate value'
        });

        if (!fixedData) fixedData = { ...settings };
        // Set appropriate defaults for each boolean field
        const defaults: Record<string, boolean> = {
          streamingEnabled: true,
          autoSave: true,
          soundEnabled: false,
          notificationsEnabled: true,
          autoTitle: true,
          debugMode: false,
          experimentalFeatures: false
        };
        (fixedData as any)[field] = defaults[field] ?? true;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fixedData: fixedData || undefined
    };
  }

  /**
   * Generate a unique ID
   */
  private static generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get default settings
   */
  private static getDefaultSettings(): ChatSettings {
    return {
      theme: 'system',
      model: 'openai/gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      systemPrompt: 'You are a helpful AI assistant.',
      streamingEnabled: true,
      autoSave: true,
      fontSize: 14,
      language: 'en',
      sidebarWidth: 300,
      messageSpacing: 16,
      soundEnabled: false,
      notificationsEnabled: true,
      conversationHistory: 50,
      autoTitle: true,
      debugMode: false,
      experimentalFeatures: false,
      openRouter: {
        apiKey: '',
        baseUrl: 'https://openrouter.ai/api/v1',
        defaultModel: 'openai/gpt-3.5-turbo',
        timeout: 30000,
        retryAttempts: 3,
        streamingEnabled: true
      }
    };
  }
}

export class DataRecovery {
  private static readonly STORAGE_KEY = 'chat_app_data';
  private static readonly BACKUP_KEY = 'chat_app_backup';
  private static readonly MAX_BACKUPS = 5;

  /**
   * Create a backup of current data
   */
  static async createBackup(conversations: Conversation[], settings: ChatSettings): Promise<string> {
    try {
      const backupData: BackupData = {
        conversations,
        settings,
        timestamp: new Date(),
        version: DataValidator['CURRENT_VERSION'],
        checksum: this.calculateChecksum({ conversations, settings })
      };

      const backupId = `backup_${Date.now()}`;
      const existingBackups = this.getBackupList();

      // Store the new backup
      localStorage.setItem(`${this.BACKUP_KEY}_${backupId}`, JSON.stringify(backupData));

      // Update backup list
      const updatedBackups = [backupId, ...existingBackups].slice(0, this.MAX_BACKUPS);
      localStorage.setItem(`${this.BACKUP_KEY}_list`, JSON.stringify(updatedBackups));

      // Clean up old backups
      for (const oldBackupId of existingBackups.slice(this.MAX_BACKUPS - 1)) {
        localStorage.removeItem(`${this.BACKUP_KEY}_${oldBackupId}`);
      }

      return backupId;
    } catch (error) {
      const handledError = ErrorHandler.handle(error, { operation: 'create_backup' });
      throw new Error(handledError.userMessage);
    }
  }

  /**
   * Restore data from backup
   */
  static async restoreFromBackup(backupId: string, options: RecoveryOptions = {
    validateData: true,
    fixCorruption: true,
    createBackup: true,
    mergeStrategy: 'replace'
  }): Promise<{ conversations: Conversation[], settings: ChatSettings }> {
    try {
      const backupData = localStorage.getItem(`${this.BACKUP_KEY}_${backupId}`);
      if (!backupData) {
        throw new Error(`Backup ${backupId} not found`);
      }

      const backup: BackupData = JSON.parse(backupData);

      // Verify checksum
      const expectedChecksum = this.calculateChecksum({
        conversations: backup.conversations,
        settings: backup.settings
      });

      if (backup.checksum !== expectedChecksum) {
        throw new Error('Backup data is corrupted (checksum mismatch)');
      }

      let { conversations, settings } = backup;

      // Validate and fix data if requested
      if (options.validateData) {
        const validationResult = this.validateAndFixData(conversations, settings, options.fixCorruption);
        conversations = validationResult.conversations;
        settings = validationResult.settings;
      }

      // Create backup of current data before restore
      if (options.createBackup) {
        try {
          const currentData = this.loadCurrentData();
          if (currentData.conversations.length > 0) {
            await this.createBackup(currentData.conversations, currentData.settings);
          }
        } catch (error) {
          console.warn('Failed to create backup before restore:', error);
        }
      }

      return { conversations, settings };
    } catch (error) {
      const handledError = ErrorHandler.handle(error, { operation: 'restore_backup' });
      throw new Error(handledError.userMessage);
    }
  }

  /**
   * Validate and fix data corruption
   */
  static validateAndFixData(
    conversations: Conversation[],
    settings: ChatSettings,
    autoFix: boolean = true
  ): { conversations: Conversation[], settings: ChatSettings, errors: ValidationError[], warnings: ValidationWarning[] } {
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];
    const fixedConversations: Conversation[] = [];

    // Validate conversations
    for (const conversation of conversations) {
      const result = DataValidator.validateConversation(conversation);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);

      if (result.isValid || (autoFix && result.fixedData)) {
        fixedConversations.push((result.fixedData as Conversation) || conversation);
      }
    }

    // Validate settings
    const settingsResult = DataValidator.validateSettings(settings);
    allErrors.push(...settingsResult.errors);
    allWarnings.push(...settingsResult.warnings);

    const fixedSettings = (settingsResult.fixedData as ChatSettings) || settings;

    return {
      conversations: fixedConversations,
      settings: fixedSettings,
      errors: allErrors,
      warnings: allWarnings
    };
  }

  /**
   * Recover from corrupted data
   */
  static async recoverFromCorruption(): Promise<{ conversations: Conversation[], settings: ChatSettings } | null> {
    try {
      // Try to load from most recent backup
      const backups = this.getBackupList();

      for (const backupId of backups) {
        try {
          const recovered = await this.restoreFromBackup(backupId, {
            validateData: true,
            fixCorruption: true,
            createBackup: false,
            mergeStrategy: 'replace'
          });

          console.log(`Successfully recovered from backup: ${backupId}`);
          return recovered;
        } catch (error) {
          console.warn(`Failed to recover from backup ${backupId}:`, error);
          continue;
        }
      }

      // If no backups work, try to salvage current data
      try {
        const currentData = this.loadCurrentData();
        const validationResult = this.validateAndFixData(
          currentData.conversations,
          currentData.settings,
          true
        );

        if (validationResult.conversations.length > 0) {
          console.log('Salvaged some data from corrupted storage');
          return {
            conversations: validationResult.conversations,
            settings: validationResult.settings
          };
        }
      } catch (error) {
        console.error('Failed to salvage current data:', error);
      }

      return null;
    } catch (error) {
      console.error('Recovery failed:', error);
      return null;
    }
  }

  /**
   * Get list of available backups
   */
  static getBackupList(): string[] {
    try {
      const backupList = localStorage.getItem(`${this.BACKUP_KEY}_list`);
      return backupList ? JSON.parse(backupList) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get backup info
   */
  static getBackupInfo(backupId: string): BackupData | null {
    try {
      const backupData = localStorage.getItem(`${this.BACKUP_KEY}_${backupId}`);
      if (!backupData) return null;

      const parsed = JSON.parse(backupData);
      // Convert timestamp back to Date object
      if (parsed.timestamp) {
        parsed.timestamp = new Date(parsed.timestamp);
      }

      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Delete a backup
   */
  static deleteBackup(backupId: string): boolean {
    try {
      localStorage.removeItem(`${this.BACKUP_KEY}_${backupId}`);

      // Update backup list
      const backups = this.getBackupList().filter(id => id !== backupId);
      localStorage.setItem(`${this.BACKUP_KEY}_list`, JSON.stringify(backups));

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load current data from storage
   */
  private static loadCurrentData(): { conversations: Conversation[], settings: ChatSettings } {
    try {
      const conversationsData = localStorage.getItem('conversations');
      const settingsData = localStorage.getItem('settings');

      const conversations = conversationsData ? JSON.parse(conversationsData) : [];
      const settings = settingsData ? JSON.parse(settingsData) : DataValidator['getDefaultSettings']();

      // Convert date strings back to Date objects for conversations
      if (Array.isArray(conversations)) {
        for (const conv of conversations) {
          if (conv.createdAt && typeof conv.createdAt === 'string') {
            conv.createdAt = new Date(conv.createdAt);
          }
          if (conv.lastMessage && typeof conv.lastMessage === 'string') {
            conv.lastMessage = new Date(conv.lastMessage);
          }
          if (Array.isArray(conv.messages)) {
            for (const msg of conv.messages) {
              if (msg.timestamp && typeof msg.timestamp === 'string') {
                msg.timestamp = new Date(msg.timestamp);
              }
            }
          }
        }
      }

      return { conversations, settings };
    } catch (error) {
      throw new Error('Failed to load current data from storage');
    }
  }

  /**
   * Calculate checksum for data integrity
   */
  private static calculateChecksum(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  /**
   * Check data integrity
   */
  static checkDataIntegrity(): { isValid: boolean, errors: string[], canRecover: boolean } {
    const errors: string[] = [];
    let canRecover = false;

    try {
      // Check if localStorage is available
      if (typeof localStorage === 'undefined') {
        errors.push('Local storage is not available');
        return { isValid: false, errors, canRecover: false };
      }

      // Try to load current data
      try {
        const currentData = this.loadCurrentData();
        const validationResult = this.validateAndFixData(currentData.conversations, currentData.settings, false);

        if (validationResult.errors.length > 0) {
          errors.push(`Found ${validationResult.errors.length} data validation errors`);
        }

        if (validationResult.warnings.length > 0) {
          errors.push(`Found ${validationResult.warnings.length} data validation warnings`);
        }
      } catch (error) {
        errors.push(`Failed to load current data: ${(error as Error).message}`);
      }

      // Check if backups are available
      const backups = this.getBackupList();
      if (backups.length > 0) {
        canRecover = true;
      }

      return {
        isValid: errors.length === 0,
        errors,
        canRecover
      };
    } catch (error) {
      errors.push(`Integrity check failed: ${(error as Error).message}`);
      return { isValid: false, errors, canRecover };
    }
  }
}