import { describe, it, expect } from 'vitest';
import { splitDocumentIntoNotes } from './documentParser';

describe('splitDocumentIntoNotes', () => {
  it('splits by markdown headers (### or #)', () => {
    const text = `
# Header 1
This is the first note. It has enough content to be kept.
## Header 2
This is the second note. It also has enough content to be kept.
### Header 3
This is the third note. It also has enough content to be kept.
    `;
    const notes = splitDocumentIntoNotes(text);
    expect(notes.length).toBe(3);
    expect(notes[0].title).toBe('Header 1');
    expect(notes[1].title).toBe('Header 2');
    expect(notes[2].title).toBe('Header 3');
  });

  it('splits by markdown horizontal rules (--- or ***)', () => {
    const text = `
First section content. Needs to be long enough.
---
Second section content. Needs to be long enough.
***
Third section content. Needs to be long enough.
    `;
    const notes = splitDocumentIntoNotes(text);
    expect(notes.length).toBe(3);
    expect(notes[0].title).toBe('First section content. Needs to be...');
    expect(notes[1].title).toBe('Second section content. Needs to be...');
    expect(notes[2].title).toBe('Third section content. Needs to be...');
  });

  it('splits by date-like headers', () => {
    const text = `
Jan 1, 2023
First note content here.
2023-01-02
Second note content here.
Mar 15, 2023
Third note content here.
    `;
    const notes = splitDocumentIntoNotes(text);
    expect(notes.length).toBe(3);
    expect(notes[0].title).toBe('Jan 1, 2023');
    expect(notes[1].title).toBe('2023-01-02');
    expect(notes[2].title).toBe('Mar 15, 2023');
  });

  it('splits by large paragraph gaps (3 or more newlines)', () => {
    const text = `First paragraph of note 1. Long enough.


Second paragraph of note 2. Long enough.



Third paragraph of note 3. Long enough.`;
    const notes = splitDocumentIntoNotes(text);
    expect(notes.length).toBe(3);
    expect(notes[0].title).toBe('First paragraph of note 1. Long...');
    expect(notes[1].title).toBe('Second paragraph of note 2. Long...');
    expect(notes[2].title).toBe('Third paragraph of note 3. Long...');
  });

  it('fallback: whole document is one note', () => {
    const text = `Just one long single note without any standard splitters. Needs to be at least 10 chars.`;
    const notes = splitDocumentIntoNotes(text);
    expect(notes.length).toBe(1);
    expect(notes[0].title).toBe('Just one long single note without...');
  });

  it('ignores noisy/short segments (< 10 chars)', () => {
    const text = `
First segment
---
short
---
Second valid segment is long enough
    `;
    const notes = splitDocumentIntoNotes(text);
    expect(notes.length).toBe(2);
    expect(notes[0].title).toBe('First segment');
    expect(notes[1].title).toBe('Second valid segment is long enough');
  });

  it('title generation cases (standard words, truncating, removing * and _)', () => {
    const text = `
**Bold Title** With _Italics_ And More Words Than Six Should Truncate To Max Sixty Characters Or Just Ellipsis
This is the content for the title generation test. It should be long enough.
    `;
    const notes = splitDocumentIntoNotes(text);
    expect(notes.length).toBe(1);
    // 6 words limit check & truncating formatting
    // "**Bold Title** With _Italics_ And More" -> "Bold Title With Italics And More..."
    expect(notes[0].title).toBe('Bold Title With Italics And More...');
  });

  it('title generation cases truncates to 60 chars maximum', () => {
      const text = `
# A very long header title that definitely exceeds the sixty characters limit imposed by the slicing logic
Content here.
      `;
      const notes = splitDocumentIntoNotes(text);
      expect(notes.length).toBe(1);
      expect(notes[0].title.length).toBe(60);
      expect(notes[0].title).toBe('A very long header title that definitely exceeds the sixty c');
  });
});
