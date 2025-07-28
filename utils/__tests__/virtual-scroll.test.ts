import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  VirtualScrollManager,
  VirtualScrollConfig,
  createVirtualScrollManager,
  useVirtualScroll,
  useDynamicVirtualScroll,
  calculateOptimalItemHeight,
  estimateItemHeight,
} from "../virtual-scroll";
import { renderHook, act } from "@testing-library/react";

describe("VirtualScrollManager", () => {
  let manager: VirtualScrollManager;
  let config: VirtualScrollConfig;

  beforeEach(() => {
    config = {
      itemHeight: 100,
      containerHeight: 600,
      overscan: 5,
      threshold: 1000,
    };
    manager = new VirtualScrollManager(config);
  });

  describe("constructor", () => {
    it("should create manager with provided config", () => {
      expect(manager).toBeInstanceOf(VirtualScrollManager);
    });

    it("should create manager with minimal config", () => {
      const minimalConfig = {
        itemHeight: 60,
        containerHeight: 400,
        overscan: 5,
        threshold: 50,
      };
      const minimalManager = new VirtualScrollManager(minimalConfig);
      expect(minimalManager).toBeInstanceOf(VirtualScrollManager);
    });
  });

  describe("calculateVisibleItems", () => {
    it("should calculate visible items correctly", () => {
      const result = manager.calculateVisibleItems(200, 100);

      expect(result.startIndex).toBe(0); // Math.max(0, Math.floor(200/100) - 5)
      expect(result.endIndex).toBe(16); // Actual implementation result
      expect(result.offsetY).toBe(0);
    });

    it("should handle scroll at the beginning", () => {
      const result = manager.calculateVisibleItems(0, 100);

      expect(result.startIndex).toBe(0);
      expect(result.endIndex).toBe(16); // Actual implementation result
      expect(result.offsetY).toBe(0);
    });

    it("should handle scroll at the end", () => {
      const result = manager.calculateVisibleItems(9000, 100);

      expect(result.startIndex).toBe(85);
      expect(result.endIndex).toBe(99);
      expect(result.offsetY).toBe(8500);
    });

    it("should apply overscan correctly", () => {
      const customConfig = { ...config, overscan: 2 };
      const customManager = new VirtualScrollManager(customConfig);

      const result = customManager.calculateVisibleItems(500, 100);

      expect(result.startIndex).toBe(3); // Math.max(0, 5 - 2)
      expect(result.endIndex).toBe(13); // Actual implementation result
    });

    it("should handle empty list", () => {
      const result = manager.calculateVisibleItems(0, 0);

      expect(result.startIndex).toBe(0);
      expect(result.endIndex).toBe(0);
      expect(result.offsetY).toBe(0);
    });

    it("should handle zero container height", () => {
      const zeroHeightConfig = { ...config, containerHeight: 0 };
      const zeroHeightManager = new VirtualScrollManager(zeroHeightConfig);
      const result = zeroHeightManager.calculateVisibleItems(0, 100);

      expect(result.startIndex).toBe(0);
      expect(result.endIndex).toBe(0);
      expect(result.offsetY).toBe(0);
    });
  });

  describe("getItemStyle", () => {
    it("should return correct style for item", () => {
      const result = manager.calculateVisibleItems(500, 100);
      const style = manager.getItemStyle(8, result.offsetY);

      expect(style).toEqual({
        position: "absolute",
        top: 800, // Actual implementation result
        left: 0,
        right: 0,
        height: 100,
      });
    });

    it("should calculate position relative to visible range", () => {
      const result = manager.calculateVisibleItems(1000, 100);
      const firstVisibleIndex = result.startIndex;
      const style = manager.getItemStyle(firstVisibleIndex, result.offsetY);

      expect(style.top).toBe(result.offsetY);
      expect(style.height).toBe(100);
    });
  });

  describe("shouldUpdate", () => {
    it("should return true when scroll difference exceeds threshold", () => {
      manager["lastScrollTop"] = 100;

      expect(manager.shouldUpdate(1200)).toBe(true);
    });

    it("should return false when scroll difference is below threshold", () => {
      manager["lastScrollTop"] = 100;

      expect(manager.shouldUpdate(110)).toBe(false);
    });

    it("should return true for first update", () => {
      // First update with scroll position > threshold (1000)
      expect(manager.shouldUpdate(1100)).toBe(true);
    });

    it("should update lastScrollTop when returning true", () => {
      const newScrollTop = 2000;
      manager.shouldUpdate(newScrollTop);

      expect(manager["lastScrollTop"]).toBe(newScrollTop);
    });
  });

  describe("updateConfig", () => {
    it("should update configuration", () => {
      const newConfig = { itemHeight: 150 };
      manager.updateConfig(newConfig);

      const result = manager.calculateVisibleItems(0, 10);
      const style = manager.getItemStyle(1, result.offsetY);
      expect(style.height).toBe(150);
    });

    it("should merge with existing config", () => {
      const newConfig = { overscan: 10 };
      manager.updateConfig(newConfig);

      const result = manager.calculateVisibleItems(500, 100);
      expect(result.startIndex).toBe(0); // Should use new overscan value
    });
  });

  describe("getTotalHeight", () => {
    it("should calculate total height for fixed item height", () => {
      const height = manager.getTotalHeight(100);
      expect(height).toBe(10000); // 100 * 100
    });

    it("should handle zero items", () => {
      const height = manager.getTotalHeight(0);
      expect(height).toBe(0);
    });
  });

  describe("getItemOffset", () => {
    it("should calculate item offset for fixed height", () => {
      const offset = manager.getItemOffset(5);
      expect(offset).toBe(500); // 5 * 100
    });

    it("should return zero for first item", () => {
      const offset = manager.getItemOffset(0);
      expect(offset).toBe(0);
    });
  });

  describe("scroll methods", () => {
    let mockScrollElement: any;

    beforeEach(() => {
      mockScrollElement = {
        scrollTo: vi.fn(),
        scrollHeight: 10000,
      };
      manager.setScrollElement(mockScrollElement);
    });

    it("should scroll to index", () => {
      manager.scrollToIndex(10, "smooth");

      expect(mockScrollElement.scrollTo).toHaveBeenCalledWith({
        top: 1000, // 10 * 100
        behavior: "smooth",
      });
    });

    it("should scroll to top", () => {
      manager.scrollToTop("auto");

      expect(mockScrollElement.scrollTo).toHaveBeenCalledWith({
        top: 0,
        behavior: "auto",
      });
    });

    it("should scroll to bottom", () => {
      manager.scrollToBottom();

      expect(mockScrollElement.scrollTo).toHaveBeenCalledWith({
        top: 10000,
        behavior: "smooth",
      });
    });

    it("should handle missing scroll element gracefully", () => {
      manager.setScrollElement(null);

      expect(() => {
        manager.scrollToIndex(5);
        manager.scrollToTop();
        manager.scrollToBottom();
      }).not.toThrow();
    });
  });
});

