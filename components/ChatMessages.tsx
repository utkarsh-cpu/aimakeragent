import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './ui/context-menu';
import { Copy, RotateCcw, ThumbsUp, ThumbsDown, User, Bot, Check, Quote, Trash2, Edit3, Share, Square, Loader2 } from 'lucide-react';
import { cn } from './ui/utils';
import { MessageEditor } from './MessageEditor';
import { MessageSearch, SearchResult } from './MessageSearch';
import { VirtualizedChatMessages } from './VirtualizedChatMessages';
import { Message } from '../types/conversation';
import { ChatAccessibility, ScreenReaderContent, AriaLiveRegionManager } from '../utils/accessibility';

interface ChatMessagesProps {
  messages: Message[];
  isTyping: boolean;
  streamingMessageId?: string;
  onCopyMessage: (content: string) => void;
  onRegenerateMessage: (messageId: string) => void;
  onRateMessage: (messageId: string, rating: 'up' | 'down') => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onQuoteMessage?: (messageId: string, content: string) => void;
  onCancelStream?: () => void;
  fontSize: number;
  showSearch?: boolean;
  onToggleSearch?: () => void;
  enableVirtualScrolling?: boolean;
  virtualScrollThreshold?: number;
  selectedMessageId?: string;
  onMessageSelect?: (messageId: string | null) => void;
}

