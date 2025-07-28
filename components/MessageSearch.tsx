import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { 
  Search, 
  X, 
  ChevronUp, 
  ChevronDown, 
  Filter,
  User,
  Bot,
  Settings2
} from 'lucide-react';
import { cn } from './ui/utils';

import { Message } from '../types/conversation';
import { useOptimizedSearch, useRenderOptimization } from '../utils/debounce';

export interface SearchResult {
  messageId: string;
  message: Message;
  matchedText: string;
  matchIndex: number;
  contextBefore: string;
  contextAfter: string;
}

export interface SearchFilters {
  role?: 'user' | 'assistant' | 'system';
  dateRange?: {
    start: Date;
    end: Date;
  };
  model?: string;
  minTokens?: number;
  maxTokens?: number;
  editedOnly?: boolean;
}

interface MessageSearchProps {
  messages: Message[];
  onSearchResults: (results: SearchResult[]) => void;
  onHighlightMessage: (messageId: string, searchTerm: string) => void;
  onNavigateToMessage: (messageId: string) => void;
  className?: string;
}

export function MessageSearch({
  messages,
  onSearchResults,
  onHighlightMessage,
  onNavigateToMessage,
  className
}: MessageSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  // Available models from messages
  const availableModels = useMemo(() => {
    const models = new Set(messages.map(m => m.model).filter(Boolean));
    return Array.from(models);
  }, [messages]);

  // Optimized search function with filtering
  const searchFunction = useCallback((items: Message[], term: string): SearchResult[] => {
    if (!term.trim()) {
      return [];
    }

    // Apply filters first
    let filteredMessages = items;

    if (filters.role) {
      filteredMessages = filteredMessages.filter(m => m.role === filters.role);
    }

    if (filters.dateRange) {
      filteredMessages = filteredMessages.filter(m => 
        m.timestamp >= filters.dateRange!.start && 
        m.timestamp <= filters.dateRange!.end
      );
    }

    if (filters.model) {
      filteredMessages = filteredMessages.filter(m => m.model === filters.model);
    }

    if (filters.minTokens !== undefined) {
      filteredMessages = filteredMessages.filter(m => (m.tokens || 0) >= filters.minTokens!);
    }

    if (filters.maxTokens !== undefined) {
      filteredMessages = filteredMessages.filter(m => (m.tokens || 0) <= filters.maxTokens!);
    }

    if (filters.editedOnly) {
      filteredMessages = filteredMessages.filter(m => m.isEdited);
    }

    // Perform text search
    const results: SearchResult[] = [];
    
    try {
      const searchRegex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

      filteredMessages.forEach(message => {
        // Use exec in a loop for better compatibility
        let match: RegExpExecArray | null;
        const regex = new RegExp(searchRegex.source, searchRegex.flags);
        
        while ((match = regex.exec(message.content)) !== null) {
          const matchIndex = match.index;
          const contextStart = Math.max(0, matchIndex - 50);
          const contextEnd = Math.min(message.content.length, matchIndex + match[0].length + 50);
          
          results.push({
            messageId: message.id,
            message,
            matchedText: match[0],
            matchIndex,
            contextBefore: message.content.slice(contextStart, matchIndex),
            contextAfter: message.content.slice(matchIndex + match[0].length, contextEnd)
          });

          // Prevent infinite loop for zero-length matches
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }
      });
    } catch (error) {
      console.error('Search regex error:', error);
      return [];
    }

    return results;
  }, [filters]);

  // Create a wrapper search function that returns messages for the hook
  const messageSearchFunction = useCallback((items: Message[], term: string): Message[] => {
    const results = searchFunction(items, term);
    return results.map(result => result.message);
  }, [searchFunction]);

  // Use optimized search with caching
  const {
    isSearching: isOptimizedSearching,
    debouncedTerm,
    cacheHit
  } = useOptimizedSearch(messages, searchTerm, messageSearchFunction, {
    delay: 250,
    cacheSize: 50,
    minSearchLength: 1,
  });

  // Convert messages back to search results when we have a search term
  const rawSearchResults = useMemo(() => {
    if (!debouncedTerm.trim()) {
      return [];
    }
    return searchFunction(messages, debouncedTerm);
  }, [searchFunction, messages, debouncedTerm]);

  // Update search results with render optimization
  const optimizedSearchResults = useRenderOptimization(rawSearchResults, undefined, 100);

  const navigateToResult = useCallback((index: number) => {
    if (index >= 0 && index < searchResults.length) {
      setCurrentResultIndex(index);
      const result = searchResults[index];
      onNavigateToMessage(result.messageId);
      onHighlightMessage(result.messageId, debouncedTerm || searchTerm);
    }
  }, [searchResults, onNavigateToMessage, onHighlightMessage, debouncedTerm, searchTerm]);

  const nextResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentResultIndex + 1) % searchResults.length;
    navigateToResult(nextIndex);
  }, [currentResultIndex, searchResults.length, navigateToResult]);

  const previousResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const prevIndex = currentResultIndex === 0 ? searchResults.length - 1 : currentResultIndex - 1;
    navigateToResult(prevIndex);
  }, [currentResultIndex, searchResults.length, navigateToResult]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchResults([]);
    setCurrentResultIndex(0);
    onSearchResults([]);
  }, [onSearchResults]);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Update state when search results change
  useEffect(() => {
    setSearchResults(optimizedSearchResults);
    setCurrentResultIndex(0);
    onSearchResults(optimizedSearchResults);
    setIsSearching(isOptimizedSearching);

    // Highlight first result
    if (optimizedSearchResults.length > 0 && debouncedTerm) {
      onHighlightMessage(optimizedSearchResults[0].messageId, debouncedTerm);
    }
  }, [optimizedSearchResults, isOptimizedSearching, debouncedTerm, onSearchResults, onHighlightMessage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (searchResults.length === 0) return;

      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          previousResult();
        } else {
          nextResult();
        }
      } else if (e.key === 'Escape') {
        clearSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchResults.length, nextResult, previousResult, clearSearch]);

  const hasActiveFilters = useMemo(() => 
    Object.values(filters).some(value => 
      value !== undefined && value !== null && value !== ''
    ), [filters]
  );

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search messages... (Cmd/Ctrl+Enter to navigate)"
          className="pl-10 pr-20"
          aria-label="Search messages"
          aria-describedby={searchResults.length > 0 ? "search-results-count" : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchResults.length > 0) {
              e.preventDefault();
              if (e.shiftKey) {
                previousResult();
              } else {
                nextResult();
              }
            } else if (e.key === 'Escape') {
              e.preventDefault();
              clearSearch();
            }
          }}
        />
        
        {/* Search Results Counter */}
        {searchResults.length > 0 && (
          <div 
            id="search-results-count"
            className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground"
            aria-live="polite"
          >
            <span>
              {currentResultIndex + 1} of {searchResults.length}
            </span>
          </div>
        )}
        
        {/* Clear Search */}
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            onClick={clearSearch}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Navigation Controls */}
      {searchResults.length > 0 && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={previousResult}
            disabled={searchResults.length <= 1}
            title="Previous result"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={nextResult}
            disabled={searchResults.length <= 1}
            title="Next result"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Filters */}
      <Popover open={showFilters} onOpenChange={setShowFilters}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              hasActiveFilters && "text-primary bg-primary/10"
            )}
            title="Search filters"
          >
            <Filter className="h-4 w-4" />
            {hasActiveFilters && (
              <div className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Search Filters</h4>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-6 px-2 text-xs"
                >
                  Clear All
                </Button>
              )}
            </div>

            {/* Role Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Message Type</label>
              <div className="flex gap-2">
                <Button
                  variant={filters.role === 'user' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilters(prev => ({ 
                    ...prev, 
                    role: prev.role === 'user' ? undefined : 'user' 
                  }))}
                  className="flex-1"
                >
                  <User className="h-3 w-3 mr-1" />
                  User
                </Button>
                <Button
                  variant={filters.role === 'assistant' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilters(prev => ({ 
                    ...prev, 
                    role: prev.role === 'assistant' ? undefined : 'assistant' 
                  }))}
                  className="flex-1"
                >
                  <Bot className="h-3 w-3 mr-1" />
                  Assistant
                </Button>
              </div>
            </div>

            {/* Model Filter */}
            {availableModels.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Model</label>
                <ScrollArea className="h-20">
                  <div className="space-y-1">
                    {availableModels.map(model => (
                      <Button
                        key={model}
                        variant={filters.model === model ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setFilters(prev => ({ 
                          ...prev, 
                          model: prev.model === model ? undefined : model 
                        }))}
                        className="w-full justify-start text-xs"
                      >
                        {model}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Token Range Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Token Range</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.minTokens || ''}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    minTokens: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.maxTokens || ''}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    maxTokens: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Other Filters */}
            <div className="space-y-2">
              <Button
                variant={filters.editedOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilters(prev => ({ 
                  ...prev, 
                  editedOnly: !prev.editedOnly 
                }))}
                className="w-full justify-start"
              >
                <Settings2 className="h-3 w-3 mr-2" />
                Edited messages only
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Search Status */}
      {(isSearching || isOptimizedSearching) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
          <span>Searching...</span>
          {cacheHit && process.env.NODE_ENV === 'development' && (
            <span className="text-green-500">(Cached)</span>
          )}
        </div>
      )}

      {/* No Results */}
      {!isSearching && !isOptimizedSearching && searchTerm && searchResults.length === 0 && (
        <div className="text-xs text-muted-foreground">
          No results found
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1">
          {filters.role && (
            <Badge variant="secondary" className="text-xs">
              {filters.role === 'user' ? 'User' : 'Assistant'}
            </Badge>
          )}
          {filters.model && (
            <Badge variant="secondary" className="text-xs">
              {filters.model}
            </Badge>
          )}
          {filters.editedOnly && (
            <Badge variant="secondary" className="text-xs">
              Edited
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}