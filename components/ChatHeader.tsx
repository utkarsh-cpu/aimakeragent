import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Settings, Moon, Sun, MoreHorizontal, Menu, Search, Keyboard } from 'lucide-react';
import { Conversation } from '../types/conversation';
import { ChatSettings } from '../types/settings';

interface ChatHeaderProps {
  conversation?: Conversation;
  settings: ChatSettings;
  onSettingsChange: (settings: ChatSettings) => void;
  isDarkMode: boolean;
  onThemeToggle: (isDark: boolean) => void;
  onSettingsToggle: () => void;
  onSidebarToggle?: () => void;
  isMobile: boolean;
  showSearch?: boolean;
  onToggleSearch?: () => void;
  onShowKeyboardHelp?: () => void;
}

export function ChatHeader({
  conversation,
  settings,
  onSettingsChange,
  isDarkMode,
  onThemeToggle,
  onSettingsToggle,
  onSidebarToggle,
  isMobile,
  showSearch = false,
  onToggleSearch,
  onShowKeyboardHelp
}: ChatHeaderProps) {
  const models = [
    { value: 'gpt-4', label: 'GPT-4', badge: 'Most Capable' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', badge: 'Fast' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus', badge: 'Creative' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet', badge: 'Balanced' },
    { value: 'gemini-pro', label: 'Gemini Pro', badge: 'Google' },
  ];

  const messageCount = conversation?.messages.length || 0;
  const tokenEstimate = conversation?.messages.reduce((acc, msg) => acc + msg.content.length, 0) || 0;

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Sidebar Toggle - Always visible when callback provided */}
          {onSidebarToggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onSidebarToggle}
              className="shrink-0 h-9 w-9 hover:bg-accent/80 transition-colors duration-200"
              aria-label="Toggle sidebar"
              data-sidebar-toggle
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className={`font-semibold text-foreground truncate leading-tight ${
                isMobile ? 'text-base' : 'text-lg'
              }`}>
                {conversation?.title || 'New Chat'}
              </h1>
              {!isMobile && messageCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full border border-border/50 backdrop-blur-sm">
                  <span className="font-medium">{messageCount}</span>
                  <div className="w-1 h-1 bg-muted-foreground/40 rounded-full"></div>
                  <span>~{Math.ceil(tokenEstimate / 4)} tokens</span>
                </div>
              )}
            </div>
            {isMobile && messageCount > 0 && (
              <div className="text-xs text-muted-foreground mt-1 font-medium">
                {messageCount} messages • ~{Math.ceil(tokenEstimate / 4)} tokens
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Model Selection - Hidden on mobile */}
          {!isMobile && (
            <div className="flex items-center gap-3 mr-1">
              <Select 
                value={settings.model} 
                onValueChange={(value) => onSettingsChange({ ...settings, model: value })}
              >
                <SelectTrigger className="w-48 h-9 text-sm font-medium border-border/60 hover:border-border transition-colors duration-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-background/95 backdrop-blur-sm border-border/60">
                  {models.map((model) => (
                    <SelectItem key={model.value} value={model.value} className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.label}</span>
                        <Badge variant="outline" className="text-xs font-medium">
                          {model.badge}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Search Toggle */}
          {onToggleSearch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSearch}
              className={`h-9 w-9 hover:bg-accent/80 transition-all duration-200 ${
                showSearch ? 'bg-accent text-accent-foreground' : ''
              }`}
              aria-label="Toggle search"
            >
              <Search className="h-4 w-4 transition-transform duration-200 hover:scale-110" />
            </Button>
          )}

          {/* Theme Toggle - Hidden on mobile, moved to settings */}
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onThemeToggle(!isDarkMode)}
              className="h-9 w-9 hover:bg-accent/80 transition-all duration-200"
              aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? (
                <Sun className="h-4 w-4 transition-transform duration-200 hover:scale-110" />
              ) : (
                <Moon className="h-4 w-4 transition-transform duration-200 hover:scale-110" />
              )}
            </Button>
          )}

          {/* Keyboard Shortcuts Help */}
          {onShowKeyboardHelp && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onShowKeyboardHelp}
              className="h-9 w-9 hover:bg-accent/80 transition-all duration-200"
              aria-label="Show keyboard shortcuts (F1)"
              title="Keyboard shortcuts (F1)"
            >
              <Keyboard className="h-4 w-4 transition-transform duration-200 hover:scale-110" />
            </Button>
          )}

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettingsToggle}
            className="h-9 w-9 hover:bg-accent/80 transition-all duration-200"
            aria-label="Open settings"
            data-settings-toggle
          >
            <Settings className="h-4 w-4 transition-transform duration-200 hover:rotate-90" />
          </Button>

          {/* More Options - Hidden on mobile */}
          {!isMobile && (
            <Button 
              variant="ghost" 
              size="icon"
              className="h-9 w-9 hover:bg-accent/80 transition-colors duration-200"
              aria-label="More options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}