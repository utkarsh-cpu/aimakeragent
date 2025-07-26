import { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Keyboard, Search, X } from 'lucide-react';
import { Input } from './ui/input';
import { KeyboardShortcut } from '../hooks/use-keyboard-navigation';

interface KeyboardShortcutsHelpProps {
  shortcuts: KeyboardShortcut[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function KeyboardShortcutsHelp({ 
  shortcuts, 
  trigger,
  open,
  onOpenChange 
}: KeyboardShortcutsHelpProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Group shortcuts by category
  const shortcutsByCategory = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  const categories = ['all', ...Object.keys(shortcutsByCategory)];

  // Filter shortcuts based on search and category
  const filteredShortcuts = shortcuts.filter(shortcut => {
    const matchesSearch = searchTerm === '' || 
      shortcut.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shortcut.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shortcut.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || shortcut.category === selectedCategory;
    
    return matchesSearch && matchesCategory && !shortcut.disabled;
  });

  // Format shortcut key combination
  const formatShortcut = (shortcut: KeyboardShortcut) => {
    const parts: string[] = [];
    
    if (shortcut.ctrlKey || shortcut.metaKey) {
      parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
    }
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.altKey) parts.push('Alt');
    parts.push(shortcut.key === ' ' ? 'Space' : shortcut.key.toUpperCase());
    
    return parts;
  };

  const defaultTrigger = (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0"
      title="Keyboard shortcuts (F1)"
      aria-label="Show keyboard shortcuts"
    >
      <Keyboard className="h-4 w-4" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-4">
          {/* Search and Filter */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shortcuts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Category Tabs */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="grid w-full grid-cols-6 mb-4">
              {categories.map(category => (
                <TabsTrigger 
                  key={category} 
                  value={category}
                  className="text-xs"
                >
                  {category === 'all' ? 'All' : category}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-0">
              <ScrollArea className="h-[400px] pr-4">
                {selectedCategory === 'all' ? (
                  // Show all categories
                  <div className="space-y-6">
                    {Object.entries(shortcutsByCategory).map(([category, categoryShortcuts]) => {
                      const visibleShortcuts = categoryShortcuts.filter(shortcut => 
                        !shortcut.disabled && (
                          searchTerm === '' || 
                          shortcut.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          shortcut.key.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                      );

                      if (visibleShortcuts.length === 0) return null;

                      return (
                        <div key={category}>
                          <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                            {category}
                          </h3>
                          <div className="space-y-2">
                            {visibleShortcuts.map((shortcut, index) => (
                              <div
                                key={`${category}-${index}`}
                                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                              >
                                <span className="text-sm">{shortcut.description}</span>
                                <div className="flex items-center gap-1">
                                  {formatShortcut(shortcut).map((key, keyIndex) => (
                                    <Badge
                                      key={keyIndex}
                                      variant="outline"
                                      className="text-xs font-mono px-2 py-1"
                                    >
                                      {key}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Show specific category
                  <div className="space-y-2">
                    {filteredShortcuts
                      .filter(shortcut => shortcut.category === selectedCategory)
                      .map((shortcut, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <span className="text-sm">{shortcut.description}</span>
                          <div className="flex items-center gap-1">
                            {formatShortcut(shortcut).map((key, keyIndex) => (
                              <Badge
                                key={keyIndex}
                                variant="outline"
                                className="text-xs font-mono px-2 py-1"
                              >
                                {key}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {filteredShortcuts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Keyboard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No shortcuts found matching your search.</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer with tips */}
        <div className="border-t bg-muted/30 px-6 py-4">
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Tips:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Use <Badge variant="outline" className="text-xs">Tab</Badge> and <Badge variant="outline" className="text-xs">Shift+Tab</Badge> to navigate between elements</li>
              <li>Use <Badge variant="outline" className="text-xs">Arrow Keys</Badge> to navigate messages and sidebar items</li>
              <li>Press <Badge variant="outline" className="text-xs">Escape</Badge> to cancel actions or close dialogs</li>
              <li>Most shortcuts work globally, but some require focus on specific elements</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Quick shortcuts reference component
export function QuickShortcutsReference() {
  const quickShortcuts = [
    { key: 'Ctrl+I', description: 'Focus input' },
    { key: 'Ctrl+N', description: 'New chat' },
    { key: 'Ctrl+F', description: 'Search' },
    { key: 'F1', description: 'Help' },
  ];

  return (
    <div className="fixed bottom-4 right-4 bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg z-50">
      <div className="text-xs font-medium mb-2">Quick Shortcuts</div>
      <div className="space-y-1">
        {quickShortcuts.map((shortcut, index) => (
          <div key={index} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{shortcut.description}</span>
            <Badge variant="outline" className="text-xs font-mono">
              {shortcut.key}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}