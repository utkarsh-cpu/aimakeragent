/**
 * Tests for the DataValidator and DataRecovery classes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataValidator, DataRecovery } from '../data-recovery';
import { Conversation, Message } from '../../types/conversation';
import { ChatSettings } from '../../types/settings';

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  })
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('DataValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('validateConversation', () => {
    it('should validate a valid conversation', () => {
      const validConversation: Conversation = {
        id: '1',
        title: 'Test Conversation',
        messages: [
          {
            id: '1',
            content: 'Hello',
            role: 'user',
            timestamp: new Date()
          }
        ],
        lastMessage: new Date(),
        metadata: {
          messageCount: 1,
          tokenCount: 0,
          isFavorite: false,
          isArchived: false,
          tags: [],
          autoTitleGenerated: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActivity: new Date()
        }
      };

      const result = DataValidator.validateConversation(validConversation);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fix missing conversation ID', () => {
      const invalidConversation = {
        title: 'Test Conversation',
        messages: [],
        createdAt: new Date(),
        lastMessage: new Date()
      };

      const result = DataValidator.validateConversation(invalidConversation);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'id')).toBe(true);
      expect(result.fixedData?.id).toBeTruthy();
    });

    it('should fix missing conversation title', () => {
      const invalidConversation = {
        id: '1',
        messages: [],
        createdAt: new Date(),
        lastMessage: new Date()
      };

      const result = DataValidator.validateConversation(invalidConversation);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'title')).toBe(true);
      expect(result.fixedData?.title).toBe('Untitled Conversation');
    });

    it('should fix invalid messages array', () => {
      const invalidConversation = {
        id: '1',
        title: 'Test',
        messages: 'not an array',
        createdAt: new Date(),
        lastMessage: new Date()
      };

      const result = DataValidator.validateConversation(invalidConversation);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'messages')).toBe(true);
      expect(Array.isArray(result.fixedData?.messages)).toBe(true);
    });

    it('should handle null conversation', () => {
      const result = DataValidator.validateConversation(null);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('conversation');
    });
  });

  describe('validateMessage', () => {
    it('should validate a valid message', () => {
      const validMessage: Message = {
        id: '1',
        content: 'Hello world',
        role: 'user',
        timestamp: new Date()
      };

      const result = DataValidator.validateMessage(validMessage);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fix missing message ID', () => {
      const invalidMessage = {
        content: 'Hello',
        role: 'user',
        timestamp: new Date()
      };

      const result = DataValidator.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field.includes('id'))).toBe(true);
      expect(result.fixedData?.id).toBeTruthy();
    });

    it('should fix invalid role', () => {
      const invalidMessage = {
        id: '1',
        content: 'Hello',
        role: 'invalid_role',
        timestamp: new Date()
      };

      const result = DataValidator.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field.includes('role'))).toBe(true);
      expect(result.fixedData?.role).toBe('user');
    });

    it('should truncate overly long content', () => {
      const longContent = 'a'.repeat(100001);
      const invalidMessage = {
        id: '1',
        content: longContent,
        role: 'user',
        timestamp: new Date()
      };

      const result = DataValidator.validateMessage(invalidMessage);
      expect(result.warnings.some(w => w.field.includes('content'))).toBe(true);
      expect(result.fixedData?.content?.length).toBeLessThan(longContent.length);
      expect(result.fixedData?.content?.includes('[truncated]')).toBe(true);
    });

    it('should handle null message', () => {
      const result = DataValidator.validateMessage(null);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('message');
    });
  });

  describe('validateSettings', () => {
    it('should validate valid settings', () => {
      const validSettings: ChatSettings = {
        theme: 'dark',
        model: 'openai/gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 1000,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        systemPrompt: 'You are helpful',
        streamingEnabled: true,
        autoSave: true,
        fontSize: 14,
        soundEnabled: false,
        notificationsEnabled: true,
        language: 'en',
        sidebarWidth: 300,
        messageSpacing: 16,
        conversationHistory: 50,
        autoTitle: true,
        debugMode: false,
        experimentalFeatures: false,
        openRouter: {
          apiKey: 'test-key',
          baseUrl: 'https://openrouter.ai/api/v1',
          defaultModel: 'openai/gpt-3.5-turbo',
          timeout: 30000,
          retryAttempts: 3,
          streamingEnabled: true
        }
      };

      const result = DataValidator.validateSettings(validSettings);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fix invalid theme', () => {
      const invalidSettings = {
        theme: 'invalid_theme',
        model: 'openai/gpt-3.5-turbo'
      };

      const result = DataValidator.validateSettings(invalidSettings);
      expect(result.warnings.some(w => w.field === 'theme')).toBe(true);
      expect(result.fixedData?.theme).toBe('system');
    });

    it('should fix invalid numeric values', () => {
      const invalidSettings = {
        temperature: -1, // Below minimum
        maxTokens: 'not a number', // Wrong type
        topP: 5 // Above maximum
      };

      const result = DataValidator.validateSettings(invalidSettings);
      expect(result.warnings.some(w => w.field === 'temperature')).toBe(true);
      expect(result.warnings.some(w => w.field === 'maxTokens')).toBe(true);
      expect(result.warnings.some(w => w.field === 'topP')).toBe(true);

      expect(result.fixedData?.temperature).toBe(0.7);
      expect(result.fixedData?.maxTokens).toBe(1000);
      expect(result.fixedData?.topP).toBe(1);
    });

    it('should handle null settings', () => {
      const result = DataValidator.validateSettings(null);
      expect(result.isValid).toBe(false);
      expect(result.fixedData).toBeTruthy();
      expect(result.fixedData?.theme).toBe('system');
    });
  });
});

describe('DataRecovery', () => {
  const mockConversations: Conversation[] = [
    {
      id: '1',
      title: 'Test Conversation',
      messages: [
        {
          id: '1',
          content: 'Hello',
          role: 'user',
          timestamp: new Date()
        }
      ],
      lastMessage: new Date(),
      metadata: {
        messageCount: 1,
        tokenCount: 0,
        isFavorite: false,
        isArchived: false,
        tags: [],
        autoTitleGenerated: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date()
      }
    }
  ];

  const mockSettings: ChatSettings = {
    theme: 'dark',
    model: 'openai/gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1000,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    systemPrompt: 'You are helpful',
    streamingEnabled: true,
    autoSave: true,
    fontSize: 14,
    soundEnabled: false,
    notificationsEnabled: true,
    language: 'en',
    sidebarWidth: 300,
    messageSpacing: 16,
    conversationHistory: 50,
    autoTitle: true,
    debugMode: false,
    experimentalFeatures: false,
    openRouter: {
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.ai/api/v1',
      defaultModel: 'openai/gpt-3.5-turbo',
      timeout: 30000,
      retryAttempts: 3,
      streamingEnabled: true
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('createBackup', () => {
    it('should create a backup successfully', async () => {
      const backupId = await DataRecovery.createBackup(mockConversations, mockSettings);

      expect(backupId).toBeTruthy();
      expect(backupId.startsWith('backup_')).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should maintain backup list', async () => {
      const backupId1 = await DataRecovery.createBackup(mockConversations, mockSettings);
      const backupId2 = await DataRecovery.createBackup(mockConversations, mockSettings);

      const backupList = DataRecovery.getBackupList();
      expect(backupList).toContain(backupId1);
      expect(backupList).toContain(backupId2);
      expect(backupList[0]).toBe(backupId2); // Most recent first
    });

    it('should limit number of backups', async () => {
      // Create more than MAX_BACKUPS (5)
      for (let i = 0; i < 7; i++) {
        await DataRecovery.createBackup(mockConversations, mockSettings);
      }

      const backupList = DataRecovery.getBackupList();
      expect(backupList.length).toBe(5);
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore from backup successfully', async () => {
      const backupId = await DataRecovery.createBackup(mockConversations, mockSettings);

      const restored = await DataRecovery.restoreFromBackup(backupId, {
        validateData: false,
        fixCorruption: false,
        createBackup: false,
        mergeStrategy: 'replace'
      });

      expect(restored.conversations).toHaveLength(1);
      expect(restored.conversations[0].title).toBe('Test Conversation');
      expect(restored.settings.theme).toBe('dark');
    });

    it('should throw error for non-existent backup', async () => {
      await expect(DataRecovery.restoreFromBackup('non-existent')).rejects.toThrow();
    });

    it('should validate data during restore', async () => {
      // Create backup with invalid data
      const invalidConversations = [
        {
          // Missing required fields
          title: 'Invalid Conversation',
          messages: 'not an array'
        }
      ];

      const backupId = await DataRecovery.createBackup(invalidConversations as any, mockSettings);

      const restored = await DataRecovery.restoreFromBackup(backupId, {
        validateData: true,
        fixCorruption: true,
        createBackup: false,
        mergeStrategy: 'replace'
      });

      // Should have fixed the invalid data
      expect(restored.conversations).toHaveLength(1);
      expect(restored.conversations[0].id).toBeTruthy();
      expect(Array.isArray(restored.conversations[0].messages)).toBe(true);
    });
  });

  describe('validateAndFixData', () => {
    it('should validate and fix corrupted conversations', () => {
      const corruptedConversations = [
        {
          // Missing ID and invalid messages
          title: 'Corrupted',
          messages: 'not an array',
          createdAt: new Date()
        }
      ];

      const result = DataRecovery.validateAndFixData(
        corruptedConversations as any,
        mockSettings,
        true
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.conversations).toHaveLength(1);
      expect(result.conversations[0].id).toBeTruthy();
      expect(Array.isArray(result.conversations[0].messages)).toBe(true);
    });

    it('should remove unfixable conversations', () => {
      const corruptedConversations = [
        null, // Unfixable
        {
          title: 'Valid',
          id: '1',
          messages: [],
          createdAt: new Date(),
          lastMessage: new Date()
        }
      ];

      const result = DataRecovery.validateAndFixData(
        corruptedConversations as any,
        mockSettings,
        true
      );

      expect(result.conversations).toHaveLength(1);
      expect(result.conversations[0].title).toBe('Valid');
    });
  });

  describe('getBackupList', () => {
    it('should return empty array when no backups exist', () => {
      const backups = DataRecovery.getBackupList();
      expect(backups).toEqual([]);
    });

    it('should return backup list', async () => {
      const backupId = await DataRecovery.createBackup(mockConversations, mockSettings);
      const backups = DataRecovery.getBackupList();

      expect(backups).toContain(backupId);
    });
  });

  describe('getBackupInfo', () => {
    it('should return backup info', async () => {
      const backupId = await DataRecovery.createBackup(mockConversations, mockSettings);
      const info = DataRecovery.getBackupInfo(backupId);

      expect(info).toBeTruthy();
      expect(info?.conversations).toHaveLength(1);
      expect(info?.timestamp).toBeInstanceOf(Date);
      expect(info?.checksum).toBeTruthy();
    });

    it('should return null for non-existent backup', () => {
      const info = DataRecovery.getBackupInfo('non-existent');
      expect(info).toBeNull();
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup successfully', async () => {
      const backupId = await DataRecovery.createBackup(mockConversations, mockSettings);

      const deleted = DataRecovery.deleteBackup(backupId);
      expect(deleted).toBe(true);

      const info = DataRecovery.getBackupInfo(backupId);
      expect(info).toBeNull();

      const backups = DataRecovery.getBackupList();
      expect(backups).not.toContain(backupId);
    });

    it('should handle deleting non-existent backup', () => {
      const deleted = DataRecovery.deleteBackup('non-existent');
      expect(deleted).toBe(true); // Should not throw error
    });
  });

  describe('checkDataIntegrity', () => {
    it('should report healthy data', () => {
      // Set up valid data in localStorage
      localStorageMock.setItem('conversations', JSON.stringify(mockConversations));
      localStorageMock.setItem('settings', JSON.stringify(mockSettings));

      const integrity = DataRecovery.checkDataIntegrity();
      expect(integrity.isValid).toBe(true);
      expect(integrity.errors).toHaveLength(0);
    });

    it('should detect corrupted data', () => {
      // Set up invalid data
      localStorageMock.setItem('conversations', JSON.stringify([{ invalid: 'data' }]));
      localStorageMock.setItem('settings', JSON.stringify({ invalid: 'settings' }));

      const integrity = DataRecovery.checkDataIntegrity();
      expect(integrity.isValid).toBe(false);
      expect(integrity.errors.length).toBeGreaterThan(0);
    });

    it('should indicate recovery possibility when backups exist', async () => {
      // Create a backup first
      await DataRecovery.createBackup(mockConversations, mockSettings);

      // Set up corrupted data
      localStorageMock.setItem('conversations', 'invalid json');

      const integrity = DataRecovery.checkDataIntegrity();
      expect(integrity.canRecover).toBe(true);
    });
  });
});