import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Check, X, History, AlertCircle, Undo2, Clock } from 'lucide-react';
import { cn } from './ui/utils';
import { InputValidator } from '../utils/validation';
import { Message } from '../types/conversation';

interface MessageEditorProps {
  message: Message;
  onSave: (messageId: string, newContent: string) => void;
  onCancel: () => void;
  isEditing: boolean;
  className?: string;
}

export function MessageEditor({
  message,
  onSave,
  onCancel,
  isEditing,
  className
}: MessageEditorProps) {
  const [content, setContent] = useState(message.content);
  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Set cursor to end of text
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  // Reset content when message changes
  useEffect(() => {
    setContent(message.content);
    setValidationError(null);
  }, [message.content]);

  const validateContent = (text: string): string | null => {
    // Use the validation utility
    const validation = InputValidator.validateMessage(text);
    if (!validation.isValid) {
      return validation.error || 'Invalid message content';
    }
    
    if (text.trim() === message.content.trim()) {
      return 'No changes made to the message';
    }
    
    return null;
  };

  const handleSave = async () => {
    const error = validateContent(content);
    if (error) {
      setValidationError(error);
      return;
    }

    setIsSaving(true);
    setValidationError(null);

    try {
      await onSave(message.id, content.trim());
    } catch (error) {
      setValidationError('Failed to save message. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setContent(message.content);
    setValidationError(null);
    setShowHistory(false);
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString([], { 
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isEditing) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Editor */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setValidationError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Edit your message..."
          className={cn(
            "min-h-[100px] resize-none",
            validationError && "border-destructive focus-visible:ring-destructive"
          )}
          disabled={isSaving}
        />
        
        {/* Character count */}
        <div className={cn(
          "absolute bottom-2 right-2 text-xs",
          content.length > 45000 ? "text-destructive" : 
          content.length > 40000 ? "text-yellow-600" : "text-muted-foreground"
        )}>
          {content.length.toLocaleString()}/50,000
        </div>
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={isSaving || !!validationError}
            size="sm"
            className="h-8"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-3 w-3 mr-2" />
                Save
              </>
            )}
          </Button>
          
          <Button
            onClick={handleCancel}
            disabled={isSaving}
            variant="outline"
            size="sm"
            className="h-8"
          >
            <X className="h-3 w-3 mr-2" />
            Cancel
          </Button>
        </div>

        {/* Edit History Toggle */}
        {message.editHistory && message.editHistory.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowHistory(!showHistory)}
              variant="ghost"
              size="sm"
              className="h-8"
            >
              <History className="h-3 w-3 mr-2" />
              History ({message.editHistory.length})
            </Button>
            
            {/* Restore to previous version */}
            <Button
              onClick={() => {
                const lastEdit = message.editHistory![message.editHistory!.length - 1];
                if (lastEdit) {
                  setContent(lastEdit.previousContent);
                  setValidationError(null);
                }
              }}
              variant="ghost"
              size="sm"
              className="h-8"
              title="Restore to previous version"
            >
              <Undo2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Edit History */}
      {showHistory && message.editHistory && message.editHistory.length > 0 && (
        <div className="border rounded-lg p-3 bg-muted/30">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <History className="h-4 w-4" />
            Edit History
            <Badge variant="secondary" className="text-xs ml-auto">
              {message.editHistory.length} edit{message.editHistory.length !== 1 ? 's' : ''}
            </Badge>
          </h4>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {message.editHistory.map((edit, index) => (
              <div key={edit.id} className="border rounded-lg p-3 bg-background/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Version #{message.editHistory!.length - index}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTime(edit.timestamp)}
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setContent(edit.previousContent);
                      setValidationError(null);
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    title="Restore this version"
                  >
                    <Undo2 className="h-3 w-3 mr-1" />
                    Restore
                  </Button>
                </div>
                <div className="bg-muted/50 rounded p-2 text-xs font-mono max-h-20 overflow-y-auto">
                  {edit.previousContent}
                </div>
                {edit.reason && (
                  <div className="text-xs text-muted-foreground italic mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {edit.reason}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {edit.previousContent.length} characters
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      <div className="text-xs text-muted-foreground">
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+Enter</kbd> to save, {' '}
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Esc</kbd> to cancel
      </div>
    </div>
  );
}