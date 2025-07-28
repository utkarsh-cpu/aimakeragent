import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageSearch } from '../MessageSearch';
import { Message } from '../../types/conversation';

const mockMessages: Message[] = [
  {
    id: '1',
    content: 'Hello world, this is a test message',
    role: 'user',
    timestamp: new Date('2024-01-01'),
    model: 'gpt-3.5-turbo',
    tokens: 10
  },
  {
    id: '2',
    content: 'This is another test message with different content',
    role: 'assistant',
    timestamp: new Date('2024-01-02'),
    model: 'gpt-4',
    tokens: 15
  },
  {
    id: '3',
    content: 'Hello again, testing search functionality',
    role: 'user',
    timestamp: new Date('2024-01-03'),
    model: 'gpt-3.5-turbo',
    tokens: 12,
    isEdited: true
  }
];

describe('MessageSearch', () => {
  const mockOnSearchResults = vi.fn();
  const mockOnHighlightMessage = vi.fn();
  const mockOnNavigateToMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    messages: mockMessages,
    onSearchResults: mockOnSearchResults,
    onHighlightMessage: mockOnHighlightMessage,
    onNavigateToMessage: mockOnNavigateToMessage
  };

  it('renders search input', () => {
    render(<MessageSearch {...defaultProps} />);
    
    const searchInput = screen.getByLabelText('Search messages');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('placeholder', 'Search messages... (Cmd/Ctrl+Enter to navigate)');
  });

  it('performs search and shows results', async () => {
    render(<MessageSearch {...defaultProps} />);
    
    const searchInput = screen.getByLabelText('Search messages');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    await waitFor(() => {
      expect(mockOnSearchResults).toHaveBeenCalled();
    });

    // Should find results in messages containing "test"
    const lastCall = mockOnSearchResults.mock.calls[mockOnSearchResults.mock.calls.length - 1];
    expect(lastCall[0]).toHaveLength(2); // Two messages contain "test"
  });

  it('shows search results counter', async () => {
    render(<MessageSearch {...defaultProps} />);
    
    const searchInput = screen.getByLabelText('Search messages');
    fireEvent.change(searchInput, { target: { value: 'Hello' } });

    await waitFor(() => {
      const counter = screen.getByText('1 of 2');
      expect(counter).toBeInTheDocument();
    });
  });

  it('navigates between search results', async () => {
    render(<MessageSearch {...defaultProps} />);
    
    const searchInput = screen.getByLabelText('Search messages');
    fireEvent.change(searchInput, { target: { value: 'Hello' } });

    await waitFor(() => {
      const nextButton = screen.getByTitle('Next result');
      expect(nextButton).toBeInTheDocument();
      
      fireEvent.click(nextButton);
      expect(mockOnNavigateToMessage).toHaveBeenCalled();
    });
  });

  it('clears search when escape is pressed', async () => {
    render(<MessageSearch {...defaultProps} />);
    
    const searchInput = screen.getByLabelText('Search messages');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    await waitFor(() => {
      expect(mockOnSearchResults).toHaveBeenCalled();
    });

    fireEvent.keyDown(searchInput, { key: 'Escape' });
    
    expect(searchInput).toHaveValue('');
    expect(mockOnSearchResults).toHaveBeenCalledWith([]);
  });

  it('filters by role', async () => {
    render(<MessageSearch {...defaultProps} />);
    
    // Open filters
    const filterButton = screen.getByTitle('Search filters');
    fireEvent.click(filterButton);

    // Select user role filter
    const userButton = screen.getByText('User');
    fireEvent.click(userButton);

    // Search for something
    const searchInput = screen.getByLabelText('Search messages');
    fireEvent.change(searchInput, { target: { value: 'Hello' } });

    await waitFor(() => {
      const lastCall = mockOnSearchResults.mock.calls[mockOnSearchResults.mock.calls.length - 1];
      // Should only find results from user messages
      expect(lastCall[0]).toHaveLength(1);
      expect(lastCall[0][0].message.role).toBe('user');
    });
  });

  it('filters by edited messages only', async () => {
    render(<MessageSearch {...defaultProps} />);
    
    // Open filters
    const filterButton = screen.getByTitle('Search filters');
    fireEvent.click(filterButton);

    // Select edited only filter
    const editedButton = screen.getByText('Edited messages only');
    fireEvent.click(editedButton);

    // Search for something
    const searchInput = screen.getByLabelText('Search messages');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    await waitFor(() => {
      const lastCall = mockOnSearchResults.mock.calls[mockOnSearchResults.mock.calls.length - 1];
      // Should only find results from edited messages
      expect(lastCall[0]).toHaveLength(1);
      expect(lastCall[0][0].message.isEdited).toBe(true);
    });
  });

  it('shows no results message when search yields no matches', async () => {
    render(<MessageSearch {...defaultProps} />);
    
    const searchInput = screen.getByLabelText('Search messages');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      const noResults = screen.getByText('No results found');
      expect(noResults).toBeInTheDocument();
    });
  });

  it('handles keyboard navigation', async () => {
    render(<MessageSearch {...defaultProps} />);
    
    const searchInput = screen.getByLabelText('Search messages');
    fireEvent.change(searchInput, { target: { value: 'Hello' } });

    await waitFor(() => {
      const counter = screen.getByText('1 of 2');
      expect(counter).toBeInTheDocument();
    });

    // Test Enter key navigation
    fireEvent.keyDown(searchInput, { key: 'Enter' });
    expect(mockOnNavigateToMessage).toHaveBeenCalled();

    // Test Shift+Enter for previous
    fireEvent.keyDown(searchInput, { key: 'Enter', shiftKey: true });
    expect(mockOnNavigateToMessage).toHaveBeenCalledTimes(2);
  });
});