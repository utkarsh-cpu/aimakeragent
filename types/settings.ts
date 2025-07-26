/**
 * Enhanced settings data structures for the chat application
 */

/**
 * OpenRouter API configuration
 */
export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  timeout: number;
  retryAttempts: number;
  streamingEnabled: boolean;
}

/**
 * Model information from OpenRouter
 */
export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  pricing: {
    prompt: number;
    completion: number;
  };
  capabilities: string[];
  provider: string;
}

/**
 * Comprehensive chat settings interface
 */
export interface ChatSettings {
  // API Configuration
  openRouter: OpenRouterConfig;

  // Model Settings
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;

  // UI Settings
  theme: "light" | "dark" | "system";
  fontSize: number;
  language: string;
  sidebarWidth: number;
  messageSpacing: number;

  // Feature Settings
  streamingEnabled: boolean;
  autoSave: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;

  // System Settings
  systemPrompt: string;
  conversationHistory: number;
  autoTitle: boolean;

  // Advanced Settings
  debugMode: boolean;
  experimentalFeatures: boolean;
}

/**
 * Settings validation result
 */
export interface SettingsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Settings migration info
 */
export interface SettingsMigration {
  fromVersion: string;
  toVersion: string;
  migrationFunction: (oldSettings: unknown) => ChatSettings;
}

/**
 * Settings backup metadata
 */
export interface SettingsBackup {
  version: string;
  timestamp: Date;
  settings: ChatSettings;
  metadata: {
    userAgent: string;
    appVersion: string;
    exportReason?: string;
  };
}

/**
 * Default settings configuration
 */
export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  // API Configuration
  openRouter: {
    apiKey: "",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-3.5-turbo",
    timeout: 30000,
    retryAttempts: 3,
    streamingEnabled: true,
  },

  // Model Settings
  model: "openai/gpt-3.5-turbo",
  temperature: 0.7,
  maxTokens: 1000,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,

  // UI Settings
  theme: "system",
  fontSize: 14,
  language: "en",
  sidebarWidth: 300,
  messageSpacing: 16,

  // Feature Settings
  streamingEnabled: true,
  autoSave: true,
  soundEnabled: false,
  notificationsEnabled: true,

  // System Settings
  systemPrompt: "You are a helpful AI assistant.",
  conversationHistory: 50,
  autoTitle: true,

  // Advanced Settings
  debugMode: false,
  experimentalFeatures: false,
};

/**
 * Settings categories for UI organization
 */
export const SETTINGS_CATEGORIES = {
  API: "api",
  MODEL: "model",
  UI: "ui",
  FEATURES: "features",
  SYSTEM: "system",
  ADVANCED: "advanced",
} as const;

export type SettingsCategory =
  (typeof SETTINGS_CATEGORIES)[keyof typeof SETTINGS_CATEGORIES];

/**
 * Settings field metadata for UI generation
 */
export interface SettingsFieldMetadata {
  key: keyof ChatSettings;
  category: SettingsCategory;
  type: "string" | "number" | "boolean" | "select" | "slider" | "textarea";
  label: string;
  description: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string | number; label: string }[];
  validation?: (value: unknown) => string | null;
  sensitive?: boolean; // For API keys, etc.
}

/**
 * Settings metadata for all fields
 */
