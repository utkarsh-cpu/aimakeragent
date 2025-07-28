import { Conversation, Message } from '../types/conversation';
import { conversationCache, messageCache } from './cache-manager';

export interface LazyLoadConfig {
  pageSize: number;
  preloadPages: number;
  maxConcurrentLoads: number;
  loadTimeout: number;
}

export const DEFAULT_LAZY_LOAD_CONFIG: LazyLoadConfig = {
  pageSize: 20,
  preloadPages: 2,
  maxConcurrentLoads: 3,
  loadTimeout: 5000,
};

export interface LoadResult<T> {
  data: T[];
  hasMore: boolean;
  totalCount?: number;
  nextOffset?: number;
}

export interface LoadRequest {
  offset: number;
  limit: number;
  filters?: any;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Generic lazy loader with caching support
 */
export class LazyLoader<T extends { id: string }> {
  private config: LazyLoadConfig;
  private loadingRequests = new Map<string, Promise<LoadResult<T>>>();
  private loadedPages = new Set<string>();
  private totalCount: number | null = null;

  constructor(
    private loadFunction: (request: LoadRequest) => Promise<LoadResult<T>>,
    config: Partial<LazyLoadConfig> = {}
  ) {
    this.config = { ...DEFAULT_LAZY_LOAD_CONFIG, ...config };
  }

  /**
   * Load a page of data
   */
  async loadPage(
    offset: number,
    limit: number = this.config.pageSize,
    filters?: any
  ): Promise<LoadResult<T>> {
    const cacheKey = this.getCacheKey(offset, limit, filters);

    // Check if already loading
    const existingRequest = this.loadingRequests.get(cacheKey);
    if (existingRequest) {
      return existingRequest;
    }

    // Create load request
    const request: LoadRequest = {
      offset,
      limit,
      filters,
    };

    const loadPromise = this.executeLoad(request, cacheKey);
    this.loadingRequests.set(cacheKey, loadPromise);

    try {
      const result = await loadPromise;
      this.loadedPages.add(cacheKey);

      if (result.totalCount !== undefined) {
        this.totalCount = result.totalCount;
      }

      // Preload adjacent pages if configured
      this.preloadAdjacentPages(offset, limit, filters);

      return result;
    } finally {
      this.loadingRequests.delete(cacheKey);
    }
  }

  /**
   * Load multiple pages concurrently
   */
  async loadPages(requests: LoadRequest[]): Promise<Map<string, LoadResult<T>>> {
    const results = new Map<string, LoadResult<T>>();

    // Limit concurrent requests
    const chunks = this.chunkArray(requests, this.config.maxConcurrentLoads);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (request) => {
        try {
          const result = await this.loadPage(request.offset, request.limit, request.filters);
          const key = this.getCacheKey(request.offset, request.limit, request.filters);
          results.set(key, result);
        } catch (error) {
          console.error('Failed to load page:', error);
        }
      });

      await Promise.all(chunkPromises);
    }