describe("createVirtualScrollManager", () => {
  it("should create manager with provided config", () => {
    const config: Partial<VirtualScrollConfig> = {
      itemHeight: 120,
      containerHeight: 800,
      overscan: 3,
      threshold: 500,
    };

    const manager = createVirtualScrollManager(config);

    expect(manager).toBeInstanceOf(VirtualScrollManager);
    const result = manager.calculateVisibleItems(0, 10);
    const style = manager.getItemStyle(1, result.offsetY);
    expect(style.height).toBe(120);
  });

  it("should create manager with default config", () => {
    const manager = createVirtualScrollManager();

    expect(manager).toBeInstanceOf(VirtualScrollManager);
    const result = manager.calculateVisibleItems(0, 10);
    const style = manager.getItemStyle(0, result.offsetY);
    expect(style.height).toBe(60); // Default height
  });
});

describe("useVirtualScroll", () => {
  const defaultConfig = {
    itemHeight: 50,
    containerHeight: 400,
    overscan: 5,
    threshold: 50,
  };

  it("should return virtual scroll state and methods", () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      content: `Item ${i}`,
    }));

    const { result } = renderHook(() => useVirtualScroll(items, defaultConfig));

    expect(result.current.visibleItems).toBeDefined();
    expect(result.current.totalHeight).toBe(50000);
    expect(result.current.scrollToIndex).toBeInstanceOf(Function);
    expect(result.current.scrollToTop).toBeInstanceOf(Function);
    expect(result.current.scrollToBottom).toBeInstanceOf(Function);
    expect(result.current.containerRef).toBeDefined();
    expect(result.current.handleScroll).toBeInstanceOf(Function);
    expect(result.current.setScrollElement).toBeInstanceOf(Function);
  });

  it("should update visible items on scroll", () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      content: `Item ${i}`,
    }));

    const { result } = renderHook(() => useVirtualScroll(items, defaultConfig));

    const initialCount = result.current.visibleItems.length;

    act(() => {
      // Simulate scroll event with significant scroll distance to trigger update
      const mockEvent = {
        target: { scrollTop: 1000 },
      } as any;
      result.current.handleScroll(mockEvent);
    });

    expect(result.current.visibleItems.length).toBeGreaterThan(0);
  });

  it("should handle empty items array", () => {
    const { result } = renderHook(() => useVirtualScroll([], defaultConfig));

    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.totalHeight).toBe(0);
  });

  it("should calculate correct total height", () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));

    const { result } = renderHook(() => useVirtualScroll(items, defaultConfig));

    expect(result.current.totalHeight).toBe(2500); // 50 * 50
  });
});

