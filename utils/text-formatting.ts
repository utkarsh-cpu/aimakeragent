import { marked } from 'marked';

// Configure marked for safe HTML rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

export interface TextSelection {
  start: number;
  end: number;
  text: string;
}

export interface FormatAction {
  id: string;
  label: string;
  icon: string;
  shortcut: string;
  before: string;
  after: string;
  block?: boolean;
}

export const formatActions: FormatAction[] = [
  {
    id: 'bold',
    label: 'Bold',
    icon: 'Bold',
    shortcut: 'Ctrl+B',
    before: '**',
    after: '**',
  },
  {
    id: 'italic',
    label: 'Italic',
    icon: 'Italic',
    shortcut: 'Ctrl+I',
    before: '*',
    after: '*',
  },
  {
    id: 'code',
    label: 'Inline Code',
    icon: 'Code',
    shortcut: 'Ctrl+`',
    before: '`',
    after: '`',
  },
  {
    id: 'codeblock',
    label: 'Code Block',
    icon: 'FileCode',
    shortcut: 'Ctrl+Shift+`',
    before: '```\n',
    after: '\n```',
    block: true,
  },
  {
    id: 'quote',
    label: 'Quote',
    icon: 'Quote',
    shortcut: 'Ctrl+>',
    before: '> ',
    after: '',
    block: true,
  },
  {
    id: 'list',
    label: 'Bullet List',
    icon: 'List',
    shortcut: 'Ctrl+L',
    before: '- ',
    after: '',
    block: true,
  },
  {
    id: 'numberedlist',
    label: 'Numbered List',
    icon: 'ListOrdered',
    shortcut: 'Ctrl+Shift+L',
    before: '1. ',
    after: '',
    block: true,
  },
];

export class TextFormatter {
  static insertFormatting(
    text: string,
    selection: TextSelection,
    action: FormatAction
  ): { text: string; selection: TextSelection } {
    const { start, end } = selection;
    const selectedText = text.substring(start, end);
    
    if (action.block) {
      return this.insertBlockFormatting(text, selection, action);
    }
    
    // Check if text is already formatted
    const beforeStart = start - action.before.length;
    const afterEnd = end + action.after.length;
    
    if (
      beforeStart >= 0 &&
      afterEnd <= text.length &&
      text.substring(beforeStart, start) === action.before &&
      text.substring(end, afterEnd) === action.after
    ) {
      // Remove formatting
      const newText = 
        text.substring(0, beforeStart) +
        selectedText +
        text.substring(afterEnd);
      
      return {
        text: newText,
        selection: {
          start: beforeStart,
          end: beforeStart + selectedText.length,
          text: selectedText,
        },
      };
    }
    
    // Add formatting
    const newText =
      text.substring(0, start) +
      action.before +
      selectedText +
      action.after +
      text.substring(end);
    
    return {
      text: newText,
      selection: {
        start: start + action.before.length,
        end: end + action.before.length,
        text: selectedText,
      },
    };
  }
  
  private static insertBlockFormatting(
    text: string,
    selection: TextSelection,
    action: FormatAction
  ): { text: string; selection: TextSelection } {
    const lines = text.split('\n');
    const { start, end } = selection;
    
    // Find line numbers for selection
    let currentPos = 0;
    let startLine = 0;
    let endLine = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1; // +1 for newline
      if (currentPos <= start && start < currentPos + lineLength) {
        startLine = i;
      }
      if (currentPos <= end && end < currentPos + lineLength) {
        endLine = i;
        break;
      }
      currentPos += lineLength;
    }
    
    // Apply formatting to selected lines
    const modifiedLines = [...lines];
    for (let i = startLine; i <= endLine; i++) {
      if (action.id === 'quote') {
        if (modifiedLines[i].startsWith('> ')) {
          modifiedLines[i] = modifiedLines[i].substring(2);
        } else {
          modifiedLines[i] = '> ' + modifiedLines[i];
        }
      } else if (action.id === 'list') {
        if (modifiedLines[i].match(/^- /)) {
          modifiedLines[i] = modifiedLines[i].substring(2);
        } else {
          modifiedLines[i] = '- ' + modifiedLines[i];
        }
      } else if (action.id === 'numberedlist') {
        if (modifiedLines[i].match(/^\d+\. /)) {
          modifiedLines[i] = modifiedLines[i].replace(/^\d+\. /, '');
        } else {
          modifiedLines[i] = `${i - startLine + 1}. ${modifiedLines[i]}`;
        }
      } else if (action.id === 'codeblock') {
        // For code blocks, wrap the entire selection
        if (i === startLine) {
          modifiedLines[i] = action.before + modifiedLines[i];
        }
        if (i === endLine) {
          modifiedLines[i] = modifiedLines[i] + action.after;
        }
      }
    }
    
    const newText = modifiedLines.join('\n');
    
