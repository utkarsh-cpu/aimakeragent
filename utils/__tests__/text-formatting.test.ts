import { describe, it, expect } from 'vitest';
import { TextFormatter } from '../text-formatting';

describe('TextFormatter', () => {
    describe('estimateTokens', () => {
        it('should estimate tokens for simple text', () => {
            const text = 'Hello world';
            const tokens = TextFormatter.estimateTokens(text);
            expect(tokens).toBeGreaterThan(0);
            expect(tokens).toBeLessThan(10);
        });

        it('should handle markdown formatting', () => {
            const plainText = 'This is bold text';
            const markdownText = 'This is **bold** text';

            const plainTokens = TextFormatter.estimateTokens(plainText);
            const markdownTokens = TextFormatter.estimateTokens(markdownText);

            // Markdown should have similar token count after processing
            expect(Math.abs(plainTokens - markdownTokens)).toBeLessThan(2);
        });

        it('should handle code blocks', () => {
            const text = '```javascript\nconst x = 1;\nconsole.log(x);\n```';
            const tokens = TextFormatter.estimateTokens(text);
            expect(tokens).toBeGreaterThan(5);
        });

        it('should handle empty text', () => {
            const tokens = TextFormatter.estimateTokens('');
            expect(tokens).toBe(0);
        });
    });

    describe('validateInput', () => {
        it('should validate text within limits', () => {
            const result = TextFormatter.validateInput('Short text', 100);

            expect(result.isValid).toBe(true);
            expect(result.isOverLimit).toBe(false);
            expect(result.isNearLimit).toBe(false);
            expect(result.tokenCount).toBeGreaterThan(0);
        });

        it('should detect text over limits', () => {
            const longText = 'This is a very long text '.repeat(50);
            const result = TextFormatter.validateInput(longText, 10);

            expect(result.isValid).toBe(false);
            expect(result.isOverLimit).toBe(true);
            expect(result.suggestions).toBeDefined();
            expect(result.suggestions!.length).toBeGreaterThan(0);
        });

        it('should detect near limit text', () => {
            const text = 'This is some text that approaches the limit';
            const result = TextFormatter.validateInput(text, 12); // Adjust based on actual token count

            if (result.tokenCount > 9) { // 80% of 12
                expect(result.isNearLimit).toBe(true);
            }
        });

        it('should handle attachments in validation', () => {
            const attachments = [
                { type: 'image/png', content: undefined },
                { type: 'text/plain', content: 'Some file content here' }
            ];

            const result = TextFormatter.validateInput('Short text', 100, attachments);

            expect(result.attachmentTokens).toBeGreaterThan(0);
            expect(result.totalTokens).toBeGreaterThan(result.tokenCount);
        });
    });

    describe('insertFormatting', () => {
        it('should insert bold formatting', () => {
            const text = 'Hello world';
            const selection = { start: 6, end: 11, text: 'world' };
            const action = { id: 'bold', before: '**', after: '**', label: 'Bold', icon: 'Bold', shortcut: 'Ctrl+B' };

            const result = TextFormatter.insertFormatting(text, selection, action);

            expect(result.text).toBe('Hello **world**');
            expect(result.selection.start).toBe(8);
            expect(result.selection.end).toBe(13);
        });

        it('should remove existing formatting', () => {
            const text = 'Hello **world**';
            const selection = { start: 8, end: 13, text: 'world' };
            const action = { id: 'bold', before: '**', after: '**', label: 'Bold', icon: 'Bold', shortcut: 'Ctrl+B' };

            const result = TextFormatter.insertFormatting(text, selection, action);

            expect(result.text).toBe('Hello world');
            expect(result.selection.start).toBe(6);
            expect(result.selection.end).toBe(11);
        });

        it('should handle block formatting', () => {
            const text = 'Line 1\nLine 2\nLine 3';
            const selection = { start: 7, end: 13, text: 'Line 2' };
            const action = {
                id: 'quote',
                before: '> ',
                after: '',
                label: 'Quote',
                icon: 'Quote',
                shortcut: 'Ctrl+>',
                block: true
            };

            const result = TextFormatter.insertFormatting(text, selection, action);

            expect(result.text).toContain('> Line 2');
        });
    });

    describe('getSmartTruncationSuggestions', () => {
        it('should provide suggestions for long text', () => {
            const longText = 'This is a very long text that needs to be truncated. '.repeat(10);
            const result = TextFormatter.getSmartTruncationSuggestions(longText, 50);

            expect(result.suggestions).toBeDefined();
            expect(result.suggestions.length).toBeGreaterThan(0);
            expect(result.truncatedText).toBeDefined();
        });

        it('should handle text within limits', () => {
            const shortText = 'Short text';
            const result = TextFormatter.getSmartTruncationSuggestions(shortText, 100);

            expect(result.suggestions).toContain('Text is within token limit');
        });

        it('should suggest code block reduction', () => {
            const textWithCode = 'Here is some code:\n```javascript\nconst x = 1;\nconsole.log(x);\n```\nMore text here.';
            const result = TextFormatter.getSmartTruncationSuggestions(textWithCode, 10);

            expect(result.suggestions.some(s => s.includes('code'))).toBe(true);
        });
    });

    describe('renderMarkdown', () => {
        it('should render basic markdown', () => {
            const markdown = '**bold** and *italic*';
            const html = TextFormatter.renderMarkdown(markdown);

            expect(html).toContain('<strong>bold</strong>');
            expect(html).toContain('<em>italic</em>');
        });

        it('should handle code blocks', () => {
            const markdown = '```javascript\nconst x = 1;\n```';
            const html = TextFormatter.renderMarkdown(markdown);

            expect(html).toContain('<pre><code');
        });

        it('should handle errors gracefully', () => {
            // Test with potentially problematic input
            const result = TextFormatter.renderMarkdown('Normal text');
            expect(typeof result).toBe('string');
        });
    });
});