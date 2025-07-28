import { Conversation, Message } from '../types/conversation';

export interface CacheConfig {
  maxCacheSize: number; // Maximum number of items to cache
  maxMemoryUsage: number; // Maximum memory usage in MB
  ttl: number; // Time to live in milliseconds
  compressionEnabled: boolean;
  persistToStorage: boolean;
  storageKey: string;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxCacheSize: 1000,
  maxMemoryUsage: 50, // 50MB
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  compressionEnabled: true,
  persistToStorage: true,
  storageKey: 'chat-app-cache',
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number; // Estimated size in bytes
  compressed?: boolean;
}

interface CacheStats {
  totalItems: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
}

// Strategy pattern for eviction policies
interface EvictionStrategy<T> {
  selectItemsToEvict(
    cache: Map<string, CacheEntry<T>>,
    requiredSpace: number,
    maxSize: number
  ): string[];
  getName(): string;
  getDescription(): string;
}

class LRUEvictionStrategy<T> implements EvictionStrategy<T> {
  getName(): string {
    return 'LRU';
  }

  getDescription(): string {
    return 'Least Recently Used eviction strategy';
  }

  selectItemsToEvict(
    cache: Map<string, CacheEntry<T>>,
    requiredSpace: number,
    maxSize: number
  ): string[] {
    const entries = Array.from(cache.entries()).sort(([, a], [, b]) => {
      // Combine recency and frequency for better eviction strategy
      const aScore = a.lastAccessed + (a.accessCount * 1000);
      const bScore = b.lastAccessed + (b.accessCount * 1000);
      return aScore - bScore; // Ascending order (oldest/least used first)
    });

    const keysToEvict: string[] = [];
    let freedSpace = 0;
    const targetSize = Math.floor(maxSize * 0.8); // Target 80% capacity

    for (const [key, entry] of entries) {
      if (cache.size - keysToEvict.length <= targetSize && freedSpace >= requiredSpace) {
        break;
      }
      keysToEvict.push(key);
      freedSpace += entry.size;
    }

    return keysToEvict;
  }
}

// Strategy pattern for compression
interface CompressionStrategy<T> {
  compress(data: T): { data: T; compressed: boolean };
  decompress(data: T, compressed: boolean): T;
}

class NoCompressionStrategy<T> implements CompressionStrategy<T> {
  compress(data: T): { data: T; compressed: boolean } {
    return { data, compressed: false };
  }

  decompress(data: T, compressed: boolean): T {
    return data;
  }
}

// Example of a real compression strategy (commented out as it requires external library)
/*
class JSONCompressionStrategy<T> implements CompressionStrategy<T> {
  compress(data: T): { data: T; compressed: boolean } {
    if (typeof data === 'object' && data !== null) {
      try {
        // Using a hypothetical compression library
        const compressed = LZString.compress(JSON.stringify(data));
        return { data: compressed as unknown as T, compressed: true };
      } catch {
        return { data, compressed: false };
      }
    }
    return { data, compressed: false };
  }

  decompress(data: T, isCompressed: boolean): T {
    if (isCompressed && typeof data === 'string') {
      try {
        const decompressed = LZString.decompress(data);
        return JSON.parse(decompressed || '{}');
      } catch {
        return data;
      }
    }
    return data;
  }
}
*/

// Separate class for cache statistics
class CacheStatistics {
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  recordHit(): void {
    this.stats.hits++;
  }

  recordMiss(): void {
    this.stats.misses++;
  }

  recordEviction(): void {
    this.stats.evictions++;
  }

  getStats(totalItems: number, totalSize: number): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;

    return {
      totalItems,
      totalSize,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
      evictionCount: this.stats.evictions,
    };
  }

  reset(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }
}

// Separate class for storage persistence
class CacheStorage<T> {
  constructor(private config: CacheConfig) { }

