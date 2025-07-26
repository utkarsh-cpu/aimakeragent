import { useEffect, useCallback, useRef, useState } from 'react';
import { KeyboardNavigation } from '../utils/accessibility';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
  category: string;
  disabled?: boolean;
}

export interface FocusableElement {
  id: string;
  element: HTMLElement;
  priority: number;
  category: 'message' | 'input' | 'sidebar' | 'header' | 'settings';
}

export interface KeyboardNavigationOptions {
  enableShortcuts?: boolean;
  enableFocusManagement?: boolean;
  enableArrowNavigation?: boolean;
  trapFocus?: boolean;
  announceNavigation?: boolean;
}

export function useKeyboardNavigation(
  shortcuts: KeyboardShortcut[] = [],
  options: KeyboardNavigationOptions = {}
) {
  const {
    enableShortcuts = true,
    enableFocusManagement = true,
    enableArrowNavigation = true,
    trapFocus = false,
    announceNavigation = true
  } = options;

  const [focusedElementId, setFocusedElementId] = useState<string | null>(null);
  const [focusableElements, setFocusableElements] = useState<FocusableElement[]>([]);
  const containerRef = useRef<HTMLElement | null>(null);
  const shortcutsRef = useRef<KeyboardShortcut[]>(shortcuts);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Update shortcuts ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  // Register focusable element
  const registerFocusableElement = useCallback((
    id: string,
    element: HTMLElement,
    priority: number = 0,
    category: FocusableElement['category'] = 'message'
  ) => {
    setFocusableElements(prev => {
      const existing = prev.find(el => el.id === id);
      if (existing) {
        return prev.map(el => 
          el.id === id 
            ? { ...el, element, priority, category }
            : el
        );
      }
      return [...prev, { id, element, priority, category }].sort((a, b) => b.priority - a.priority);
    });

    // Return cleanup function
    return () => {
      setFocusableElements(prev => prev.filter(el => el.id !== id));
    };
  }, []);

  // Unregister focusable element
  const unregisterFocusableElement = useCallback((id: string) => {
    setFocusableElements(prev => prev.filter(el => el.id !== id));
  }, []);

  // Focus element by ID
  const focusElement = useCallback((id: string, announce = true) => {
    const element = focusableElements.find(el => el.id === id);
    if (element?.element) {
      element.element.focus();
      setFocusedElementId(id);
      
      if (announce && announceNavigation) {
        const announcement = `Focused ${element.category} ${id}`;
        // Use screen reader announcer if available
        if (window.screenReaderAnnouncer) {
          window.screenReaderAnnouncer.announce(announcement);
        }
      }
    }
  }, [focusableElements, announceNavigation]);

  // Navigate to next/previous focusable element
  const navigateElements = useCallback((direction: 'next' | 'previous', category?: string) => {
    if (!focusableElements.length) return;

    const filteredElements = category 
      ? focusableElements.filter(el => el.category === category)
      : focusableElements;

    if (!filteredElements.length) return;

    const currentIndex = focusedElementId 
      ? filteredElements.findIndex(el => el.id === focusedElementId)
      : -1;

    let nextIndex: number;
    if (direction === 'next') {
      nextIndex = currentIndex < filteredElements.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : filteredElements.length - 1;
    }

    const nextElement = filteredElements[nextIndex];
    if (nextElement) {
      focusElement(nextElement.id);
    }
  }, [focusableElements, focusedElementId, focusElement]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enableShortcuts) return;

    // Check if we're in an input field (except for specific shortcuts)
    const activeElement = document.activeElement;
    const isInInput = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true'
    );

    // Global shortcuts that work even in input fields
    const globalShortcuts = ['Escape', 'F1', 'F2', 'F3', 'F4'];
    const isGlobalShortcut = globalShortcuts.includes(event.key);

    // Arrow key navigation
    if (enableArrowNavigation && !isInInput) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        navigateElements(event.key === 'ArrowDown' ? 'next' : 'previous');
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const category = event.shiftKey ? 'sidebar' : 'message';
        event.preventDefault();
        navigateElements(event.key === 'ArrowRight' ? 'next' : 'previous', category);
        return;
      }
    }

    // Tab navigation enhancement
    if (event.key === 'Tab' && enableFocusManagement) {
      if (trapFocus && containerRef.current) {
        const focusableElements = KeyboardNavigation.getFocusableElements(containerRef.current);
        if (focusableElements.length > 0) {
          const currentIndex = focusableElements.indexOf(activeElement as HTMLElement);
          let nextIndex: number;
          
          if (event.shiftKey) {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
          } else {
            nextIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
          }
          
          event.preventDefault();
          focusableElements[nextIndex]?.focus();
        }
      }
      return;
    }

    // Skip other shortcuts if in input field (unless global)
    if (isInInput && !isGlobalShortcut) return;

    // Find matching shortcut
    const matchingShortcut = shortcutsRef.current.find(shortcut => {
      if (shortcut.disabled) return false;
      
      return (
        shortcut.key.toLowerCase() === event.key.toLowerCase() &&
        !!shortcut.ctrlKey === (event.ctrlKey || event.metaKey) &&
        !!shortcut.shiftKey === event.shiftKey &&
        !!shortcut.altKey === event.altKey
      );
    });

    if (matchingShortcut) {
      event.preventDefault();
      event.stopPropagation();
      matchingShortcut.action();
    }
  }, [enableShortcuts, enableArrowNavigation, enableFocusManagement, trapFocus, navigateElements]);

  // Set up keyboard event listeners
  useEffect(() => {
    if (!enableShortcuts && !enableArrowNavigation) return;

    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleKeyDown, enableShortcuts, enableArrowNavigation]);

  // Focus trap setup
  useEffect(() => {
    if (!trapFocus || !containerRef.current) return;

    const cleanup = KeyboardNavigation.trapFocus(containerRef.current);
    cleanupRef.current = cleanup;

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [trapFocus]);

  // Get shortcuts by category
  const getShortcutsByCategory = useCallback(() => {
    const categories: Record<string, KeyboardShortcut[]> = {};
    
    shortcutsRef.current.forEach(shortcut => {
      if (!categories[shortcut.category]) {
        categories[shortcut.category] = [];
      }
      categories[shortcut.category].push(shortcut);
    });

    return categories;
  }, []);

  // Format shortcut key combination
  const formatShortcut = useCallback((shortcut: KeyboardShortcut) => {
    const parts: string[] = [];
    
    if (shortcut.ctrlKey || shortcut.metaKey) {
      parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
    }
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.altKey) parts.push('Alt');
    parts.push(shortcut.key.toUpperCase());
    
    return parts.join(' + ');
  }, []);

  return {
    // State
    focusedElementId,
    focusableElements,
    
    // Actions
    registerFocusableElement,
    unregisterFocusableElement,
    focusElement,
    navigateElements,
    
    // Utilities
    getShortcutsByCategory,
    formatShortcut,
    
    // Refs
    containerRef,
    
    // Cleanup
    cleanup: () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    }
  };
}

