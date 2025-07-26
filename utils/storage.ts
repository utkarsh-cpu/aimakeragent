/**
 * Storage utilities for secure API key management and settings persistence
 */

const STORAGE_KEYS = {
  API_KEY: 'openrouter_api_key',
  SETTINGS: 'chat_settings',
  CONVERSATIONS: 'chat_conversations'
} as const;

/**
 * Encrypt a string using a simple XOR cipher with a key derived from the domain
 * Note: This is basic obfuscation, not cryptographic security
 */
function simpleEncrypt(text: string): string {
  const key = window.location.hostname;
  let result = '';
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  
  return btoa(result);
}

/**
 * Decrypt a string encrypted with simpleEncrypt
 */
function simpleDecrypt(encryptedText: string): string {
  try {
    const decoded = atob(encryptedText);
    const key = window.location.hostname;
    let result = '';
    
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    
    return result;
  } catch (error) {
    throw new Error('Failed to decrypt data');
  }
}

/**
 * API Key Storage utilities
 */
export class ApiKeyStorage {
  /**
   * Store API key securely in localStorage
   */
  static store(apiKey: string): void {
    if (!apiKey) {
      throw new Error('API key cannot be empty');
    }
    
    try {
      const encrypted = simpleEncrypt(apiKey);
      localStorage.setItem(STORAGE_KEYS.API_KEY, encrypted);
    } catch (error) {
      throw new Error('Failed to store API key');
    }
  }

  /**
   * Retrieve API key from localStorage
   */
  static retrieve(): string | null {
    try {
      const encrypted = localStorage.getItem(STORAGE_KEYS.API_KEY);
      if (!encrypted) {
        return null;
      }
      
      return simpleDecrypt(encrypted);
    } catch (error) {
      console.warn('Failed to decrypt API key, removing corrupted data');
      this.remove();
      return null;
    }
  }

  /**
   * Remove API key from localStorage
   */
  static remove(): void {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
  }

  /**
   * Check if API key exists
   */
  static exists(): boolean {
    return localStorage.getItem(STORAGE_KEYS.API_KEY) !== null;
  }
}

/**
 * Settings Storage utilities
 */
export class SettingsStorage {
  /**
   * Store settings in localStorage
   */
  static store<T>(settings: T): void {
    try {
      const serialized = JSON.stringify(settings);
      localStorage.setItem(STORAGE_KEYS.SETTINGS, serialized);
    } catch (error) {
      throw new Error('Failed to store settings');
    }
  }

  /**
   * Retrieve settings from localStorage
   */
  static retrieve<T>(defaultSettings: T): T {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!stored) {
        return defaultSettings;
      }
      
      const parsed = JSON.parse(stored);
      return { ...defaultSettings, ...parsed };
    } catch (error) {
      console.warn('Failed to parse stored settings, using defaults');
      return defaultSettings;
    }
  }

  /**
   * Remove settings from localStorage
   */
  static remove(): void {
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  }
}

/**
 * Conversation Storage utilities
 */
export class ConversationStorage {
  /**
   * Store conversations in localStorage
   */
  static store<T>(conversations: T[]): void {
    try {
      const serialized = JSON.stringify(conversations);
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, serialized);
    } catch (error) {
      throw new Error('Failed to store conversations');
    }
  }

  /**
   * Retrieve conversations from localStorage
   */
  static retrieve<T>(): T[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      if (!stored) {
        return [];
      }
      
      return JSON.parse(stored);
    } catch (error) {
      console.warn('Failed to parse stored conversations');
      return [];
    }
  }

  /**
   * Remove conversations from localStorage
   */
  static remove(): void {
    localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
  }
}

/**
 * Convenience function to get stored API key
 */
export async function getStoredApiKey(): Promise<string | null> {
  return ApiKeyStorage.retrieve();
}

/**
 * General storage utilities
 */
export class StorageUtils {
  /**
   * Check if localStorage is available
   */
  static isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage usage information
   */
  static getUsageInfo(): { used: number; available: number } {
    if (!this.isAvailable()) {
      return { used: 0, available: 0 };
    }

    let used = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length;
      }
    }

    // Most browsers have a 5-10MB limit for localStorage
    const available = 5 * 1024 * 1024; // 5MB estimate
    
    return { used, available };
  }

  /**
   * Clear all application data
   */
  static clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  /**
   * Export all application data
   */
  static exportData(): string {
    const data: Record<string, any> = {};
    
    Object.values(STORAGE_KEYS).forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        data[key] = value;
      }
    });

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import application data
   */
  static importData(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      
      Object.entries(data).forEach(([key, value]) => {
        if (Object.values(STORAGE_KEYS).includes(key as any)) {
          localStorage.setItem(key, value as string);
        }
      });
    } catch (error) {
      throw new Error('Invalid data format for import');
    }
  }
}