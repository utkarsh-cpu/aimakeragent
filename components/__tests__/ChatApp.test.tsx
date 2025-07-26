import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('ChatApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders the main chat interface', () => {
    render(<ChatApp />);
    
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText(/chat interface/i)).toBeInTheDocument();
  });

  it('shows API key setup when no key is configured', () => {
    const { SettingsManager } = require('../../utils/settings-manager');
    SettingsManager.getSettings.mockReturnValue({
      openRouter: { apiKey: '' },
      model: 'openai/gpt-3.5-turbo'
    });

    render(<ChatApp />);
    
    expect(screen.getByText(/api key required/i)).toBeInTheDocument();
  });

  it('handles message sending', async () => {
    const user = userEvent.setup();
    const mockSendMessage = vi.fn().mockResolvedValue({
      id: '2',
      content: 'AI response',
      role: 'assistant',
      timestamp: new Date()
    });

    const { OpenRouterService } = require('../../services/openrouter');
    OpenRouterService.mockImplementation(() => ({
      sendMessage: mockSendMessage,
      getModels: vi.fn(),
      validateApiKey: vi.fn(),
      updateConfig: vi.fn(),
      cancelCurrentRequest: vi.fn()
    }));

    render(<ChatApp />);
    
    const input = screen.getByPlaceholderText(/type your message/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Hello AI');
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalled();
    });
  });

  it('handles streaming responses', async () => {
    const user = userEvent.setup();
    const mockStreamProcessor = {
      processChunk: vi.fn(),
      complete: vi.fn(),
      error: vi.fn(),
      cancel: vi.fn(),
      isProcessing: vi.fn(() => true)
    };

    const { createStreamProcessor } = require('../../services/stream-processor');
    createStreamProcessor.mockReturnValue(mockStreamProcessor);

    render(<ChatApp />);
    
    const input = screen.getByPlaceholderText(/type your message/i);
    await user.type(input, 'Stream test');
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);

    expect(createStreamProcessor).toHaveBeenCalled();
  });

  it('handles conversation switching', async () => {
    const user = userEvent.setup();
    const { StorageManager } = require('../../utils/storage');
    StorageManager.getConversations.mockReturnValue([
      {
        id: '1',
        title: 'Conversation 1',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        title: 'Conversation 2',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    render(<ChatApp />);
    
    const conversationButton = screen.getByText('Conversation 2');
    await user.click(conversationButton);

    expect(screen.getByText('Conversation 2')).toHaveClass('active');
  });

  it('handles settings updates', async () => {
    const user = userEvent.setup();
    const { SettingsManager } = require('../../utils/settings-manager');
    const mockSaveSettings = vi.fn();
    SettingsManager.saveSettings = mockSaveSettings;

    render(<ChatApp />);
    
    const settingsButton = screen.getByRole('button', { name: /settings/i });
    await user.click(settingsButton);

    const modelSelect = screen.getByRole('combobox', { name: /model/i });
    await user.selectOptions(modelSelect, 'openai/gpt-4');

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalled();
    });
  });

  it('handles error states gracefully', async () => {
    const user = userEvent.setup();
    const mockSendMessage = vi.fn().mockRejectedValue(new Error('API Error'));

    const { OpenRouterService } = require('../../services/openrouter');
    OpenRouterService.mockImplementation(() => ({
      sendMessage: mockSendMessage,
      getModels: vi.fn(),
      validateApiKey: vi.fn(),
      updateConfig: vi.fn(),
      cancelCurrentRequest: vi.fn()
    }));

    render(<ChatApp />);
    
    const input = screen.getByPlaceholderText(/type your message/i);
    await user.type(input, 'Error test');
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
    });
  });

  it('supports keyboard shortcuts', async () => {
    const user = userEvent.setup();
    render(<ChatApp />);
    
    // Test Ctrl+N for new conversation
    await user.keyboard('{Control>}n{/Control}');
    expect(screen.getByText(/new conversation/i)).toBeInTheDocument();

    // Test Ctrl+/ for shortcuts help
    await user.keyboard('{Control>}/{/Control}');
    expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument();
  });

  it('handles offline state', () => {
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    render(<ChatApp />);
    
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });

  it('manages conversation state correctly', async () => {
    const user = userEvent.setup();
    render(<ChatApp />);
    
    // Send first message
    const input = screen.getByPlaceholderText(/type your message/i);
    await user.type(input, 'First message');
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);

    expect(screen.getByText('First message')).toBeInTheDocument();
  });
});