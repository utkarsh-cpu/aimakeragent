import { render, screen, fireEvent } from '@testing-library/react';
import { VirtualizedChatMessages } from '../VirtualizedChatMessages';
import { Message } from '../../types/conversation';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock the virtual scroll utility
vi.mock('../../utils/virtual-scroll', () => ({
  VirtualScrollManager: vi.fn().mockImplementation(() => ({
    calculateVisibleItems: vi.fn((scrollTop: number, totalItems: number) => ({
      startIndex: Math.floor(scrollTop / 100),
      endIndex: Math.min(Math.floor(scrollTop / 100) + 10, totalItems - 1),
      offsetY: Math.floor(scrollTop / 100) * 100
    })),
    getItemStyle: vi.fn((index: number) => ({
      position: 'absolute',
      top: `${index * 100}px`,
      height: '100px',
      width: '100%'
    })),
    shouldUpdate: vi.fn(() => true),
    updateConfig: vi.fn(),
    getTotalHeight: vi.fn((itemCount: number) => itemCount * 100)
  }))
}));

// Mock intersection observer
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
});
window.IntersectionObserver = mockIntersectionObserver;

describe('VirtualizedChatMessages', () => {
  const createMockMessage = (id: string, content: string, role: 'user' | 'assistant' = 'user'): Message => ({
    id,
    content,
    role,
    timestamp: new Date(`2024-01-${id.padStart(2, '0')}T10:00:00Z`),
    isEdited: false
  });

  const mockMessages: Message[] = Array.from({ length: 100 }, (_, i) => 
    createMockMessage((i + 1).toString(), `Message ${i + 1}`, i % 2 === 0 ? 'user' : 'assistant')
  );

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

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: vi.fn()
    }));
  });

  it('renders virtualized message list', () => {
    render(<VirtualizedChatMessages {...defaultProps} />);
    
    expect(screen.getByRole('log')).toBeInTheDocument();
    expect(screen.getByText('Message 1')).toBeInTheDocument();
  });

  it('renders only visible messages', () => {
    render(<VirtualizedChatMessages {...defaultProps} />);
    
    // Should render first 10 messages based on mock implementation
    expect(screen.getByText('Message 1')).toBeInTheDocument();
    expect(screen.getByText('Message 10')).toBeInTheDocument();
    
    // Should not render messages outside visible range
    expect(screen.queryByText('Message 50')).not.toBeInTheDocument();
  });

  it('handles scroll events', () => {
    render(<VirtualizedChatMessages {...defaultProps} />);
    
    const container = screen.getByRole('log');
    fireEvent.scroll(container, { target: { scrollTop: 500 } });
    
    // Virtual scroll manager should be called
    const { VirtualScrollManager } = require('../../utils/virtual-scroll');
    const mockInstance = VirtualScrollManager.mock.results[0].value;
    expect(mockInstance.calculateVisibleItems).toHaveBeenCalled();
  });

  it('shows streaming indicator for streaming message', () => {
    render(
      <VirtualizedChatMessages 
        {...defaultProps} 
        isStreaming={true}
        streamingMessageId="1"
      />
    );
    
    expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument();
  });

  it('handles message actions', async () => {
    const onMessageEdit = vi.fn();
    const onMessageDelete = vi.fn();
    const onMessageCopy = vi.fn();
    
    render(
      <VirtualizedChatMessages 
        {...defaultProps}
        onMessageEdit={onMessageEdit}
        onMessageDelete={onMessageDelete}
        onMessageCopy={onMessageCopy}
      />
    );
    
    // Find and click message actions
    const message = screen.getByText('Message 1').closest('[data-message-id]');
    expect(message).toBeInTheDocument();
    
    // Hover to show actions
    fireEvent.mouseEnter(message!);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);
    
    expect(onMessageEdit).toHaveBeenCalledWith('1');
  });

  it('handles empty message list', () => {
    render(<VirtualizedChatMessages {...defaultProps} messages={[]} />);
    
    expect(screen.getByText(/no messages/i)).toBeInTheDocument();
  });

  it('auto-scrolls to bottom for new messages', () => {
    const { rerender } = render(<VirtualizedChatMessages {...defaultProps} />);
    
    const container = screen.getByRole('log');
    const scrollToBottomSpy = vi.spyOn(container, 'scrollTo');
    
    const newMessages = [...mockMessages, createMockMessage('101', 'New message')];
    rerender(<VirtualizedChatMessages {...defaultProps} messages={newMessages} />);
    
    expect(scrollToBottomSpy).toHaveBeenCalledWith({
      top: expect.any(Number),
      behavior: 'smooth'
    });
  });

  it('preserves scroll position when messages are added at top', () => {
    const { rerender } = render(<VirtualizedChatMessages {...defaultProps} />);
    
    const container = screen.getByRole('log');
    container.scrollTop = 500;
    
    const newMessages = [createMockMessage('0', 'Older message'), ...mockMessages];
    rerender(<VirtualizedChatMessages {...defaultProps} messages={newMessages} />);
    
    // Scroll position should be adjusted to maintain view
    expect(container.scrollTop).toBeGreaterThan(500);
  });

  it('handles message updates correctly', () => {
    const { rerender } = render(<VirtualizedChatMessages {...defaultProps} />);
    
    const updatedMessages = mockMessages.map(msg => 
      msg.id === '1' ? { ...msg, content: 'Updated message 1', isEdited: true } : msg
    );
    
    rerender(<VirtualizedChatMessages {...defaultProps} messages={updatedMessages} />);
    
    expect(screen.getByText('Updated message 1')).toBeInTheDocument();
    expect(screen.getByText('(edited)')).toBeInTheDocument();
  });

  it('shows loading skeleton for initial load', () => {
    render(<VirtualizedChatMessages {...defaultProps} messages={[]} isLoading={true} />);
    
    expect(screen.getAllByTestId('message-skeleton')).toHaveLength(5);
  });

  it('handles keyboard navigation', () => {
    render(<VirtualizedChatMessages {...defaultProps} />);
    
    const container = screen.getByRole('log');
    
    // Test arrow key navigation
    fireEvent.keyDown(container, { key: 'ArrowDown' });
    expect(container).toHaveAttribute('aria-activedescendant');
    
    fireEvent.keyDown(container, { key: 'ArrowUp' });
    // Should navigate to previous message
  });

  it('supports message search highlighting', () => {
    render(
      <VirtualizedChatMessages 
        {...defaultProps} 
        searchQuery="Message 5"
        searchResults={[mockMessages[4]]}
      />
    );
    
    const highlightedMessage = screen.getByText('Message 5');
    expect(highlightedMessage).toHaveClass('search-highlight');
  });

  it('handles message grouping by date', () => {
    const messagesWithDifferentDates = [
      createMockMessage('1', 'Today message'),
      { ...createMockMessage('2', 'Yesterday message'), timestamp: new Date('2024-01-01T10:00:00Z') }
    ];
    
    render(
      <VirtualizedChatMessages 
        {...defaultProps} 
        messages={messagesWithDifferentDates}
        groupByDate={true}
      />
    );
    
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('January 1, 2024')).toBeInTheDocument();
  });

  it('shows message timestamps on hover', () => {
    render(<VirtualizedChatMessages {...defaultProps} />);
    
    const message = screen.getByText('Message 1').closest('[data-message-id]');
    fireEvent.mouseEnter(message!);
    
    expect(screen.getByText(/Jan 01, 2024/)).toBeInTheDocument();
  });

  it('handles message selection for bulk actions', () => {
    render(<VirtualizedChatMessages {...defaultProps} selectionMode={true} />);
    
    const message = screen.getByText('Message 1').closest('[data-message-id]');
    const checkbox = message!.querySelector('input[type="checkbox"]');
    
    fireEvent.click(checkbox!);
    expect(checkbox).toBeChecked();
  });

  it('optimizes rendering for large message lists', () => {
    const largeMessageList = Array.from({ length: 10000 }, (_, i) => 
      createMockMessage((i + 1).toString(), `Message ${i + 1}`)
    );
    
    const startTime = performance.now();
    render(<VirtualizedChatMessages {...defaultProps} messages={largeMessageList} />);
    const endTime = performance.now();
    
    // Should render quickly even with large lists
    expect(endTime - startTime).toBeLessThan(100);
  });

  it('handles message reactions', () => {
    const onMessageRate = vi.fn();
    render(
      <VirtualizedChatMessages 
        {...defaultProps}
        onMessageRate={onMessageRate}
      />
    );
    
    const message = screen.getByText('Message 2').closest('[data-message-id]');
    fireEvent.mouseEnter(message!);
    
    const thumbsUpButton = screen.getByRole('button', { name: /thumbs up/i });
    fireEvent.click(thumbsUpButton);
    
    expect(onMessageRate).toHaveBeenCalledWith('2', 'up');
  });

  it('shows context menu on right click', () => {
    render(<VirtualizedChatMessages {...defaultProps} />);
    
    const message = screen.getByText('Message 1').closest('[data-message-id]');
    fireEvent.contextMenu(message!);
    
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
  });

  it('handles accessibility features', () => {
    render(<VirtualizedChatMessages {...defaultProps} />);
    
    const container = screen.getByRole('log');
    expect(container).toHaveAttribute('aria-label', 'Chat messages');
    expect(container).toHaveAttribute('tabindex', '0');
    
    const messages = screen.getAllByRole('article');
    messages.forEach((message, index) => {
      expect(message).toHaveAttribute('aria-label', expect.stringContaining(`Message ${index + 1}`));
    });
  });
});