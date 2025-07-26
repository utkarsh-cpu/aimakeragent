/**
 * Tests for settings management functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsValidator, SettingsMigrator, SettingsManager } from '../settings-manager';
import { DEFAULT_CHAT_SETTINGS, ChatSettings } from '../../types/settings';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('SettingsValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate valid settings', () => {
    const result = SettingsValidator.validate(DEFAULT_CHAT_SETTINGS);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect invalid temperature', () => {
    const invalidSettings = {
      ...DEFAULT_CHAT_SETTINGS,
      temperature: 3.0 // Invalid: > 2.0
    };
    
    const result = SettingsValidator.validate(invalidSettings);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Temperature must be between 0 and 1');
  });

  it('should detect invalid max tokens', () => {
    const invalidSettings = {
      ...DEFAULT_CHAT_SETTINGS,
      maxTokens: -100 // Invalid: < 1
    };
    
    const result = SettingsValidator.validate(invalidSettings);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Max tokens must be between 1 and 10000');
  });

  it('should validate individual fields', () => {
    const error = SettingsValidator.validateField('temperature', 3.0);
    expect(error).toBeTruthy();
    
    const noError = SettingsValidator.validateField('temperature', 0.7);
    expect(noError).toBeNull();
  });
});

describe('SettingsMigrator', () => {
  it('should migrate legacy settings', () => {
    const legacySettings = {
      apiKey: 'sk-or-test123',
      model: 'openai/gpt-4',
      temperature: 0.8,
      systemPrompt: 'Test prompt'
    };

    const migrated = SettingsMigrator.migrate(legacySettings, '0.9.0');
    
    expect(migrated.openRouter.apiKey).toBe('sk-or-test123');
    expect(migrated.model).toBe('openai/gpt-4');
    expect(migrated.temperature).toBe(0.8);
    expect(migrated.systemPrompt).toBe('Test prompt');
  });

  it('should ensure complete settings structure', () => {
    const partialSettings = {
      model: 'openai/gpt-4',
      temperature: 0.8
    };

    const complete = SettingsMigrator.migrate(partialSettings);
    
    // Should have all required fields
    expect(complete.openRouter).toBeDefined();
    expect(complete.theme).toBeDefined();
    expect(complete.fontSize).toBeDefined();
    expect(complete.streamingEnabled).toBeDefined();
  });
});

describe('SettingsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load default settings when none exist', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    const settings = SettingsManager.load();
    expect(settings).toEqual(DEFAULT_CHAT_SETTINGS);
  });

  it('should save settings to localStorage', () => {
    const testSettings = { ...DEFAULT_CHAT_SETTINGS, temperature: 0.8 };
    
    SettingsManager.save(testSettings);
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'chat_settings',
      JSON.stringify(testSettings)
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'settings_version',
      '1.0.0'
    );
  });

  it('should reset to defaults', () => {
    const reset = SettingsManager.reset();
    expect(reset).toEqual(DEFAULT_CHAT_SETTINGS);
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('should handle corrupted settings gracefully', () => {
    localStorageMock.getItem.mockReturnValue('invalid json');
    
    const settings = SettingsManager.load();
    expect(settings).toEqual(DEFAULT_CHAT_SETTINGS);
  });
});

describe('Settings Import/Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export settings with metadata', () => {
    // Mock URL.createObjectURL and related DOM methods
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
    const mockRevokeObjectURL = vi.fn();
    const mockClick = vi.fn();
    const mockAppendChild = vi.fn();
    const mockRemoveChild = vi.fn();
    
    Object.defineProperty(URL, 'createObjectURL', { value: mockCreateObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { value: mockRevokeObjectURL });
    
    const mockLink = {
      href: '',
      download: '',
      click: mockClick
    };
    
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
    vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

    const testSettings = { ...DEFAULT_CHAT_SETTINGS, temperature: 0.9 };
    
    SettingsManager.export(testSettings, 'test export');
    
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });

  it('should import valid settings', async () => {
    const testSettings = { ...DEFAULT_CHAT_SETTINGS, temperature: 0.9 };
    const fileContent = JSON.stringify({
      version: '1.0.0',
      timestamp: new Date(),
      settings: testSettings,
      metadata: {
        userAgent: 'test',
        appVersion: '1.0.0'
      }
    });

    const mockFile = new File([fileContent], 'settings.json', { type: 'application/json' });
    
    const imported = await SettingsManager.import(mockFile);
    expect(imported.temperature).toBe(0.9);
  });

  it('should reject invalid settings file', async () => {
    const invalidContent = 'invalid json';
    const mockFile = new File([invalidContent], 'settings.json', { type: 'application/json' });
    
    await expect(SettingsManager.import(mockFile)).rejects.toThrow();
  });
});