export function ChatMessages({
  messages,
  isTyping,
  streamingMessageId,
  onCopyMessage,
  onRegenerateMessage,
  onRateMessage,
  onEditMessage,
  onDeleteMessage,
  onQuoteMessage,
  onCancelStream,
  fontSize,
  showSearch = false,
  onToggleSearch: _onToggleSearch,
  enableVirtualScrolling = true,
  virtualScrollThreshold = 50,
  selectedMessageId: externalSelectedMessageId,
  onMessageSelect
}: ChatMessagesProps) {
  // Use virtualized component for large message lists
  if (enableVirtualScrolling && messages.length > virtualScrollThreshold) {
    return (
      <VirtualizedChatMessages
        messages={messages}
        isTyping={isTyping}
        streamingMessageId={streamingMessageId}
        onCopyMessage={onCopyMessage}
        onRegenerateMessage={onRegenerateMessage}
        onRateMessage={onRateMessage}
        onEditMessage={onEditMessage}
        onDeleteMessage={onDeleteMessage}
        onQuoteMessage={onQuoteMessage}
        onCancelStream={onCancelStream}
        fontSize={fontSize}
        showSearch={showSearch}
        onToggleSearch={_onToggleSearch}
        enableVirtualScrolling={enableVirtualScrolling}
        virtualScrollThreshold={virtualScrollThreshold}
        selectedMessageId={externalSelectedMessageId}
        onMessageSelect={onMessageSelect}
      />
    );
  }

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, 'up' | 'down'>>({});
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [internalSelectedMessageId, setInternalSelectedMessageId] = useState<string | null>(null);

  // Use external selection if provided, otherwise use internal
  const selectedMessageId = externalSelectedMessageId ?? internalSelectedMessageId;
  const setSelectedMessageId = onMessageSelect ?? setInternalSelectedMessageId;
  const [_searchResults, _setSearchResults] = useState<SearchResult[]>([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const handleCopy = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      onCopyMessage(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);

      onCopyMessage(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleRate = (messageId: string, rating: 'up' | 'down') => {
    setRatings(prev => {
      const currentRating = prev[messageId];
      // Toggle rating if same rating is clicked, otherwise set new rating
      const newRating = currentRating === rating ? undefined : rating;
      const newRatings = { ...prev };

      if (newRating) {
        newRatings[messageId] = newRating;
      } else {
        delete newRatings[messageId];
      }

      return newRatings;
    });

    onRateMessage(messageId, rating);
  };

  const handleEditStart = (messageId: string) => {
    setEditingMessageId(messageId);
  };

  const handleEditSave = (messageId: string, newContent: string) => {
    if (onEditMessage) {
      onEditMessage(messageId, newContent);
    }
    setEditingMessageId(null);
  };

  const handleEditCancel = () => {
    setEditingMessageId(null);
  };

  // Announce typing changes
  useEffect(() => {
    ChatAccessibility.announceTyping(isTyping);
  }, [isTyping]);

  // Announce new messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && !lastMessage.isStreaming) {
        ChatAccessibility.announceNewMessage(
          lastMessage.role === 'user' ? 'You' : 'Assistant',
          lastMessage.content,
          lastMessage.role === 'user'
        );
      }
    }
  }, [messages]);

  // Keyboard shortcuts handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!selectedMessageId) return;

    const message = messages.find(m => m.id === selectedMessageId);
    if (!message) return;

    // Prevent shortcuts when editing
    if (editingMessageId) return;

    switch (event.key.toLowerCase()) {
      case 'c':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          handleCopy(message.id, message.content);
          ChatAccessibility.announceMessageAction('Copy message');
        }
        break;
      case 'q':
        if ((event.ctrlKey || event.metaKey) && onQuoteMessage) {
          event.preventDefault();
          onQuoteMessage(message.id, message.content);
          ChatAccessibility.announceMessageAction('Quote message');
        }
        break;
      case 'e':
        if (onEditMessage && message.role === 'user' && !message.isStreaming) {
          event.preventDefault();
          handleEditStart(message.id);
          ChatAccessibility.announceMessageAction('Edit mode activated');
        }
        break;
      case 'r':
        if (message.role === 'assistant' && !message.error) {
          event.preventDefault();
          onRegenerateMessage(message.id);
          ChatAccessibility.announceMessageAction('Regenerating message');
        }
        break;
      case 'delete':
        if (onDeleteMessage) {
          event.preventDefault();
          if (window.confirm('Are you sure you want to delete this message?')) {
            onDeleteMessage(message.id);
            ChatAccessibility.announceMessageAction('Delete message');
          }
        }
        break;
      case 'escape':
        if (message.isStreaming && onCancelStream) {
          event.preventDefault();
          onCancelStream();
          ChatAccessibility.announceMessageAction('Streaming cancelled');
        }
        break;
    }
  }, [selectedMessageId, messages, editingMessageId, onQuoteMessage, onEditMessage, onRegenerateMessage, onDeleteMessage, onCancelStream]);

  // Add keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Search handlers
  const handleSearchResults = useCallback((results: SearchResult[]) => {
    _setSearchResults(results);
  }, []);

  const handleHighlightMessage = useCallback((messageId: string, term: string) => {
    setHighlightedMessageId(messageId);
    setSearchTerm(term);
  }, []);

  const handleNavigateToMessage = useCallback((messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, []);

  // Highlight search terms in message content
  const highlightSearchTerm = useCallback((content: string, term: string) => {
    if (!term || !content) return content;

    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return content.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">$1</mark>');
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderContent = (content: string, messageId: string, isStreaming?: boolean) => {
    // Apply search highlighting first if this message is highlighted
    let processedContent = content;
    if (highlightedMessageId === messageId && searchTerm) {
      processedContent = highlightSearchTerm(content, searchTerm);
    }

    // Simple markdown-like formatting
    let formattedContent = processedContent
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>');

    // Code blocks
    formattedContent = formattedContent.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      '<pre class="bg-muted p-3 rounded-lg overflow-x-auto"><code class="text-sm">$2</code></pre>'
    );

    return (
      <div className="relative">
        <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
        {isStreaming && (
          <span className="inline-block w-2 h-5 bg-current animate-streaming-cursor ml-1 align-text-bottom" />
        )}
      </div>
    );
  };

  const StreamingIndicator = () => (
    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>Streaming response...</span>
      {onCancelStream && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-2 text-xs"
          onClick={onCancelStream}
          title="Cancel streaming"
        >
          <Square className="h-2 w-2 mr-1" />
          Cancel
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col">
      {/* Search Bar */}
      {showSearch && (
        <div className="border-b bg-background/95 backdrop-blur-sm p-4">
          <MessageSearch
            messages={messages}
            onSearchResults={handleSearchResults}
            onHighlightMessage={handleHighlightMessage}
            onNavigateToMessage={handleNavigateToMessage}
          />
        </div>
      )}

      <ScrollArea className="flex-1 p-4" ref={messagesContainerRef} data-messages-container>
        <div className="max-w-4xl mx-auto space-y-6" style={{ fontSize: `${fontSize}px` }}>
          {messages.length === 0 && !isTyping && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
              <div className="bg-muted/50 rounded-full p-6 mb-6">
                <Bot className="h-12 w-12 text-muted-foreground/70" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Welcome to your AI Assistant</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                I'm here to help you with any questions or tasks you might have.
                Feel free to ask me anything!
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <div className="bg-muted/30 px-3 py-1.5 rounded-full text-sm">💡 Ask a question</div>
                <div className="bg-muted/30 px-3 py-1.5 rounded-full text-sm">✍️ Write content</div>
                <div className="bg-muted/30 px-3 py-1.5 rounded-full text-sm">🔍 Research topics</div>
              </div>
            </div>
          )}

          {messages.map((message, index) => {
            // Set up accessibility attributes
            const messageElement = useRef<HTMLDivElement>(null);

            useEffect(() => {
              if (messageElement.current && (message.role === 'user' || message.role === 'assistant')) {
                ChatAccessibility.setupMessageAccessibility(
                  messageElement.current,
                  {
                    id: message.id,
                    role: message.role as 'user' | 'assistant',
                    content: message.content,
                    timestamp: message.timestamp,
                    isStreaming: message.isStreaming,
                    error: message.error
                  },
                  { index, total: messages.length }
                );
              }
            }, [message, index, messages.length]);

            return (
              <ContextMenu key={message.id}>
                <ContextMenuTrigger>
                  <div
                    ref={messageElement}
                    id={`message-${message.id}`}
                    className={cn(
                      "group flex gap-3 relative animate-message-in cursor-pointer transition-all duration-200",
                      message.role === 'user' ? 'flex-row-reverse animate-slide-in-right' : 'flex-row animate-slide-in-left',
                      selectedMessageId === message.id && "ring-2 ring-primary/20 bg-primary/5 rounded-lg",
                      highlightedMessageId === message.id && "ring-2 ring-yellow-400/50 bg-yellow-50/50 dark:bg-yellow-900/20 rounded-lg"
                    )}
                    onMouseEnter={() => setHoveredMessage(message.id)}
                    onMouseLeave={() => setHoveredMessage(null)}
                    onClick={() => {
                      const newSelection = selectedMessageId === message.id ? null : message.id;
                      setSelectedMessageId(newSelection);
                      if (newSelection) {
                        AriaLiveRegionManager.announce(
                          'navigation',
                          `Selected ${message.role === 'user' ? 'your' : 'assistant'} message`,
                          'polite'
                        );
                      }
                    }}
                    role="article"
                    tabIndex={0}
                    aria-label={`${message.role === 'user' ? 'Your' : 'Assistant'} message from ${formatTime(message.timestamp)}. ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`}
                    aria-describedby={`message-${message.id}-content`}
                    aria-selected={selectedMessageId === message.id}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const newSelection = selectedMessageId === message.id ? null : message.id;
                        setSelectedMessageId(newSelection);
                        if (newSelection) {
                          AriaLiveRegionManager.announce(
                            'navigation',
                            `Selected ${message.role === 'user' ? 'your' : 'assistant'} message`,
                            'polite'
                          );
                        }
                      }
                    }}
                  >
                    {/* Avatar */}
                    <Avatar
                      className={cn(
                        "w-8 h-8 mt-1 ring-2 ring-offset-2 ring-offset-background transition-all duration-200",
                        message.role === 'user'
                          ? 'ring-primary/20'
                          : 'ring-muted-foreground/20'
                      )}
                      role="img"
                      aria-label={`${message.role === 'user' ? 'User' : 'Assistant'} avatar`}
                    >
                      <AvatarFallback className={cn(
                        message.role === 'user'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {message.role === 'user' ? (
                          <User className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Bot className="h-4 w-4" aria-hidden="true" />
                        )}
                      </AvatarFallback>
                    </Avatar>

                    {/* Message Content */}
                    <div className={cn(
                      "flex-1 max-w-[80%]",
                      message.role === 'user' ? 'items-end' : 'items-start'
                    )}>
                      <div
                        className={cn(
                          "rounded-2xl p-4 shadow-sm border transition-all duration-200",
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground ml-12 border-primary/20 shadow-primary/10'
                            : 'bg-muted/50 border-border/50 hover:bg-muted/70'
                        )}
                      >
                        {/* Role and Timestamp */}
                        <div
                          id={`message-${message.id}-header`}
                          className={cn(
                            "flex items-center gap-2 mb-3 text-xs",
                            message.role === 'user' ? 'justify-end text-primary-foreground/70' : 'justify-start text-muted-foreground'
                          )}
                        >
                          <span className="font-medium">
                            {message.role === 'user' ? 'You' : 'Assistant'}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-current opacity-50" aria-hidden="true"></span>
                          <time
                            dateTime={message.timestamp.toISOString()}
                            data-timestamp
                            aria-label={`Sent ${message.timestamp.toLocaleString()}`}
                          >
                            {formatTime(message.timestamp)}
                          </time>
                        </div>

                        {/* Message Text or Editor */}
                        {editingMessageId === message.id ? (
                          <MessageEditor
                            message={message}
                            onSave={handleEditSave}
                            onCancel={handleEditCancel}
                            isEditing={true}
                          />
                        ) : (
                          <div
                            id={`message-${message.id}-content`}
                            className="prose prose-sm max-w-none"
                            role="region"
                            aria-label="Message content"
                          >
                            {renderContent(message.content, message.id, message.isStreaming)}
                            {/* Screen reader only content for additional context */}
                            <div className="sr-only">
                              {message.isStreaming && 'Message is still being generated'}
                              {message.error && `Error: ${message.error}`}
                              {message.isEdited && 'This message has been edited'}
                            </div>
                          </div>
                        )}

                        {/* Streaming Indicator */}
                        {message.isStreaming && streamingMessageId === message.id && (
                          <div role="status" aria-live="polite" aria-label="Message is being generated">
                            <StreamingIndicator />
                          </div>
                        )}

                        {/* Error Display */}
                        {message.error && (
                          <div
                            className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm"
                            role="alert"
                            aria-live="assertive"
                          >
                            <span className="font-medium">Error:</span> {message.error}
                          </div>
                        )}

                        {/* Message Metadata */}
                        {(message.model || message.tokens || message.isEdited || ratings[message.id]) && !message.isStreaming && (
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            {message.model && (
                              <Badge variant="outline" className="text-xs">
                                {message.model}
                              </Badge>
                            )}
                            {message.tokens && (
                              <span>{message.tokens.toLocaleString()} tokens</span>
                            )}
                            {message.isEdited && (
                              <span className="italic flex items-center gap-1">
                                <Edit3 className="h-3 w-3" />
                                edited
                              </span>
                            )}
                            {ratings[message.id] && (
                              <span className={cn(
                                "flex items-center gap-1",
                                ratings[message.id] === 'up' ? "text-green-600" : "text-red-600"
                              )}>
                                {ratings[message.id] === 'up' ? (
                                  <ThumbsUp className="h-3 w-3" />
                                ) : (
                                  <ThumbsDown className="h-3 w-3" />
                                )}
                                rated {ratings[message.id] === 'up' ? 'helpful' : 'unhelpful'}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Hover Actions */}
                        {(hoveredMessage === message.id || selectedMessageId === message.id) && !message.isStreaming && (
                          <div className={cn(
                            "absolute top-2 flex items-center gap-0.5 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-1 z-10 transition-all duration-200",
                            message.role === 'user' ? 'left-2' : 'right-2'
                          )}>
                            {/* Primary Actions */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 focus-ring"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(message.id, message.content);
                              }}
                              title="Copy message (Ctrl+C)"
                              aria-label="Copy message to clipboard"
                            >
                              {copiedId === message.id ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>

                            {onQuoteMessage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 focus-ring"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onQuoteMessage(message.id, message.content);
                                }}
                                title="Quote message (Ctrl+Q)"
                                aria-label="Quote this message in reply"
                              >
                                <Quote className="h-3 w-3" />
                              </Button>
                            )}

                            {/* Edit Actions */}
                            {onEditMessage && message.role === 'user' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 focus-ring"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditStart(message.id);
                                }}
                                title="Edit message (E)"
                                aria-label="Edit this message"
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                            )}

                            {message.role === 'assistant' && !message.error && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 focus-ring"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRegenerateMessage(message.id);
                                }}
                                title="Regenerate response (R)"
                                aria-label="Regenerate AI response"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            )}

                            {/* Rating Actions */}
                            {message.role === 'assistant' && !message.error && (
                              <>
                                <div className="w-px h-4 bg-border mx-1" />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "h-7 w-7 p-0 focus-ring transition-colors",
                                    ratings[message.id] === 'up'
                                      ? "text-green-600 bg-green-100 dark:bg-green-900/30"
                                      : "hover:text-green-600"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRate(message.id, 'up');
                                  }}
                                  title="Good response"
                                  aria-label="Rate response as helpful"
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "h-7 w-7 p-0 focus-ring transition-colors",
                                    ratings[message.id] === 'down'
                                      ? "text-red-600 bg-red-100 dark:bg-red-900/30"
                                      : "hover:text-red-600"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRate(message.id, 'down');
                                  }}
                                  title="Poor response"
                                  aria-label="Rate response as unhelpful"
                                >
                                  <ThumbsDown className="h-3 w-3" />
                                </Button>
                              </>
                            )}

                            {/* Destructive Actions */}
                            {onDeleteMessage && (
                              <>
                                <div className="w-px h-4 bg-border mx-1" />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 focus-ring text-muted-foreground hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('Are you sure you want to delete this message?')) {
                                      onDeleteMessage(message.id);
                                    }
                                  }}
                                  title="Delete message (Del)"
                                  aria-label="Delete this message"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Streaming Actions */}
                        {hoveredMessage === message.id && message.isStreaming && onCancelStream && (
                          <div className={cn(
                            "absolute top-2 flex items-center gap-1 bg-background border border-border rounded-lg shadow-lg p-1 z-10 transition-opacity",
                            message.role === 'user' ? 'left-2' : 'right-2'
                          )}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 focus-ring text-destructive hover:text-destructive"
                              onClick={onCancelStream}
                              title="Cancel streaming"
                              aria-label="Cancel streaming response"
                            >
                              <Square className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">
                  {!message.isStreaming && (
                    <>
                      {/* Primary Actions */}
                      <ContextMenuItem onClick={() => handleCopy(message.id, message.content)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Message
                        <span className="ml-auto text-xs text-muted-foreground">Ctrl+C</span>
                      </ContextMenuItem>

                      {onQuoteMessage && (
                        <ContextMenuItem onClick={() => onQuoteMessage(message.id, message.content)}>
                          <Quote className="h-4 w-4 mr-2" />
                          Quote Message
                          <span className="ml-auto text-xs text-muted-foreground">Ctrl+Q</span>
                        </ContextMenuItem>
                      )}

                      {/* Edit Actions */}
                      {onEditMessage && message.role === 'user' && !message.isStreaming && (
                        <ContextMenuItem onClick={() => handleEditStart(message.id)}>
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit Message
                          <span className="ml-auto text-xs text-muted-foreground">E</span>
                        </ContextMenuItem>
                      )}

                      {message.role === 'assistant' && !message.error && (
                        <ContextMenuItem onClick={() => onRegenerateMessage(message.id)}>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Regenerate Response
                          <span className="ml-auto text-xs text-muted-foreground">R</span>
                        </ContextMenuItem>
                      )}

                      {/* Rating Actions */}
                      {message.role === 'assistant' && !message.error && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            Rate Response
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1">
                            <button
                              onClick={() => handleRate(message.id, 'up')}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                                ratings[message.id] === 'up'
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "hover:bg-muted"
                              )}
                            >
                              <ThumbsUp className="h-3 w-3" />
                              Good
                            </button>
                            <button
                              onClick={() => handleRate(message.id, 'down')}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                                ratings[message.id] === 'down'
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  : "hover:bg-muted"
                              )}
                            >
                              <ThumbsDown className="h-3 w-3" />
                              Poor
                            </button>
                          </div>
                        </>
                      )}

                      {/* Share Actions */}
                      <div className="border-t my-1"></div>
                      <ContextMenuItem
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({
                              text: message.content,
                              title: `Message from ${message.role === 'user' ? 'You' : 'Assistant'}`
                            });
                          } else {
                            handleCopy(message.id, message.content);
                          }
                        }}
                      >
                        <Share className="h-4 w-4 mr-2" />
                        Share Message
                      </ContextMenuItem>

                      {/* Copy Variations */}
                      <ContextMenuItem onClick={() => handleCopy(message.id, `> ${message.content.replace(/\n/g, '\n> ')}`)}>
                        <Quote className="h-4 w-4 mr-2" />
                        Copy as Quote
                      </ContextMenuItem>

                      <ContextMenuItem onClick={() => handleCopy(message.id, `**${message.role === 'user' ? 'You' : 'Assistant'}:** ${message.content}`)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy with Label
                      </ContextMenuItem>

                      {/* Destructive Actions */}
                      {onDeleteMessage && (
                        <>
                          <div className="border-t my-1"></div>
                          <ContextMenuItem
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
                                onDeleteMessage(message.id);
                              }
                            }}
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Message
                            <span className="ml-auto text-xs text-muted-foreground">Del</span>
                          </ContextMenuItem>
                        </>
                      )}
                    </>
                  )}

                  {message.isStreaming && onCancelStream && (
                    <ContextMenuItem
                      onClick={onCancelStream}
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Cancel Streaming
                      <span className="ml-auto text-xs text-muted-foreground">Esc</span>
                    </ContextMenuItem>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div
              className="flex gap-3 animate-fade-in"
              role="status"
              aria-live="polite"
              aria-label="Assistant is typing"
            >
              <Avatar
                className="w-8 h-8 mt-1 ring-2 ring-offset-2 ring-offset-background ring-muted-foreground/20"
                role="img"
                aria-label="Assistant avatar"
              >
                <AvatarFallback className="bg-muted text-muted-foreground">
                  <Bot className="h-4 w-4" aria-hidden="true" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted/50 rounded-2xl p-4 shadow-sm max-w-[80%] border border-border/50">
                <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                  <span className="font-medium">Assistant</span>
                  <div className="w-1 h-1 rounded-full bg-current opacity-50" aria-hidden="true"></div>
                  <Badge variant="secondary" className="text-xs animate-pulse">typing...</Badge>
                </div>
                <div className="flex gap-1.5" aria-hidden="true">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"></div>
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.2s]"></div>
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.4s]"></div>
                </div>
                <div className="sr-only">Assistant is typing a response</div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}