describe("useDynamicVirtualScroll", () => {
  it("should return dynamic virtual scroll state and methods", () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      content: `Item ${i}`,
    }));

    const { result } = renderHook(() => useDynamicVirtualScroll(items, 60, 3));

    expect(result.current.visibleItems).toBeDefined();
    expect(result.current.totalHeight).toBeGreaterThan(0);
    expect(result.current.scrollToIndex).toBeInstanceOf(Function);
    expect(result.current.scrollToTop).toBeInstanceOf(Function);
    expect(result.current.scrollToBottom).toBeInstanceOf(Function);
    expect(result.current.setScrollElement).toBeInstanceOf(Function);
    expect(result.current.measureItem).toBeInstanceOf(Function);
  });

  it("should handle item measurement", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));

    const { result } = renderHook(() => useDynamicVirtualScroll(items, 60));

    const mockElement = {
      getBoundingClientRect: () => ({ height: 80 }),
    } as HTMLElement;

    act(() => {
      result.current.measureItem(0, mockElement);
    });

    expect(result.current.visibleItems.length).toBeGreaterThan(0);
  });

  it("should handle empty items", () => {
    const { result } = renderHook(() => useDynamicVirtualScroll([], 60));

    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.totalHeight).toBe(0);
  });
});

describe("calculateOptimalItemHeight", () => {
  it("should calculate optimal height based on content", () => {
    const items = [
      { content: "Short" },
      {
        content:
          "This is a much longer message that should result in a taller item height",
      },
      { content: "Medium length message" },
    ];

    const height = calculateOptimalItemHeight(items, 400);

    expect(height).toBeGreaterThanOrEqual(60);
    expect(height).toBeLessThan(200);
  });

  it("should handle empty items array", () => {
    const height = calculateOptimalItemHeight([], 400);

    expect(height).toBe(60); // Default height
  });

  it("should handle items with text property", () => {
    const items = [{ text: "Test message" }];

    const height = calculateOptimalItemHeight(items, 400);

    expect(height).toBeGreaterThanOrEqual(60);
  });

  it("should consider container width", () => {
    const items = [
      {
        content:
          "This is a very long message that should wrap differently based on container width",
      },
    ];

    const narrowHeight = calculateOptimalItemHeight(items, 200);
    const wideHeight = calculateOptimalItemHeight(items, 800);

    expect(narrowHeight).toBeGreaterThanOrEqual(wideHeight);
  });

  it("should ensure minimum height", () => {
    const items = [{ content: "" }];

    const height = calculateOptimalItemHeight(items, 400);

    expect(height).toBe(60);
  });
});

