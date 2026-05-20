import { Note } from '../types';

// Trie Node representation for prefix suggestion and typo tolerance
class TrieNode {
  children: { [char: string]: TrieNode } = {};
  isWord: boolean = false;
  frequency: number = 0;
}

// Trie data structure for fast prefix autocomplete and fuzzy word lookups
class Trie {
  root = new TrieNode();

  insert(word: string, freq = 1) {
    if (!word) return;
    let curr = this.root;
    for (const char of word) {
      if (!curr.children[char]) {
        curr.children[char] = new TrieNode();
      }
      curr = curr.children[char];
    }
    curr.isWord = true;
    curr.frequency += freq;
  }

  // Get words with a specific prefix
  suggest(prefix: string, maxResults = 5): string[] {
    let curr = this.root;
    for (const char of prefix) {
      if (!curr.children[char]) return [];
      curr = curr.children[char];
    }

    const results: { word: string; freq: number }[] = [];
    this.traverse(curr, prefix, results);
    return results
      .sort((a, b) => b.freq - a.freq)
      .slice(0, maxResults)
      .map(item => item.word);
  }

  private traverse(node: TrieNode, word: string, results: { word: string; freq: number }[]) {
    if (node.isWord) {
      results.push({ word, freq: node.frequency });
    }
    for (const char in node.children) {
      this.traverse(node.children[char], word + char, results);
    }
  }

  // Fuzzy search returning words in Trie within editDistance
  fuzzyFind(word: string, maxDistance = 1): string[] {
    const results: string[] = [];
    const currentWord: string[] = [];

    const searchRecursive = (node: TrieNode, char: string, previousRow: number[]) => {
      const size = word.length;
      const currentRow = [previousRow[0] + 1];

      for (let i = 1; i <= size; i++) {
        const insertCost = currentRow[i - 1] + 1;
        const deleteCost = previousRow[i] + 1;
        let replaceCost = previousRow[i - 1];

        if (word[i - 1] !== char) {
          replaceCost += 1;
        }

        currentRow.push(Math.min(insertCost, deleteCost, replaceCost));
      }

      if (currentRow[size] <= maxDistance && node.isWord) {
        results.push(currentWord.join(''));
      }

      if (Math.min(...currentRow) <= maxDistance) {
        for (const nextChar in node.children) {
          currentWord.push(nextChar);
          searchRecursive(node.children[nextChar], nextChar, currentRow);
          currentWord.pop();
        }
      }
    };

    // Initialize first row of Levenshtein matrix
    const initialRow = Array.from({ length: word.length + 1 }, (_, i) => i);

    for (const nextChar in this.root.children) {
      currentWord.push(nextChar);
      searchRecursive(this.root.children[nextChar], nextChar, initialRow);
      currentWord.pop();
    }

    return results;
  }
}

export interface SearchFilters {
  category?: string | null;
  folder?: string | null;
  confidential?: boolean;
}

export interface HighlightChunk {
  text: string;
  isMatch: boolean;
}

export interface SearchResult {
  note: Note;
  score: number;
  highlightedTitle: HighlightChunk[];
  snippet: HighlightChunk[];
  matchedField: string;
}

// Full text indexing & scoring with BM25
export class NoteSearchEngine {
  private invertedIndex: { [term: string]: { [noteId: string]: { freq: number; fields: Set<string> } } } = {};
  private documentLengths: { [noteId: string]: number } = {};
  private notesMap: { [noteId: string]: Note } = {};
  private trie = new Trie();
  private totalDocs = 0;
  private totalDocLength = 0;
  
  // Weights for different document fields to boost relevance
  private static FIELD_WEIGHTS = {
    title: 12.0,
    categories: 6.0,
    keywords: 6.0,
    folder: 4.0,
    summary: 3.0,
    content: 1.0,
  };

