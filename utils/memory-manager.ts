import { Conversation, Message } from '../types/conversation';

export interface MemoryConfig {
  maxConversations: number;
  maxMessagesPerConversation: number;
  maxTotalMessages: number;
  cleanupThreshold: number;
  preserveRecentMessages: number;
  maxAge: number; // in milliseconds
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  maxConversations: 100,
  maxMessagesPerConversation: 500,
  maxTotalMessages: 10000,
  cleanupThreshold: 1.2, // Trigger cleanup when 20% over limit
  preserveRecentMessages: 50,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export class ConversationMemoryManager {
  private config: MemoryConfig;
  private cleanupInProgress = false;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
  }

  /**
   * Optimize conversations by removing old and excessive data
   */
  optimizeConversations(conversations: Conversation[]): Conversation[] {
    if (this.cleanupInProgress) {
      return conversations;
    }

    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
    const needsCleanup =
      conversations.length > this.config.maxConversations * this.config.cleanupThreshold ||
      totalMessages > this.config.maxTotalMessages * this.config.cleanupThreshold;

    if (!needsCleanup) {
      return conversations;
    }

    this.cleanupInProgress = true;

    try {
      let optimized = [...conversations];

      // Step 1: Remove old conversations
      optimized = this.removeOldConversations(optimized);

      // Step 2: Limit number of conversations
      optimized = this.limitConversationCount(optimized);

      // Step 3: Optimize messages within conversations
      optimized = this.optimizeMessagesInConversations(optimized);

      // Step 4: Final check and emergency cleanup if needed
      const finalTotalMessages = optimized.reduce((sum, conv) => sum + conv.messages.length, 0);
      if (finalTotalMessages > this.config.maxTotalMessages) {
        optimized = this.emergencyCleanup(optimized);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('Memory optimization completed:', {
          before: {
            conversations: conversations.length,
            messages: totalMessages,
          },
          after: {
            conversations: optimized.length,
            messages: optimized.reduce((sum, conv) => sum + conv.messages.length, 0),
          },
        });
      }

      return optimized;
    } finally {
      this.cleanupInProgress = false;
    }
  }

  /**
   * Remove conversations older than maxAge
   */
  private removeOldConversations(conversations: Conversation[]): Conversation[] {
    const now = Date.now();
    const cutoffTime = now - this.config.maxAge;

    return conversations.filter(conv => {
      const lastMessageTime = conv.lastMessage?.getTime() || conv.metadata.createdAt.getTime();
      return lastMessageTime > cutoffTime;
    });
  }

  /**
   * Limit the total number of conversations, keeping the most recent ones
   */
  private limitConversationCount(conversations: Conversation[]): Conversation[] {
    if (conversations.length <= this.config.maxConversations) {
      return conversations;
    }

    // Sort by last message time (most recent first)
    const sorted = [...conversations].sort((a, b) => {
      const aTime = a.lastMessage?.getTime() || a.metadata.createdAt.getTime();
      const bTime = b.lastMessage?.getTime() || b.metadata.createdAt.getTime();
      return bTime - aTime;
    });

    return sorted.slice(0, this.config.maxConversations);
  }

  /**
   * Optimize messages within each conversation
   */
  private optimizeMessagesInConversations(conversations: Conversation[]): Conversation[] {
    return conversations.map(conv => {
      if (conv.messages.length <= this.config.maxMessagesPerConversation) {
        return conv;
      }

      const optimizedMessages = this.optimizeMessages(conv.messages);

      return {
        ...conv,
        messages: optimizedMessages,
        metadata: {
          ...conv.metadata,
          messageCount: optimizedMessages.length,
          updatedAt: new Date(),
        },
      };
    });
  }

