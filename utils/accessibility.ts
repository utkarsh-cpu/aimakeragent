/**
 * Accessibility utilities for the chat application
 */

export interface AccessibilityConfig {
  announceMessages: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  keyboardNavigation: boolean;
}

export const DEFAULT_ACCESSIBILITY_CONFIG: AccessibilityConfig = {
  announceMessages: false,
  highContrast: false,
  reducedMotion: false,
  fontSize: 'medium',
  keyboardNavigation: true,
};

/**
 * Screen reader announcement utility
 */
export class ScreenReaderAnnouncer {
  private static announcer: HTMLElement | null = null;

  /**
   * Initialize the screen reader announcer
   */
  static initialize(): void {
    if (this.announcer || typeof document === 'undefined') return;

    this.announcer = document.createElement('div');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.style.position = 'absolute';
    this.announcer.style.left = '-10000px';
    this.announcer.style.width = '1px';
    this.announcer.style.height = '1px';
    this.announcer.style.overflow = 'hidden';
    
    document.body.appendChild(this.announcer);
  }

  /**
   * Announce a message to screen readers
   */
  static announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.announcer) this.initialize();
    if (!this.announcer) return;

    this.announcer.setAttribute('aria-live', priority);
    this.announcer.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (this.announcer) {
        this.announcer.textContent = '';
      }
    }, 1000);
  }

  /**
   * Announce new message arrival
   */
  static announceNewMessage(sender: string, preview: string): void {
    const message = `New message from ${sender}: ${preview.substring(0, 100)}${preview.length > 100 ? '...' : ''}`;
    this.announce(message);
  }

  /**
   * Announce system status
   */
  static announceStatus(status: string): void {
    this.announce(status, 'assertive');
  }
}

/**
 * Keyboard navigation utilities
 */
export class KeyboardNavigation {
  private static focusableElements = [
    'button',
    'input',
    'textarea',
    'select',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  /**
   * Get all focusable elements within a container
   */
  static getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(this.focusableElements))
      .filter(el => !el.hasAttribute('disabled') && this.isVisible(el)) as HTMLElement[];
  }

  /**
   * Trap focus within a container (for modals, etc.)
   */
  static trapFocus(container: HTMLElement): () => void {
    const focusableElements = this.getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Focus first element
    firstElement?.focus();

    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }

  /**
   * Check if element is visible
   */
  private static isVisible(element: Element): boolean {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  }
}

/**
 * High contrast mode utilities
 */
export class HighContrastMode {
  private static readonly HIGH_CONTRAST_CLASS = 'high-contrast-mode';

  /**
   * Enable high contrast mode
   */
  static enable(): void {
    document.documentElement.classList.add(this.HIGH_CONTRAST_CLASS);
    localStorage.setItem('high-contrast-mode', 'true');
  }

  /**
   * Disable high contrast mode
   */
  static disable(): void {
    document.documentElement.classList.remove(this.HIGH_CONTRAST_CLASS);
    localStorage.setItem('high-contrast-mode', 'false');
  }

  /**
   * Toggle high contrast mode
   */
  static toggle(): boolean {
    const isEnabled = this.isEnabled();
    if (isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
    return !isEnabled;
  }

  /**
   * Check if high contrast mode is enabled
   */
  static isEnabled(): boolean {
    return document.documentElement.classList.contains(this.HIGH_CONTRAST_CLASS);
  }

  /**
   * Initialize high contrast mode from saved preference
   */
  static initialize(): void {
    const saved = localStorage.getItem('high-contrast-mode');
    if (saved === 'true') {
      this.enable();
    }
  }
}

/**
 * Reduced motion utilities
 */
export class ReducedMotion {
  /**
   * Check if user prefers reduced motion
   */
  static prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Apply reduced motion styles
   */
  static applyReducedMotion(): void {
    if (this.prefersReducedMotion()) {
      document.documentElement.classList.add('reduced-motion');
    }
  }

  /**
   * Initialize reduced motion detection
   */
  static initialize(): void {
    this.applyReducedMotion();

    // Listen for changes
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addEventListener('change', () => {
      this.applyReducedMotion();
    });
  }
}

/**
 * ARIA live region manager for dynamic content announcements
 */
export class AriaLiveRegionManager {
  private static regions: Map<string, HTMLElement> = new Map();