  private tokenize(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s\-\[\]]/g, ' ') // Preserve letters, numbers, and basic brackets
      .split(/\s+/)
      .filter(w => w.length > 1); // Avoid index dilution with tiny words/letters
  }

  // Set or update full indices for notes array
  public indexDocuments(notes: Note[]) {
    this.invertedIndex = {};
    this.documentLengths = {};
    this.notesMap = {};
    this.trie = new Trie();
    this.totalDocs = 0;
    this.totalDocLength = 0;

    for (const note of notes) {
      this.addDocument(note);
    }
  }

  private addDocument(note: Note) {
    const id = note.id;
    this.notesMap[id] = note;
    this.totalDocs++;

    let docLen = 0;

    const processField = (text: string, fieldName: keyof typeof NoteSearchEngine.FIELD_WEIGHTS) => {
      const tokens = this.tokenize(text);
      docLen += tokens.length;
      
      for (const token of tokens) {
        this.trie.insert(token);

        if (!this.invertedIndex[token]) {
          this.invertedIndex[token] = {};
        }
        if (!this.invertedIndex[token][id]) {
          this.invertedIndex[token][id] = { freq: 0, fields: new Set() };
        }
        
        // Add frequency weighted inside field
        const weight = NoteSearchEngine.FIELD_WEIGHTS[fieldName];
        this.invertedIndex[token][id].freq += weight;
        this.invertedIndex[token][id].fields.add(fieldName);
      }
    };

    processField(note.title || '', 'title');
    processField(note.content || '', 'content');
    processField(note.summary || '', 'summary');
    processField(note.folder || '', 'folder');
    processField((note.categories || []).join(' '), 'categories');
    processField((note.keywords || []).join(' '), 'keywords');

    this.documentLengths[id] = docLen;
    this.totalDocLength += docLen;
  }

  get autocompleteTrie(): Trie {
    return this.trie;
  }

  // Real-time cached suggestions for search queries
  public getSuggestions(query: string, limit = 5): string[] {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    
    // Find the last word in the phrase
    const terms = trimmed.split(/\s+/);
    const lastTerm = terms[terms.length - 1];
    
    const prefixSuggestions = this.trie.suggest(lastTerm, limit);
    if (prefixSuggestions.length > 0) {
      // Re-stitch sentence suggestion
      const basePhrase = terms.slice(0, terms.length - 1).join(" ");
      return prefixSuggestions.map(s => basePhrase ? `${basePhrase} ${s}` : s);
    }
    
    // Fallback to fuzzy lookups
    const fuzzySuggestions = this.trie.fuzzyFind(lastTerm, 1);
    if (fuzzySuggestions.length > 0) {
      const basePhrase = terms.slice(0, terms.length - 1).join(" ");
      return fuzzySuggestions.slice(0, limit).map(s => basePhrase ? `${basePhrase} ${s}` : s);
    }

    return [];
  }

  // Match and score documents with BM25 logic + typo tolerance
  public search(query: string, filters?: SearchFilters): SearchResult[] {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      // If query is empty, return original documents sorted by pinning & date
      return Object.values(this.notesMap)
        .filter(n => this.applyFilters(n, filters))
        .map(n => ({
          note: n,
          score: 1.0,
          highlightedTitle: [{ text: n.title || 'Untitled Note', isMatch: false }],
          snippet: [{ text: n.summary || n.content.slice(0, 100), isMatch: false }],
          matchedField: 'none'
        }));
    }

    const queryTerms = this.tokenize(trimmed);
    if (queryTerms.length === 0) return [];

    // Expand search using typo-tolerant suggestions for terms that match nothing directly
    const expandedTerms: string[] = [];
    for (const term of queryTerms) {
      expandedTerms.push(term);
      // If a term does not exist directly in inverted index, find a close fuzzy match
      if (!this.invertedIndex[term]) {
        const fuzzyMatches = this.trie.fuzzyFind(term, term.length > 5 ? 2 : 1);
        for (const match of fuzzyMatches) {
          expandedTerms.push(match);
        }
      }
    }

    const scores: { [noteId: string]: number } = {};
    const matchedFieldsTracker: { [noteId: string]: Set<string> } = {};

    // BM25 Hyperparameters
    const k1 = 1.2;
    const b = 0.75;
    const avgdl = this.totalDocs > 0 ? this.totalDocLength / this.totalDocs : 1;

    for (const term of expandedTerms) {
      const posting = this.invertedIndex[term];
      if (!posting) continue;

      const df = Object.keys(posting).length;
      // Inverse Document Frequency calculation
      const idf = Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1);

      for (const noteId in posting) {
        const freqInfo = posting[noteId];
        const docLen = this.documentLengths[noteId] || 1;
        
        // TF-IDF scoring with BM25 formula
        const termFreq = freqInfo.freq;
        const score = idf * ((termFreq * (k1 + 1)) / (termFreq + k1 * (1 - b + b * (docLen / avgdl))));

        scores[noteId] = (scores[noteId] || 0) + score;

        if (!matchedFieldsTracker[noteId]) {
          matchedFieldsTracker[noteId] = new Set();
        }
        freqInfo.fields.forEach(f => matchedFieldsTracker[noteId].add(f));
      }
    }

    // Convert notes maps into structured results
    const results: SearchResult[] = [];
    for (const noteId in scores) {
      const note = this.notesMap[noteId];
      if (!note) continue;

      // Filter verification
      if (!this.applyFilters(note, filters)) continue;

      const score = scores[noteId];
      const matchedFields = matchedFieldsTracker[noteId];
      
      // Determine primary matched field
      let matchedField = 'content';
      if (matchedFields.has('title')) matchedField = 'title';
      else if (matchedFields.has('categories')) matchedField = 'categories';
      else if (matchedFields.has('keywords')) matchedField = 'keywords';
      else if (matchedFields.has('summary')) matchedField = 'summary';

      // Generate highlighted structures
      const highlightedTitle = this.generateHeaderHighlights(note.title || 'Untitled Note', queryTerms);
      const snippet = this.generateContentSnippet(note.content, queryTerms);

      results.push({
        note,
        score,
        highlightedTitle,
        snippet,
        matchedField
      });
    }

    // Sort by descending score (relevance)
    return results.sort((a, b) => b.score - a.score);
  }

  private applyFilters(note: Note, filters?: SearchFilters): boolean {
    if (!filters) return true;
    if (filters.category && (!note.categories || !note.categories.includes(filters.category))) {
      return false;
    }
    if (filters.folder && note.folder !== filters.folder) {
      return false;
    }
    if (filters.confidential !== undefined && note.isConfidential !== filters.confidential) {
      return false;
    }
    return true;
  }

  // Highlights title matches
  private generateHeaderHighlights(title: string, queryTerms: string[]): HighlightChunk[] {
    return this.highlightText(title, queryTerms);
  }

  // Generates sliding context snippets around match window
  private generateContentSnippet(content: string, queryTerms: string[]): HighlightChunk[] {
    const lowerContent = content.toLowerCase();
    
    // Find earliest match index
    let bestIndex = 0;
    let maxMatchCount = 0;

    for (let i = 0; i < content.length - 20; i += 10) {
      let count = 0;
      const windowStr = lowerContent.substring(i, i + 120);
      for (const term of queryTerms) {
        if (windowStr.includes(term)) {
          count++;
        }
      }
      if (count > maxMatchCount) {
        maxMatchCount = count;
        bestIndex = i;
      }
    }

    // Extract window surrounding best match
    const startIdx = Math.max(0, bestIndex - 30);
    const endIdx = Math.min(content.length, startIdx + 110);
    let sliceText = content.slice(startIdx, endIdx);
    
    if (startIdx > 0) sliceText = '...' + sliceText;
    if (endIdx < content.length) sliceText = sliceText + '...';

    return this.highlightText(sliceText, queryTerms);
  }

  // Split-chunk helper to highlight sub-segments of matching phrases without rendering innerHTML
  private highlightText(text: string, queryTerms: string[]): HighlightChunk[] {
    if (queryTerms.length === 0 || !text) {
      return [{ text, isMatch: false }];
    }

    // Build regex that captures all query terms
    const escapedTerms = queryTerms
      .map(t => t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')) // escape regex chars
      .filter(t => t.length > 0);
      
    if (escapedTerms.length === 0) {
      return [{ text, isMatch: false }];
    }

    const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
    const splitArr = text.split(pattern);
    
    const chunks: HighlightChunk[] = [];
    for (const segment of splitArr) {
      if (!segment) continue;
      
      const isMatch = queryTerms.some(term => segment.toLowerCase() === term.toLowerCase());
      chunks.push({
        text: segment,
        isMatch
      });
    }

    return chunks;
  }
}

// Persistent searches tracker helper (Recent query storage)
export const SearchHistoryCache = {
  getRecentSearches(): string[] {
    try {
      const stored = localStorage.getItem('knowledge_search_recent');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  addSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    try {
      let recent = this.getRecentSearches();
      recent = [trimmed, ...recent.filter(q => q !== trimmed)].slice(0, 8);
      localStorage.setItem('knowledge_search_recent', JSON.stringify(recent));
    } catch (e) {
      console.error('Failed to update recent searches', e);
    }
  },

  clearRecent() {
    try {
      localStorage.removeItem('knowledge_search_recent');
    } catch {}
  }
};
