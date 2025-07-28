import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { MarkdownPreview } from './MarkdownPreview';
import { AttachmentManager, type Attachment } from './AttachmentManager';
import { VoiceInput } from './VoiceInput';
import { TextFormatter, formatActions } from '../utils/text-formatting';
import {
  useDebounce,
  useDebounceCallback,
  usePerformanceMonitor
} from '../utils/debounce';
import {
  Send,
  Mic,
  MoreHorizontal,
  Eye,
  Edit3,
  FileCode,
  Quote,
  List,
  ListOrdered,
  Bold,
  Italic,
  Code
} from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSendMessage: (message: string, attachments?: Attachment[]) => void;
  disabled?: boolean;
  isMobile?: boolean;
  maxTokens?: number;
  enableVoiceInput?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSendMessage,
  disabled,
  isMobile = false,
  maxTokens = 4000,
  enableVoiceInput = true
}: ChatInputProps) {
  const [isFormatMenuOpen, setIsFormatMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activeTab, setActiveTab] = useState<'write' | 'preview' | 'voice'>('write');
  const [showPreview, setShowPreview] = useState(false);
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Performance monitoring
  usePerformanceMonitor('ChatInput', 16);

  // Debounced value for validation
  const debouncedValue = useDebounce(value, 100);

  // Debounced attachments for validation
  const debouncedAttachments = useDebounce(attachments, 150);

  // Memoize validation with render optimization
  const validation = useMemo(() => {
    return TextFormatter.validateInput(debouncedValue, maxTokens, debouncedAttachments);
  }, [debouncedValue, maxTokens, debouncedAttachments]);

  const { tokenCount, isNearLimit, isOverLimit, suggestions, attachmentTokens, totalTokens } = validation;



  const getIconComponent = (iconName: string) => {
    const icons = {
      Bold,
      Italic,
      Code,
      FileCode,
      Quote,
      List,
      ListOrdered,
    };
    return icons[iconName as keyof typeof icons] || Code;
  };

  const applyFormatting = (actionId: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const action = formatActions.find(a => a.id === actionId);
    if (!action) return;

    const selection = TextFormatter.getSelection(textarea);
    const result = TextFormatter.insertFormatting(value, selection, action);

    onChange(result.text);

    // Reset cursor position
    setTimeout(() => {
      TextFormatter.setSelection(textarea, result.selection);
    }, 0);
  };

  const handleSend = () => {
    if ((value.trim() || attachments.length > 0) && !disabled && !isOverLimit) {
      onSendMessage(value, attachments.length > 0 ? attachments : undefined);
      setAttachments([]); // Clear attachments after sending
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    // Format shortcuts
    if (e.ctrlKey || e.metaKey) {
      const action = formatActions.find(a => {
        const shortcut = a.shortcut.toLowerCase();
        if (shortcut.includes('shift') && !e.shiftKey) return false;
        if (!shortcut.includes('shift') && e.shiftKey) return false;

        if (shortcut.includes('ctrl+b') && e.key === 'b') return true;
        if (shortcut.includes('ctrl+i') && e.key === 'i') return true;
        if (shortcut.includes('ctrl+`') && e.key === '`') return true;
        if (shortcut.includes('ctrl+>') && e.key === '>') return true;
        if (shortcut.includes('ctrl+l') && e.key === 'l') return true;

        return false;
      });

      if (action) {
        e.preventDefault();
        applyFormatting(action.id);
      }
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    setShowVoiceInput(!showVoiceInput);
  };

  const handleVoiceTranscript = (transcript: string) => {
    onChange(value + transcript);
    setShowVoiceInput(false);
  };

  // Debounced auto-resize textarea to improve performance during typing
  const debouncedAutoResize = useDebounceCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, 100);

  useEffect(() => {
    debouncedAutoResize();
  }, [value, debouncedAutoResize]);

  const canSend = (value.trim() || attachments.length > 0) && !disabled && !isOverLimit;

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Enhanced Formatting Toolbar - Hidden on mobile */}
        {!isMobile && (
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="flex items-center gap-1">
              {formatActions.slice(0, 6).map((action) => {
                const IconComponent = getIconComponent(action.icon);
                return (
                  <Button
                    key={action.id}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => applyFormatting(action.id)}
                    title={`${action.label} (${action.shortcut})`}
                  >
                    <IconComponent className="h-3 w-3" />
                  </Button>
                );
              })}
            </div>

            <div className="h-4 w-px bg-border mx-1" />

            {/* Preview Toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setShowPreview(!showPreview)}
              title="Toggle Preview"
            >
              {showPreview ? <Edit3 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>

            {/* Voice Input Toggle */}
            {enableVoiceInput && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2 ${showVoiceInput ? 'bg-accent text-accent-foreground' : ''}`}
                onClick={() => {
                  setShowVoiceInput(!showVoiceInput);
                  if (!showVoiceInput) {
                    setActiveTab('voice');
                  }
                }}
                title="Toggle Voice Input"
              >
                <Mic className="h-3 w-3" />
              </Button>
            )}

            <Popover open={isFormatMenuOpen} onOpenChange={setIsFormatMenuOpen}>
              <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-7 px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
                <MoreHorizontal className="h-3 w-3" />
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" side="top">
                <div className="text-xs text-muted-foreground p-2">
                  <div className="font-medium mb-2">Keyboard Shortcuts:</div>
                  <div className="space-y-1">
                    {formatActions.map((action) => (
                      <div key={action.id} className="flex justify-between">
                        <span>{action.label}</span>
                        <span className="font-mono">{action.shortcut}</span>
                      </div>
                    ))}
                    <div className="border-t border-border my-2" />
                    <div className="flex justify-between">
                      <span>Send</span>
                      <span className="font-mono">Enter</span>
                    </div>
                    <div className="flex justify-between">
                      <span>New Line</span>
                      <span className="font-mono">Shift+Enter</span>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex-1" />

            {/* Enhanced Token Counter with Suggestions */}
            <div className="flex items-center gap-2">
              {suggestions && (
                <Popover>
                  <PopoverTrigger>
                    <Badge
                      variant={isOverLimit ? "destructive" : "outline"}
                      className="text-xs cursor-pointer"
                    >
                      !
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" side="top">
                    <div className="text-sm">
                      <div className="font-medium mb-2">Suggestions:</div>
                      <ul className="space-y-1 text-muted-foreground">
                        {suggestions.map((suggestion, index) => (
                          <li key={index} className="text-xs">• {suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <Badge
                variant={isNearLimit ? (isOverLimit ? "destructive" : "outline") : "secondary"}
                className="text-xs"
              >
                {totalTokens || tokenCount}/{maxTokens} tokens
                {attachmentTokens && attachmentTokens > 0 && (
                  <span className="ml-1 text-muted-foreground">
                    ({tokenCount}+{attachmentTokens})
                  </span>
                )}
              </Badge>
            </div>
          </div>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mb-3">
            <AttachmentManager
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              disabled={disabled}
            />
          </div>
        )}

        {/* Input Area with Preview and Voice Support */}
        <div className="bg-muted/30 rounded-xl border border-border/50">
          {(showPreview || showVoiceInput) && !isMobile ? (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'write' | 'preview' | 'voice')} className="w-full">
              <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <TabsList className={`grid h-7 ${showVoiceInput ? 'w-48 grid-cols-3' : 'w-32 grid-cols-2'}`}>
                  <TabsTrigger value="write" className="text-xs">Write</TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
                  {enableVoiceInput && showVoiceInput && (
                    <TabsTrigger value="voice" className="text-xs">Voice</TabsTrigger>
                  )}
                </TabsList>
                <div className="flex items-center gap-2">
                  {suggestions && (
                    <Popover>
                      <PopoverTrigger>
                        <Badge
                          variant={isOverLimit ? "destructive" : "outline"}
                          className="text-xs cursor-pointer"
                        >
                          !
                        </Badge>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3" side="top">
                        <div className="text-sm">
                          <div className="font-medium mb-2">Suggestions:</div>
                          <ul className="space-y-1 text-muted-foreground">
                            {suggestions.map((suggestion, index) => (
                              <li key={index} className="text-xs">• {suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                  <Badge
                    variant={isNearLimit ? (isOverLimit ? "destructive" : "outline") : "secondary"}
                    className="text-xs"
                  >
                    {totalTokens || tokenCount}/{maxTokens}
                    {attachmentTokens && attachmentTokens > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        ({tokenCount}+{attachmentTokens})
                      </span>
                    )}
                  </Badge>
                </div>
              </div>

              <TabsContent value="write" className="mt-0 p-3 pt-2">
                <div className="flex items-end gap-3">
                  <AttachmentManager
                    attachments={attachments}
                    onAttachmentsChange={setAttachments}
                    disabled={disabled}
                    className="flex-shrink-0"
                  />

                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type your message with markdown formatting..."
                      className={`w-full px-4 py-3 border-0 bg-transparent focus:outline-none resize-none min-h-[44px] max-h-[200px] placeholder:text-muted-foreground/70 ${isOverLimit ? 'text-destructive' : ''
                        }`}
                      disabled={disabled}
                      data-chat-input
                      aria-label="Chat message input"
                      aria-describedby="token-counter"
                    />
                  </div>

                  <Button
                    onClick={handleSend}
                    disabled={!canSend}
                    className={`h-9 w-9 p-0 shrink-0 rounded-lg transition-all duration-200 ${canSend
                        ? 'bg-primary hover:bg-primary/90 shadow-sm'
                        : 'bg-muted hover:bg-muted/80'
                      }`}
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-0 p-3 pt-2">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-h-[44px] max-h-[200px] overflow-y-auto">
                    <MarkdownPreview content={value} className="text-sm" />
                  </div>
                  <Button
                    onClick={handleSend}
                    disabled={!canSend}
                    className={`h-9 w-9 p-0 shrink-0 rounded-lg transition-all duration-200 ${canSend
                        ? 'bg-primary hover:bg-primary/90 shadow-sm'
                        : 'bg-muted hover:bg-muted/80'
                      }`}
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

              {enableVoiceInput && showVoiceInput && (
                <TabsContent value="voice" className="mt-0 p-3 pt-2">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-h-[44px]">
                      <VoiceInput
                        onTranscript={handleVoiceTranscript}
                        disabled={disabled}
                        autoSend={false}
                        continuous={true}
                      />
                    </div>
                    <Button
                      onClick={handleSend}
                      disabled={!canSend}
                      className={`h-9 w-9 p-0 shrink-0 rounded-lg transition-all duration-200 ${canSend
                          ? 'bg-primary hover:bg-primary/90 shadow-sm'
                          : 'bg-muted hover:bg-muted/80'
                        }`}
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          ) : (
            <div className="flex items-end gap-3 p-3">
              <AttachmentManager
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                disabled={disabled}
                className="flex-shrink-0"
              />

              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isMobile ? "Type your message..." : "Type your message with markdown... (Shift+Enter for new line)"}
                  className={`w-full px-4 py-3 pr-12 border-0 bg-transparent focus:outline-none resize-none min-h-[44px] max-h-[200px] placeholder:text-muted-foreground/70 ${isOverLimit ? 'text-destructive' : ''
                    } ${isMobile ? 'text-base' : ''}`}
                  disabled={disabled}
                  data-chat-input
                  aria-label="Chat message input"
                  aria-describedby="token-counter"
                />

                {(isMobile || !value.trim()) && enableVoiceInput && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`absolute right-2 top-2 h-6 w-6 p-0 ${isRecording ? 'text-red-500 animate-pulse' : ''
                      }`}
                    onClick={toggleRecording}
                    title="Voice input"
                    aria-label="Toggle voice input"
                  >
                    <Mic className="h-3 w-3" />
                  </Button>
                )}

                {isMobile && (
                  <div className="absolute right-2 bottom-2">
                    <Badge
                      variant={isNearLimit ? (isOverLimit ? "destructive" : "outline") : "secondary"}
                      className="text-xs"
                    >
                      {totalTokens || tokenCount}
                    </Badge>
                  </div>
                )}
              </div>

              <Button
                onClick={handleSend}
                disabled={!canSend}
                className={`h-9 w-9 p-0 shrink-0 rounded-lg transition-all duration-200 ${canSend
                    ? 'bg-primary hover:bg-primary/90 shadow-sm'
                    : 'bg-muted hover:bg-muted/80'
                  }`}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Voice Input for Mobile */}
        {isMobile && showVoiceInput && enableVoiceInput && (
          <div className="mt-3">
            <VoiceInput
              onTranscript={handleVoiceTranscript}
              disabled={disabled}
              autoSend={false}
              continuous={true}
            />
          </div>
        )}

        {/* Error Message with Smart Suggestions */}
        {isOverLimit && (
          <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive font-medium mb-2">
              Content exceeds token limit by {(totalTokens || tokenCount) - maxTokens} tokens
            </p>
            {suggestions && suggestions.length > 0 && (
              <div className="text-xs text-destructive/80">
                <p className="font-medium mb-1">Suggestions:</p>
                <ul className="space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <li key={index}>• {suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
            {attachmentTokens && attachmentTokens > 0 && (
              <p className="text-xs text-destructive/80 mt-2">
                Attachments are using {attachmentTokens} tokens
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}