  /**
   * Create or get an ARIA live region
   */
  static getRegion(id: string, priority: 'polite' | 'assertive' = 'polite'): HTMLElement {
    if (this.regions.has(id)) {
      return this.regions.get(id)!;
    }

    const region = document.createElement('div');
    region.id = `aria-live-${id}`;
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', 'true');
    region.style.position = 'absolute';
    region.style.left = '-10000px';
    region.style.width = '1px';
    region.style.height = '1px';
    region.style.overflow = 'hidden';
    
    document.body.appendChild(region);
    this.regions.set(id, region);
    
    return region;
  }

  /**
   * Announce to a specific live region
   */
  static announce(regionId: string, message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const region = this.getRegion(regionId, priority);
    region.setAttribute('aria-live', priority);
    region.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      region.textContent = '';
    }, 1000);
  }

  /**
   * Clean up all regions
   */
  static cleanup(): void {
    this.regions.forEach(region => {
      if (region.parentNode) {
        region.parentNode.removeChild(region);
      }
    });
    this.regions.clear();
  }
}

/**
 * Accessibility utilities for form elements
 */
export class FormAccessibility {
  /**
   * Associate label with form control
   */
  static associateLabel(control: HTMLElement, labelText: string, description?: string): void {
    const labelId = `${control.id || 'control'}-label`;
    const descId = description ? `${control.id || 'control'}-desc` : undefined;

    // Create or update label
    let label = document.getElementById(labelId) as HTMLLabelElement;
    if (!label) {
      label = document.createElement('label');
      label.id = labelId;
      label.htmlFor = control.id;
      control.parentNode?.insertBefore(label, control);
    }
    label.textContent = labelText;

    // Create or update description
    if (description) {
      let desc = document.getElementById(descId!);
      if (!desc) {
        desc = document.createElement('div');
        desc.id = descId!;
        desc.className = 'sr-only';
        control.parentNode?.insertBefore(desc, control.nextSibling);
      }
      desc.textContent = description;
      control.setAttribute('aria-describedby', descId!);
    }

    control.setAttribute('aria-labelledby', labelId);
  }

  /**
   * Set validation state for form control
   */
  static setValidationState(
    control: HTMLElement, 
    isValid: boolean, 
    errorMessage?: string
  ): void {
    control.setAttribute('aria-invalid', (!isValid).toString());
    
    if (!isValid && errorMessage) {
      const errorId = `${control.id || 'control'}-error`;
      let errorElement = document.getElementById(errorId);
      
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = errorId;
        errorElement.className = 'sr-only';
        errorElement.setAttribute('role', 'alert');
        control.parentNode?.insertBefore(errorElement, control.nextSibling);
      }
      
      errorElement.textContent = errorMessage;
      control.setAttribute('aria-describedby', 
        `${control.getAttribute('aria-describedby') || ''} ${errorId}`.trim()
      );
    }
  }
}

/**
 * Screen reader optimized content utilities
 */
export class ScreenReaderContent {
  /**
   * Create screen reader only text
   */
  static createSROnlyText(text: string): HTMLElement {
    const element = document.createElement('span');
    element.className = 'sr-only';
    element.textContent = text;
    return element;
  }

  /**
   * Add screen reader context to interactive elements
   */
  static addInteractiveContext(
    element: HTMLElement, 
    context: {
      role?: string;
      label?: string;
      description?: string;
      expanded?: boolean;
      pressed?: boolean;
      selected?: boolean;
      level?: number;
      posInSet?: number;
      setSize?: number;
    }
  ): void {
    if (context.role) element.setAttribute('role', context.role);
    if (context.label) element.setAttribute('aria-label', context.label);
    if (context.description) element.setAttribute('aria-description', context.description);
    if (context.expanded !== undefined) element.setAttribute('aria-expanded', context.expanded.toString());
    if (context.pressed !== undefined) element.setAttribute('aria-pressed', context.pressed.toString());
    if (context.selected !== undefined) element.setAttribute('aria-selected', context.selected.toString());
    if (context.level) element.setAttribute('aria-level', context.level.toString());
    if (context.posInSet) element.setAttribute('aria-posinset', context.posInSet.toString());
    if (context.setSize) element.setAttribute('aria-setsize', context.setSize.toString());
  }

  /**
   * Create accessible loading indicator
   */
  static createLoadingIndicator(message: string = 'Loading'): HTMLElement {
    const container = document.createElement('div');
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-label', message);
    
    const visualIndicator = document.createElement('div');
    visualIndicator.className = 'loading-spinner';
    visualIndicator.setAttribute('aria-hidden', 'true');
    
    const srText = this.createSROnlyText(message);
    
    container.appendChild(visualIndicator);
    container.appendChild(srText);
    
    return container;
  }
}

/**
 * Chat-specific accessibility utilities
 */
