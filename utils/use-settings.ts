/**
 * React hook for managing enhanced chat settings
 */

import { useState, useEffect, useCallback } from 'react';
import { ChatSettings, DEFAULT_CHAT_SETTINGS } from '../types/settings';
import { SettingsManager, SettingsValidator } from './settings-manager';

/**
 * Settings change event type
 */
export type SettingsChangeHandler = (settings: ChatSettings) => void;

/**
 * Settings hook return type
 */
export interface UseSettingsReturn {
  settings: ChatSettings;
  updateSettings: (updates: Partial<ChatSettings>) => void;
  updateSetting: <K extends keyof ChatSettings>(key: K, value: ChatSettings[K]) => void;
  resetSettings: () => void;
  exportSettings: (reason?: string) => void;
  importSettings: (file: File) => Promise<void>;
  validateSettings: (settings: Partial<ChatSettings>) => { isValid: boolean; errors: string[]; warnings: string[] };
  isLoading: boolean;
  error: string | null;
}

/**
 * Enhanced settings management hook
 */
export function useSettings(onChange?: SettingsChangeHandler): UseSettingsReturn {
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_CHAT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    try {
      const loadedSettings = SettingsManager.load();
      setSettings(loadedSettings);
      setError(null);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      setSettings(DEFAULT_CHAT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save settings when they change
  const saveSettings = useCallback((newSettings: ChatSettings) => {
    try {
      SettingsManager.save(newSettings);
      setError(null);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  }, []);

  // Update multiple settings at once
  const updateSettings = useCallback((updates: Partial<ChatSettings>) => {
    setSettings(prevSettings => {
      const newSettings = {
        ...prevSettings,
        ...updates,
        // Ensure nested objects are properly merged
        openRouter: {
          ...prevSettings.openRouter,
          ...(updates.openRouter || {})
        }
      };

      // Validate before applying
      const validation = SettingsValidator.validate(newSettings);
      if (!validation.isValid) {
        console.warn('Invalid settings update:', validation.errors);
        setError(`Invalid settings: ${validation.errors.join(', ')}`);
        return prevSettings;
      }

      // Save to storage
      saveSettings(newSettings);
      
      // Notify onChange handler
      if (onChange) {
        onChange(newSettings);
      }

      return newSettings;
    });
  }, [saveSettings, onChange]);

  // Update a single setting
  const updateSetting = useCallback(<K extends keyof ChatSettings>(
    key: K, 
    value: ChatSettings[K]
  ) => {
    // Validate individual field
    const fieldError = SettingsValidator.validateField(key, value);
    if (fieldError) {
      setError(fieldError);
      return;
    }

    if (key.includes('.')) {
      // Handle nested properties (e.g., 'openRouter.apiKey')
      const [parentKey, childKey] = key.split('.') as [keyof ChatSettings, string];
      updateSettings({
        [parentKey]: {
          ...(settings[parentKey] as any),
          [childKey]: value
        }
      } as Partial<ChatSettings>);
    } else {
      updateSettings({ [key]: value } as Partial<ChatSettings>);
    }
  }, [settings, updateSettings]);

  // Reset to default settings
  const resetSettings = useCallback(() => {
    try {
      const defaultSettings = SettingsManager.reset();
      setSettings(defaultSettings);
      setError(null);
      
      if (onChange) {
        onChange(defaultSettings);
      }
    } catch (err) {
      console.error('Failed to reset settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
    }
  }, [onChange]);

  // Export settings to file
  const exportSettings = useCallback((reason?: string) => {
    try {
      SettingsManager.export(settings, reason);
      setError(null);
    } catch (err) {
      console.error('Failed to export settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to export settings');
    }
  }, [settings]);

  // Import settings from file
  const importSettings = useCallback(async (file: File) => {
    try {
      setIsLoading(true);
      const importedSettings = await SettingsManager.import(file);
      
      // Create backup before importing
      SettingsManager.backup(settings);
      
      setSettings(importedSettings);
      saveSettings(importedSettings);
      setError(null);
      
      if (onChange) {
        onChange(importedSettings);
      }
    } catch (err) {
      console.error('Failed to import settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to import settings');
    } finally {
      setIsLoading(false);
    }
  }, [settings, saveSettings, onChange]);

  // Validate settings
  const validateSettings = useCallback((settingsToValidate: Partial<ChatSettings>) => {
    return SettingsValidator.validate(settingsToValidate);
  }, []);

  return {
    settings,
    updateSettings,
    updateSetting,
    resetSettings,
    exportSettings,
    importSettings,
    validateSettings,
    isLoading,
    error
  };
}

/**
 * Hook for managing specific setting categories
 */
export function useSettingsCategory(category: 'api' | 'model' | 'ui' | 'features' | 'system' | 'advanced') {
  const { settings, updateSetting, error } = useSettings();

  const getCategorySettings = useCallback(() => {
    switch (category) {
      case 'api':
        return {
          openRouter: settings.openRouter
        };
      case 'model':
        return {
          model: settings.model,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          topP: settings.topP,
          frequencyPenalty: settings.frequencyPenalty,
          presencePenalty: settings.presencePenalty
        };
      case 'ui':
        return {
          theme: settings.theme,
          fontSize: settings.fontSize,
          language: settings.language,
          sidebarWidth: settings.sidebarWidth,
          messageSpacing: settings.messageSpacing
        };
      case 'features':
        return {
          streamingEnabled: settings.streamingEnabled,
          autoSave: settings.autoSave,
          soundEnabled: settings.soundEnabled,
          notificationsEnabled: settings.notificationsEnabled
        };
      case 'system':
        return {
          systemPrompt: settings.systemPrompt,
          conversationHistory: settings.conversationHistory,
          autoTitle: settings.autoTitle
        };
      case 'advanced':
        return {
          debugMode: settings.debugMode,
          experimentalFeatures: settings.experimentalFeatures
        };
      default:
        return {};
    }
  }, [settings, category]);

  return {
    settings: getCategorySettings(),
    updateSetting,
    error
  };
}

/**
 * Hook for managing API key specifically
 */
export function useApiKey() {
  const { settings, updateSetting, error } = useSettings();

  const setApiKey = useCallback((apiKey: string) => {
    updateSetting('openRouter' as keyof ChatSettings, {
      ...settings.openRouter,
      apiKey
    } as any);
  }, [settings.openRouter, updateSetting]);

  const removeApiKey = useCallback(() => {
    updateSetting('openRouter' as keyof ChatSettings, {
      ...settings.openRouter,
      apiKey: ''
    } as any);
  }, [settings.openRouter, updateSetting]);

  const hasApiKey = useCallback(() => {
    return Boolean(settings.openRouter.apiKey);
  }, [settings.openRouter.apiKey]);

  return {
    apiKey: settings.openRouter.apiKey,
    setApiKey,
    removeApiKey,
    hasApiKey,
    error
  };
}