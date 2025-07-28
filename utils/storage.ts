/**
 * Storage management utilities for conversations and settings
 */

import { Conversation, Message } from '../types/conversation';
import { ChatSettings } from '../types/settings';
import { ErrorHandler, ErrorType } from './error-handler';

export interface StorageStats {
  totalConversations: number;
  totalMessages: number;
  storageUsed: number;
  storageLimit: number;
}

export class StorageManager {
  private static readonly CONVERSATIONS_KEY = 'conversations';
  private static readonly SETTINGS_KEY = 'settings';
  private static readonly BACKUP_PREFIX = 'backup_';

  /**
   * Get all conversations from storage
   */
  static getConversations(): Conversation[] {
    try {
      const data = localStorage.getItem(this.CONVERSATIONS_KEY);
      if (!data) return [];

      const conversations = JSON.parse(data);
      
      // Convert date strings back to Date objects
      return conversations.map((conv: any) => ({
        ...conv,
        lastMessage: new Date(conv.lastMessage),
        metadata: {
          ...conv.metadata,
          createdAt: new Date(conv.metadata.createdAt),
          updatedAt: new Date(conv.metadata.updatedAt),
          lastActivity: new Date(conv.metadata.lastActivity),
        },
        messages: conv.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          editHistory: msg.editHistory?.map((edit: any) => ({
            ...edit,
            timestamp: new Date(edit.timestamp),
          })) || [],
        })),
      }));
    } catch (error) {
      console.error('Failed to load conversations:', error);
      return [];
    }
  }

  /**
   * Save a conversation to storage
   */
  static saveConversation(conversation: Conversation): void {
    try {
      const conversations = this.getConversations();
      const existingIndex = conversations.findIndex(c => c.id === conversation.id);

      if (existingIndex >= 0) {
        conversations[existingIndex] = conversation;
      } else {
        conversations.push(conversation);
      }

      localStorage.setItem(this.CONVERSATIONS_KEY, JSON.stringify(conversations));
    } catch (error) {
      const handledError = ErrorHandler.handle(error, { operation: 'save_conversation' });
      throw new Error(handledError.userMessage);
    }
  }

  /**
   * Delete a conversation from storage
   */
  static deleteConversation(conversationId: string): boolean {
    try {
      const conversations = this.getConversations();
      const filteredConversations = conversations.filter(c => c.id !== conversationId);

      if (filteredConversations.length === conversations.length) {
        return false; // Conversation not found
      }

      localStorage.setItem(this.CONVERSATIONS_KEY, JSON.stringify(filteredConversations));
      return true;
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      return false;
    }
  }

  /**
   * Get a specific conversation by ID
   */
  static getConversation(conversationId: string): Conversation | null {
    const conversations = this.getConversations();
    return conversations.find(c => c.id === conversationId) || null;
  }

  /**
   * Export a conversation to JSON
   */
  static exportConversation(conversationId: string): string {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return JSON.stringify(conversation, null, 2);
  }

  /**
   * Export all conversations
   */
  static exportAllConversations(): string {
    const conversations = this.getConversations();
    return JSON.stringify(conversations, null, 2);
  }

  /**
   * Import conversations from JSON
   */
  static importConversations(jsonData: string): number {
    try {
      const importedData = JSON.parse(jsonData);
      const conversations = Array.isArray(importedData) ? importedData : [importedData];
      
      let importedCount = 0;
      for (const conv of conversations) {
        if (this.isValidConversation(conv)) {
          this.saveConversation(conv);
          importedCount++;
        }
      }

      return importedCount;
    } catch (error) {
      throw new Error('Invalid JSON data');
    }
  }

  /**
   * Get storage statistics
   */
  static getStorageStats(): StorageStats {
    const conversations = this.getConversations();
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
    
    // Estimate storage usage
    const conversationsData = localStorage.getItem(this.CONVERSATIONS_KEY) || '';
    const settingsData = localStorage.getItem(this.SETTINGS_KEY) || '';
    const storageUsed = (conversationsData.length + settingsData.length) * 2; // Rough estimate in bytes

    return {
      totalConversations: conversations.length,
      totalMessages,
      storageUsed,
      storageLimit: 5 * 1024 * 1024, // 5MB typical localStorage limit
    };
  }

  /**
   * Clear all conversations
   */
  static clearAllConversations(): void {
    localStorage.removeItem(this.CONVERSATIONS_KEY);
  }

  /**
   * Search conversations
   */
  static searchConversations(query: string): Conversation[] {
    const conversations = this.getConversations();
    const lowerQuery = query.toLowerCase();

    return conversations.filter(conv => 
      conv.title.toLowerCase().includes(lowerQuery) ||
      conv.messages.some(msg => msg.content.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Validate conversation structure
   */
  private static isValidConversation(conv: any): boolean {
    return (
      conv &&
      typeof conv.id === 'string' &&
      typeof conv.title === 'string' &&
      Array.isArray(conv.messages) &&
      conv.metadata &&
      typeof conv.metadata === 'object'
    );
  }

  /**
   * Create backup of current data
   */
  static createBackup(): string {
    const conversations = this.getConversations();
    const backupId = `${this.BACKUP_PREFIX}${Date.now()}`;
    
    const backupData = {
      conversations,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };

    localStorage.setItem(backupId, JSON.stringify(backupData));
    return backupId;
  }

  /**
   * Restore from backup
   */
  static restoreFromBackup(backupId: string): boolean {
    try {
      const backupData = localStorage.getItem(backupId);
      if (!backupData) return false;

      const backup = JSON.parse(backupData);
      if (backup.conversations && Array.isArray(backup.conversations)) {
        localStorage.setItem(this.CONVERSATIONS_KEY, JSON.stringify(backup.conversations));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to restore backup:', error);
      return false;
    }
  }

  /**
   * Get available backups
   */
  static getBackups(): Array<{ id: string; timestamp: string }> {
    const backups: Array<{ id: string; timestamp: string }> = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.BACKUP_PREFIX)) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const backup = JSON.parse(data);
            backups.push({
              id: key,
              timestamp: backup.timestamp || 'Unknown',
            });
          }
        } catch (error) {
          console.warn(`Invalid backup data for key: ${key}`);
        }
      }
    }

    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Delete backup
   */
  static deleteBackup(backupId: string): boolean {
    try {
      localStorage.removeItem(backupId);
      return true;
    } catch (error) {
      console.error('Failed to delete backup:', error);
      return false;
    }
  }
}/**
 * 
API Key storage utilities
 */