export class ChatAccessibility {
  /**
   * Announce new message arrival
   */
  static announceNewMessage(sender: string, content: string, isUser: boolean = false): void {
    const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
    const announcement = isUser 
      ? `You sent: ${preview}`
      : `New message from ${sender}: ${preview}`;
    
    AriaLiveRegionManager.announce('messages', announcement, 'polite');
  }

  /**
   * Announce typing indicator
   */
  static announceTyping(isTyping: boolean): void {
    const message = isTyping ? 'Assistant is typing' : 'Assistant finished typing';
    AriaLiveRegionManager.announce('typing', message, 'polite');
  }

  /**
   * Announce conversation changes
   */
  static announceConversationChange(title: string, messageCount: number): void {
    const announcement = `Switched to conversation: ${title}. ${messageCount} messages.`;
    AriaLiveRegionManager.announce('navigation', announcement, 'polite');
  }

  /**
   * Announce message actions
   */
  static announceMessageAction(action: string, success: boolean = true): void {
    const message = success 
      ? `${action} completed successfully`
      : `${action} failed`;
    
    AriaLiveRegionManager.announce('actions', message, success ? 'polite' : 'assertive');
  }

  /**
   * Set up message accessibility attributes
   */
  static setupMessageAccessibility(
    messageElement: HTMLElement,
    message: {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: Date;
      isStreaming?: boolean;
      error?: string;
    },
    position: { index: number; total: number }
  ): void {
    messageElement.setAttribute('role', 'article');
    messageElement.setAttribute('aria-labelledby', `message-${message.id}-header`);
    messageElement.setAttribute('aria-describedby', `message-${message.id}-content`);
    messageElement.setAttribute('aria-posinset', (position.index + 1).toString());
    messageElement.setAttribute('aria-setsize', position.total.toString());
    
    if (message.isStreaming) {
      messageElement.setAttribute('aria-live', 'polite');
      messageElement.setAttribute('aria-busy', 'true');
    }
    
    if (message.error) {
      messageElement.setAttribute('aria-invalid', 'true');
    }

    // Add timestamp for screen readers
    const timeElement = messageElement.querySelector('[data-timestamp]');
    if (timeElement) {
      timeElement.setAttribute('aria-label', 
        `Sent ${message.timestamp.toLocaleString()}`
      );
    }
  }
}

/**
 * Initialize all accessibility features
 */
export function initializeAccessibility(config: Partial<AccessibilityConfig> = {}): void {
  const fullConfig = { ...DEFAULT_ACCESSIBILITY_CONFIG, ...config };

  ScreenReaderAnnouncer.initialize();
  HighContrastMode.initialize();
  ReducedMotion.initialize();

  // Apply configuration
  if (fullConfig.highContrast) {
    HighContrastMode.enable();
  }

  // Set up keyboard navigation
  if (fullConfig.keyboardNavigation) {
    document.addEventListener('keydown', (e) => {
      // Escape key handling for modals
      if (e.key === 'Escape') {
        const modal = document.querySelector('[role="dialog"]:not([hidden])');
        if (modal) {
          const closeButton = modal.querySelector('[data-close]') as HTMLElement;
          closeButton?.click();
        }
      }
    });
  }

  // Add CSS for screen reader only content
  if (!document.getElementById('accessibility-styles')) {
    const style = document.createElement('style');
    style.id = 'accessibility-styles';
    style.textContent = `
      .sr-only {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
      
      .focus-ring:focus {
        outline: 2px solid var(--ring) !important;
        outline-offset: 2px !important;
      }
      
      @media (prefers-reduced-motion: reduce) {
        .reduced-motion * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
      
      .high-contrast-mode {
        --background: #000000;
        --foreground: #ffffff;
        --primary: #ffffff;
        --primary-foreground: #000000;
        --secondary: #333333;
        --secondary-foreground: #ffffff;
        --muted: #333333;
        --muted-foreground: #ffffff;
        --accent: #ffffff;
        --accent-foreground: #000000;
        --destructive: #ff0000;
        --destructive-foreground: #ffffff;
        --border: #ffffff;
        --input: #333333;
        --ring: #ffffff;
      }
    `;
    document.head.appendChild(style);
  }

  // Set up global ARIA live regions
  AriaLiveRegionManager.getRegion('messages', 'polite');
  AriaLiveRegionManager.getRegion('navigation', 'polite');
  AriaLiveRegionManager.getRegion('actions', 'polite');
  AriaLiveRegionManager.getRegion('typing', 'polite');
  AriaLiveRegionManager.getRegion('alerts', 'assertive');
}