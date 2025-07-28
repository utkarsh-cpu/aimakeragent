import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { SettingsPanel } from "./SettingsPanel";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./ui/resizable";
import { Sheet, SheetContent } from "./ui/sheet";
import { useIsMobile } from "./ui/use-mobile";
import {
  OpenRouterService,
  DEFAULT_OPENROUTER_CONFIG,
} from "../services/openrouter";
import { ChatSettings } from "../types/settings";
import { useSettings } from "../utils/use-settings";
import { Conversation } from "../types/conversation";
import {
  createNewConversation,
  exportConversation,
} from "../utils/conversation-utils";

import {
  useConversationMemoryOptimization,
  useDebounceCallback,
} from "../utils/debounce";
import { conversationCache, messageCache } from "../utils/cache-manager";
import { createConversationLazyLoader } from "../utils/lazy-loader";
import { dataCleanupManager } from "../utils/data-cleanup";
import {
  useKeyboardNavigation,
  KeyboardShortcut,
} from "../hooks/use-keyboard-navigation";
import { ScreenReaderAnnouncer } from "../utils/accessibility";
import { useVoiceNavigation } from "./VoiceInput";
import { ChatErrorBoundary, SidebarErrorBoundary, SettingsErrorBoundary } from "./ErrorBoundary";

interface ChatAppProps {
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean) => void;
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
}

