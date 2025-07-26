import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Edit3,
  Download,
  Star,
  Archive,
  CheckSquare,
  Square,
  MoreVertical,
} from "lucide-react";
import { Conversation } from "../types/conversation";
import { ConversationSearch } from "./ConversationSearch";
import { useCachedConversations } from "../hooks/use-cached-conversations";
import { useLazyLoading } from "../utils/debounce";

interface ChatSidebarProps {
  conversations: Conversation[];
  currentConversationId: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onExportConversation: (format?: "txt" | "json" | "md") => void;
  onToggleFavorite?: (id: string) => void;
  onToggleArchive?: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkExport?: (ids: string[], format?: "txt" | "json" | "md") => void;
}

export function ChatSidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onUpdateTitle,
  onExportConversation,
  onToggleFavorite,
  onToggleArchive,
  onBulkDelete,
  onBulkExport,
}: ChatSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [filteredConversations, setFilteredConversations] =
    useState<Conversation[]>(conversations);
  const [selectedConversations, setSelectedConversations] = useState<
    Set<string>
  >(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // Use cached conversations with lazy loading
  const {
    conversations: cachedConversations,
    isLoading: isLoadingMore,
    hasMore,
    loadMore,
    cacheStats,
  } = useCachedConversations(conversations, {
    pageSize: 50,
    preloadPages: 1,
    enableCaching: true,
    enableLazyLoading: true,
  });

  // Lazy loading for scroll detection
  const { ref: loadMoreRef, isVisible: shouldLoadMore } = useLazyLoading(0.8);

  // Load more when scroll trigger is visible
  useEffect(() => {
    if (shouldLoadMore && hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [shouldLoadMore, hasMore, isLoadingMore, loadMore]);

  // Update filtered conversations when cached conversations change
  useEffect(() => {
    setFilteredConversations(cachedConversations);
  }, [cachedConversations]);

  const startEditing = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditingTitle(conversation.title);
  };

  const saveTitle = () => {
    if (editingId && editingTitle.trim()) {
      onUpdateTitle(editingId, editingTitle.trim());
    }
    setEditingId(null);
  };

  const toggleConversationSelection = (conversationId: string) => {
    setSelectedConversations((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(conversationId)) {
        newSet.delete(conversationId);
      } else {
        newSet.add(conversationId);
      }
      return newSet;
    });
  };

  const selectAllConversations = () => {
    setSelectedConversations(new Set(filteredConversations.map((c) => c.id)));
  };

  const clearSelection = () => {
    setSelectedConversations(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedConversations.size > 0 && onBulkDelete) {
      if (
        window.confirm(
          `Are you sure you want to delete ${selectedConversations.size} conversation(s)?`,
        )
      ) {
        onBulkDelete(Array.from(selectedConversations));
        clearSelection();
        setBulkMode(false);
      }
    }
  };

  const handleBulkExport = (format: "txt" | "json" | "md" = "txt") => {
    if (selectedConversations.size > 0 && onBulkExport) {
      onBulkExport(Array.from(selectedConversations), format);
    }
  };

  const toggleFavorite = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(conversationId);
    }
  };

  const toggleArchive = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleArchive) {
      onToggleArchive(conversationId);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  return (
    <div
      className="h-full bg-sidebar/50 backdrop-blur supports-[backdrop-filter]:bg-sidebar/80 border-r border-sidebar-border flex flex-col"
      data-sidebar
      role="navigation"
      aria-label="Conversation sidebar"
    >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border/50 space-y-3">
        <Button
          onClick={onNewConversation}
          className="w-full justify-start gap-2 h-10 bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 transition-all duration-200"
          variant="outline"
          data-new-conversation
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>

        {/* Bulk Management Controls */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBulkMode(!bulkMode)}
            className="text-xs"
          >
            {bulkMode ? "Cancel" : "Select"}
          </Button>

          {bulkMode && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllConversations}
                className="text-xs"
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="text-xs"
              >
                None
              </Button>

              {selectedConversations.size > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBulkExport("txt")}>
                      <Download className="h-3 w-3 mr-2" />
                      Export as Text
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkExport("json")}>
                      <Download className="h-3 w-3 mr-2" />
                      Export as JSON
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleBulkDelete}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Delete Selected ({selectedConversations.size})
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Search */}
      <div className="p-4 border-b border-sidebar-border/50">
        <ConversationSearch
          conversations={cachedConversations}
          onFilteredResults={setFilteredConversations}
        />

        {/* Cache Stats (Development Only) */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-2 text-xs text-muted-foreground">
            Cache: {cacheStats.totalItems} items,{" "}
            {Math.round(cacheStats.totalSize / 1024)}KB,
            {Math.round(cacheStats.hitRate * 100)}% hit rate
          </div>
        )}
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center text-muted-foreground p-8">
              <p>No conversations found</p>
              <p className="text-sm">
                {conversations.length === 0
                  ? "Start a new chat to begin"
                  : "Try adjusting your search or filters"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`group relative rounded-xl p-3 cursor-pointer transition-all duration-200 ${
                    conversation.id === currentConversationId
                      ? "bg-sidebar-accent/80 text-sidebar-accent-foreground shadow-sm border border-sidebar-border/50"
                      : "hover:bg-sidebar-accent/30 hover:shadow-sm"
                  } ${selectedConversations.has(conversation.id) ? "ring-2 ring-primary/50" : ""}`}
                  onClick={() => {
                    if (bulkMode) {
                      toggleConversationSelection(conversation.id);
                    } else {
                      onSelectConversation(conversation.id);
                    }
                  }}
                >
                  {/* Selection Checkbox */}
                  {bulkMode && (
                    <div className="absolute top-2 left-2">
                      {selectedConversations.has(conversation.id) ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <div className="flex items-start justify-between">
                    <div className={`flex-1 min-w-0 ${bulkMode ? "ml-6" : ""}`}>
                      {editingId === conversation.id ? (
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={saveTitle}
                          onKeyPress={(e) => e.key === "Enter" && saveTitle()}
                          className="h-6 p-1 text-sm"
                          autoFocus
                        />
                      ) : (
                        <h3 className="truncate text-sm font-medium">
                          {conversation.title}
                        </h3>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {formatDate(conversation.lastMessage)}
                        </p>
                        {conversation.metadata.autoTitleGenerated && (
                          <span
                            className="text-xs text-muted-foreground/60"
                            title="Auto-generated title"
                          >
                            ✨
                          </span>
                        )}
                        {conversation.metadata.isFavorite && (
                          <Star className="h-3 w-3 text-yellow-500 fill-current" />
                        )}
                        {conversation.metadata.isArchived && (
                          <Archive className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        {conversation.messages.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate flex-1">
                            {
                              conversation.messages[
                                conversation.messages.length - 1
                              ].content
                            }
                          </p>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground/60 ml-2">
                          <span>{conversation.metadata.messageCount}</span>
                          {conversation.metadata.tokenCount > 0 && (
                            <span>• {conversation.metadata.tokenCount}t</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-6 w-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => startEditing(conversation)}
                        >
                          <Edit3 className="h-3 w-3 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => toggleFavorite(conversation.id, e)}
                        >
                          <Star className="h-3 w-3 mr-2" />
                          {conversation.metadata.isFavorite
                            ? "Remove from Favorites"
                            : "Add to Favorites"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => toggleArchive(conversation.id, e)}
                        >
                          <Archive className="h-3 w-3 mr-2" />
                          {conversation.metadata.isArchived
                            ? "Unarchive"
                            : "Archive"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            onSelectConversation(conversation.id);
                            onExportConversation("txt");
                          }}
                        >
                          <Download className="h-3 w-3 mr-2" />
                          Export as Text
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            onSelectConversation(conversation.id);
                            onExportConversation("md");
                          }}
                        >
                          <Download className="h-3 w-3 mr-2" />
                          Export as Markdown
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            onSelectConversation(conversation.id);
                            onExportConversation("json");
                          }}
                        >
                          <Download className="h-3 w-3 mr-2" />
                          Export as JSON
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDeleteConversation(conversation.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}

              {/* Load More Trigger */}
              {hasMore && (
                <div ref={loadMoreRef} className="py-4 text-center">
                  {isLoadingMore ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                      Loading more conversations...
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadMore}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Load more conversations
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