  /**
   * Optimize messages within a single conversation
   */
  private optimizeMessages(messages: Message[]): Message[] {
    if (messages.length <= this.config.maxMessagesPerConversation) {
      return messages;
    }

    // Always preserve the most recent messages
    const recentMessages = messages.slice(-this.config.preserveRecentMessages);

    // For older messages, keep a strategic sample
    const olderMessages = messages.slice(0, -this.config.preserveRecentMessages);
    const keepOlderCount = this.config.maxMessagesPerConversation - this.config.preserveRecentMessages;

    if (keepOlderCount <= 0) {
      return recentMessages;
    }

    // Keep important messages and a distributed sample
    const importantOlder = this.selectImportantMessages(olderMessages, Math.floor(keepOlderCount * 0.3));
    const sampledOlder = this.selectDistributedSample(
      olderMessages.filter(m => !importantOlder.includes(m)),
      keepOlderCount - importantOlder.length
    );

    // Combine and sort by timestamp
    const combined = [...importantOlder, ...sampledOlder, ...recentMessages];
    return combined.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Select important messages to preserve (system messages, long messages, etc.)
   */
  private selectImportantMessages(messages: Message[], count: number): Message[] {
    if (count <= 0) return [];

    const scored = messages.map(message => ({
      message,
      score: this.calculateMessageImportance(message),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map(item => item.message);
  }

  /**
   * Calculate importance score for a message
   */
  private calculateMessageImportance(message: Message): number {
    let score = 0;

    // System messages are important
    if (message.role === 'system') score += 100;

    // Longer messages might be more important
    score += Math.min(message.content.length / 100, 50);

    // Messages with attachments are important
    if (message.attachments && message.attachments.length > 0) score += 30;

    // Edited messages might be important
    if (message.isEdited) score += 20;

    // Messages with ratings are important
    if (message.rating) score += 15;

    // Code blocks are often important
    if (message.content.includes('```')) score += 25;

    return score;
  }

  /**
   * Select a distributed sample of messages to maintain conversation flow
   */
  private selectDistributedSample(messages: Message[], count: number): Message[] {
    if (count <= 0 || messages.length === 0) return [];
    if (count >= messages.length) return messages;

    const step = Math.floor(messages.length / count);
    const sample: Message[] = [];

    for (let i = 0; i < count; i++) {
      const index = Math.min(i * step, messages.length - 1);
      sample.push(messages[index]);
    }

    return sample;
  }

  /**
   * Emergency cleanup when other methods aren't sufficient
   */
  private emergencyCleanup(conversations: Conversation[]): Conversation[] {
    // Sort conversations by importance (recent activity, message count, etc.)
    const scored = conversations.map(conv => ({
      conversation: conv,
      score: this.calculateConversationImportance(conv),
    }));

    scored.sort((a, b) => b.score - a.score);

    // Keep reducing until we're under the limit
    let totalMessages = scored.reduce((sum, item) => sum + item.conversation.messages.length, 0);
    const result: Conversation[] = [];

    for (const item of scored) {
      if (totalMessages <= this.config.maxTotalMessages) {
        result.push(item.conversation);
      } else {
        // Try to keep conversation with reduced messages
        const maxMessagesForThis = Math.max(
          10, // Minimum messages to keep
          Math.floor((this.config.maxTotalMessages - (totalMessages - item.conversation.messages.length)) / 2)
        );

        if (maxMessagesForThis > 0) {
          const reducedConv = {
            ...item.conversation,
            messages: this.optimizeMessages(item.conversation.messages).slice(-maxMessagesForThis),
          };

          reducedConv.metadata.messageCount = reducedConv.messages.length;
          result.push(reducedConv);
          totalMessages = totalMessages - item.conversation.messages.length + reducedConv.messages.length;
        }
      }
    }

    return result;
  }

  /**
   * Calculate importance score for a conversation
   */
  private calculateConversationImportance(conversation: Conversation): number {
    let score = 0;

    // Recent activity is important
    const daysSinceLastMessage = conversation.lastMessage
      ? (Date.now() - conversation.lastMessage.getTime()) / (1000 * 60 * 60 * 24)
      : 999;
    score += Math.max(0, 100 - daysSinceLastMessage * 2);

    // Favorite conversations are important
    if (conversation.metadata.isFavorite) score += 200;

    // Longer conversations might be more important
    score += Math.min(conversation.messages.length / 10, 50);

    // Conversations with custom titles are important
    if (!conversation.metadata.autoTitleGenerated) score += 30;

    // Tagged conversations are important
    score += conversation.metadata.tags.length * 10;

    return score;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(conversations: Conversation[]): {
    conversationCount: number;
    totalMessages: number;
    averageMessagesPerConversation: number;
    oldestConversation: Date | null;
    newestConversation: Date | null;
    memoryUsageEstimate: number; // in MB
  } {
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
    const dates = conversations.map(conv => conv.lastMessage || conv.metadata.createdAt);

    // Rough estimate: ~1KB per message on average
    const memoryUsageEstimate = totalMessages * 1024 / (1024 * 1024); // Convert to MB

    return {
      conversationCount: conversations.length,
      totalMessages,
      averageMessagesPerConversation: conversations.length > 0 ? totalMessages / conversations.length : 0,
      oldestConversation: dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null,
      newestConversation: dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null,
      memoryUsageEstimate,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MemoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): MemoryConfig {
    return { ...this.config };
  }
}

// Singleton instance for global use
export const memoryManager = new ConversationMemoryManager();