// Hook for managing focus within a specific component
export function useFocusManagement(
  elementId: string,
  category: FocusableElement['category'] = 'message',
  priority: number = 0
) {
  const elementRef = useRef<HTMLElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    element.addEventListener('focus', handleFocus);
    element.addEventListener('blur', handleBlur);

    // Make element focusable if it isn't already
    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '0');
    }

    // Add ARIA attributes
    element.setAttribute('role', category === 'message' ? 'article' : 'button');
    element.setAttribute('aria-label', `${category} ${elementId}`);

    return () => {
      element.removeEventListener('focus', handleFocus);
      element.removeEventListener('blur', handleBlur);
    };
  }, [elementId, category]);

  return {
    elementRef,
    isFocused,
    focusProps: {
      ref: elementRef,
      tabIndex: 0,
      role: category === 'message' ? 'article' : 'button',
      'aria-label': `${category} ${elementId}`,
      'data-focus-id': elementId,
      'data-focus-category': category,
      'data-focus-priority': priority,
    }
  };
}

// Global keyboard shortcuts registry
export const GLOBAL_SHORTCUTS = {
  // Navigation
  FOCUS_CHAT_INPUT: { key: 'i', ctrlKey: true, description: 'Focus chat input', category: 'Navigation' },
  FOCUS_SIDEBAR: { key: 'b', ctrlKey: true, description: 'Focus sidebar', category: 'Navigation' },
  TOGGLE_SIDEBAR: { key: 'b', ctrlKey: true, shiftKey: true, description: 'Toggle sidebar', category: 'Navigation' },
  
  // Messages
  SCROLL_TO_TOP: { key: 'Home', ctrlKey: true, description: 'Scroll to top', category: 'Messages' },
  SCROLL_TO_BOTTOM: { key: 'End', ctrlKey: true, description: 'Scroll to bottom', category: 'Messages' },
  NEXT_MESSAGE: { key: 'ArrowDown', description: 'Next message', category: 'Messages' },
  PREVIOUS_MESSAGE: { key: 'ArrowUp', description: 'Previous message', category: 'Messages' },
  
  // Actions
  NEW_CONVERSATION: { key: 'n', ctrlKey: true, description: 'New conversation', category: 'Actions' },
  SEARCH_MESSAGES: { key: 'f', ctrlKey: true, description: 'Search messages', category: 'Actions' },
  TOGGLE_SETTINGS: { key: ',', ctrlKey: true, description: 'Toggle settings', category: 'Actions' },
  
  // Message Actions
  COPY_MESSAGE: { key: 'c', ctrlKey: true, description: 'Copy selected message', category: 'Message Actions' },
  EDIT_MESSAGE: { key: 'e', description: 'Edit selected message', category: 'Message Actions' },
  DELETE_MESSAGE: { key: 'Delete', description: 'Delete selected message', category: 'Message Actions' },
  REGENERATE_MESSAGE: { key: 'r', description: 'Regenerate selected message', category: 'Message Actions' },
  QUOTE_MESSAGE: { key: 'q', ctrlKey: true, description: 'Quote selected message', category: 'Message Actions' },
  
  // System
  HELP: { key: 'F1', description: 'Show keyboard shortcuts', category: 'System' },
  ESCAPE: { key: 'Escape', description: 'Cancel current action', category: 'System' },
} as const;

declare global {
  interface Window {
    screenReaderAnnouncer?: {
      announce: (message: string, priority?: 'polite' | 'assertive') => void;
    };
  }
}