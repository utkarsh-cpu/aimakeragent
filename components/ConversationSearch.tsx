import { useState, useEffect, useMemo, useCallback } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Search,
  Filter,
  X,
  Tag,
  Star,
  Archive,
  SortAsc,
  SortDesc,
} from "lucide-react";
import {
  Conversation,
  ConversationFilter,
  ConversationSortOptions,
} from "../types/conversation";
import {
  filterConversations,
  sortConversations,
} from "../utils/conversation-utils";
import {
  useOptimizedSearch,
  useDebounceCallback,
  useRenderOptimization,
} from "../utils/debounce";

interface ConversationSearchProps {
  conversations: Conversation[];
  onFilteredResults: (filtered: Conversation[]) => void;
  className?: string;
}

export function ConversationSearch({
  conversations,
  onFilteredResults,
  className = "",
}: ConversationSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<ConversationFilter>({});
  const [sortOptions, setSortOptions] = useState<ConversationSortOptions>({
    field: "lastMessage",
    direction: "desc",
  });
  const [showFilters, setShowFilters] = useState(false);

  // Optimized search function with caching
  const searchFunction = useCallback((items: Conversation[], term: string) => {
    return filterConversations(items, { query: term });
  }, []);

  // Use optimized search with caching
  const {
    results: searchResults,
    isSearching,
    debouncedTerm,
    cacheHit,
  } = useOptimizedSearch(conversations, searchQuery, searchFunction, {
    delay: 200,
    cacheSize: 100,
    minSearchLength: 1,
  });

  // Get unique tags and models from conversations
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    conversations.forEach((conv) => {
      conv.metadata.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [conversations]);

  const availableModels = useMemo(() => {
    const models = new Set<string>();
    conversations.forEach((conv) => {
      if (conv.metadata.model) {
        models.add(conv.metadata.model);
      }
    });
    return Array.from(models).sort();
  }, [conversations]);

  // Apply additional filters and sorting with optimization
  const filteredAndSortedConversations = useRenderOptimization(
    useMemo(() => {
      let filtered = searchResults;

      // Apply other filters (non-search filters)
      if (Object.keys(activeFilters).length > 0) {
        filtered = filterConversations(filtered, activeFilters);
      }

      // Apply sorting
      return sortConversations(filtered, sortOptions);
    }, [searchResults, activeFilters, sortOptions]),
    (prev, next) => {
      return (
        prev.length === next.length &&
        prev.every((conv, index) => conv.id === next[index]?.id)
      );
    },
    100,
  );

  // Update parent component with filtered results
  useEffect(() => {
    onFilteredResults(filteredAndSortedConversations);
  }, [filteredAndSortedConversations, onFilteredResults]);

  // Debounced search change handler
  const debouncedSetSearchQuery = useDebounceCallback(setSearchQuery, 100);

  const handleSearchChange = useCallback(
    (value: string) => {
      debouncedSetSearchQuery(value);
    },
    [debouncedSetSearchQuery],
  );

  const addTagFilter = (tag: string) => {
    setActiveFilters((prev) => ({
      ...prev,
      tags: [...(prev.tags || []), tag],
    }));
  };

  const removeTagFilter = (tag: string) => {
    setActiveFilters((prev) => ({
      ...prev,
      tags: prev.tags?.filter((t) => t !== tag),
    }));
  };

  const setModelFilter = (model: string | undefined) => {
    setActiveFilters((prev) => ({
      ...prev,
      model: model || undefined,
    }));
  };

  const setArchiveFilter = (isArchived: boolean | undefined) => {
    setActiveFilters((prev) => ({
      ...prev,
      isArchived,
    }));
  };

  const setFavoriteFilter = (isFavorite: boolean | undefined) => {
    setActiveFilters((prev) => ({
      ...prev,
      isFavorite,
    }));
  };

  // const setDateRangeFilter = (dateRange: { start: Date; end: Date } | undefined) => {
  //   setActiveFilters(prev => ({
  //     ...prev,
  //     dateRange
  //   }));
  // };

  const clearAllFilters = () => {
    setSearchQuery("");
    setActiveFilters({});
  };

  const hasActiveFilters =
    searchQuery.trim() || Object.keys(activeFilters).length > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/70" />
        <Input
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 pr-20"
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`h-6 px-2 ${showFilters ? "bg-accent" : ""}`}
          >
            <Filter className="h-3 w-3" />
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-6 px-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1">
          {searchQuery.trim() && (
            <Badge variant="secondary" className="text-xs">
              Search: "{searchQuery}"
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          )}
          {activeFilters.tags?.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              <Tag className="h-2 w-2 mr-1" />
              {tag}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeTagFilter(tag)}
                className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          ))}
          {activeFilters.model && (
            <Badge variant="secondary" className="text-xs">
              Model: {activeFilters.model}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModelFilter(undefined)}
                className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          )}
          {activeFilters.isFavorite !== undefined && (
            <Badge variant="secondary" className="text-xs">
              <Star className="h-2 w-2 mr-1" />
              {activeFilters.isFavorite ? "Favorites" : "Not Favorites"}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFavoriteFilter(undefined)}
                className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          )}
          {activeFilters.isArchived !== undefined && (
            <Badge variant="secondary" className="text-xs">
              <Archive className="h-2 w-2 mr-1" />
              {activeFilters.isArchived ? "Archived" : "Not Archived"}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setArchiveFilter(undefined)}
                className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          )}
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="border rounded-lg p-3 bg-background/50 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Filters & Sorting</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Sort Options */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Sort By
              </label>
              <div className="flex gap-1">
                <Select
                  value={sortOptions.field}
                  onValueChange={(field: any) =>
                    setSortOptions((prev) => ({ ...prev, field }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lastMessage">Last Message</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                    <SelectItem value="createdAt">Created Date</SelectItem>
                    <SelectItem value="messageCount">Message Count</SelectItem>
                    <SelectItem value="tokenCount">Token Count</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSortOptions((prev) => ({
                      ...prev,
                      direction: prev.direction === "asc" ? "desc" : "asc",
                    }))
                  }
                  className="h-8 w-8 p-0"
                >
                  {sortOptions.direction === "asc" ? (
                    <SortAsc className="h-3 w-3" />
                  ) : (
                    <SortDesc className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            {/* Model Filter */}
            {availableModels.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Model
                </label>
                <Select
                  value={activeFilters.model || ""}
                  onValueChange={(value) => setModelFilter(value || undefined)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All models</SelectItem>
                    {availableModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quick Filters */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Quick Filters
              </label>
              <div className="flex flex-wrap gap-1">
                <Button
                  variant={
                    activeFilters.isFavorite === true ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    setFavoriteFilter(
                      activeFilters.isFavorite === true ? undefined : true,
                    )
                  }
                  className="h-7 text-xs"
                >
                  <Star className="h-3 w-3 mr-1" />
                  Favorites
                </Button>
                <Button
                  variant={
                    activeFilters.isArchived === true ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    setArchiveFilter(
                      activeFilters.isArchived === true ? undefined : true,
                    )
                  }
                  className="h-7 text-xs"
                >
                  <Archive className="h-3 w-3 mr-1" />
                  Archived
                </Button>
              </div>
            </div>

            {/* Tags Filter */}
            {availableTags.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Tags
                </label>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {availableTags.map((tag) => (
                    <Button
                      key={tag}
                      variant={
                        activeFilters.tags?.includes(tag)
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => {
                        if (activeFilters.tags?.includes(tag)) {
                          removeTagFilter(tag);
                        } else {
                          addTagFilter(tag);
                        }
                      }}
                      className="h-6 text-xs"
                    >
                      <Tag className="h-2 w-2 mr-1" />
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Results Summary */}
          <div className="text-xs text-muted-foreground pt-2 border-t flex items-center justify-between">
            <span>
              Showing {filteredAndSortedConversations.length} of{" "}
              {conversations.length} conversations
            </span>
            {isSearching && (
              <div className="flex items-center gap-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                <span>Searching...</span>
              </div>
            )}
            {cacheHit && process.env.NODE_ENV === "development" && (
              <span className="text-green-500">Cached</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
