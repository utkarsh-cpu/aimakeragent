import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ChatApp } from '../../components/ChatApp';
import { ChatInput } from '../../components/ChatInput';
import { VirtualizedChatMessages } from '../../components/VirtualizedChatMessages';
import { SettingsPanel } from '../../components/SettingsPanel';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
vi.mock('../../services/openrouter', () => ({
  OpenRouterService: vi.fn().mockImplementation(() => ({
    sendMessage: vi.fn(),
    getModels: vi.fn().mockResolvedValue([]),
    validateApiKey: vi.fn(),
    updateConfig: vi.fn(),
    cancelCurrentRequest: vi.fn()
  })),
  DEFAULT_OPENROUTER_CONFIG: {
    apiKey: 'test-key',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-3.5-turbo'
  }
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
    deleteConversation: vi.fn()
  }
}));

describe('Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ChatApp Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<ChatApp />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA landmarks', () => {
      render(<ChatApp />);
      
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('complementary')).toBeInTheDocument(); // Sidebar
      expect(screen.getByRole('log')).toBeInTheDocument(); // Messages area
    });

    it('should have proper heading hierarchy', () => {
      render(<ChatApp />);
      
      const headings = screen.getAllByRole('heading');
      expect(headings[0]).toHaveAttribute('aria-level', '1');
      
      // Verify heading levels are sequential
      headings.forEach((heading, index) => {
        const level = parseInt(heading.getAttribute('aria-level') || '1');
        if (index > 0) {
          const prevLevel = parseInt(headings[index - 1].getAttribute('aria-level') || '1');
          expect(level).toBeLessThanOrEqual(prevLevel + 1);
        }
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ChatApp />);
      
      // Test Tab navigation
      await user.tab();
      expect(document.activeElement).toHaveAttribute('role', 'button');
      
      // Test arrow key navigation in message list
      const messageList = screen.getByRole('log');
      messageList.focus();
      
      await user.keyboard('{ArrowDown}');
      expect(messageList).toHaveAttribute('aria-activedescendant');
    });

    it('should announce dynamic content changes', async () => {
      const user = userEvent.setup();
      render(<ChatApp />);
      
      // Send a message
      const input = screen.getByPlaceholderText(/type your message/i);
      await user.type(input, 'Test message');
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);
      
      // Verify live region for announcements
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
    });

    it('should have proper focus management', async () => {
      const user = userEvent.setup();
      render(<ChatApp />);
      
      // Open settings dialog
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);
      
      // Focus should move to dialog
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveFocus();
      
      // Close dialog with Escape
      await user.keyboard('{Escape}');
      
      // Focus should return to settings button
      expect(settingsButton).toHaveFocus();
    });
  });

  describe('ChatInput Accessibility', () => {
    const defaultProps = {
      onSendMessage: vi.fn(),
      disabled: false,
      placeholder: 'Type your message...'
    };

    it('should not have accessibility violations', async () => {
      const { container } = render(<ChatInput {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper labels and descriptions', () => {
      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAccessibleName();
      expect(input).toHaveAccessibleDescription();
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toHaveAccessibleName();
    });

    it('should announce validation errors', async () => {
      const user = userEvent.setup();
      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i });
      
      // Try to send empty message
      await user.click(sendButton);
      
      // Error should be announced
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
    });

    it('should support screen reader shortcuts', async () => {
      const user = userEvent.setup();
      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      // Test formatting shortcuts with screen reader
      await user.type(input, 'bold text');
      await user.keyboard('{Control>}a{/Control}'); // Select all
      await user.keyboard('{Control>}b{/Control}'); // Bold
      
      expect(input).toHaveValue('**bold text**');
      
      // Verify formatting is announced
      const announcement = screen.getByRole('status');
      expect(announcement).toHaveTextContent(/bold formatting applied/i);
    });

    it('should have proper ARIA attributes for rich text features', () => {
      render(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-multiline', 'true');
      expect(input).toHaveAttribute('aria-expanded', 'false'); // For formatting toolbar
      
      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toHaveAttribute('aria-label', 'Text formatting');
      
      const boldButton = screen.getByRole('button', { name: /bold/i });
      expect(boldButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('VirtualizedChatMessages Accessibility', () => {
    const mockMessages = [
      {
        id: '1',
        content: 'Hello world',
        role: 'user' as const,
        timestamp: new Date(),
        isEdited: false
      },
      {
        id: '2',
        content: 'Hi there!',
        role: 'assistant' as const,
        timestamp: new Date(),
        isEdited: false
      }
    ];

    const defaultProps = {
      messages: mockMessages,
      onMessageEdit: vi.fn(),
      onMessageDelete: vi.fn(),
      onMessageRegenerate: vi.fn(),
      onMessageCopy: vi.fn(),
      onMessageRate: vi.fn(),
      isStreaming: false,
      streamingMessageId: null
    };

    it('should not have accessibility violations', async () => {
      const { container } = render(<VirtualizedChatMessages {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA structure for messages', () => {
      render(<VirtualizedChatMessages {...defaultProps} />);
      
      const messageList = screen.getByRole('log');
      expect(messageList).toHaveAttribute('aria-label', 'Chat messages');
      expect(messageList).toHaveAttribute('aria-live', 'polite');
      
      const messages = screen.getAllByRole('article');
      expect(messages).toHaveLength(2);
      
      messages.forEach((message, index) => {
        expect(message).toHaveAttribute('aria-label', expect.stringContaining('Message'));
        expect(message).toHaveAttribute('tabindex', '0');
      });
    });

    it('should support keyboard navigation between messages', async () => {
      const user = userEvent.setup();
      render(<VirtualizedChatMessages {...defaultProps} />);
      
      const messageList = screen.getByRole('log');
      await user.click(messageList);
      
      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}');
      expect(messageList).toHaveAttribute('aria-activedescendant', 'message-1');
      
      await user.keyboard('{ArrowDown}');
      expect(messageList).toHaveAttribute('aria-activedescendant', 'message-2');
      
      await user.keyboard('{ArrowUp}');
      expect(messageList).toHaveAttribute('aria-activedescendant', 'message-1');
    });

    it('should announce streaming messages', () => {
      render(
        <VirtualizedChatMessages 
          {...defaultProps} 
          isStreaming={true}
          streamingMessageId="2"
        />
      );
      
      const streamingIndicator = screen.getByRole('status');
      expect(streamingIndicator).toHaveAttribute('aria-live', 'assertive');
      expect(streamingIndicator).toHaveTextContent(/typing/i);
    });

    it('should have accessible message actions', async () => {
      const user = userEvent.setup();
      render(<VirtualizedChatMessages {...defaultProps} />);
      
      const message = screen.getAllByRole('article')[0];
      await user.hover(message);
      
      // Message actions should be accessible
      const editButton = screen.getByRole('button', { name: /edit message/i });
      expect(editButton).toHaveAttribute('aria-label', expect.stringContaining('Edit'));
      
      const deleteButton = screen.getByRole('button', { name: /delete message/i });
      expect(deleteButton).toHaveAttribute('aria-label', expect.stringContaining('Delete'));
      
      const copyButton = screen.getByRole('button', { name: /copy message/i });
      expect(copyButton).toHaveAttribute('aria-label', expect.stringContaining('Copy'));
    });

    it('should support high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(<VirtualizedChatMessages {...defaultProps} />);
      
      const messages = screen.getAllByRole('article');
      messages.forEach(message => {
        expect(message).toHaveClass('high-contrast');
      });
    });
  });

  describe('SettingsPanel Accessibility', () => {
    const defaultProps = {
      isOpen: true,
      onClose: vi.fn(),
      onSave: vi.fn()
    };

    it('should not have accessibility violations', async () => {
      const { container } = render(<SettingsPanel {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper dialog structure', () => {
      render(<SettingsPanel {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-describedby');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      
      const title = screen.getByRole('heading', { level: 2 });
      expect(title).toHaveTextContent(/settings/i);
    });

    it('should trap focus within dialog', async () => {
      const user = userEvent.setup();
      render(<SettingsPanel {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      const firstInput = screen.getAllByRole('textbox')[0];
      const lastButton = screen.getByRole('button', { name: /save/i });
      
      // Focus should start on first focusable element
      expect(firstInput).toHaveFocus();
      
      // Tab to last element
      await user.tab({ shift: true });
      expect(lastButton).toHaveFocus();
      
      // Tab should wrap to first element
      await user.tab();
      expect(firstInput).toHaveFocus();
    });

    it('should have proper form labels and descriptions', () => {
      render(<SettingsPanel {...defaultProps} />);
      
      const apiKeyInput = screen.getByLabelText(/api key/i);
      expect(apiKeyInput).toHaveAccessibleName();
      expect(apiKeyInput).toHaveAccessibleDescription();
      
      const modelSelect = screen.getByLabelText(/model/i);
      expect(modelSelect).toHaveAccessibleName();
      
      const streamingToggle = screen.getByRole('switch');
      expect(streamingToggle).toHaveAccessibleName();
    });

    it('should announce form validation errors', async () => {
      const user = userEvent.setup();
      render(<SettingsPanel {...defaultProps} />);
      
      const apiKeyInput = screen.getByLabelText(/api key/i);
      const saveButton = screen.getByRole('button', { name: /save/i });
      
      // Clear API key and try to save
      await user.clear(apiKeyInput);
      await user.click(saveButton);
      
      // Error should be announced
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(apiKeyInput).toHaveAttribute('aria-invalid', 'true');
    });

    it('should support reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(<SettingsPanel {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('reduce-motion');
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    it('should meet WCAG color contrast requirements', async () => {
      const { container } = render(<ChatApp />);
      
      // This would typically use a tool like axe-core to check contrast
      // For now, we'll verify that contrast classes are applied
      const textElements = container.querySelectorAll('[class*="text-"]');
      textElements.forEach(element => {
        expect(element).toHaveClass(expect.stringMatching(/text-(gray|slate|zinc)-/));
      });
    });

    it('should support dark mode with proper contrast', () => {
      // Mock dark mode preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(<ChatApp />);
      
      const main = screen.getByRole('main');
      expect(main).toHaveClass('dark');
    });

    it('should scale properly with font size preferences', () => {
      // Mock large font preference
      document.documentElement.style.fontSize = '20px';
      
      render(<ChatApp />);
      
      const textElements = screen.getAllByText(/./);
      textElements.forEach(element => {
        const computedStyle = window.getComputedStyle(element);
        expect(parseFloat(computedStyle.fontSize)).toBeGreaterThanOrEqual(16);
      });
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide meaningful alternative text for images', () => {
      render(<ChatApp />);
      
      const images = screen.getAllByRole('img');
      images.forEach(img => {
        expect(img).toHaveAttribute('alt');
        expect(img.getAttribute('alt')).not.toBe('');
      });
    });

    it('should use semantic HTML elements', () => {
      render(<ChatApp />);
      
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('complementary')).toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(expect.any(Number));
      expect(screen.getAllByRole('textbox')).toHaveLength(expect.any(Number));
    });

    it('should provide status updates for dynamic content', async () => {
      const user = userEvent.setup();
      render(<ChatApp />);
      
      // Send a message
      const input = screen.getByPlaceholderText(/type your message/i);
      await user.type(input, 'Test message');
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);
      
      // Status should be announced
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveTextContent(/message sent/i);
    });
  });

  describe('Motor Accessibility', () => {
    it('should have large enough click targets', () => {
      render(<ChatApp />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        expect(Math.min(rect.width, rect.height)).toBeGreaterThanOrEqual(44);
      });
    });

    it('should support sticky hover states', async () => {
      const user = userEvent.setup();
      render(<ChatApp />);
      
      const button = screen.getByRole('button', { name: /send/i });
      
      // Simulate touch interaction
      await user.pointer({ target: button, keys: '[TouchA>]' });
      expect(button).toHaveClass('hover');
      
      await user.pointer({ keys: '[/TouchA]' });
      expect(button).toHaveClass('hover'); // Should remain hovered
    });

    it('should provide adequate spacing between interactive elements', () => {
      render(<ChatApp />);
      
      const buttons = screen.getAllByRole('button');
      
      // Check spacing between adjacent buttons
      for (let i = 0; i < buttons.length - 1; i++) {
        const current = buttons[i].getBoundingClientRect();
        const next = buttons[i + 1].getBoundingClientRect();
        
        const horizontalGap = Math.abs(current.right - next.left);
        const verticalGap = Math.abs(current.bottom - next.top);
        
        // At least 8px gap between buttons
        expect(Math.min(horizontalGap, verticalGap)).toBeGreaterThanOrEqual(8);
      }
    });
  });
});