    return {
      text: newText,
      selection: {
        start: selection.start,
        end: selection.end + (newText.length - text.length),
        text: newText.substring(selection.start, selection.end + (newText.length - text.length)),
      },
    };
  }
  
  static renderMarkdown(text: string): string {
    try {
      return marked(text) as string;
    } catch (error) {
      console.error('Markdown rendering error:', error);
      return text;
    }
  }
  
  static getSelection(textarea: HTMLTextAreaElement): TextSelection {
    return {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
      text: textarea.value.substring(textarea.selectionStart, textarea.selectionEnd),
    };
  }
  
  static setSelection(textarea: HTMLTextAreaElement, selection: TextSelection): void {
    textarea.focus();
    textarea.setSelectionRange(selection.start, selection.end);
  }
  
  static estimateTokens(text: string): number {
    // More sophisticated token estimation
    // Based on OpenAI's tokenization patterns
    
    // Remove markdown formatting for more accurate count
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1')     // Italic
      .replace(/`(.*?)`/g, '$1')       // Inline code
      .replace(/```[\s\S]*?```/g, (match) => {
        // Code blocks: count lines and content separately
        const lines = match.split('\n').length;
        return match.replace(/```/g, '').trim();
      })
      .replace(/#{1,6}\s/g, '')        // Headers
      .replace(/>\s/g, '')             // Quotes
      .replace(/[-*+]\s/g, '')         // Lists
      .replace(/\d+\.\s/g, '');        // Numbered lists
    
    // Split by common token boundaries
    const words = cleanText.split(/\s+/).filter(word => word.length > 0);
    const punctuation = (cleanText.match(/[.,!?;:()[\]{}'"]/g) || []).length;
    
    // Estimate tokens: ~0.75 tokens per word + punctuation + whitespace
    const wordTokens = words.reduce((count, word) => {
      // Longer words typically use more tokens
      if (word.length <= 4) return count + 1;
      if (word.length <= 8) return count + 1.5;
      return count + 2;
    }, 0);
    
    return Math.ceil(wordTokens + punctuation * 0.5);
  }
  
  static validateInput(text: string, maxTokens: number, attachments?: any[]): {
    isValid: boolean;
    tokenCount: number;
    isNearLimit: boolean;
    isOverLimit: boolean;
    suggestions?: string[];
    attachmentTokens?: number;
    totalTokens?: number;
  } {
    const textTokens = this.estimateTokens(text);
    
    // Estimate tokens for attachments
    let attachmentTokens = 0;
    if (attachments && attachments.length > 0) {
      attachmentTokens = attachments.reduce((total, attachment) => {
        // Text files contribute their content tokens
        if (attachment.content) {
          return total + this.estimateTokens(attachment.content);
        }
        // Images and other files have a base token cost
        if (attachment.type.startsWith('image/')) {
          return total + 85; // Approximate tokens for image processing
        }
        // Other files have minimal token cost
        return total + 10;
      }, 0);
    }
    
    const totalTokens = textTokens + attachmentTokens;
    const isNearLimit = totalTokens > maxTokens * 0.8;
    const isOverLimit = totalTokens > maxTokens;
    
    const suggestions: string[] = [];
    
    if (isOverLimit) {
      const excessTokens = totalTokens - maxTokens;
      suggestions.push(`Reduce content by approximately ${excessTokens} tokens`);
      
      if (attachmentTokens > 0) {
        suggestions.push('Consider removing some attachments');
        if (attachments?.some(a => a.content)) {
          suggestions.push('Large text files contribute significantly to token count');
        }
      }
      
      if (textTokens > maxTokens * 0.5) {
        suggestions.push('Consider breaking message into multiple parts');
        suggestions.push('Remove unnecessary formatting or repetitive content');
      }
      
      // Specific suggestions based on content analysis
      if (text.includes('```')) {
        suggestions.push('Code blocks use many tokens - consider shortening');
      }
      
      const longWords = text.split(/\s+/).filter(word => word.length > 15);
      if (longWords.length > 0) {
        suggestions.push('Very long words/URLs increase token usage');
      }
      
    } else if (isNearLimit) {
      suggestions.push('Approaching token limit');
      suggestions.push('Consider keeping content concise');
      
      if (attachmentTokens > maxTokens * 0.3) {
        suggestions.push('Attachments are using significant tokens');
      }
    }
    
    return {
      isValid: !isOverLimit,
      tokenCount: textTokens,
      isNearLimit,
      isOverLimit,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      attachmentTokens,
      totalTokens,
    };
  }
  
  static getSmartTruncationSuggestions(text: string, targetTokens: number): {
    suggestions: string[];
    truncatedText?: string;
  } {
    const currentTokens = this.estimateTokens(text);
    const suggestions: string[] = [];
    
    if (currentTokens <= targetTokens) {
      return { suggestions: ['Text is within token limit'] };
    }
    
    const excessTokens = currentTokens - targetTokens;
    const reductionRatio = targetTokens / currentTokens;
    
    // Suggest specific reduction strategies
    if (text.includes('```')) {
      suggestions.push('Shorten code blocks or use key excerpts only');
    }
    
    if (text.split('\n').length > 10) {
      suggestions.push('Remove less important paragraphs or sections');
    }
    
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 5) {
      const keepSentences = Math.floor(sentences.length * reductionRatio);
      suggestions.push(`Consider keeping only ${keepSentences} most important sentences`);
      
      // Create a truncated version
      const truncatedText = sentences.slice(0, keepSentences).join('. ') + '.';
      return { suggestions, truncatedText };
    }
    
    // Character-based truncation as fallback
    const targetLength = Math.floor(text.length * reductionRatio);
    const truncatedText = text.substring(0, targetLength) + '...';
    suggestions.push(`Reduce to approximately ${targetLength} characters`);
    
    return { suggestions, truncatedText };
  }
}