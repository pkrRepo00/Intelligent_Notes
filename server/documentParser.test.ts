import { describe, it, expect } from 'vitest';
import { splitDocumentIntoNotes } from './documentParser';

describe('splitDocumentIntoNotes', () => {
    it('should split by markdown headers (1-4)', () => {
        const text = `
# Header 1
Some content here for header 1.
## Header 2
Some content here for header 2.
### Header 3
Some content here for header 3.
#### Header 4
Some content here for header 4.
        `.trim();

        const notes = splitDocumentIntoNotes(text);
        expect(notes.length).toBe(4);
        expect(notes[0].title).toBe('Header 1');
        expect(notes[1].title).toBe('Header 2');
        expect(notes[2].title).toBe('Header 3');
        expect(notes[3].title).toBe('Header 4');
    });

    it('should split by horizontal rules', () => {
        const text = `
First section content here.
---
Second section content here.
***
Third section content here.
___
Fourth section content here.
        `.trim();

        const notes = splitDocumentIntoNotes(text);
        expect(notes.length).toBe(4);
        expect(notes[0].title).toBe('First section content here.');
        expect(notes[1].title).toBe('Second section content here.');
        expect(notes[2].title).toBe('Third section content here.');
        expect(notes[3].title).toBe('Fourth section content here.');
    });

    it('should split by date-like headers', () => {
        const text = `
2023-01-01
Log entry for Jan 1st.
Jan 2, 2023
Log entry for Jan 2nd.
Feb 14, 2023
Log entry for Feb 14th.
        `.trim();

        const notes = splitDocumentIntoNotes(text);
        expect(notes.length).toBe(3);
        expect(notes[0].title).toBe('2023-01-01');
        expect(notes[1].title).toBe('Jan 2, 2023');
        expect(notes[2].title).toBe('Feb 14, 2023');
    });

    it('should split by large paragraph gaps (3 or more newlines)', () => {
        const text = `
Paragraph 1 content here.



Paragraph 2 content here.




Paragraph 3 content here.
        `.trim();

        const notes = splitDocumentIntoNotes(text);
        expect(notes.length).toBe(3);
        expect(notes[0].title).toBe('Paragraph 1 content here.');
        expect(notes[1].title).toBe('Paragraph 2 content here.');
        expect(notes[2].title).toBe('Paragraph 3 content here.');
    });

    it('should fallback to 1 segment if no splits are found', () => {
        const text = `Just a simple text with no special splitting criteria.`.trim();
        const notes = splitDocumentIntoNotes(text);
        expect(notes.length).toBe(1);
        expect(notes[0].title).toBe('Just a simple text with no...');
    });

    it('should skip noise segments with length < 10', () => {
        const text = `
# Header 1
Some content here for header 1.
## n
a
## Header 2
Some content here for header 2.
        `.trim();
        const notes = splitDocumentIntoNotes(text);
        expect(notes.length).toBe(2);
        expect(notes[0].title).toBe('Header 1');
        expect(notes[1].title).toBe('Header 2');
    });

    it('should format title from non-header text up to 6 words', () => {
        const text = `
This is a very long first line of a paragraph that should be truncated.
        `.trim();
        const notes = splitDocumentIntoNotes(text);
        expect(notes.length).toBe(1);
        expect(notes[0].title).toBe('This is a very long first...');
    });

    it('should replace asterisks and underscores from title', () => {
        const text = `
# **Header** _With_ formatting
Some content here.
        `.trim();
        const notes = splitDocumentIntoNotes(text);
        expect(notes.length).toBe(1);
        expect(notes[0].title).toBe('Header With formatting');
    });

    it('should slice title to 60 characters max', () => {
        // We'll give it a header that exceeds 60 characters
        const longHeader = "# " + "a".repeat(70);
        const text = `
${longHeader}
Content goes here.
        `.trim();
        const notes = splitDocumentIntoNotes(text);
        expect(notes.length).toBe(1);
        expect(notes[0].title.length).toBe(60);
        expect(notes[0].title).toBe("a".repeat(60));
    });
});
