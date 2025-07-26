/**
 * Enhanced conversation types with metadata tracking
 */

export interface MessageEdit {
  id: string;
  previousContent: string;
  timestamp: Date;
  reason?: string;
}

export interface Attachment {
  id: string;
  type: 'file' | 'image' | 'audio';
  name: string;
  size: number;
  url: string;
  mimeType: string;
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  isTyping?: boolean;
  isStreaming?: boolean;
  isEdited?: boolean;
  editHistory?: MessageEdit[];
  rating?: 'up' | 'down';
  tokens?: number;
  model?: string;
  error?: string;
  attachments?: Attachment[];
}

export interface ConversationMetadata {
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  tokenCount: number;
  model?: string;
  tags: string[];
  isArchived: boolean;
  isFavorite: boolean;
  autoTitleGenerated: boolean;
  lastActivity: Date;
  totalCost?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastMessage: Date;
  metadata: ConversationMetadata;
}

export interface ConversationStats {
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  favoriteModels: string[];
  averageResponseTime: number;
  totalCost: number;
}

export interface ConversationFilter {
  query?: string;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  model?: string;
  isArchived?: boolean;
  isFavorite?: boolean;
}

export interface ConversationSortOptions {
  field: 'title' | 'lastMessage' | 'createdAt' | 'messageCount' | 'tokenCount';
  direction: 'asc' | 'desc';
}