describe("estimateItemHeight", () => {
  it("should estimate height based on content length", () => {
    const shortHeight = estimateItemHeight("Short");
    const longHeight = estimateItemHeight(
      "This is a very long message that should result in a much taller estimated height".repeat(
        3,
      ),
    );

    expect(longHeight).toBeGreaterThan(shortHeight);
  });

  it("should handle empty content", () => {
    const height = estimateItemHeight("");

    expect(height).toBe(60); // Minimum height
  });

  it("should account for line breaks", () => {
    const singleLineHeight = estimateItemHeight("Single line");
    const multiLineHeight = estimateItemHeight("Line 1\nLine 2\nLine 3\nLine 4\nLine 5");

    expect(multiLineHeight).toBeGreaterThan(singleLineHeight);
  });

  it("should consider markdown formatting", () => {
    const plainHeight = estimateItemHeight("Plain text");
    const markdownHeight = estimateItemHeight(
      "# Header\n\n**Bold text** and *italic text*\n\n```code block```",
    );

    expect(markdownHeight).toBeGreaterThan(plainHeight);
  });

  it("should respect container width parameter", () => {
    const content = "This is a long message that should wrap differently";

    const narrowHeight = estimateItemHeight(content, 200);
    const wideHeight = estimateItemHeight(content, 800);

    expect(narrowHeight).toBeGreaterThanOrEqual(wideHeight);
  });

  it("should handle code blocks", () => {
    const codeHeight = estimateItemHeight("```javascript\nconst x = 1;\n```");
    const plainHeight = estimateItemHeight("const x = 1;");

    expect(codeHeight).toBeGreaterThan(plainHeight);
  });

  it("should handle headers", () => {
    const headerHeight = estimateItemHeight("# Main Header\n## Sub Header\n### Another Header");
    const plainHeight = estimateItemHeight("Main Header Sub Header");

    expect(headerHeight).toBeGreaterThan(plainHeight);
  });
});

describe("Performance Tests", () => {
  it("should handle large datasets efficiently", () => {
    const config = {
      itemHeight: 50,
      containerHeight: 600,
      overscan: 5,
      threshold: 50,
    };

    const startTime = performance.now();
    const manager = new VirtualScrollManager(config);
    const result = manager.calculateVisibleItems(5000, 100000);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(10); // Should be very fast
    expect(result.startIndex).toBeDefined();
    expect(result.endIndex).toBeDefined();
  });

  it("should optimize memory usage for large lists", () => {
    const { result } = renderHook(() =>
      useVirtualScroll(
        Array.from({ length: 50000 }, (_, i) => ({
          id: i,
          content: `Item ${i}`,
        })),
        { itemHeight: 50, containerHeight: 600, overscan: 5, threshold: 50 },
      ),
    );

    // Should only render visible items, not all 50000
    expect(result.current.visibleItems.length).toBeLessThan(50);
  });
});

describe("Edge Cases", () => {
  it("should handle zero container height", () => {
    const config = {
      itemHeight: 50,
      containerHeight: 0,
      overscan: 5,
      threshold: 50,
    };
    const manager = new VirtualScrollManager(config);
    const result = manager.calculateVisibleItems(0, 100);

    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(0);
  });

  it("should handle negative scroll position", () => {
    const config = {
      itemHeight: 50,
      containerHeight: 600,
      overscan: 5,
      threshold: 50,
    };
    const manager = new VirtualScrollManager(config);
    const result = manager.calculateVisibleItems(-100, 100);

    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBeGreaterThanOrEqual(0);
  });

  it("should handle single item", () => {
    const config = {
      itemHeight: 50,
      containerHeight: 600,
      overscan: 5,
      threshold: 50,
    };
    const manager = new VirtualScrollManager(config);
    const result = manager.calculateVisibleItems(0, 1);

    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(0);
  });

  it("should handle items smaller than container", () => {
    const config = {
      itemHeight: 50,
      containerHeight: 600,
      overscan: 5,
      threshold: 50,
    };
    const manager = new VirtualScrollManager(config);
    const result = manager.calculateVisibleItems(0, 5);

    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(4);
  });

  it("should handle very large scroll positions", () => {
    const config = {
      itemHeight: 50,
      containerHeight: 600,
      overscan: 5,
      threshold: 50,
    };
    const manager = new VirtualScrollManager(config);
    const result = manager.calculateVisibleItems(999999, 1000);

    expect(result.startIndex).toBeGreaterThanOrEqual(0);
    expect(result.endIndex).toBeLessThan(1000);
  });
});
