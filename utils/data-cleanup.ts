import { Conversation, Message } from '../types/conversation';
import { conversationCache, messageCache } from './cache-manager';

export interface CleanupConfig {
  maxAge: number; // Maximum age in milliseconds
  maxConversations: number; // Maximum number of conversations to keep
  maxMessagesPerConversation: number; // Maximum messages per conversation
  preserveFavorites: boolean; // Whether to preserve favorite conversations
  preserveRecent: number; // Number of recent conversations to always preserve
  cleanupInterval: number; // Cleanup interval in milliseconds
  batchSize: number; // Number of items to process in each batch
}

export const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
  maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
  maxConversations: 1000,
  maxMessagesPerConversation: 1000,
  preserveFavorites: true,
  preserveRecent: 50,
  cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
  batchSize: 100,
};

export interface CleanupStats {
  conversationsRemoved: number;
  messagesRemoved: number;
  cacheEntriesRemoved: number;
  spaceSaved: number; // Estimated space saved in bytes
  duration: number; // Cleanup duration in milliseconds
}

export interface CleanupResult {
  success: boolean;
  stats: CleanupStats;
  errors: string[];
}

/**
 * Data cleanup manager for conversations and messages
 */
export class DataCleanupManager {
  private config: CleanupConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isCleanupRunning = false;

  constructor(config: Partial<CleanupConfig> = {}) {
    this.config = { ...DEFAULT_CLEANUP_CONFIG, ...config };
  }