export function ChatApp({
  isDarkMode,
  setIsDarkMode,
  theme,
  setTheme,
}: ChatAppProps) {
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [rawConversations, setRawConversations] = useState<Conversation[]>(
    () => {
      // Initialize with welcome conversation using new structure
      const welcomeConversation = createNewConversation("1");
      welcomeConversation.title = "Welcome Chat";
      welcomeConversation.messages = [
        {
          id: "1",
          content:
            "Hello! I'm your AI assistant. I'm here to help you with any questions or tasks you might have. Feel free to ask me anything!",
          role: "assistant",
          timestamp: new Date(Date.now() - 1000 * 60 * 5),
        },
      ];
      welcomeConversation.metadata.messageCount = 1;
      welcomeConversation.metadata.autoTitleGenerated = false;
      return [welcomeConversation];
    },
  );

  // State declarations
  const [currentConversationId, setCurrentConversationId] = useState("1");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [streamingMessageId, setStreamingMessageId] = useState<
    string | undefined
  >();
  const [openRouterService, setOpenRouterService] =
    useState<OpenRouterService | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );

  // Apply memory optimization to conversations
  const conversations = useConversationMemoryOptimization(rawConversations, {
    maxConversations: 100,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  // Initialize lazy loader for conversations (not actively used yet but prepared for future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _conversationLazyLoader = useMemo(() => {
    return createConversationLazyLoader(conversations, {
      pageSize: 20,
      preloadPages: 2,
    });
  }, [conversations]);

  // Get current conversation
  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId,
  );

  // Use the enhanced settings hook
  const { settings, updateSettings } = useSettings();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Start data cleanup manager
  useEffect(() => {
    dataCleanupManager.startAutoCleanup();

    return () => {
      dataCleanupManager.stopAutoCleanup();
    };
  }, []);

  // Cache conversations when they change
  useEffect(() => {
    if (conversations.length > 0) {
      // Cache conversations in background
      setTimeout(() => {
        conversationCache.cacheConversations(conversations);
      }, 100);
    }
  }, [conversations]);

  // Cache current conversation messages
  useEffect(() => {
    if (currentConversation && currentConversation.messages.length > 0) {
      setTimeout(() => {
        messageCache.cacheMessages(
          currentConversation.id,
          currentConversation.messages,
        );
      }, 100);
    }
  }, [
    currentConversation,
    currentConversation?.messages,
    currentConversation?.id,
  ]);

  // Initialize screen reader announcer
  useEffect(() => {
    ScreenReaderAnnouncer.initialize();
    // Make it globally available for keyboard navigation
    (
      window as typeof window & {
        screenReaderAnnouncer: typeof ScreenReaderAnnouncer;
      }
    ).screenReaderAnnouncer = ScreenReaderAnnouncer;
  }, []);

  // Initialize OpenRouter service when API key changes
  useEffect(() => {
    if (settings.openRouter?.apiKey) {
      const config = {
        ...DEFAULT_OPENROUTER_CONFIG,
        apiKey: settings.openRouter.apiKey,
        streamingEnabled: settings.streamingEnabled,
        baseUrl: settings.openRouter.baseUrl,
        timeout: settings.openRouter.timeout,
        retryAttempts: settings.openRouter.retryAttempts,
      };
      setOpenRouterService(new OpenRouterService(config));
    } else {
      setOpenRouterService(null);
    }
  }, [
    settings.openRouter?.apiKey,
    settings.streamingEnabled,
    settings.openRouter?.baseUrl,
    settings.openRouter?.timeout,
    settings.openRouter?.retryAttempts,
  ]);

  // Sync theme setting with app theme
  useEffect(() => {
    if (settings.theme !== theme) {
      updateSettings({ theme });
    }
  }, [theme, settings.theme, updateSettings]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (currentConversation && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentConversation, currentConversation?.messages]);

  // Function declarations - declare all helper functions at the top level
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Debounced conversation updates for better performance
  const debouncedSetConversations = useDebounceCallback(
    setRawConversations,
    100,
  );

  const generateMockResponse = useCallback((userMessage: string): string => {
    const responses = [
      "I understand what you're asking. Here's my perspective on this topic.",
      "Great question! This is something I can definitely assist you with.",
      "I'd be happy to help you explore this further.",
      "That's a thoughtful inquiry. Let me provide you with some insights.",
    ];

    return (
      responses[Math.floor(Math.random() * responses.length)] +
      " " +
      userMessage.split(" ").reverse().join(" ") +
      " - This is a mock response to demonstrate the chat functionality."
    );
  }, []);

  const copyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  const rateMessage = useCallback(
    (messageId: string, rating: "up" | "down") => {
      console.log(`Rated message ${messageId} with ${rating}`);
    },
    [],
  );

  const editMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (!currentConversation) return;

      setRawConversations((prev) =>
        prev.map((c) =>
          c.id === currentConversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId ? { ...m, content: newContent } : m,
                ),
              }
            : c,
        ),
      );
    },
    [currentConversation, currentConversationId],
  );

  const quoteMessage = useCallback((content: string) => {
    setDraftMessage((prev) =>
      prev ? `${prev}\n\n> ${content}` : `> ${content}`,
    );
  }, []);

  const toggleSearch = useCallback(() => {
    setShowSearch((prev) => !prev);
  }, []);

  const exportConversationHandler = useCallback(
    (conversationId: string) => {
      const conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation) return;

      const exportData = exportConversation(conversation);
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conversation-${conversation.title}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [conversations],
  );

  const toggleFavoriteHandler = useCallback((conversationId: string) => {
    setRawConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              metadata: {
                ...c.metadata,
                isFavorite: !c.metadata.isFavorite,
              },
            }
          : c,
      ),
    );
  }, []);

  const toggleArchiveHandler = useCallback((conversationId: string) => {
    setRawConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              metadata: {
                ...c.metadata,
                isArchived: !c.metadata.isArchived,
              },
            }
          : c,
      ),
    );
  }, []);

  const bulkDeleteHandler = useCallback(
    (conversationIds: string[]) => {
      setRawConversations((prev) =>
        prev.filter((c) => !conversationIds.includes(c.id)),
      );

      // If current conversation was deleted, switch to first available
      if (conversationIds.includes(currentConversationId)) {
        const remaining = conversations.filter(
          (c) => !conversationIds.includes(c.id),
        );
        if (remaining.length > 0) {
          setCurrentConversationId(remaining[0].id);
        }
      }
    },
    [currentConversationId, conversations],
  );

  const bulkExportHandler = useCallback(
    (conversationIds: string[]) => {
      const conversationsToExport = conversations.filter((c) =>
        conversationIds.includes(c.id),
      );

      const exportData = conversationsToExport.map((conv) => ({
        id: conv.id,
        title: conv.title,
        messages: conv.messages,
        lastMessage: conv.lastMessage,
        metadata: conv.metadata,
      }));

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conversations-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [conversations],
  );

  const cancelStream = useCallback(() => {
    if (openRouterService && streamingMessageId) {
      openRouterService.cancelCurrentRequest();
    }

    setRawConversations((prev) =>
      prev.map((c) =>
        c.id === currentConversationId
          ? {
              ...c,
              messages: c.messages.filter((m) => m.id !== streamingMessageId),
            }
          : c,
      ),
    );

    setStreamingMessageId(undefined);
    setIsTyping(false);
  }, [currentConversationId, openRouterService, streamingMessageId]);

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      if (!currentConversation) return;

      const messageIndex = currentConversation.messages.findIndex(
        (m) => m.id === messageId,
      );
      if (messageIndex === -1) return;

      if (!openRouterService) {
        console.error("OpenRouter service not initialized");
        return;
      }

      const messagesUpToRegenerate = currentConversation.messages.slice(
        0,
        messageIndex,
      );

      setRawConversations((prev) =>
        prev.map((c) =>
          c.id === currentConversationId
            ? {
                ...c,
                messages: messagesUpToRegenerate,
              }
            : c,
        ),
      );

      const newMessageId = `msg_${Date.now()}`;
      const model = settings.model || "anthropic/claude-3-haiku";

      try {
        const mockResponse = generateMockResponse("regenerate request");

        setIsTyping(true);

        setRawConversations((prev) =>
          prev.map((c) =>
            c.id === currentConversationId
              ? {
                  ...c,
                  messages: [
                    ...messagesUpToRegenerate,
                    {
                      id: newMessageId,
                      content: "",
                      role: "assistant" as const,
                      timestamp: new Date(),
                    },
                  ],
                }
              : c,
          ),
        );

        setIsTyping(false);

        if (settings.streamingEnabled) {
          setStreamingMessageId(newMessageId);

          setIsTyping(true);

          try {
            const model = settings.model || "anthropic/claude-3-haiku";

            // Simulate streaming with mock response
            const mockResponse = generateMockResponse("regenerate request");
            let accumulatedContent = "";

            for (let i = 0; i < mockResponse.length; i++) {
              accumulatedContent += mockResponse[i];

              setRawConversations((prev) =>
                prev.map((c) =>
                  c.id === currentConversationId
                    ? {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === newMessageId
                            ? { ...m, content: accumulatedContent }
                            : m,
                        ),
                      }
                    : c,
                ),
              );

              await new Promise((resolve) => setTimeout(resolve, 10));
            }

            setStreamingMessageId(undefined);

            setRawConversations((prev) =>
              prev.map((c) =>
                c.id === currentConversationId
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === newMessageId
                          ? { ...m, content: accumulatedContent }
                          : m,
                      ),
                    }
                  : c,
              ),
            );
          } finally {
            setIsTyping(false);

            setRawConversations((prev) =>
              prev.map((c) =>
                c.id === currentConversationId
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === newMessageId
                          ? { ...m, content: mockResponse }
                          : m,
                      ),
                    }
                  : c,
              ),
            );

            setStreamingMessageId(undefined);
            setIsTyping(false);
          }
        }

        // Scroll to bottom after regenerating message
        setTimeout(() => scrollToBottom(), 100);
      } catch (error) {
        console.error("Error regenerating message:", error);

        setRawConversations((prev) =>
          prev.map((c) =>
            c.id === currentConversationId
              ? {
                  ...c,
                  messages: currentConversation.messages,
                }
              : c,
          ),
        );
      }
    },
    [
      currentConversation,
      currentConversationId,
      openRouterService,
      settings.model,
      settings.streamingEnabled,
      generateMockResponse,
      scrollToBottom,
    ],
  );

  const createNewConversationHandler = useCallback(() => {
    const newConversation = createNewConversation();
    setRawConversations((prev) => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
    setDraftMessage("");

    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);

  const deleteConversation = useCallback(
    (conversationId: string) => {
      setRawConversations((prev) =>
        prev.filter((c) => c.id !== conversationId),
      );

      if (conversationId === currentConversationId) {
        const remainingConversations = conversations.filter(
          (c) => c.id !== conversationId,
        );
        if (remainingConversations.length > 0) {
          setCurrentConversationId(remainingConversations[0].id);
        }
      }
    },
    [currentConversationId, conversations],
  );

  const updateConversationTitleHandler = useCallback(
    (conversationId: string, newTitle: string) => {
      setRawConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, title: newTitle } : c,
        ),
      );
    },
    [],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentConversation) return;

      if (!openRouterService) {
        console.error("OpenRouter service not initialized");
        setStreamingMessageId(undefined);
        return;
      }

      const userMessageId = `msg_${Date.now()}`;
      const assistantMessageId = `msg_${Date.now() + 1}`;

      // Add user message
      setRawConversations((prev) =>
        prev.map((c) =>
          c.id === currentConversationId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: userMessageId,
                    content,
                    role: "user" as const,
                    timestamp: new Date(),
                  },
                ],
                lastMessage: new Date(),
              }
            : c,
        ),
      );

      setDraftMessage("");

      const mockResponse = generateMockResponse(content);

      setIsTyping(true);

      // Add assistant message placeholder
      setRawConversations((prev) =>
        prev.map((c) =>
          c.id === currentConversationId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: assistantMessageId,
                    content: "",
                    role: "assistant" as const,
                    timestamp: new Date(),
                  },
                ],
              }
            : c,
        ),
      );

      setIsTyping(false);

      if (!settings.streamingEnabled) {
        setStreamingMessageId(assistantMessageId);

        setIsTyping(true);

        try {
          // Simulate streaming with mock response
          const mockResponse = generateMockResponse(content);
          let accumulatedContent = "";

          for (let i = 0; i < mockResponse.length; i++) {
            accumulatedContent += mockResponse[i];

            setRawConversations((prev) =>
              prev.map((c) =>
                c.id === currentConversationId
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, content: accumulatedContent }
                          : m,
                      ),
                    }
                  : c,
              ),
            );

            await new Promise((resolve) => setTimeout(resolve, 10));
          }

          setStreamingMessageId(undefined);

          setRawConversations((prev) =>
            prev.map((c) =>
              c.id === currentConversationId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: accumulatedContent }
                        : m,
                    ),
                  }
                : c,
            ),
          );
        } finally {
          setIsTyping(false);

          setRawConversations((prev) =>
            prev.map((c) =>
              c.id === currentConversationId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: mockResponse }
                        : m,
                    ),
                  }
                : c,
            ),
          );

          setStreamingMessageId(undefined);
          setIsTyping(false);
        }
      }

      // Scroll to bottom after sending message
      setTimeout(() => scrollToBottom(), 100);
    },
    [
      currentConversation,
      currentConversationId,
      openRouterService,
      settings.streamingEnabled,
      generateMockResponse,
      scrollToBottom,
    ],
  );

  // Handle theme changes from settings
  const handleSettingsChange = useCallback(
    (newSettings: ChatSettings) => {
      updateSettings(newSettings);
      if (newSettings.theme !== theme) {
        setTheme(newSettings.theme);
      }
    },
    [updateSettings, theme, setTheme],
  );

  // Set up keyboard shortcuts
  const keyboardShortcuts: KeyboardShortcut[] = useMemo(
    () => [
      {
        key: "ctrl+/",
        description: "Toggle sidebar",
        category: "Navigation",
        action: () => {
          if (isMobile) {
            setIsSidebarOpen(!isSidebarOpen);
          }
        },
        global: true,
        enabled: isSidebarOpen,
      },
      {
        key: "ctrl+k",
        description: "Toggle search",
        category: "Navigation",
        action: () => {
          setShowSearch(!showSearch);
        },
        global: true,
        enabled: showSearch,
      },
      {
        key: "ctrl+,",
        description: "Open settings",
        category: "Navigation",
        action: () => {
          setIsSettingsOpen(!isSettingsOpen);
        },
        global: true,
        enabled: isSettingsOpen,
      },
      {
        key: "?",
        description: "Show keyboard shortcuts help",
        category: "Help",
        action: () => {
          setShowKeyboardHelp(true);
        },
        global: true,
        enabled: showKeyboardHelp,
      },
      {
        key: "escape",
        description: "Close modals and cancel actions",
        category: "Navigation",
        action: () => {
          if (showKeyboardHelp) {
            setShowKeyboardHelp(false);
          } else if (isSettingsOpen) {
            setIsSettingsOpen(false);
          } else if (showSearch) {
            setShowSearch(false);
          } else if (streamingMessageId) {
            cancelStream();
          }
        },
        global: true,
        enabled: true,
      },
      ...(selectedMessageId
        ? [
            {
              key: "ArrowUp",
              description: "Select previous message",
              category: "Message",
              action: () => {
                if (!currentConversation || !selectedMessageId) return;
                const messageIndex = currentConversation.messages.findIndex(
                  (m) => m.id === selectedMessageId,
                );
                if (messageIndex > 0) {
                  // Add focus management here if needed
                }
              },
              global: false,
              enabled: selectedMessageId !== null,
            },
            {
              key: "ArrowDown",
              description: "Select next message",
              category: "Message",
              action: () => {
                if (!currentConversation || !selectedMessageId) return;
                const messageIndex = currentConversation.messages.findIndex(
                  (m) => m.id === selectedMessageId,
                );
                if (messageIndex < currentConversation.messages.length - 1) {
                  // Add focus management here if needed
                }
              },
              global: false,
              enabled: selectedMessageId !== null,
            },
            {
              key: "Delete",
              description: "Delete selected message",
              category: "Message",
              action: () => {
                if (selectedMessageId) {
                  // deleteMessage(selectedMessageId);
                  console.log(`Delete message ${selectedMessageId}`);
                }
              },
              global: false,
              enabled: selectedMessageId !== null,
            },
            {
              key: "c",
              description: "Copy selected message",
              category: "Message",
              action: () => {
                if (!currentConversation || !selectedMessageId) return;
                const message = currentConversation.messages.find(
                  (m) => m.id === selectedMessageId,
                );
                if (message) {
                  copyMessage(message.content);
                }
              },
              global: false,
              enabled: selectedMessageId !== null,
            },
            {
              key: "r",
              description: "Regenerate selected message",
              category: "Message",
              action: () => {
                if (selectedMessageId) {
                  regenerateMessage(selectedMessageId);
                }
              },
              global: false,
              enabled: selectedMessageId !== null,
            },
            {
              key: "q",
              description: "Quote selected message",
              category: "Message",
              action: () => {
                if (!currentConversation || !selectedMessageId) return;
                const message = currentConversation.messages.find(
                  (m) => m.id === selectedMessageId,
                );
                if (message) {
                  quoteMessage(message.content);
                }
              },
              global: false,
              enabled: selectedMessageId !== null,
            },
          ]
        : []),
    ],
    [
      isMobile,
      isSidebarOpen,
      showSearch,
      isSettingsOpen,
      showKeyboardHelp,
      streamingMessageId,
      selectedMessageId,
      currentConversation,
      cancelStream,
      regenerateMessage,
      copyMessage,
      quoteMessage,
    ],
  );

  // Use keyboard navigation hook
  useKeyboardNavigation(keyboardShortcuts, {
    enableShortcuts: true,
    enableFocusManagement: false,
    enableArrowNavigation: false,
    announceNavigation: false,
  });

  // Set up voice navigation
  useVoiceNavigation();

  const MobileSidebar = ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) => (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="p-0 w-80">
        <SidebarErrorBoundary>
          <ChatSidebar
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelectConversation={(id: string) => {
              setCurrentConversationId(id);
              setIsSidebarOpen(false);
              setTimeout(() => scrollToBottom(), 100);
            }}
            onNewConversation={createNewConversationHandler}
            onDeleteConversation={deleteConversation}
            onUpdateTitle={updateConversationTitleHandler}
            searchQuery=""
            onSearchChange={() => {}}
            onExportConversation={() => {
              if (currentConversation) {
                exportConversationHandler(currentConversation.id);
              }
            }}
            onToggleFavorite={toggleFavoriteHandler}
            onToggleArchive={toggleArchiveHandler}
            onBulkDelete={bulkDeleteHandler}
            onBulkExport={bulkExportHandler}
          />
        </SidebarErrorBoundary>
      </SheetContent>
    </Sheet>
  );

  return (
    <div
      ref={containerRef}
      className="h-screen bg-background text-foreground"
      role="application"
      aria-label="AI Chat Application"
    >
      {isMobile ? (
        <>
          <MobileSidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
          <ChatErrorBoundary>
            <div className="flex flex-col h-full">
              <ChatHeader
                conversation={currentConversation}
                settings={settings}
                onSettingsChange={handleSettingsChange}
                isDarkMode={isDarkMode}
                onThemeToggle={setIsDarkMode}
                onSettingsToggle={() => setIsSettingsOpen(true)}
                onSidebarToggle={() => setIsSidebarOpen(true)}
                isMobile={isMobile}
                showSearch={showSearch}
                onToggleSearch={toggleSearch}
                onShowKeyboardHelp={() => setShowKeyboardHelp(true)}
              />
              <div className="flex-1 overflow-hidden">
                <ChatMessages
                  messages={currentConversation?.messages || []}
                  isTyping={isTyping}
                  streamingMessageId={streamingMessageId}
                  onCopyMessage={copyMessage}
                  onRegenerateMessage={regenerateMessage}
                  onRateMessage={rateMessage}
                  onEditMessage={editMessage}
                  onDeleteMessage={deleteConversation}
                  onQuoteMessage={quoteMessage}
                  onCancelStream={cancelStream}
                  fontSize={settings.fontSize}
                  showSearch={showSearch}
                  onToggleSearch={toggleSearch}
                  selectedMessageId={selectedMessageId || undefined}
                  onMessageSelect={setSelectedMessageId}
                />
                <div ref={messagesEndRef} />
              </div>
              <ChatInput
                value={draftMessage}
                onChange={setDraftMessage}
                onSendMessage={sendMessage}
                disabled={isTyping || !!streamingMessageId}
                isMobile={isMobile}
                enableVoiceInput={true}
              />
            </div>
          </ChatErrorBoundary>
        </>
      ) : (
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
            <SidebarErrorBoundary>
              <ChatSidebar
                conversations={conversations}
                currentConversationId={currentConversationId}
                onSelectConversation={(id: string) => {
                  setCurrentConversationId(id);
                  setTimeout(() => scrollToBottom(), 100);
                }}
                onNewConversation={createNewConversationHandler}
                onDeleteConversation={deleteConversation}
                onUpdateTitle={updateConversationTitleHandler}
                searchQuery=""
                onSearchChange={() => {}}
                onExportConversation={() => {
                  if (currentConversation) {
                    exportConversationHandler(currentConversation.id);
                  }
                }}
                onToggleFavorite={toggleFavoriteHandler}
                onToggleArchive={toggleArchiveHandler}
                onBulkDelete={bulkDeleteHandler}
                onBulkExport={bulkExportHandler}
              />
            </SidebarErrorBoundary>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={75}>
            <ChatErrorBoundary>
              <div className="flex flex-col h-full">
                <ChatHeader
                  conversation={currentConversation}
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                  isDarkMode={isDarkMode}
                  onThemeToggle={setIsDarkMode}
                  onSettingsToggle={() => setIsSettingsOpen(true)}
                  isMobile={false}
                  showSearch={showSearch}
                  onToggleSearch={toggleSearch}
                  onShowKeyboardHelp={() => setShowKeyboardHelp(true)}
                />

                <div className="flex-1 overflow-hidden">
                  <ChatMessages
                    messages={currentConversation?.messages || []}
                    isTyping={isTyping}
                    streamingMessageId={streamingMessageId}
                    onCopyMessage={copyMessage}
                    onRegenerateMessage={regenerateMessage}
                    onRateMessage={rateMessage}
                    onEditMessage={editMessage}
                    onDeleteMessage={deleteConversation}
                    onQuoteMessage={quoteMessage}
                    onCancelStream={cancelStream}
                    fontSize={settings.fontSize}
                    showSearch={showSearch}
                    onToggleSearch={toggleSearch}
                    selectedMessageId={selectedMessageId || undefined}
                    onMessageSelect={setSelectedMessageId}
                  />
                  <div ref={messagesEndRef} />
                </div>

                <ChatInput
                  value={draftMessage}
                  onChange={setDraftMessage}
                  onSendMessage={sendMessage}
                  disabled={isTyping || !!streamingMessageId}
                  isMobile={false}
                  enableVoiceInput={true}
                />
              </div>
            </ChatErrorBoundary>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      {isSettingsOpen && (
        <SettingsErrorBoundary>
          <SettingsPanel
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onClose={() => setIsSettingsOpen(false)}
          />
        </SettingsErrorBoundary>
      )}

      <KeyboardShortcutsHelp
        shortcuts={keyboardShortcuts}
        open={showKeyboardHelp}
        onOpenChange={setShowKeyboardHelp}
      />
    </div>
  );
}