    return results;
  }

  /**
   * Check if a page is loaded
   */
  isPageLoaded(offset: number, limit: number = this.config.pageSize, filters?: any): boolean {
    const cacheKey = this.getCacheKey(offset, limit, filters);
    return this.loadedPages.has(cacheKey);
  }

  /**
   * Get total count if available
   */
  getTotalCount(): number | null {
    return this.totalCount;
  }

  /**
   * Clear loaded pages cache
   */
  clearCache(): void {
    this.loadedPages.clear();
    this.loadingRequests.clear();
    this.totalCount = null;
  }

  /**
   * Get estimated total pages
   */
  getEstimatedPageCount(): number | null {
    if (this.totalCount === null) return null;
    return Math.ceil(this.totalCount / this.config.pageSize);
  }

  /**
   * Execute the actual load with timeout
   */
  private async executeLoad(request: LoadRequest, cacheKey: string): Promise<LoadResult<T>> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Load timeout')), this.config.loadTimeout);
    });

    try {
      return await Promise.race([
        this.loadFunction(request),
        timeoutPromise,
      ]);
    } catch (error) {
      console.error(`Failed to load data for ${cacheKey}:`, error);
      throw error;
    }
  }

  /**
   * Preload adjacent pages
   */
  private preloadAdjacentPages(offset: number, limit: number, filters?: any): void {
    if (this.config.preloadPages <= 0) return;

    const preloadPromises: Promise<any>[] = [];

    // Preload next pages
    for (let i = 1; i <= this.config.preloadPages; i++) {
      const nextOffset = offset + (limit * i);
      const nextCacheKey = this.getCacheKey(nextOffset, limit, filters);

      if (!this.loadedPages.has(nextCacheKey) && !this.loadingRequests.has(nextCacheKey)) {
        preloadPromises.push(
          this.loadPage(nextOffset, limit, filters).catch(() => {
            // Ignore preload errors
          })
        );
      }
    }

    // Preload previous pages
    for (let i = 1; i <= this.config.preloadPages; i++) {
      const prevOffset = Math.max(0, offset - (limit * i));
      if (prevOffset === offset) break;

      const prevCacheKey = this.getCacheKey(prevOffset, limit, filters);

      if (!this.loadedPages.has(prevCacheKey) && !this.loadingRequests.has(prevCacheKey)) {
        preloadPromises.push(
          this.loadPage(prevOffset, limit, filters).catch(() => {
            // Ignore preload errors
          })
        );
      }
    }

    // Execute preloads without waiting
    if (preloadPromises.length > 0) {
      Promise.all(preloadPromises).catch(() => {
        // Ignore preload errors
      });
    }
  }

  /**
   * Generate cache key for request
   */
  protected getCacheKey(offset: number, limit: number, filters?: any): string {
    const filterStr = filters ? JSON.stringify(filters) : '';
    return `${offset}:${limit}:${filterStr}`;
  }

  /**
   * Split array into chunks
   */
  private chunkArray<U>(array: U[], chunkSize: number): U[][] {
    const chunks: U[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

/**
 * Conversation lazy loader
 */
export class ConversationLazyLoader extends LazyLoader<Conversation> {

  constructor(
    loadFunction: (request: LoadRequest) => Promise<LoadResult<Conversation>>,
    config?: Partial<LazyLoadConfig>
  ) {
    super(loadFunction, config);
  }

  /**
   * Load conversations with caching
   */
  async loadConversations(
    offset: number,
    limit: number = DEFAULT_LAZY_LOAD_CONFIG.pageSize,
    filters?: any
  ): Promise<LoadResult<Conversation>> {
    // Check cache first
    const cachedConversations = this.getCachedConversations(offset, limit, filters);
    if (cachedConversations) {
      return cachedConversations;
    }

    // Load from source
    const result = await this.loadPage(offset, limit, filters);

    // Cache the results
    this.cacheConversations(offset, limit, filters, result);

    return result;
  }

  /**
   * Get cached conversations
   */
  private getCachedConversations(
    offset: number,
    limit: number,
    filters?: any
  ): LoadResult<Conversation> | null {
    const cacheKey = `conversations:${this.getCacheKey(offset, limit, filters)}`;

    // Try to get from conversation cache
    const cached = conversationCache.get(cacheKey);
    if (cached && this.isValidLoadResult(cached)) {
      return cached as LoadResult<Conversation>;
    }

    return null;
  }

  /**
   * Type guard to check if cached data is a valid LoadResult
   */
  private isValidLoadResult(data: any): data is LoadResult<Conversation> {
    return data &&
      Array.isArray(data.data) &&
      typeof data.hasMore === 'boolean';
  }

  /**
   * Cache conversations
   */
  private cacheConversations(
    offset: number,
    limit: number,
    filters: any,
    result: LoadResult<Conversation>
  ): void {
    const cacheKey = `conversations:${this.getCacheKey(offset, limit, filters)}`;
    conversationCache.set(cacheKey, result as any);

    // Also cache individual conversations
    for (const conversation of result.data) {
      conversationCache.cacheConversation(conversation);
    }
  }

  public getCacheKey(offset: number, limit: number, filters?: any): string {
    const filterStr = filters ? JSON.stringify(filters) : '';
    return `${offset}:${limit}:${filterStr}`;
  }
}

/**
 * Message lazy loader for large conversations
 */
export class MessageLazyLoader extends LazyLoader<Message> {
  constructor(
    private conversationId: string,
    loadFunction: (request: LoadRequest) => Promise<LoadResult<Message>>,
    config?: Partial<LazyLoadConfig>
  ) {
    super(loadFunction, {
      pageSize: 50, // Smaller page size for messages
      preloadPages: 1,
      ...config,
    });
  }

  /**
   * Load messages with caching
   */
  async loadMessages(
    offset: number,
    limit: number = 50
  ): Promise<LoadResult<Message>> {
    // Check cache first
    const cached = messageCache.getPartialMessages(this.conversationId, offset, limit);
    if (cached) {
      return {
        data: cached,
        hasMore: cached.length === limit,
        nextOffset: offset + limit,
      };
    }

    // Load from source
    const result = await this.loadPage(offset, limit);

    // Cache the results
    messageCache.cachePartialMessages(this.conversationId, offset, limit, result.data);

    return result;
  }

  /**
   * Load all messages for conversation (with intelligent chunking)
   */
  async loadAllMessages(): Promise<Message[]> {
    const allMessages: Message[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await this.loadMessages(offset, 50);
      allMessages.push(...result.data);

      hasMore = result.hasMore;
      offset = result.nextOffset || (offset + 50);
    }

    // Cache the complete message list
    messageCache.cacheMessages(this.conversationId, allMessages);

    return allMessages;
  }
}

/**
 * Create a conversation lazy loader with default implementation
 */
export function createConversationLazyLoader(
  conversations: Conversation[],
  config?: Partial<LazyLoadConfig>
): ConversationLazyLoader {
  const loadFunction = async (request: LoadRequest): Promise<LoadResult<Conversation>> => {
    // Simulate async loading from the provided conversations array
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to simulate async

    let filteredConversations = [...conversations];

    // Apply filters if provided
    if (request.filters) {
      // Add filtering logic here based on your filter structure
      // This is a simplified example
      if (request.filters.query) {
        const query = request.filters.query.toLowerCase();
        filteredConversations = filteredConversations.filter(conv =>
          conv.title.toLowerCase().includes(query) ||
          conv.messages.some(msg => msg.content.toLowerCase().includes(query))
        );
      }
    }

    // Apply sorting
    if (request.sortBy) {
      filteredConversations.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (request.sortBy) {
          case 'title':
            aValue = a.title;
            bValue = b.title;
            break;
          case 'lastMessage':
            aValue = a.lastMessage?.getTime() || 0;
            bValue = b.lastMessage?.getTime() || 0;
            break;
          case 'createdAt':
            aValue = a.metadata.createdAt.getTime();
            bValue = b.metadata.createdAt.getTime();
            break;
          default:
            aValue = a.lastMessage?.getTime() || 0;
            bValue = b.lastMessage?.getTime() || 0;
        }

        if (request.sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
    }

    // Paginate
    const start = request.offset;
    const end = start + request.limit;
    const pageData = filteredConversations.slice(start, end);

    return {
      data: pageData,
      hasMore: end < filteredConversations.length,
      totalCount: filteredConversations.length,
      nextOffset: end,
    };
  };

  return new ConversationLazyLoader(loadFunction, config);
}

/**
 * Create a message lazy loader for a conversation
 */
export function createMessageLazyLoader(
  conversationId: string,
  messages: Message[],
  config?: Partial<LazyLoadConfig>
): MessageLazyLoader {
  const loadFunction = async (request: LoadRequest): Promise<LoadResult<Message>> => {
    // Simulate async loading
    await new Promise(resolve => setTimeout(resolve, 5));

    const start = request.offset;
    const end = start + request.limit;
    const pageData = messages.slice(start, end);

    return {
      data: pageData,
      hasMore: end < messages.length,
      totalCount: messages.length,
      nextOffset: end,
    };
  };

  return new MessageLazyLoader(conversationId, loadFunction, config);
}