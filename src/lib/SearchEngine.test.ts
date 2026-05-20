import { describe, it, expect, beforeEach } from 'vitest';
import { NoteSearchEngine } from './SearchEngine';
import { Note } from '../types';

describe('NoteSearchEngine.getSuggestions', () => {
  let engine: NoteSearchEngine;

  beforeEach(() => {
    engine = new NoteSearchEngine();

    // Create some sample notes to populate the Trie
    const sampleNotes: Note[] = [
      {
        id: '1',
        title: 'Learn React',
        content: 'React is a popular javascript library for building user interfaces.',
        ownerId: 'user1',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: '2',
        title: 'Typescript fundamentals',
        content: 'Typescript adds static typing to javascript.',
        ownerId: 'user1',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: '3',
        title: 'Animal list',
        content: 'cat bat rat mat fat hat sat',
        ownerId: 'user1',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    engine.indexDocuments(sampleNotes);
  });

  it('should return empty array for empty string or whitespace queries', () => {
    expect(engine.getSuggestions('')).toEqual([]);
    expect(engine.getSuggestions('   ')).toEqual([]);
  });

  it('should return prefix suggestions and not fallback to fuzzy find if prefix matches', () => {
    // "typesc" perfectly matches "typescript"
    const suggestions = engine.getSuggestions('typesc');
    expect(suggestions).toContain('typescript');
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('should fallback to fuzzy find for single typos (maxDistance = 1)', () => {
    // "reacx" has distance 1 from "react"
    const suggestions = engine.getSuggestions('reacx');
    expect(suggestions).toContain('react');
  });

  it('should correctly re-stitch sentences with fuzzy find', () => {
    // Query "learning reacx" should suggest "learning react"
    const suggestions = engine.getSuggestions('learning reacx');
    expect(suggestions).toContain('learning react');
  });

  it('should fail fuzzy finding if multiple typos exist (edit distance > 1)', () => {
    // "rxeaxcx" has distance > 1 from "react"
    const suggestions = engine.getSuggestions('rxeaxcx');
    expect(suggestions).toEqual([]);
  });

  it('should respect limit constraints during fuzzy find', () => {
    // Query "xat" (distance 1 from cat, bat, rat, mat, fat, hat, sat).
    // It should find all of them, but we limit to 3.
    const limit = 3;
    const suggestions = engine.getSuggestions('xat', limit);
    expect(suggestions.length).toBe(limit);

    // Also test prefix limit constraint
    const prefixSuggestions = engine.getSuggestions('c', 1);
    expect(prefixSuggestions.length).toBe(1);
  });
});
