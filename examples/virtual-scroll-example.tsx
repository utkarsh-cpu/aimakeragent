import React, { useState, useCallback } from "react";
import {
  useVirtualScroll,
  useDynamicVirtualScroll,
} from "../utils/virtual-scroll";

// Example 1: Basic Virtual Scroll Component
interface BasicVirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  renderItem: (item: T, index: number) => React.ReactNode;
}

export function BasicVirtualScroll<T>({
  items,
  itemHeight,
  height,
  renderItem,
}: BasicVirtualScrollProps<T>) {
  const config = {
    itemHeight,
    containerHeight: height,
    overscan: 5,
    threshold: 10,
  };

  const {
    visibleItems,
    totalHeight,
    scrollToIndex,
    scrollToTop,
    scrollToBottom,
    setScrollElement,
  } = useVirtualScroll(items, config);

  return (
    <div style={{ height, position: "relative" }}>
      {/* Controls */}
      <div style={{ padding: 10, borderBottom: "1px solid #ccc" }}>
        <button onClick={() => scrollToTop()}>Top</button>
        <button onClick={() => scrollToIndex(Math.floor(items.length / 2))}>
          Middle
        </button>
        <button onClick={() => scrollToBottom()}>Bottom</button>
        <span style={{ marginLeft: 20 }}>
          Total items: {items.length} | Visible: {visibleItems.length}
        </span>
      </div>

      {/* Scrollable container */}
      <div
        ref={setScrollElement}
        style={{
          height: height - 50, // Account for controls
          overflow: "auto",
          position: "relative",
        }}
      >
        {/* Total height container */}
        <div style={{ height: totalHeight, position: "relative" }}>
          {/* Visible items */}
          {visibleItems.map(({ index, style }) => (
            <div key={index} style={style}>
              {renderItem(items[index], index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Example 2: Dynamic Height Virtual Scroll (for variable content)
interface DynamicVirtualScrollProps<T> {
  items: T[];
  estimatedItemHeight: number;
  height: number;
  renderItem: (
    item: T,
    index: number,
    measureRef: (el: HTMLElement | null) => void,
  ) => React.ReactNode;
}

export function DynamicVirtualScroll<T>({
  items,
  estimatedItemHeight,
  height,
  renderItem,
}: DynamicVirtualScrollProps<T>) {
  const {
    visibleItems,
    totalHeight,
    scrollToIndex,
    scrollToTop,
    scrollToBottom,
    setScrollElement,
    measureItem,
  } = useDynamicVirtualScroll(items, estimatedItemHeight);

  const createMeasureRef = useCallback(
    (index: number) => {
      return (element: HTMLElement | null) => {
        measureItem(index, element);
      };
    },
    [measureItem],
  );

  return (
    <div style={{ height, position: "relative" }}>
      {/* Controls */}
      <div style={{ padding: 10, borderBottom: "1px solid #ccc" }}>
        <button onClick={() => scrollToTop()}>Top</button>
        <button onClick={() => scrollToIndex(Math.floor(items.length / 2))}>
          Middle
        </button>
        <button onClick={() => scrollToBottom()}>Bottom</button>
        <span style={{ marginLeft: 20 }}>
          Total items: {items.length} | Height: {totalHeight}px
        </span>
      </div>

      {/* Scrollable container */}
      <div
        ref={setScrollElement}
        style={{
          height: height - 50,
          overflow: "auto",
          position: "relative",
        }}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          {visibleItems.map(({ index, style }) => (
            <div key={index} style={style}>
              {renderItem(items[index], index, createMeasureRef(index))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Example 3: Chat Messages Virtual Scroll
interface ChatMessage {
  id: string;
  content: string;
  sender: string;
  timestamp: Date;
  type: "text" | "code" | "image";
}

interface ChatVirtualScrollProps {
  messages: ChatMessage[];
  onLoadMore: () => void;
}

export function ChatVirtualScroll({
  messages,
  onLoadMore,
}: ChatVirtualScrollProps) {
  const [autoScroll, setAutoScroll] = useState(true);

  const renderMessage = useCallback(
    (
      message: ChatMessage,
      _index: number,
      measureRef: (el: HTMLElement | null) => void,
    ) => {
      return (
        <div
          ref={measureRef}
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #f0f0f0",
            backgroundColor: message.sender === "user" ? "#f8f9fa" : "white",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
              fontSize: 12,
              color: "#666",
            }}
          >
            <span>{message.sender}</span>
            <span>{message.timestamp.toLocaleTimeString()}</span>
          </div>

          <div style={{ lineHeight: 1.5 }}>
            {message.type === "code" ? (
              <pre
                style={{
                  backgroundColor: "#f5f5f5",
                  padding: 12,
                  borderRadius: 4,
                  overflow: "auto",
                  fontSize: 14,
                  fontFamily: "monospace",
                }}
              >
                {message.content}
              </pre>
            ) : (
              <div>{message.content}</div>
            )}
          </div>
        </div>
      );
    },
    [],
  );

  const {
    visibleItems,
    totalHeight,
    scrollToBottom,
    setScrollElement,
    measureItem,
  } = useDynamicVirtualScroll(messages, 80);

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (autoScroll && messages.length > 0) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [messages.length, autoScroll, scrollToBottom]);

  const createMeasureRef = useCallback(
    (index: number) => {
      return (element: HTMLElement | null) => {
        measureItem(index, element);
      };
    },
    [measureItem],
  );

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);

      // Load more messages when scrolled to top
      if (scrollTop < 100) {
        onLoadMore();
      }
    },
    [onLoadMore],
  );

  return (
    <div style={{ height: 600, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #e0e0e0",
          backgroundColor: "#f8f9fa",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0 }}>Chat Messages ({messages.length})</h3>
          <label>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={setScrollElement}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflow: "auto",
          position: "relative",
        }}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          {visibleItems.map(({ index, style }) => (
            <div key={messages[index].id} style={style}>
              {renderMessage(messages[index], index, createMeasureRef(index))}
            </div>
          ))}
        </div>

        {/* Loading indicator */}
        {messages.length === 0 && (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "#666",
            }}
          >
            No messages yet...
          </div>
        )}
      </div>
    </div>
  );
}

// Example 4: Large Dataset Demo
export function LargeDatasetDemo() {
  // Generate large dataset
  const items = React.useMemo(
    () =>
      Array.from({ length: 100000 }, (_, i) => ({
        id: i,
        title: `Item ${i}`,
        description: `This is the description for item ${i}. It contains some random text to demonstrate variable content length.`,
        value: Math.random() * 1000,
        category: ["A", "B", "C"][i % 3],
      })),
    [],
  );

  const [filter, setFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      const matchesFilter =
        filter === "" ||
        item.title.toLowerCase().includes(filter.toLowerCase()) ||
        item.description.toLowerCase().includes(filter.toLowerCase());

      const matchesCategory =
        selectedCategory === "" || item.category === selectedCategory;

      return matchesFilter && matchesCategory;
    });
  }, [items, filter, selectedCategory]);

  const renderItem = useCallback((item: (typeof items)[0], index: number) => {
    return (
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #eee",
          backgroundColor: index % 2 === 0 ? "#fafafa" : "white",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <h4 style={{ margin: 0, color: "#333" }}>{item.title}</h4>
          <span
            style={{
              padding: "2px 8px",
              backgroundColor: "#007bff",
              color: "white",
              borderRadius: 12,
              fontSize: 12,
            }}
          >
            {item.category}
          </span>
        </div>
        <p style={{ margin: "0 0 8px 0", color: "#666", lineHeight: 1.4 }}>
          {item.description}
        </p>
        <div style={{ fontSize: 14, color: "#28a745", fontWeight: "bold" }}>
          ${item.value.toFixed(2)}
        </div>
      </div>
    );
  }, []);

  return (
    <div style={{ height: 800, display: "flex", flexDirection: "column" }}>
      {/* Filters */}
      <div
        style={{
          padding: 16,
          borderBottom: "1px solid #ddd",
          backgroundColor: "#f8f9fa",
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search items..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: 4,
              minWidth: 200,
            }}
          />

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: 4,
            }}
          >
            <option value="">All Categories</option>
            <option value="A">Category A</option>
            <option value="B">Category B</option>
            <option value="C">Category C</option>
          </select>

          <span style={{ marginLeft: "auto", color: "#666" }}>
            Showing {filteredItems.length} of {items.length} items
          </span>
        </div>
      </div>

      {/* Virtual scrolled list */}
      <BasicVirtualScroll
        items={filteredItems}
        itemHeight={120}
        height={750}
        renderItem={renderItem}
      />
    </div>
  );
}