export class ApiKeyStorage {
  private static readonly API_KEY_STORAGE_KEY = 'openrouter_api_key';

  /**
   * Store API key securely
   */
  static store(apiKey: string): void {
    try {
      // In a real app, you might want to encrypt this
      localStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey);
    } catch (error) {
      console.error('Failed to store API key:', error);
      throw new Error('Failed to store API key');
    }
  }

  /**
   * Retrieve stored API key
   */
  static retrieve(): string | null {
    try {
      return localStorage.getItem(this.API_KEY_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to retrieve API key:', error);
      return null;
    }
  }

  /**
   * Remove stored API key
   */
  static remove(): void {
    try {
      localStorage.removeItem(this.API_KEY_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to remove API key:', error);
    }
  }

  /**
   * Check if API key exists
   */
  static exists(): boolean {
    return this.retrieve() !== null;
  }
}

/**
 * Settings storage utilities
 */
export class SettingsStorage {
  private static readonly SETTINGS_STORAGE_KEY = 'chat_settings';

  /**
   * Store settings
   */
  static store(settings: any): void {
    try {
      localStorage.setItem(this.SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to store settings:', error);
      throw new Error('Failed to store settings');
    }
  }

  /**
   * Retrieve stored settings
   */
  static retrieve(): any | null {
    try {
      const stored = localStorage.getItem(this.SETTINGS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to retrieve settings:', error);
      return null;
    }
  }

  /**
   * Remove stored settings
   */
  static remove(): void {
    try {
      localStorage.removeItem(this.SETTINGS_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to remove settings:', error);
    }
  }

  /**
   * Check if settings exist
   */
  static exists(): boolean {
    return this.retrieve() !== null;
  }
}

/**
 * Conversation storage utilities
 */
export class ConversationStorage {
  private static readonly CONVERSATIONS_STORAGE_KEY = 'conversations';

  /**
   * Store conversations
   */
  static store(conversations: Conversation[]): void {
    try {
      localStorage.setItem(this.CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
    } catch (error) {
      console.error('Failed to store conversations:', error);
      throw new Error('Failed to store conversations');
    }
  }

  /**
   * Retrieve stored conversations
   */
  static retrieve(): Conversation[] {
    try {
      const stored = localStorage.getItem(this.CONVERSATIONS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to retrieve conversations:', error);
      return [];
    }
  }

  /**
   * Remove stored conversations
   */
  static remove(): void {
    try {
      localStorage.removeItem(this.CONVERSATIONS_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to remove conversations:', error);
    }
  }

  /**
   * Check if conversations exist
   */
  static exists(): boolean {
    const stored = localStorage.getItem(this.CONVERSATIONS_STORAGE_KEY);
    return stored !== null && stored !== '[]';
  }
}

/**
 * General storage utilities
 */
export class StorageUtils {
  /**
   * Get storage usage information
   */
  static getStorageInfo(): {
    used: number;
    available: number;
    percentage: number;
  } {
    try {
      let used = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }

      // Rough estimate of localStorage limit (usually 5-10MB)
      const available = 5 * 1024 * 1024; // 5MB
      const percentage = (used / available) * 100;

      return { used, available, percentage };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return { used: 0, available: 0, percentage: 0 };
    }
  }

  /**
   * Clear all app-related storage
   */
  static clearAll(): void {
    try {
      ApiKeyStorage.remove();
      SettingsStorage.remove();
      ConversationStorage.remove();
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }

  /**
   * Export all data
   */
  static exportAll(): any {
    return {
      apiKey: ApiKeyStorage.retrieve(),
      settings: SettingsStorage.retrieve(),
      conversations: ConversationStorage.retrieve(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Import all data
   */
  static importAll(data: any): void {
    try {
      if (data.apiKey) {
        ApiKeyStorage.store(data.apiKey);
      }
      if (data.settings) {
        SettingsStorage.store(data.settings);
      }
      if (data.conversations) {
        ConversationStorage.store(data.conversations);
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error('Failed to import data');
    }
  }
}