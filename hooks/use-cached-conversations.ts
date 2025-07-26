import { useState, useEffect, useCallback, useMemo } from 'react';
import { Conversation, Message } from '../types/conversation';
import { conversationCache, messageCache } from '../utils/cache-manager';
import { createConversationLazyLoader, ConversationLazyLoader } from '../utils/lazy-loader';
import { useDebounceCallback } from '../utils/debounce';

export interface UseCachedConversationsOptions {
  pageSize?: number;
  preloadPages?: number;
  enableCaching?: boolean;
  enableLazyLoading?: boolean;
}

export interface CachedConversationsResult {
  conversations: Conversation[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  lazyLoader: ConversationLazyLoader | null;
  cacheStats: {
    hitRate: number;
    totalItems: number;
    totalSize: number;
  };
}

/**
 * Hook for managing cached conversations with lazy loading
 */
export function useCachedConversations(
  sourceConversations: Conversation[],
  options: UseCachedConversationsOptions = {}
): CachedConversationsResult {
  const {
    pageSize = 20,
    preloadPages = 2,
    enableCaching = true,
    enableLazyLoading = true,
  } = options;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);

  // Create lazy loader
  const lazyLoader = useMemo(() => {
    if (!enableLazyLoading) return null;
    
    return createConversationLazyLoader(sourceConversations, {
      pageSize,
      preloadPages,
    });
  }, [sourceConversations, pageSize, preloadPages, enableLazyLoading]);

  // Debounced cache update
  const debouncedCacheUpdate = useDebounceCallback((convs: Conversation[]) => {
    if (enableCaching) {
      conversationCache.cacheConversations(convs);
    }
  }, 500);

  // Load initial conversations
  useEffect(() => {
    loadInitialConversations();
  }, [sourceConversations]);

  // Cache conversations when they change
  useEffect(() => {
    if (conversations.length > 0) {
      debouncedCacheUpdate(conversations);
    }
  }, [conversations, debouncedCacheUpdate]);

  /**
   * Load initial conversations (first page)
   */
  const loadInitialConversations = useCallback(async () => {
    setIsLoading(true);
    
    try {
      if (enableCaching) {
        // Try to load from cache first
        const cachedIds = conversationCache.getCachedConversationIds();
        if (cachedIds.length > 0) {
          const cached = conversationCache.getConversations(cachedIds.slice(0, pageSize));
          if (cached.size > 0) {
            const cachedConversations = Array.from(cached.values());
            setConversations(cachedConversations);
            setCurrentOffset(cachedConversations.length);
            setHasMore(cachedConversations.length === pageSize);
            setIsLoading(false);
            return;
          }
        }
      }

      // Load from source
      if (enableLazyLoading && lazyLoader) {
        const result = await lazyLoader.loadConversations(0, pageSize);
        setConversations(result.data);
        setCurrentOffset(result.data.length);
        setHasMore(result.hasMore);
      } else {
        // Load all conversations if lazy loading is disabled
        const initialConversations = sourceConversations.slice(0, pageSize);
        setConversations(initialConversations);
        setCurrentOffset(initialConversations.length);
        setHasMore(sourceConversations.length > pageSize);
      }
    } catch (error) {
      console.error('Failed to load initial conversations:', error);
      // Fallback to source conversations
      const fallbackConversations = sourceConversations.slice(0, pageSize);
      setConversations(fallbackConversations);
      setCurrentOffset(fallbackConversations.length);
      setHasMore(sourceConversations.length > pageSize);
    } finally {
      setIsLoading(false);
    }
  }, [sourceConversations, pageSize, enableCaching, enableLazyLoading, lazyLoader]);