// Usage Examples Component
export function VirtualScrollExamples() {
  const [activeExample, setActiveExample] = useState<
    "basic" | "dynamic" | "chat" | "large"
  >("basic");

  // Sample data
  const basicItems = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    value: i * 10,
  }));

  const dynamicItems = Array.from({ length: 500 }, (_, i) => ({
    id: i,
    content: `This is item ${i}. `.repeat(Math.floor(Math.random() * 10) + 1),
  }));

  const chatMessages: ChatMessage[] = Array.from({ length: 1000 }, (_, i) => ({
    id: `msg-${i}`,
    content:
      i % 10 === 0
        ? `// Code example ${i}\nfunction example() {\n  return "Hello World";\n}`
        : `This is message ${i} with some content that varies in length.`,
    sender: i % 3 === 0 ? "user" : "assistant",
    timestamp: new Date(Date.now() - (1000 - i) * 60000),
    type: i % 10 === 0 ? "code" : "text",
  }));

  return (
    <div style={{ padding: 20 }}>
      <h1>Virtual Scroll Examples</h1>

      {/* Example selector */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => setActiveExample("basic")}
          style={{
            marginRight: 10,
            padding: "8px 16px",
            backgroundColor: activeExample === "basic" ? "#007bff" : "#f8f9fa",
            color: activeExample === "basic" ? "white" : "#333",
            border: "1px solid #ddd",
            borderRadius: 4,
          }}
        >
          Basic Virtual Scroll
        </button>

        <button
          onClick={() => setActiveExample("dynamic")}
          style={{
            marginRight: 10,
            padding: "8px 16px",
            backgroundColor:
              activeExample === "dynamic" ? "#007bff" : "#f8f9fa",
            color: activeExample === "dynamic" ? "white" : "#333",
            border: "1px solid #ddd",
            borderRadius: 4,
          }}
        >
          Dynamic Heights
        </button>

        <button
          onClick={() => setActiveExample("chat")}
          style={{
            marginRight: 10,
            padding: "8px 16px",
            backgroundColor: activeExample === "chat" ? "#007bff" : "#f8f9fa",
            color: activeExample === "chat" ? "white" : "#333",
            border: "1px solid #ddd",
            borderRadius: 4,
          }}
        >
          Chat Messages
        </button>

        <button
          onClick={() => setActiveExample("large")}
          style={{
            padding: "8px 16px",
            backgroundColor: activeExample === "large" ? "#007bff" : "#f8f9fa",
            color: activeExample === "large" ? "white" : "#333",
            border: "1px solid #ddd",
            borderRadius: 4,
          }}
        >
          Large Dataset
        </button>
      </div>

      {/* Examples */}
      {activeExample === "basic" && (
        <BasicVirtualScroll
          items={basicItems}
          itemHeight={60}
          height={500}
          renderItem={(item) => (
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid #eee",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{item.name}</span>
              <span style={{ fontWeight: "bold", color: "#007bff" }}>
                {item.value}
              </span>
            </div>
          )}
        />
      )}

      {activeExample === "dynamic" && (
        <DynamicVirtualScroll
          items={dynamicItems}
          estimatedItemHeight={80}
          height={500}
          renderItem={(item, index, measureRef) => (
            <div
              ref={measureRef}
              style={{
                padding: 16,
                borderBottom: "1px solid #eee",
              }}
            >
              <h4>Dynamic Item {index}</h4>
              <p>{item.content}</p>
            </div>
          )}
        />
      )}

      {activeExample === "chat" && (
        <ChatVirtualScroll
          messages={chatMessages}
          onLoadMore={() => console.log("Load more messages")}
        />
      )}

      {activeExample === "large" && <LargeDatasetDemo />}
    </div>
  );
}
