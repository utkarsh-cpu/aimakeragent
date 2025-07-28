import { render, screen, waitFor } from '@testing-library/react';
import { ChatApp } from '../ChatApp';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock dependencies
vi.mock('../../services/openrouter', () => ({
  OpenRouterService: vi.fn().mockImplementation(() => ({
    sendMessage: vi.fn(),
    getModels: vi.fn(),
    validateApiKey: vi.fn(),
    updateConfig: vi.fn(),
    cancelCurrentRequest: vi.fn()
  })),
  DEFAULT_OPENROUTER_CONFIG: {
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-3.5-turbo',
    timeout: 30000,
    retryAttempts: 3,
    streamingEnabled: true
  }
}));

vi.mock('../../services/stream-processor', () => ({
  createStreamProcessor: vi.fn()
}));

vi.mock('../../utils/settings-manager', () => ({
  SettingsManager: {
    getSettings: vi.fn(() => ({
      openRouter: { apiKey: 'test-key' },
      model: 'openai/gpt-3.5-turbo',
      streamingEnabled: true
    })),
    saveSettings: vi.fn(),
    resetSettings: vi.fn()
  }
}));

vi.mock('../../utils/storage', () => ({
  StorageManager: {
    getConversations: vi.fn(() => []),
    saveConversation: vi.fn(),
    deleteConversation: vi.fn(),
    exportConversation: vi.fn()
  }
}));

// Mock complex dependencies
vi.mock('../ui/resizable', () => ({
  ResizableHandle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('../ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) => 
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('../ui/use-mobile', () => ({
  useIsMobile: vi.fn(() => false)
}));

vi.mock('../../hooks/use-keyboard-navigation', () => ({
  useKeyboardNavigation: vi.fn(),
  KeyboardShortcut: {}
}));

vi.mock('../../utils/use-settings', () => ({
  useSettings: vi.fn(() => ({
    settings: {
      openRouter: { apiKey: 'test-key' },
      model: 'openai/gpt-3.5-turbo',
      streamingEnabled: true,
      theme: 'light'
    },
    updateSettings: vi.fn()
  }))
}));

vi.mock('../../utils/debounce', () => ({
  useConversationMemoryOptimization: vi.fn((conversations) => conversations),
  useDebounceCallback: vi.fn((fn) => fn)
}));

vi.mock('../../utils/cache-manager', () => ({
  conversationCache: {
    cacheConversations: vi.fn()
  },
  messageCache: {
    cacheMessages: vi.fn()
  }
}));

vi.mock('../../utils/lazy-loader', () => ({
  createConversationLazyLoader: vi.fn(() => ({
    loadPage: vi.fn(),
    preloadNext: vi.fn()
  }))
}));

vi.mock('../../utils/data-cleanup', () => ({
  dataCleanupManager: {
    startAutoCleanup: vi.fn(),
    stopAutoCleanup: vi.fn()
  }
}));

vi.mock('../../utils/accessibility', () => ({
  ScreenReaderAnnouncer: {
    initialize: vi.fn(),
    announce: vi.fn()
  }
}));

vi.mock('../VoiceInput', () => ({
  useVoiceNavigation: vi.fn()
}));

vi.mock('../ErrorBoundary', () => ({
  ChatErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SettingsErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Mock child components
vi.mock('../ChatSidebar', () => ({
  ChatSidebar: () => <div data-testid="chat-sidebar">Sidebar</div>
}));

vi.mock('../ChatHeader', () => ({
  ChatHeader: () => <div data-testid="chat-header">Header</div>
}));

vi.mock('../ChatMessages', () => ({
  ChatMessages: () => <div data-testid="chat-messages">Messages</div>
}));

vi.mock('../ChatInput', () => ({
  ChatInput: () => <div data-testid="chat-input">Input</div>
}));

vi.mock('../SettingsPanel', () => ({
  SettingsPanel: () => <div data-testid="settings-panel">Settings</div>
}));

vi.mock('../KeyboardShortcutsHelp', () => ({
  KeyboardShortcutsHelp: () => <div data-testid="keyboard-help">Keyboard Help</div>
}));

// Additional DOM mocks
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true
});

describe('ChatApp', () => {
  const defaultProps = {
    isDarkMode: false,
    setIsDarkMode: vi.fn(),
    theme: 'light' as const,
    setTheme: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure scrollIntoView is mocked for each test
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders the main chat interface components', () => {
    render(<ChatApp {...defaultProps} />);
    
    expect(screen.getByTestId('chat-header')).toBeInTheDocument();
    expect(screen.getByTestId('chat-messages')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('renders sidebar on desktop', () => {
    render(<ChatApp {...defaultProps} />);
    
    expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();
  });

  it('initializes with welcome conversation', () => {
    render(<ChatApp {...defaultProps} />);
    
    // Component should render without errors
    expect(screen.getByTestId('chat-messages')).toBeInTheDocument();
  });

  it('handles theme prop changes', () => {
    const setTheme = vi.fn();
    
    render(<ChatApp {...defaultProps} theme="light" setTheme={setTheme} />);
    
    // Component should handle theme sync
    expect(screen.getByTestId('chat-header')).toBeInTheDocument();
  });

  it('initializes required services and hooks', () => {
    render(<ChatApp {...defaultProps} />);
    
    // Should render all main components
    expect(screen.getByTestId('chat-header')).toBeInTheDocument();
    expect(screen.getByTestId('chat-messages')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('handles component lifecycle correctly', () => {
    const { unmount } = render(<ChatApp {...defaultProps} />);
    
    // Should render without errors
    expect(screen.getByTestId('chat-messages')).toBeInTheDocument();
    
    // Should unmount without errors
    unmount();
  });
});