  /**
   * Load more conversations
   */
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);

    try {
      if (enableLazyLoading && lazyLoader) {
        const result = await lazyLoader.loadConversations(currentOffset, pageSize);
        
        setConversations(prev => {
          // Avoid duplicates
          const existingIds = new Set(prev.map(c => c.id));
          const newConversations = result.data.filter(c => !existingIds.has(c.id));
          return [...prev, ...newConversations];
        });
        
        setCurrentOffset(prev => prev + result.data.length);
        setHasMore(result.hasMore);
      } else {
        // Load from source conversations
        const nextBatch = sourceConversations.slice(currentOffset, currentOffset + pageSize);
        
        setConversations(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newConversations = nextBatch.filter(c => !existingIds.has(c.id));
          return [...prev, ...newConversations];
        });
        
        setCurrentOffset(prev => prev + nextBatch.length);
        setHasMore(currentOffset + nextBatch.length < sourceConversations.length);
      }
    } catch (error) {
      console.error('Failed to load more conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, currentOffset, pageSize, enableLazyLoading, lazyLoader, sourceConversations]);

  /**
   * Refresh conversations
   */
  const refresh = useCallback(async () => {
    // Clear cache if enabled
    if (enableCaching) {
      const cachedIds = conversationCache.getCachedConversationIds();
      for (const id of cachedIds) {
        conversationCache.removeConversation(id);
      }
    }

    // Clear lazy loader cache
    if (lazyLoader) {
      lazyLoader.clearCache();
    }

    // Reset state and reload
    setConversations([]);
    setCurrentOffset(0);
    setHasMore(true);
    
    await loadInitialConversations();
  }, [enableCaching, lazyLoader, loadInitialConversations]);

  // Get cache statistics
  const cacheStats = useMemo(() => {
    if (!enableCaching) {
      return { hitRate: 0, totalItems: 0, totalSize: 0 };
    }

    const stats = conversationCache.getStats();
    return {
      hitRate: stats.hitRate,
      totalItems: stats.totalItems,
      totalSize: stats.totalSize,
    };
  }, [enableCaching, conversations]); // Re-calculate when conversations change

  return {
    conversations,
    isLoading,
    hasMore,
    loadMore,
    refresh,
    lazyLoader,
    cacheStats,
  };
}

/**
 * Hook for managing cached messages within a conversation
 */
export function useCachedMessages(
  conversationId: string,
  sourceMessages: Message[],
  options: { pageSize?: number; enableCaching?: boolean } = {}
) {
  const { pageSize = 50, enableCaching = true } = options;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);

  // Load initial messages
  useEffect(() => {
    loadInitialMessages();
  }, [conversationId, sourceMessages]);

  // Cache messages when they change
  useEffect(() => {
    if (messages.length > 0 && enableCaching) {
      messageCache.cacheMessages(conversationId, messages);
    }
  }, [conversationId, messages, enableCaching]);

  const loadInitialMessages = useCallback(async () => {
    setIsLoading(true);

    try {
      if (enableCaching) {
        // Try to load from cache first
        const cached = messageCache.getMessages(conversationId);
        if (cached && cached.length > 0) {
          setMessages(cached.slice(0, pageSize));
          setCurrentOffset(Math.min(pageSize, cached.length));
          setHasMore(cached.length > pageSize);
          setIsLoading(false);
          return;
        }
      }

      // Load from source
      const initialMessages = sourceMessages.slice(0, pageSize);
      setMessages(initialMessages);
      setCurrentOffset(initialMessages.length);
      setHasMore(sourceMessages.length > pageSize);
    } catch (error) {
      console.error('Failed to load initial messages:', error);
      const fallbackMessages = sourceMessages.slice(0, pageSize);
      setMessages(fallbackMessages);
      setCurrentOffset(fallbackMessages.length);
      setHasMore(sourceMessages.length > pageSize);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, sourceMessages, pageSize, enableCaching]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);

    try {
      const nextBatch = sourceMessages.slice(currentOffset, currentOffset + pageSize);
      
      setMessages(prev => [...prev, ...nextBatch]);
      setCurrentOffset(prev => prev + nextBatch.length);
      setHasMore(currentOffset + nextBatch.length < sourceMessages.length);
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, currentOffset, pageSize, sourceMessages]);

  const refresh = useCallback(async () => {
    if (enableCaching) {
      messageCache.removeMessages(conversationId);
    }

    setMessages([]);
    setCurrentOffset(0);
    setHasMore(true);
    
    await loadInitialMessages();
  }, [conversationId, enableCaching, loadInitialMessages]);

  return {
    messages,
    isLoading,
    hasMore,
    loadMore,
    refresh,
  };
}