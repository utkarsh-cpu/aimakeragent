import { ChatMessages } from './ChatMessages';
import { VirtualizedChatMessages } from './VirtualizedChatMessages';
import { Message } from '../types/conversation';

interface ChatMessagesContainerProps {
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
}

export function ChatMessagesContainer({
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
  virtualScrollThreshold = 50
}: ChatMessagesContainerProps) {
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
      />
    );
  }

  return (
    <ChatMessages
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
    />
  );
}