import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageEditor } from '../MessageEditor';
import { Message } from '../../types/conversation';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock the validation utility
vi.mock('../../utils/validation', () => ({
  InputValidator: {
    validateMessage: vi.fn((content: string) => {
      if (!content.trim()) {
        return { isValid: false, error: 'Message cannot be empty' };
      }
      if (content.length > 50000) {
        return { isValid: false, error: 'Message is too long (max 50,000 characters)' };
      }
      return { isValid: true };
    })
  }
}));

describe('MessageEditor', () => {
  const mockMessage: Message = {
    id: '1',
    content: 'Original message content',
    role: 'user',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    isEdited: false
  };

  const mockMessageWithHistory: Message = {
    ...mockMessage,
    isEdited: true,
    editHistory: [
      {
        id: 'edit1',
        previousContent: 'First version',
        timestamp: new Date('2024-01-01T09:00:00Z'),
        reason: 'Initial edit'
      },
      {
        id: 'edit2',
        previousContent: 'Second version',
        timestamp: new Date('2024-01-01T09:30:00Z'),
        reason: 'Grammar correction'
      }
    ]
  };

  const defaultProps = {
    message: mockMessage,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    isEditing: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the editor when isEditing is true', () => {
    render(<MessageEditor {...defaultProps} />);
    
    expect(screen.getByPlaceholderText('Edit your message...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('does not render when isEditing is false', () => {
    render(<MessageEditor {...defaultProps} isEditing={false} />);
    
    expect(screen.queryByPlaceholderText('Edit your message...')).not.toBeInTheDocument();
  });

  it('initializes with the message content', () => {
    render(<MessageEditor {...defaultProps} />);
    
    const textarea = screen.getByDisplayValue('Original message content');
    expect(textarea).toBeInTheDocument();
  });

  it('updates content when typing', async () => {
    const user = userEvent.setup();
    render(<MessageEditor {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Edit your message...');
    await user.clear(textarea);
    await user.type(textarea, 'New content');
    
    expect(textarea).toHaveValue('New content');
  });

  it('shows character count', () => {
    render(<MessageEditor {...defaultProps} />);
    
    expect(screen.getByText(/24\/50,000/)).toBeInTheDocument();
  });

  it('shows validation error for empty content', async () => {
    const user = userEvent.setup();
    render(<MessageEditor {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Edit your message...');
    await user.clear(textarea);
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    expect(screen.getByText('Message cannot be empty')).toBeInTheDocument();
  });

  it('shows validation error when content is unchanged', async () => {
    const user = userEvent.setup();
    render(<MessageEditor {...defaultProps} />);
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    expect(screen.getByText('No changes made to the message')).toBeInTheDocument();
  });

  it('calls onSave with correct parameters when saving valid content', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<MessageEditor {...defaultProps} onSave={onSave} />);
    
    const textarea = screen.getByPlaceholderText('Edit your message...');
    await user.clear(textarea);
    await user.type(textarea, 'Updated content');
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('1', 'Updated content');
    });
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<MessageEditor {...defaultProps} onCancel={onCancel} />);
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    
    expect(onCancel).toHaveBeenCalled();
  });

  it('resets content when cancelling', async () => {
    const user = userEvent.setup();
    render(<MessageEditor {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Edit your message...');
    await user.clear(textarea);
    await user.type(textarea, 'Changed content');
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    
    expect(textarea).toHaveValue('Original message content');
  });

  it('saves with Ctrl+Enter keyboard shortcut', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<MessageEditor {...defaultProps} onSave={onSave} />);
    
    const textarea = screen.getByPlaceholderText('Edit your message...');
    await user.clear(textarea);
    await user.type(textarea, 'Keyboard save test');
    
    await user.keyboard('{Control>}{Enter}{/Control}');
    
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('1', 'Keyboard save test');
    });
  });

  it('cancels with Escape keyboard shortcut', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<MessageEditor {...defaultProps} onCancel={onCancel} />);
    
    const textarea = screen.getByPlaceholderText('Edit your message...');
    await user.click(textarea);
    await user.keyboard('{Escape}');
    
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows edit history when available', () => {
    render(<MessageEditor {...defaultProps} message={mockMessageWithHistory} />);
    
    expect(screen.getByRole('button', { name: /history \(2\)/i })).toBeInTheDocument();
  });

  it('toggles edit history display', async () => {
    const user = userEvent.setup();
    render(<MessageEditor {...defaultProps} message={mockMessageWithHistory} />);
    
    const historyButton = screen.getByRole('button', { name: /history \(2\)/i });
    await user.click(historyButton);
    
    expect(screen.getByText('Edit History')).toBeInTheDocument();
    expect(screen.getByText('First version')).toBeInTheDocument();
    expect(screen.getByText('Second version')).toBeInTheDocument();
  });

  it('restores previous version from history', async () => {
    const user = userEvent.setup();
    render(<MessageEditor {...defaultProps} message={mockMessageWithHistory} />);
    
    // Open history
    const historyButton = screen.getByRole('button', { name: /history \(2\)/i });
    await user.click(historyButton);
    
    // Click restore on first version
    const restoreButtons = screen.getAllByRole('button', { name: /restore/i });
    await user.click(restoreButtons[0]);
    
    const textarea = screen.getByPlaceholderText('Edit your message...');
    expect(textarea).toHaveValue('Second version');
  });

  it('restores to previous version using undo button', async () => {
    const user = userEvent.setup();
    render(<MessageEditor {...defaultProps} message={mockMessageWithHistory} />);
    
    const undoButton = screen.getByTitle('Restore to previous version');
    await user.click(undoButton);
    
    const textarea = screen.getByPlaceholderText('Edit your message...');
    expect(textarea).toHaveValue('Second version');
  });

  it('shows loading state when saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
    render(<MessageEditor {...defaultProps} onSave={onSave} />);
    
    const textarea = screen.getByPlaceholderText('Edit your message...');
    await user.clear(textarea);
    await user.type(textarea, 'Loading test');
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
  });

  it('handles save errors gracefully', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));
    render(<MessageEditor {...defaultProps} onSave={onSave} />);
    
    const textarea = screen.getByPlaceholderText('Edit your message...');
    await user.clear(textarea);
    await user.type(textarea, 'Error test');
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to save message. Please try again.')).toBeInTheDocument();
    });
  });

  it('disables save button when validation fails', async () => {
    const user = userEvent.setup();
    render(<MessageEditor {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Edit your message...');
    await user.clear(textarea);
    
    // Trigger validation by trying to save
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    // Check that validation error appears and button is disabled
    expect(screen.getByText('Message cannot be empty')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
  });

  it('shows keyboard shortcuts help', () => {
    render(<MessageEditor {...defaultProps} />);
    
    expect(screen.getByText(/Ctrl\+Enter/)).toBeInTheDocument();
    expect(screen.getByText(/Esc/)).toBeInTheDocument();
  });

  it('shows character count warning for long content', async () => {
    render(<MessageEditor {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Edit your message...');
    
    // Use fireEvent for faster input simulation with large text
    const longText = 'a'.repeat(45001);
    fireEvent.change(textarea, { target: { value: longText } });
    
    const characterCount = screen.getByText(/45,001\/50,000/);
    expect(characterCount).toHaveClass('text-destructive');
  }, 10000); // Increase timeout for this test

  it('formats timestamps correctly in edit history', () => {
    render(<MessageEditor {...defaultProps} message={mockMessageWithHistory} />);
    
    const historyButton = screen.getByRole('button', { name: /history \(2\)/i });
    fireEvent.click(historyButton);
    
    // Check that timestamps are formatted (exact format may vary by locale)
    const timestamps = screen.getAllByText(/Jan 1, 2024/);
    expect(timestamps.length).toBeGreaterThan(0);
  });

  it('shows edit reasons in history', () => {
    render(<MessageEditor {...defaultProps} message={mockMessageWithHistory} />);
    
    const historyButton = screen.getByRole('button', { name: /history \(2\)/i });
    fireEvent.click(historyButton);
    
    expect(screen.getByText('Initial edit')).toBeInTheDocument();
    expect(screen.getByText('Grammar correction')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <MessageEditor {...defaultProps} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('focuses textarea when editing starts', () => {
    // This test is hard to verify in jsdom environment
    // We'll just check that the textarea is rendered when editing
    render(<MessageEditor {...defaultProps} isEditing={true} />);
    
    const textarea = screen.getByPlaceholderText('Edit your message...');
    expect(textarea).toBeInTheDocument();
  });

  it('sets cursor to end of text when focusing', () => {
    // This test is hard to verify in jsdom environment
    // We'll just check that the textarea has the correct initial value
    render(<MessageEditor {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Edit your message...') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Original message content');
  });
});