import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatApp } from '../../components/ChatApp';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock all external dependencies
vi.mock('../../services/openrouter', () => ({
  OpenRouterService: vi.fn().mockImplementation(() => ({
    sendMessage: vi.fn(),
    getModels: vi.fn().mockResolvedValue([
      { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
      { id: 'openai/gpt-4', name: 'GPT-4' }
    ]),
    validateApiKey: vi.fn().mockResolvedValue(true),
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
  createStreamProcessor: vi.fn().mockImplementation((onToken, onComplete, onError) => ({
    processChunk: vi.fn((chunk) => {
      // Simulate streaming response
      if (chunk.includes('Hello')) {
        onToken('Hello');
      }
      if (chunk.includes('[DONE]')) {
        onComplete('Hello, how can I help you today?');
      }
    }),
    complete: vi.fn(() => onComplete('Hello, how can I help you today?')),
    error: vi.fn((error) => onError(error)),
    cancel: vi.fn(),
    isProcessing: vi.fn(() => false)
  }))
}));

vi.mock('../../utils/settings-manager', () => ({
  SettingsManager: {
    getSettings: vi.fn(() => ({
      openRouter: { apiKey: 'sk-test-key-123' },
      model: 'openai/gpt-3.5-turbo',
      streamingEnabled: true,
      theme: 'light',
      fontSize: 14
    })),
    saveSettings: vi.fn(),
    resetSettings: vi.fn(),
    exportSettings: vi.fn(),
    importSettings: vi.fn()
  }
}));

vi.mock('../../utils/storage', () => ({
  StorageManager: {
    getConversations: vi.fn(() => []),
    saveConversation: vi.fn(),
    deleteConversation: vi.fn(),
    exportConversation: vi.fn(),
    importConversations: vi.fn()
  }
}));

describe('Chat Flow Integration Tests', () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let mockSaveConversation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    const { OpenRouterService } = require('../../services/openrouter');
    const { StorageManager } = require('../../utils/storage');
    
    mockSendMessage = vi.fn().mockResolvedValue({
      id: '2',
      content: 'Hello, how can I help you today?',
      role: 'assistant',
      timestamp: new Date()
    });
    
    mockSaveConversation = vi.fn();
    
    OpenRouterService.mockImplementation(() => ({
      sendMessage: mockSendMessage,
      getModels: vi.fn().mockResolvedValue([
        { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        { id: 'openai/gpt-4', name: 'GPT-4' }
      ]),
      validateApiKey: vi.fn().mockResolvedValue(true),
      updateConfig: vi.fn(),
      cancelCurrentRequest: vi.fn()
    }));
    
    StorageManager.saveConversation = mockSaveConversation;
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('completes full chat conversation flow', async () => {
    const user = userEvent.setup();
    render(<ChatApp />);

    // 1. User sends first message
    const input = screen.getByPlaceholderText(/type your message/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Hello, AI!');
    await user.click(sendButton);

    // 2. Verify user message appears
    expect(screen.getByText('Hello, AI!')).toBeInTheDocument();

    // 3. Wait for AI response
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: 'Hello, AI!',
            role: 'user'
          })
        ]),
        expect.any(Object)
      );
    });

    // 4. Verify AI response appears
    await waitFor(() => {
      expect(screen.getByText('Hello, how can I help you today?')).toBeInTheDocument();
    });

    // 5. Verify conversation is saved
    expect(mockSaveConversation).toHaveBeenCalled();

    // 6. Send follow-up message
    await user.type(input, 'What is the weather like?');
    await user.click(sendButton);

    // 7. Verify follow-up message appears
    expect(screen.getByText('What is the weather like?')).toBeInTheDocument();

    // 8. Verify conversation context is maintained
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ content: 'Hello, AI!', role: 'user' }),
          expect.objectContaining({ content: 'Hello, how can I help you today?', role: 'assistant' }),
          expect.objectContaining({ content: 'What is the weather like?', role: 'user' })
        ]),
        expect.any(Object)
      );
    });
  });

  it('handles streaming response flow', async () => {
    const user = userEvent.setup();
    const { createStreamProcessor } = require('../../services/stream-processor');
    
    let onToken: (token: string) => void;
    let onComplete: (response: string) => void;
    
    createStreamProcessor.mockImplementation((tokenCallback, completeCallback) => {
      onToken = tokenCallback;
      onComplete = completeCallback;
      return {
        processChunk: vi.fn(),
        complete: vi.fn(),
        error: vi.fn(),
        cancel: vi.fn(),
        isProcessing: vi.fn(() => true)
      };
    });

    render(<ChatApp />);

    const input = screen.getByPlaceholderText(/type your message/i);
    await user.type(input, 'Tell me a story');
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);

    // Simulate streaming tokens
    await waitFor(() => {
      expect(createStreamProcessor).toHaveBeenCalled();
    });

    // Simulate receiving streaming tokens
    act(() => {
      onToken('Once');
      onToken(' upon');
      onToken(' a');
      onToken(' time');
    });

    // Verify partial response is shown
    expect(screen.getByText(/Once upon a time/)).toBeInTheDocument();

    // Complete the stream
    act(() => {
      onComplete('Once upon a time, there was a brave knight...');
    });

    // Verify complete response
    await waitFor(() => {
      expect(screen.getByText('Once upon a time, there was a brave knight...')).toBeInTheDocument();
    });
  });

  it('handles conversation management flow', async () => {
    const user = userEvent.setup();
    const { StorageManager } = require('../../utils/storage');
    
    // Mock existing conversations
    StorageManager.getConversations.mockReturnValue([
      {
        id: 'conv1',
        title: 'Previous Chat',
        messages: [
          { id: '1', content: 'Previous message', role: 'user', timestamp: new Date() }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    render(<ChatApp />);

    // 1. Create new conversation
    const newConversationButton = screen.getByRole('button', { name: /new conversation/i });
    await user.click(newConversationButton);

    // 2. Verify new conversation is created
    expect(screen.getByText(/new conversation/i)).toBeInTheDocument();

    // 3. Switch to previous conversation
    const previousChatButton = screen.getByText('Previous Chat');
    await user.click(previousChatButton);

    // 4. Verify previous messages are loaded
    expect(screen.getByText('Previous message')).toBeInTheDocument();

    // 5. Delete conversation
    const deleteButton = screen.getByRole('button', { name: /delete conversation/i });
    await user.click(deleteButton);

    // 6. Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    // 7. Verify conversation is deleted
    expect(StorageManager.deleteConversation).toHaveBeenCalledWith('conv1');
  });

  it('handles settings configuration flow', async () => {
    const user = userEvent.setup();
    const { SettingsManager } = require('../../utils/settings-manager');
    const mockSaveSettings = vi.fn();
    SettingsManager.saveSettings = mockSaveSettings;

    render(<ChatApp />);

    // 1. Open settings
    const settingsButton = screen.getByRole('button', { name: /settings/i });
    await user.click(settingsButton);

    // 2. Change model
    const modelSelect = screen.getByRole('combobox', { name: /model/i });
    await user.selectOptions(modelSelect, 'openai/gpt-4');

    // 3. Update API key
    const apiKeyInput = screen.getByLabelText(/api key/i);
    await user.clear(apiKeyInput);
    await user.type(apiKeyInput, 'sk-new-key-456');

    // 4. Toggle streaming
    const streamingToggle = screen.getByRole('switch', { name: /streaming/i });
    await user.click(streamingToggle);

    // 5. Save settings
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // 6. Verify settings are saved
    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'openai/gpt-4',
          openRouter: expect.objectContaining({
            apiKey: 'sk-new-key-456'
          }),
          streamingEnabled: false
        })
      );
    });

    // 7. Verify success message
    expect(screen.getByText(/settings saved/i)).toBeInTheDocument();
  });

  it('handles error recovery flow', async () => {
    const user = userEvent.setup();
    
    // Mock API error
    mockSendMessage.mockRejectedValueOnce(new Error('API Error: Rate limit exceeded'));

    render(<ChatApp />);

    const input = screen.getByPlaceholderText(/type your message/i);
    await user.type(input, 'This will fail');
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);

    // 1. Verify error message appears
    await waitFor(() => {
      expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument();
    });

    // 2. Click retry button
    const retryButton = screen.getByRole('button', { name: /retry/i });
    
    // Mock successful retry
    mockSendMessage.mockResolvedValueOnce({
      id: '2',
      content: 'Success after retry',
      role: 'assistant',
      timestamp: new Date()
    });

    await user.click(retryButton);

    // 3. Verify successful response after retry
    await waitFor(() => {
      expect(screen.getByText('Success after retry')).toBeInTheDocument();
    });

    // 4. Verify error message is cleared
    expect(screen.queryByText(/rate limit exceeded/i)).not.toBeInTheDocument();
  });

  it('handles offline/online state transitions', async () => {
    const user = userEvent.setup();
    
    render(<ChatApp />);

    // 1. Simulate going offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    fireEvent(window, new Event('offline'));

    // 2. Verify offline indicator
    await waitFor(() => {
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });

    // 3. Try to send message while offline
    const input = screen.getByPlaceholderText(/type your message/i);
    await user.type(input, 'Offline message');
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();

    // 4. Simulate going back online
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    fireEvent(window, new Event('online'));

    // 5. Verify online state restored
    await waitFor(() => {
      expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
    });

    // 6. Verify send button is enabled
    expect(sendButton).not.toBeDisabled();

    // 7. Send queued message
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalled();
    });
  });

  it('handles keyboard shortcuts flow', async () => {
    const user = userEvent.setup();
    render(<ChatApp />);

    // 1. Test new conversation shortcut (Ctrl+N)
    await user.keyboard('{Control>}n{/Control}');
    expect(screen.getByText(/new conversation/i)).toBeInTheDocument();

    // 2. Test settings shortcut (Ctrl+,)
    await user.keyboard('{Control>},{/Control}');
    expect(screen.getByRole('dialog', { name: /settings/i })).toBeInTheDocument();

    // 3. Close settings with Escape
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /settings/i })).not.toBeInTheDocument();

    // 4. Test search shortcut (Ctrl+F)
    await user.keyboard('{Control>}f{/Control}');
    expect(screen.getByPlaceholderText(/search messages/i)).toBeInTheDocument();

    // 5. Test help shortcut (Ctrl+?)
    await user.keyboard('{Control>}/{/Control}');
    expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument();
  });

  it('handles message editing flow', async () => {
    const user = userEvent.setup();
    render(<ChatApp />);

    // 1. Send initial message
    const input = screen.getByPlaceholderText(/type your message/i);
    await user.type(input, 'Original message');
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);

    // 2. Wait for message to appear
    await waitFor(() => {
      expect(screen.getByText('Original message')).toBeInTheDocument();
    });

    // 3. Click edit button
    const messageElement = screen.getByText('Original message').closest('[data-message-id]');
    fireEvent.mouseEnter(messageElement!);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    await user.click(editButton);

    // 4. Edit the message
    const editInput = screen.getByDisplayValue('Original message');
    await user.clear(editInput);
    await user.type(editInput, 'Edited message');

    // 5. Save the edit
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // 6. Verify edited message appears
    await waitFor(() => {
      expect(screen.getByText('Edited message')).toBeInTheDocument();
      expect(screen.getByText('(edited)')).toBeInTheDocument();
    });

    // 7. Verify original message is gone
    expect(screen.queryByText('Original message')).not.toBeInTheDocument();
  });

  it('handles file upload flow', async () => {
    const user = userEvent.setup();
    render(<ChatApp />);

    // 1. Click file upload button
    const uploadButton = screen.getByRole('button', { name: /upload file/i });
    await user.click(uploadButton);

    // 2. Select file (mocked)
    const fileInput = screen.getByLabelText(/choose file/i);
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    await user.upload(fileInput, file);

    // 3. Verify file is selected
    expect(screen.getByText('test.txt')).toBeInTheDocument();

    // 4. Add message with file
    const input = screen.getByPlaceholderText(/type your message/i);
    await user.type(input, 'Message with attachment');

    // 5. Send message
    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);

    // 6. Verify message with attachment is sent
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: 'Message with attachment',
            attachments: expect.arrayContaining([
              expect.objectContaining({ name: 'test.txt' })
            ])
          })
        ]),
        expect.any(Object)
      );
    });
  });
});