  /**
   * Start automatic cleanup
   */
  startAutoCleanup(): void {
    if (this.cleanupTimer) {
      this.stopAutoCleanup();
    }

    this.cleanupTimer = setInterval(() => {
      this.performCleanup().catch(error => {
        console.error('Auto cleanup failed:', error);
      });
    }, this.config.cleanupInterval);

    // Run initial cleanup
    setTimeout(() => {
      this.performCleanup().catch(error => {
        console.error('Initial cleanup failed:', error);
      });
    }, 1000);
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Perform manual cleanup
   */
  async performCleanup(conversations?: Conversation[]): Promise<CleanupResult> {
    if (this.isCleanupRunning) {
      return {
        success: false,
        stats: this.getEmptyStats(),
        errors: ['Cleanup is already running'],
      };
    }

    this.isCleanupRunning = true;
    const startTime = Date.now();
    const stats: CleanupStats = this.getEmptyStats();
    const errors: string[] = [];

    try {
      // Clean up conversations
      if (conversations) {
        const conversationResult = await this.cleanupConversations(conversations);
        this.mergeStats(stats, conversationResult);
      }

      // Clean up cache
      const cacheResult = await this.cleanupCache();
      this.mergeStats(stats, cacheResult);

      // Clean up localStorage if available
      if (typeof localStorage !== 'undefined') {
        const storageResult = await this.cleanupLocalStorage();
        this.mergeStats(stats, storageResult);
      }

      stats.duration = Date.now() - startTime;

      if (process.env.NODE_ENV === 'development') {
        console.log('Data cleanup completed:', stats);
      }

      return {
        success: true,
        stats,
        errors,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      stats.duration = Date.now() - startTime;

      return {
        success: false,
        stats,
        errors,
      };
    } finally {
      this.isCleanupRunning = false;
    }
  }

  /**
   * Clean up old conversations
   */
  async cleanupConversations(conversations: Conversation[]): Promise<CleanupStats> {
    const stats = this.getEmptyStats();
    const now = Date.now();
    const cutoffTime = now - this.config.maxAge;

    // Sort conversations by importance for cleanup decisions
    const sortedConversations = this.sortConversationsByImportance(conversations);
    
    // Identify conversations to remove
    const conversationsToRemove: Conversation[] = [];
    const conversationsToTrim: Conversation[] = [];

    for (let i = 0; i < sortedConversations.length; i++) {
      const conversation = sortedConversations[i];
      const lastActivity = conversation.lastMessage?.getTime() || conversation.metadata.createdAt.getTime();

      // Always preserve recent conversations
      if (i < this.config.preserveRecent) {
        continue;
      }

      // Preserve favorites if configured
      if (this.config.preserveFavorites && conversation.metadata.isFavorite) {
        // But still trim messages if needed
        if (conversation.messages.length > this.config.maxMessagesPerConversation) {
          conversationsToTrim.push(conversation);
        }
        continue;
      }

      // Remove old conversations
      if (lastActivity < cutoffTime) {
        conversationsToRemove.push(conversation);
        continue;
      }

      // Remove excess conversations beyond limit
      if (i >= this.config.maxConversations) {
        conversationsToRemove.push(conversation);
        continue;
      }

      // Trim messages in large conversations
      if (conversation.messages.length > this.config.maxMessagesPerConversation) {
        conversationsToTrim.push(conversation);
      }
    }

    // Process removals in batches
    for (let i = 0; i < conversationsToRemove.length; i += this.config.batchSize) {
      const batch = conversationsToRemove.slice(i, i + this.config.batchSize);
      
      for (const conversation of batch) {
        stats.conversationsRemoved++;
        stats.messagesRemoved += conversation.messages.length;
        stats.spaceSaved += this.estimateConversationSize(conversation);
      }

      // Small delay to prevent blocking
      if (i + this.config.batchSize < conversationsToRemove.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Process message trimming
    for (const conversation of conversationsToTrim) {
      const originalMessageCount = conversation.messages.length;
      const trimmedMessages = this.trimMessages(conversation.messages);
      const removedCount = originalMessageCount - trimmedMessages.length;
      
      stats.messagesRemoved += removedCount;
      stats.spaceSaved += removedCount * 500; // Estimated 500 bytes per message
    }

    return stats;
  }

  /**
   * Clean up cache entries
   */
  async cleanupCache(): Promise<CleanupStats> {
    const stats = this.getEmptyStats();

    try {

      // Clear expired entries (this is done automatically, but we can force it)
      const expiredConversationKeys = conversationCache.getKeys().filter(key => {
        const conversation = conversationCache.get(key);
        return !conversation; // Will return null if expired
      });

      const expiredMessageKeys = messageCache.getKeys().filter(key => {
        const messages = messageCache.get(key);
        return !messages; // Will return null if expired
      });

      // Remove expired entries
      for (const key of expiredConversationKeys) {
        conversationCache.delete(key);
        stats.cacheEntriesRemoved++;
      }

      for (const key of expiredMessageKeys) {
        messageCache.delete(key);
        stats.cacheEntriesRemoved++;
      }

      // Estimate space saved
      stats.spaceSaved += (expiredConversationKeys.length + expiredMessageKeys.length) * 1000; // Rough estimate

    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }

    return stats;
  }

  /**
   * Clean up localStorage entries
   */
  async cleanupLocalStorage(): Promise<CleanupStats> {
    const stats = this.getEmptyStats();

    try {
      const keysToRemove: string[] = [];
      
      // Check for old cache entries
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        // Check if it's a chat app related key
        if (key.startsWith('chat-') || key.startsWith('conversation-') || key.startsWith('message-')) {
          try {
            const item = localStorage.getItem(key);
            if (item) {
              const data = JSON.parse(item);
              
              // Check if data has timestamp and is old
              if (data.timestamp && Date.now() - data.timestamp > this.config.maxAge) {
                keysToRemove.push(key);
              }
            }
          } catch (error) {
            // Invalid JSON, consider for removal
            keysToRemove.push(key);
          }
        }
      }

      // Remove old entries
      for (const key of keysToRemove) {
        const item = localStorage.getItem(key);
        if (item) {
          stats.spaceSaved += item.length * 2; // UTF-16 encoding
        }
        localStorage.removeItem(key);
        stats.cacheEntriesRemoved++;
      }

    } catch (error) {
      console.error('localStorage cleanup failed:', error);
    }

    return stats;
  }

  /**
   * Sort conversations by importance (most important first)
   */
  private sortConversationsByImportance(conversations: Conversation[]): Conversation[] {
    return [...conversations].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Recent activity is important
      const aLastActivity = a.lastMessage?.getTime() || a.metadata.createdAt.getTime();
      const bLastActivity = b.lastMessage?.getTime() || b.metadata.createdAt.getTime();
      scoreA += aLastActivity / 1000000; // Scale down to prevent overflow
      scoreB += bLastActivity / 1000000;

      // Favorites are important
      if (a.metadata.isFavorite) scoreA += 1000000;
      if (b.metadata.isFavorite) scoreB += 1000000;

      // Message count indicates engagement
      scoreA += a.messages.length * 100;
      scoreB += b.messages.length * 100;

      // Custom titles indicate importance
      if (!a.metadata.autoTitleGenerated) scoreA += 50000;
      if (!b.metadata.autoTitleGenerated) scoreB += 50000;

      // Tags indicate organization
      scoreA += a.metadata.tags.length * 10000;
      scoreB += b.metadata.tags.length * 10000;

      return scoreB - scoreA; // Descending order (most important first)
    });
  }

  /**
   * Trim messages in a conversation, keeping important ones
   */
  private trimMessages(messages: Message[]): Message[] {
    if (messages.length <= this.config.maxMessagesPerConversation) {
      return messages;
    }

    const keepCount = this.config.maxMessagesPerConversation;
    const recentCount = Math.floor(keepCount * 0.7); // Keep 70% recent messages
    const importantCount = keepCount - recentCount; // Keep 30% important messages

    // Always keep the most recent messages
    const recentMessages = messages.slice(-recentCount);

    // Select important messages from the rest
    const olderMessages = messages.slice(0, -recentCount);
    const importantMessages = this.selectImportantMessages(olderMessages, importantCount);

    // Combine and sort by timestamp
    const combined = [...importantMessages, ...recentMessages];
    return combined.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Select important messages to preserve
   */
  private selectImportantMessages(messages: Message[], count: number): Message[] {
    if (count <= 0 || messages.length === 0) return [];

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
    if (message.role === 'system') score += 1000;

    // Longer messages might be more important
    score += Math.min(message.content.length / 10, 100);

    // Messages with attachments are important
    if (message.attachments && message.attachments.length > 0) score += 200;

    // Edited messages might be important
    if (message.isEdited) score += 150;

    // Messages with ratings are important
    if (message.rating) score += 100;

    // Code blocks are often important
    if (message.content.includes('```')) score += 300;

    // Messages with errors might be important for debugging
    if (message.error) score += 50;

    return score;
  }

  /**
   * Estimate conversation size in bytes
   */
  private estimateConversationSize(conversation: Conversation): number {
    let size = 0;

    // Basic conversation metadata
    size += JSON.stringify({
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.metadata.createdAt,
      lastMessage: conversation.lastMessage,
      metadata: conversation.metadata,
    }).length * 2; // UTF-16 encoding

    // Messages
    for (const message of conversation.messages) {
      size += JSON.stringify(message).length * 2;
    }

    return size;
  }

  /**
   * Get empty stats object
   */
  private getEmptyStats(): CleanupStats {
    return {
      conversationsRemoved: 0,
      messagesRemoved: 0,
      cacheEntriesRemoved: 0,
      spaceSaved: 0,
      duration: 0,
    };
  }

  /**
   * Merge stats objects
   */
  private mergeStats(target: CleanupStats, source: CleanupStats): void {
    target.conversationsRemoved += source.conversationsRemoved;
    target.messagesRemoved += source.messagesRemoved;
    target.cacheEntriesRemoved += source.cacheEntriesRemoved;
    target.spaceSaved += source.spaceSaved;
  }

  /**
   * Get current configuration
   */
  getConfig(): CleanupConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CleanupConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Check if cleanup is currently running
   */
  isRunning(): boolean {
    return this.isCleanupRunning;
  }
}

/**
 * Global cleanup manager instance
 */
export const dataCleanupManager = new DataCleanupManager();

/**
 * Utility function to clean up conversations array
 */
export function cleanupConversationsArray(
  conversations: Conversation[],
  config?: Partial<CleanupConfig>
): { cleanedConversations: Conversation[]; stats: CleanupStats } {
  const manager = new DataCleanupManager(config);
  // This is a simplified synchronous version for immediate use
  const now = Date.now();
  const cutoffTime = now - (config?.maxAge || DEFAULT_CLEANUP_CONFIG.maxAge);
  const maxConversations = config?.maxConversations || DEFAULT_CLEANUP_CONFIG.maxConversations;
  const preserveRecent = config?.preserveRecent || DEFAULT_CLEANUP_CONFIG.preserveRecent;
  const preserveFavorites = config?.preserveFavorites ?? DEFAULT_CLEANUP_CONFIG.preserveFavorites;

  const sorted = manager['sortConversationsByImportance'](conversations);
  const cleaned: Conversation[] = [];
  const cleanupStats = manager['getEmptyStats']();

  for (let i = 0; i < sorted.length; i++) {
    const conversation = sorted[i];
    const lastActivity = conversation.lastMessage?.getTime() || conversation.metadata.createdAt.getTime();

    // Always preserve recent conversations
    if (i < preserveRecent) {
      cleaned.push(conversation);
      continue;
    }

    // Preserve favorites if configured
    if (preserveFavorites && conversation.metadata.isFavorite) {
      cleaned.push(conversation);
      continue;
    }

    // Remove old conversations
    if (lastActivity < cutoffTime) {
      cleanupStats.conversationsRemoved++;
      cleanupStats.messagesRemoved += conversation.messages.length;
      continue;
    }

    // Remove excess conversations beyond limit
    if (cleaned.length >= maxConversations) {
      cleanupStats.conversationsRemoved++;
      cleanupStats.messagesRemoved += conversation.messages.length;
      continue;
    }

    cleaned.push(conversation);
  }

  return {
    cleanedConversations: cleaned,
    stats: cleanupStats,
  };
}