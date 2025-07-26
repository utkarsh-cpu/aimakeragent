import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '../ChatInput';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock dependencies
vi.mock('../../utils/validation', () => ({
  InputValidator: {
    validateMessage: vi.fn((content: string) => {
      if (!content.trim()) {
        return { isValid: false, error: 'Message cannot be empty' };
      }
      if (content.length > 50000) {
        return { isValid: false, error: 'Message is too long' };
      }
      return { isValid: true };
    }),
    countTokens: vi.fn((content: string) => Math.ceil(content.length / 4))
  }
}));

vi.mock('../../components/VoiceInput', () => ({
  VoiceInput: ({ onTranscript }: { onTranscript: (text: string) => void }) => (
    <button onClick={() => onTranscript('Voice input test')}>
      Voice Input
    </button>
  )
}));

vi.mock('../../components/FileUpload', () => ({
  FileUpload: ({ onFileSelect }: { onFileSelect: (files: File[]) => void }) => (
    <button onClick={() => onFileSelect([new File(['test'], 'test.txt')])}>
      Upload File
    </button>
  )
}));

describe('ChatInput', () => {
  const defaultProps = {
    onSendMessage: vi.fn(),
    disabled: false,
    placeholder: 'Type your message...'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the input field', () => {
    render(<ChatInput {...defaultProps} />);
    
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('handles text input', async () => {
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, 'Hello world');
    
    expect(input).toHaveValue('Hello world');
  });

  it('sends message on button click', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();
    render(<ChatInput {...defaultProps} onSendMessage={onSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    await user.type(input, 'Test message');
    await user.click(sendButton);
    
    expect(onSendMessage).toHaveBeenCalledWith('Test message', []);
    expect(input).toHaveValue('');
  });

  it('sends message on Enter key', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();
    render(<ChatInput {...defaultProps} onSendMessage={onSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, 'Enter test');
    await user.keyboard('{Enter}');
    
    expect(onSendMessage).toHaveBeenCalledWith('Enter test', []);
  });

  it('adds new line on Shift+Enter', async () => {
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, 'Line 1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(input, 'Line 2');
    
    expect(input).toHaveValue('Line 1\nLine 2');
  });

  it('shows character count', async () => {
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, 'Test');
    
    expect(screen.getByText(/4\/50,000/)).toBeInTheDocument();
  });

  it('shows token count', async () => {
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, 'Test message');
    
    expect(screen.getByText(/3 tokens/)).toBeInTheDocument();
  });

  it('disables send button when input is empty', () => {
    render(<ChatInput {...defaultProps} />);
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it('disables send button when validation fails', async () => {
    const user = userEvent.setup();
    const { InputValidator } = require('../../utils/validation');
    InputValidator.validateMessage.mockReturnValue({
      isValid: false,
      error: 'Invalid message'
    });

    render(<ChatInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, 'Invalid');
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
    expect(screen.getByText('Invalid message')).toBeInTheDocument();
  });

  it('handles voice input', async () => {
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} />);
    
    const voiceButton = screen.getByText('Voice Input');
    await user.click(voiceButton);
    
    const input = screen.getByPlaceholderText('Type your message...');
    expect(input).toHaveValue('Voice input test');
  });

  it('handles file upload', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();
    render(<ChatInput {...defaultProps} onSendMessage={onSendMessage} />);
    
    const uploadButton = screen.getByText('Upload File');
    await user.click(uploadButton);
    
    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, 'Message with file');
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);
    
    expect(onSendMessage).toHaveBeenCalledWith('Message with file', [
      expect.objectContaining({ name: 'test.txt' })
    ]);
  });

  it('supports markdown formatting shortcuts', async () => {
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, 'bold text');
    
    // Select text
    fireEvent.select(input, { target: { selectionStart: 0, selectionEnd: 9 } });
    
    // Apply bold formatting (Ctrl+B)
    await user.keyboard('{Control>}b{/Control}');
    
    expect(input).toHaveValue('**bold text**');
  });

  it('shows formatting toolbar', () => {
    render(<ChatInput {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /code/i })).toBeInTheDocument();
  });

  it('handles paste events', async () => {
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    await user.click(input);
    
    // Simulate paste
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', 'Pasted text');
    
    fireEvent.paste(input, {
      clipboardData
    });
    
    expect(input).toHaveValue('Pasted text');
  });

  it('auto-resizes textarea', async () => {
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const initialHeight = input.style.height;
    
    await user.type(input, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
    
    // Height should increase (exact value depends on implementation)
    expect(input.style.height).not.toBe(initialHeight);
  });

  it('handles disabled state', () => {
    render(<ChatInput {...defaultProps} disabled={true} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('shows loading state when sending', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
    render(<ChatInput {...defaultProps} onSendMessage={onSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    await user.type(input, 'Loading test');
    await user.click(sendButton);
    
    expect(screen.getByText(/sending/i)).toBeInTheDocument();
    expect(sendButton).toBeDisabled();
  });

  it('preserves draft when component unmounts', async () => {
    const user = userEvent.setup();
    const { rerender, unmount } = render(<ChatInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, 'Draft message');
    
    unmount();
    
    // Re-render and check if draft is restored
    rerender(<ChatInput {...defaultProps} />);
    const newInput = screen.getByPlaceholderText('Type your message...');
    expect(newInput).toHaveValue('Draft message');
  });

  it('clears input after successful send', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn().mockResolvedValue(undefined);
    render(<ChatInput {...defaultProps} onSendMessage={onSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, 'Clear test');
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);
    
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('shows warning for long messages', async () => {
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const longText = 'a'.repeat(45000);
    
    fireEvent.change(input, { target: { value: longText } });
    
    expect(screen.getByText(/approaching character limit/i)).toBeInTheDocument();
  });

  it('supports custom placeholder', () => {
    render(<ChatInput {...defaultProps} placeholder="Custom placeholder" />);
    
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });
});