  persist(cache: Map<string, CacheEntry<T>>): void {
    if (!this.config.persistToStorage || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const cacheData = {
        entries: Array.from(cache.entries()),
        timestamp: Date.now(),
      };

      localStorage.setItem(this.config.storageKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to persist cache to storage:', error);
    }
  }

  load(): Map<string, CacheEntry<T>> {
    const cache = new Map<string, CacheEntry<T>>();

    if (!this.config.persistToStorage || typeof localStorage === 'undefined') {
      return cache;
    }

    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) return cache;

      const cacheData = JSON.parse(stored);
      const currentTime = Date.now();

      // Only load if not too old
      if (currentTime - cacheData.timestamp < this.config.ttl) {
        for (const [key, entry] of cacheData.entries) {
          if (!this.isExpired(entry, currentTime)) {
            cache.set(key, entry);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
    }

    return cache;
  }

  private isExpired(entry: CacheEntry<T>, currentTime: number = Date.now()): boolean {
    return currentTime - entry.timestamp > this.config.ttl;
  }
}

export class CacheManager<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: CacheConfig;
  private statistics = new CacheStatistics();
  private storage: CacheStorage<T>;
  private evictionStrategy: EvictionStrategy<T>;
  private compressionStrategy: CompressionStrategy<T>;
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    config: Partial<CacheConfig> = {},
    evictionStrategy?: EvictionStrategy<T>,
    compressionStrategy?: CompressionStrategy<T>
  ) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.storage = new CacheStorage(this.config);
    this.evictionStrategy = evictionStrategy || new LRUEvictionStrategy<T>();
    this.compressionStrategy = compressionStrategy || new NoCompressionStrategy<T>();

    this.cache = this.storage.load();

    // Periodic cleanup with proper cleanup on destruction
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  // Add cleanup method for proper resource management
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.storage.persist(this.cache);
  }

  /**
   * Get cache health metrics
   */
  getHealthMetrics(): {
    memoryPressure: 'low' | 'medium' | 'high';
    recommendedAction: string;
    cacheEfficiency: number;
  } {
    const stats = this.getStats();
    const memoryUsageMB = stats.totalSize / (1024 * 1024);
    const maxMemoryMB = this.config.maxMemoryUsage;

    let memoryPressure: 'low' | 'medium' | 'high' = 'low';
    let recommendedAction = 'No action needed';

    if (memoryUsageMB > maxMemoryMB * 0.8) {
      memoryPressure = 'high';
      recommendedAction = 'Consider clearing cache or reducing cache size';
    } else if (memoryUsageMB > maxMemoryMB * 0.6) {
      memoryPressure = 'medium';
      recommendedAction = 'Monitor cache usage';
    }

    const cacheEfficiency = stats.hitRate;

    return {
      memoryPressure,
      recommendedAction,
      cacheEfficiency,
    };
  }

  /**
   * Get item from cache
   */
  get(key: string): T | null {
    try {
      const entry = this.cache.get(key);

      if (!entry) {
        this.statistics.recordMiss();
        return null;
      }

      // Check if expired
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.statistics.recordMiss();
        return null;
      }

      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.statistics.recordHit();

      return this.compressionStrategy.decompress(entry.data, entry.compressed || false);
    } catch (error) {
      console.warn(`Cache get error for key "${key}":`, error);
      this.statistics.recordMiss();
      return null;
    }
  }

  /**
   * Set item in cache
   */
  set(key: string, data: T): void {
    const { data: compressedData, compressed } = this.compressionStrategy.compress(data);
    const size = this.estimateSize(compressedData);

    const entry: CacheEntry<T> = {
      data: compressedData,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      size,
      compressed,
    };

    // Check if we need to evict items
    this.evictIfNeeded(size);

    this.cache.set(key, entry);
    this.storage.persist(this.cache);
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.storage.persist(this.cache);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalItems = this.cache.size;
    const totalSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);

    return this.statistics.getStats(totalItems, totalSize);
  }

  /**
   * Get multiple items from cache
   */
  getMultiple(keys: string[]): Map<string, T> {
    const result = new Map<string, T>();

    for (const key of keys) {
      const value = this.get(key);
      if (value !== null) {
        result.set(key, value);
      }
    }

    return result;
  }

  /**
   * Set multiple items in cache
   */
  setMultiple(items: Map<string, T>): void {
    for (const [key, value] of items) {
      this.set(key, value);
    }
  }

  /**
   * Get keys matching a pattern
   */
  getKeys(pattern?: RegExp): string[] {
    const keys = Array.from(this.cache.keys());
    return pattern ? keys.filter(key => pattern.test(key)) : keys;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      this.storage.persist(this.cache);
    }
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this.config.ttl;
  }

  /**
   * Evict items if cache is full or memory limit exceeded
   */
  private evictIfNeeded(newItemSize: number): void {
    const currentSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    const maxSizeBytes = this.config.maxMemoryUsage * 1024 * 1024;

    // Check if we need to evict based on size or count
    const needsEviction =
      this.cache.size >= this.config.maxCacheSize ||
      currentSize + newItemSize > maxSizeBytes;

    if (!needsEviction) return;

    const keysToEvict = this.evictionStrategy.selectItemsToEvict(
      this.cache,
      newItemSize,
      this.config.maxCacheSize
    );

    for (const key of keysToEvict) {
      this.cache.delete(key);
      this.statistics.recordEviction();
    }
  }

  /**
   * Estimate size of data in bytes
   */
  private estimateSize(data: any): number {
    if (typeof data === 'string') {
      return data.length * 2; // UTF-16 encoding
    }

    if (typeof data === 'object' && data !== null) {
      return JSON.stringify(data).length * 2;
    }

    return 8; // Default size for primitives
  }


}

