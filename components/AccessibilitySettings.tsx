import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { 
  Eye, 
  Volume2, 
  Keyboard, 
  Contrast,
  Zap,
  TestTube
} from 'lucide-react';
import { 
  AccessibilityConfig, 
  HighContrastMode, 
  ReducedMotion,
  ScreenReaderAnnouncer,
  AriaLiveRegionManager
} from '../utils/accessibility';

interface AccessibilitySettingsProps {
  config: AccessibilityConfig;
  onConfigChange: (config: AccessibilityConfig) => void;
}

export function AccessibilitySettings({ config, onConfigChange }: AccessibilitySettingsProps) {
  const [testAnnouncement, setTestAnnouncement] = useState('');

  // Handle configuration changes
  const updateConfig = (updates: Partial<AccessibilityConfig>) => {
    const newConfig = { ...config, ...updates };
    onConfigChange(newConfig);
  };

  // Apply high contrast mode
  useEffect(() => {
    if (config.highContrast) {
      HighContrastMode.enable();
    } else {
      HighContrastMode.disable();
    }
  }, [config.highContrast]);

  // Test screen reader announcement
  const testScreenReader = () => {
    const message = testAnnouncement || 'This is a test announcement for screen readers.';
    ScreenReaderAnnouncer.announce(message, 'polite');
    AriaLiveRegionManager.announce('test', message, 'polite');
    setTestAnnouncement('');
  };

  // Get system preferences
  const systemPrefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const systemPrefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;

  return (
    <div className="space-y-6">
      {/* Visual Accessibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Visual Accessibility
          </CardTitle>
          <CardDescription>
            Adjust visual settings to improve readability and reduce eye strain
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* High Contrast Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="high-contrast">High Contrast Mode</Label>
              <p className="text-sm text-muted-foreground">
                Increase contrast for better visibility
              </p>
              {systemPrefersHighContrast && (
                <Badge variant="outline" className="text-xs">
                  System preference detected
                </Badge>
              )}
            </div>
            <Switch
              id="high-contrast"
              checked={config.highContrast}
              onCheckedChange={(checked) => updateConfig({ highContrast: checked })}
              aria-describedby="high-contrast-desc"
            />
          </div>

          <Separator />

          {/* Font Size */}
          <div className="space-y-2">
            <Label htmlFor="font-size">Font Size</Label>
            <Select
              value={config.fontSize}
              onValueChange={(value) => updateConfig({ fontSize: value as AccessibilityConfig['fontSize'] })}
            >
              <SelectTrigger id="font-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium (Default)</SelectItem>
                <SelectItem value="large">Large</SelectItem>
                <SelectItem value="extra-large">Extra Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reduced Motion */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reduced-motion">Reduce Motion</Label>
              <p className="text-sm text-muted-foreground">
                Minimize animations and transitions
              </p>
              {systemPrefersReducedMotion && (
                <Badge variant="outline" className="text-xs">
                  System preference detected
                </Badge>
              )}
            </div>
            <Switch
              id="reduced-motion"
              checked={config.reducedMotion}
              onCheckedChange={(checked) => updateConfig({ reducedMotion: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Screen Reader Support */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Screen Reader Support
          </CardTitle>
          <CardDescription>
            Configure announcements and audio feedback for screen readers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Announce Messages */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="announce-messages">Announce New Messages</Label>
              <p className="text-sm text-muted-foreground">
                Automatically announce new messages as they arrive
              </p>
            </div>
            <Switch
              id="announce-messages"
              checked={config.announceMessages}
              onCheckedChange={(checked) => updateConfig({ announceMessages: checked })}
            />
          </div>

          <Separator />

          {/* Test Screen Reader */}
          <div className="space-y-2">
            <Label htmlFor="test-announcement">Test Screen Reader</Label>
            <div className="flex gap-2">
              <input
                id="test-announcement"
                type="text"
                placeholder="Enter test message..."
                value={testAnnouncement}
                onChange={(e) => setTestAnnouncement(e.target.value)}
                className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm"
                aria-describedby="test-announcement-desc"
              />
              <Button 
                onClick={testScreenReader}
                variant="outline"
                size="sm"
                aria-describedby="test-announcement-desc"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Test
              </Button>
            </div>
            <p id="test-announcement-desc" className="text-xs text-muted-foreground">
              This will announce the message to screen readers
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Navigation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Navigation
          </CardTitle>
          <CardDescription>
            Configure keyboard shortcuts and navigation behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable Keyboard Navigation */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="keyboard-navigation">Enable Keyboard Navigation</Label>
              <p className="text-sm text-muted-foreground">
                Use keyboard shortcuts to navigate the interface
              </p>
            </div>
            <Switch
              id="keyboard-navigation"
              checked={config.keyboardNavigation}
              onCheckedChange={(checked) => updateConfig({ keyboardNavigation: checked })}
            />
          </div>

          {config.keyboardNavigation && (
            <>
              <Separator />
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium">Available Shortcuts:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Ctrl+I: Focus input</div>
                  <div>Ctrl+N: New conversation</div>
                  <div>Ctrl+F: Search messages</div>
                  <div>F1: Show help</div>
                  <div>Arrow keys: Navigate messages</div>
                  <div>Escape: Cancel actions</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Advanced Settings
          </CardTitle>
          <CardDescription>
            Fine-tune accessibility features for your specific needs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Custom CSS for accessibility */}
          <div className="space-y-2">
            <Label>Accessibility Enhancements</Label>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="focus-indicators"
                  defaultChecked
                  className="rounded border-input"
                />
                <Label htmlFor="focus-indicators" className="text-sm">
                  Enhanced focus indicators
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="skip-links"
                  defaultChecked
                  className="rounded border-input"
                />
                <Label htmlFor="skip-links" className="text-sm">
                  Skip navigation links
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="aria-descriptions"
                  defaultChecked
                  className="rounded border-input"
                />
                <Label htmlFor="aria-descriptions" className="text-sm">
                  Detailed ARIA descriptions
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="live-regions"
                  defaultChecked
                  className="rounded border-input"
                />
                <Label htmlFor="live-regions" className="text-sm">
                  ARIA live regions
                </Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Reset to defaults */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Reset Settings</Label>
              <p className="text-sm text-muted-foreground">
                Restore all accessibility settings to their default values
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const defaultConfig: AccessibilityConfig = {
                  announceMessages: false,
                  highContrast: false,
                  reducedMotion: systemPrefersReducedMotion,
                  fontSize: 'medium',
                  keyboardNavigation: true,
                };
                onConfigChange(defaultConfig);
                ScreenReaderAnnouncer.announce('Accessibility settings reset to defaults', 'polite');
              }}
            >
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Contrast className="h-5 w-5" />
            Accessibility Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span>Screen Reader Support</span>
              <Badge variant={config.announceMessages ? "default" : "secondary"}>
                {config.announceMessages ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>High Contrast</span>
              <Badge variant={config.highContrast ? "default" : "secondary"}>
                {config.highContrast ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Keyboard Navigation</span>
              <Badge variant={config.keyboardNavigation ? "default" : "secondary"}>
                {config.keyboardNavigation ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Reduced Motion</span>
              <Badge variant={config.reducedMotion ? "default" : "secondary"}>
                {config.reducedMotion ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Skip navigation component
export function SkipNavigation() {
  return (
    <div className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50">
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <a
        href="#chat-input"
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md ml-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to chat input
      </a>
    </div>
  );
}