export const SETTINGS_METADATA: SettingsFieldMetadata[] = [
  // API Configuration
  {
    key: "openRouter" as keyof ChatSettings,
    category: SETTINGS_CATEGORIES.API,
    type: "string",
    label: "OpenRouter API Key",
    description: "Your OpenRouter API key for accessing AI models",
    sensitive: true,
    validation: (value: unknown) => {
      if (typeof value !== "string") return "API key must be a string";
      if (!value) return "API key is required";
      if (!value.startsWith("sk-or-")) return "Invalid API key format";
      return null;
    },
  },

  // Model Settings
  {
    key: "model",
    category: SETTINGS_CATEGORIES.MODEL,
    type: "select",
    label: "AI Model",
    description: "Choose the AI model for conversations",
    options: [], // Will be populated dynamically
  },
  {
    key: "temperature",
    category: SETTINGS_CATEGORIES.MODEL,
    type: "slider",
    label: "Creativity",
    description: "Controls randomness in responses",
    min: 0,
    max: 1,
    step: 0.1,
  },
  {
    key: "maxTokens",
    category: SETTINGS_CATEGORIES.MODEL,
    type: "slider",
    label: "Response Length",
    description: "Maximum length of AI responses",
    min: 100,
    max: 4000,
    step: 100,
  },
  {
    key: "topP",
    category: SETTINGS_CATEGORIES.MODEL,
    type: "slider",
    label: "Focus",
    description: "Controls diversity of word choices",
    min: 0,
    max: 1,
    step: 0.1,
  },
  {
    key: "frequencyPenalty",
    category: SETTINGS_CATEGORIES.MODEL,
    type: "slider",
    label: "Frequency Penalty",
    description: "Reduces repetition of frequent words",
    min: -2,
    max: 2,
    step: 0.1,
  },
  {
    key: "presencePenalty",
    category: SETTINGS_CATEGORIES.MODEL,
    type: "slider",
    label: "Presence Penalty",
    description: "Encourages talking about new topics",
    min: -2,
    max: 2,
    step: 0.1,
  },

  // UI Settings
  {
    key: "theme",
    category: SETTINGS_CATEGORIES.UI,
    type: "select",
    label: "Theme",
    description: "Choose your preferred color scheme",
    options: [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
      { value: "system", label: "System" },
    ],
  },
  {
    key: "fontSize",
    category: SETTINGS_CATEGORIES.UI,
    type: "slider",
    label: "Font Size",
    description: "Adjust text size for better readability",
    min: 10,
    max: 20,
    step: 1,
  },
  {
    key: "language",
    category: SETTINGS_CATEGORIES.UI,
    type: "select",
    label: "Language",
    description: "Preferred language for AI responses",
    options: [
      { value: "en", label: "English" },
      { value: "es", label: "Español" },
      { value: "fr", label: "Français" },
      { value: "de", label: "Deutsch" },
      { value: "it", label: "Italiano" },
      { value: "pt", label: "Português" },
      { value: "ru", label: "Русский" },
      { value: "ja", label: "日本語" },
      { value: "ko", label: "한국어" },
      { value: "zh", label: "中文" },
    ],
  },
  {
    key: "sidebarWidth",
    category: SETTINGS_CATEGORIES.UI,
    type: "slider",
    label: "Sidebar Width",
    description: "Width of the conversation sidebar",
    min: 200,
    max: 500,
    step: 10,
  },
  {
    key: "messageSpacing",
    category: SETTINGS_CATEGORIES.UI,
    type: "slider",
    label: "Message Spacing",
    description: "Space between messages",
    min: 8,
    max: 32,
    step: 4,
  },

  // Feature Settings
  {
    key: "streamingEnabled",
    category: SETTINGS_CATEGORIES.FEATURES,
    type: "boolean",
    label: "Response Streaming",
    description: "Enable real-time streaming of AI responses",
  },
  {
    key: "autoSave",
    category: SETTINGS_CATEGORIES.FEATURES,
    type: "boolean",
    label: "Auto Save",
    description: "Automatically save conversations",
  },
  {
    key: "soundEnabled",
    category: SETTINGS_CATEGORIES.FEATURES,
    type: "boolean",
    label: "Sound Effects",
    description: "Play sounds for notifications and actions",
  },
  {
    key: "notificationsEnabled",
    category: SETTINGS_CATEGORIES.FEATURES,
    type: "boolean",
    label: "Notifications",
    description: "Show browser notifications for new messages",
  },

  // System Settings
  {
    key: "systemPrompt",
    category: SETTINGS_CATEGORIES.SYSTEM,
    type: "textarea",
    label: "System Prompt",
    description: "Define how the AI should behave and respond",
  },
  {
    key: "conversationHistory",
    category: SETTINGS_CATEGORIES.SYSTEM,
    type: "slider",
    label: "Conversation History",
    description: "Number of previous messages to include in context",
    min: 5,
    max: 100,
    step: 5,
  },
  {
    key: "autoTitle",
    category: SETTINGS_CATEGORIES.SYSTEM,
    type: "boolean",
    label: "Auto Title",
    description: "Automatically generate conversation titles",
  },

  // Advanced Settings
  {
    key: "debugMode",
    category: SETTINGS_CATEGORIES.ADVANCED,
    type: "boolean",
    label: "Debug Mode",
    description: "Enable debug information and logging",
  },
  {
    key: "experimentalFeatures",
    category: SETTINGS_CATEGORIES.ADVANCED,
    type: "boolean",
    label: "Experimental Features",
    description: "Enable experimental and beta features",
  },
];