/**
 * Specialized cache for conversations
 */
export class ConversationCache extends CacheManager<Conversation> {
  constructor() {
    super({
      maxCacheSize: 500,
      maxMemoryUsage: 100, // 100MB for conversations
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
      storageKey: 'chat-conversations-cache',
    });
  }

  /**
   * Cache conversation with automatic key generation
   */
  cacheConversation(conversation: Conversation): void {
    this.set(`conv:${conversation.id}`, conversation);
  }

  /**
   * Get conversation from cache
   */
  getConversation(id: string): Conversation | null {
    return this.get(`conv:${id}`);
  }

  /**
   * Cache multiple conversations
   */
  cacheConversations(conversations: Conversation[]): void {
    const items = new Map<string, Conversation>();
    for (const conv of conversations) {
      items.set(`conv:${conv.id}`, conv);
    }
    this.setMultiple(items);
  }

  /**
   * Get conversations by IDs
   */
  getConversations(ids: string[]): Map<string, Conversation> {
    const keys = ids.map(id => `conv:${id}`);
    const cached = this.getMultiple(keys);

    // Convert back to original IDs
    const result = new Map<string, Conversation>();
    for (const [key, conversation] of cached) {
      const id = key.replace('conv:', '');
      result.set(id, conversation);
    }

    return result;
  }

  /**
   * Remove conversation from cache
   */
  removeConversation(id: string): boolean {
    return this.delete(`conv:${id}`);
  }

  /**
   * Get all cached conversation IDs
   */
  getCachedConversationIds(): string[] {
    return this.getKeys(/^conv:/).map(key => key.replace('conv:', ''));
  }
}

/**
 * Specialized cache for messages
 */
export class MessageCache extends CacheManager<Message[]> {
  constructor() {
    super({
      maxCacheSize: 1000,
      maxMemoryUsage: 50, // 50MB for messages
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      storageKey: 'chat-messages-cache',
    });
  }

  /**
   * Cache messages for a conversation
   */
  cacheMessages(conversationId: string, messages: Message[]): void {
    this.set(`msg:${conversationId}`, messages);
  }

  /**
   * Get messages for a conversation
   */
  getMessages(conversationId: string): Message[] | null {
    return this.get(`msg:${conversationId}`);
  }

  /**
   * Remove messages for a conversation
   */
  removeMessages(conversationId: string): boolean {
    return this.delete(`msg:${conversationId}`);
  }

  /**
   * Cache partial messages (for pagination)
   */
  cachePartialMessages(conversationId: string, offset: number, limit: number, messages: Message[]): void {
    const key = `msg:${conversationId}:${offset}:${limit}`;
    this.set(key, messages);
  }

  /**
   * Get partial messages
   */
  getPartialMessages(conversationId: string, offset: number, limit: number): Message[] | null {
    const key = `msg:${conversationId}:${offset}:${limit}`;
    return this.get(key);
  }
}

/**
 * Global cache instances
 */
export const conversationCache = new ConversationCache();
export const messageCache = new MessageCache();

/**
 * Cache manager for search results
 */
export const searchCache = new CacheManager<any>({
  maxCacheSize: 200,
  maxMemoryUsage: 10, // 10MB for search results
  ttl: 30 * 60 * 1000, // 30 minutes
  storageKey: 'chat-search-cache',
});