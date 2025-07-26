import { useState } from 'react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Plus, Settings, FileText, Image, Code, HelpCircle, Camera, Mic, MoreHorizontal, Send } from 'lucide-react';

export function ChatInterface() {
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInputMenuOpen, setIsInputMenuOpen] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [message, setMessage] = useState('');

  const models = [
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
    { value: 'gemini-pro', label: 'Gemini Pro' },
  ];

  const menuItems = [
    { icon: FileText, label: 'New Document', action: () => console.log('New Document') },
    { icon: Image, label: 'Upload Image', action: () => console.log('Upload Image') },
    { icon: Code, label: 'Code Mode', action: () => console.log('Code Mode') },
    { icon: Settings, label: 'Settings', action: () => console.log('Settings') },
    { icon: HelpCircle, label: 'Help', action: () => console.log('Help') },
  ];

  const attachmentItems = [
    { icon: FileText, label: 'Attach File', action: () => console.log('Attach File') },
    { icon: Image, label: 'Upload Image', action: () => console.log('Upload Image') },
    { icon: Camera, label: 'Take Photo', action: () => console.log('Take Photo') },
    { icon: Mic, label: 'Voice Message', action: () => console.log('Voice Message') },
    { icon: Code, label: 'Code Snippet', action: () => console.log('Code Snippet') },
  ];

  const optionsItems = [
    { icon: Settings, label: 'Chat Settings', action: () => console.log('Chat Settings') },
    { icon: FileText, label: 'Save Chat', action: () => console.log('Save Chat') },
    { icon: HelpCircle, label: 'Help', action: () => console.log('Help') },
  ];

  const handleSendMessage = () => {
    if (message.trim()) {
      console.log('Sending message:', message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header with model dropdown and plus menu */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-4">
          <h1>Chat</h1>

          {/* Model Selection Dropdown */}
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Plus Menu (Drop Up) */}
        <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
            <Plus className="h-4 w-4" />
          </PopoverTrigger>
          <PopoverContent
            className="w-56 p-2"
            side="top"
            align="end"
            sideOffset={8}
          >
            <div className="space-y-1">
              {menuItems.map((item, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className="w-full justify-start gap-2 h-10"
                  onClick={() => {
                    item.action();
                    setIsMenuOpen(false);
                  }}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Sample messages */}
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-3 max-w-[80%]">
              <p className="text-muted-foreground mb-1">Assistant</p>
              <p>Hello! I'm ready to help you with any questions or tasks. What would you like to chat about today?</p>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="bg-primary text-primary-foreground rounded-lg p-3 max-w-[80%]">
              <p className="opacity-80 mb-1">You</p>
              <p>Hi there! Can you help me understand how this chat interface works?</p>
            </div>
          </div>

          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-3 max-w-[80%]">
              <p className="text-muted-foreground mb-1">Assistant</p>
              <p>Of course! This chat interface features a model selector dropdown at the top where you can choose between different AI models like GPT-4, Claude, and others. The plus button opens a menu with additional options like uploading images, switching to code mode, and accessing settings.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-2">
            {/* Attachment Menu */}
            <Popover open={isInputMenuOpen} onOpenChange={setIsInputMenuOpen}>
              <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 mb-2">
                <Plus className="h-4 w-4" />
              </PopoverTrigger>
              <PopoverContent
                className="w-56 p-2"
                side="top"
                align="start"
                sideOffset={8}
              >
                <div className="space-y-1">
                  {attachmentItems.map((item, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      className="w-full justify-start gap-2 h-10"
                      onClick={() => {
                        item.action();
                        setIsInputMenuOpen(false);
                      }}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Text Input */}
            <div className="flex-1 relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="w-full px-3 py-2 pr-12 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-ring resize-none min-h-[44px] max-h-32"
                rows={1}
                style={{
                  height: 'auto',
                  minHeight: '44px',
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
              />

              {/* Options Menu in Input */}
              <div className="absolute right-2 top-2">
                <Popover open={isOptionsMenuOpen} onOpenChange={setIsOptionsMenuOpen}>
                  <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-full hover:bg-accent hover:text-accent-foreground h-6 w-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
                    <MoreHorizontal className="h-3 w-3" />
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-48 p-2"
                    side="top"
                    align="end"
                    sideOffset={8}
                  >
                    <div className="space-y-1">
                      {optionsItems.map((item, index) => (
                        <Button
                          key={index}
                          variant="ghost"
                          className="w-full justify-start gap-2 h-9"
                          onClick={() => {
                            item.action();
                            setIsOptionsMenuOpen(false);
                          }}
                        >
                          <item.icon className="h-3 w-3" />
                          {item.label}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Send Button */}
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim()}
              className="h-10 w-10 p-0 mb-2"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}