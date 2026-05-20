import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, FileText, Plus, Folder, Hash, Tag, Settings, Play, ChevronRight, X, Clock, EyeOff, LayoutTemplate, Star
} from 'lucide-react';
import { Note } from '../types';
import { NoteSearchEngine, SearchHistoryCache, SearchResult, HighlightChunk } from '../lib/SearchEngine';
import { WikiMarkdown } from './WikiMarkdown';

interface CommandPaletteProps {
  notes: Note[];
  onOpenNote: (note: Note) => void;
  onNewNote: () => void;
  onSwitchView: (view: 'notes' | 'graph' | 'canvas') => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function CommandPalette({ 
  notes, 
  onOpenNote, 
  onNewNote, 
  onSwitchView, 
  isOpen, 
  setIsOpen 
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Search Engine
  const searchEngine = useMemo(() => {
    const engine = new NoteSearchEngine();
    engine.indexDocuments(notes);
    return engine;
  }, [notes]);

  // Load search history & suggestions on query change
  useEffect(() => {
    setRecentSearches(SearchHistoryCache.getRecentSearches());
  }, [isOpen, query]);

  useEffect(() => {
    if (query.trim()) {
      const sugs = searchEngine.getSuggestions(query);
      setSuggestions(sugs);
    } else {
      setSuggestions([]);
    }
  }, [query, searchEngine]);

  // Command palette hotkey (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setSelectedResultIndex(0);
      setQuery('');
      setSelectedFolder(null);
      setSelectedCategory(null);
    }
  }, [isOpen]);

  // Calculate search results
  const searchResults = useMemo(() => {
    const filters = {
      folder: selectedFolder,
      category: selectedCategory,
    };
    return searchEngine.search(query, filters);
  }, [query, selectedFolder, selectedCategory, searchEngine]);

  // Constrain selected index within search boundaries
  useEffect(() => {
    if (selectedResultIndex >= searchResults.length) {
      setSelectedResultIndex(Math.max(0, searchResults.length - 1));
    }
  }, [searchResults, selectedResultIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (resultsContainerRef.current) {
      const activeEl = resultsContainerRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedResultIndex]);

  // Keyboard navigation within the listing
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedResultIndex(prev => (prev + 1) % Math.max(1, searchResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedResultIndex(prev => (prev - 1 + searchResults.length) % Math.max(1, searchResults.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedResultIndex]) {
        handleSubmitResult(searchResults[selectedResultIndex]);
      }
    }
  };

  const handleSubmitResult = (result: SearchResult) => {
    SearchHistoryCache.addSearch(query || result.note.title || '');
    onOpenNote(result.note);
    setIsOpen(false);
  };

  // List unique categories and folders for metadata quick tags
  const uniqueFolders = useMemo(() => {
    return Array.from(new Set(notes.map(n => n.folder).filter(Boolean))) as string[];
  }, [notes]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(notes.flatMap(n => n.categories || []).filter(Boolean))) as string[];
  }, [notes]);

  if (!isOpen) return null;

  const currentResultNote = searchResults[selectedResultIndex]?.note;

  // Render Highlight Text safely
  const renderHighlights = (chunks: HighlightChunk[]) => {
    return chunks.map((chunk, idx) => (
      <span 
        key={idx} 
        className={chunk.isMatch ? "bg-amber-500/20 text-amber-400 font-semibold px-0.5 rounded border border-amber-500/10" : ""}
      >
        {chunk.text}
      </span>
    ));
  };

  return (
    <AnimatePresence>
      <div 
        id="refactored-search-palette"
        className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-start justify-center p-4 sm:p-10 pt-[5vh] sm:pt-[10vh] border-none"
        onKeyDown={handleKeyDown}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -20 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="w-full max-w-5xl bg-[#0b0b0d] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[80vh] md:h-[75vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Main Search Input Fields */}
          <div className="flex items-center px-5 py-4 border-b border-white/10 bg-black/40 gap-3 shrink-0">
            <Search className="w-5 h-5 text-amber-500/70" />
            <input 
              ref={inputRef}
              type="text"
              placeholder="Search note titles, tags, full-text content, backlinks... (Cmd+K)" 
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedResultIndex(0);
              }}
              className="flex-1 bg-transparent border-none outline-none text-base w-full text-white placeholder:text-white/30 focus:ring-0 leading-normal"
            />
            
            {/* ESC Status Key indicator */}
            <div className="hidden sm:flex items-center gap-1">
              <span className="text-[10px] font-mono tracking-widest bg-white/5 border border-white/10 rounded-md px-2 py-0.5 text-white/40">ESC Close</span>
            </div>

            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Inline Autocomplete Suggestions / Trie assistance Row */}
          {suggestions.length > 0 && (
            <div className="px-5 py-2.5 bg-[#121217] border-b border-white/5 flex flex-wrap items-center gap-2 text-xs shrink-0 select-none">
              <span className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Autocomplete:</span>
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuery(sug);
                    inputRef.current?.focus();
                  }}
                  className="bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/25 text-amber-400 font-semibold px-2 py-0.5 rounded-lg cursor-pointer transition-all"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Sub Filters Toolbar Row */}
          <div className="px-5 py-3 border-b border-white/5 flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 text-xs bg-[#08080a] select-none">
            
            {/* Folder filters */}
            {uniqueFolders.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-hide shrink-0">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest shrink-0">Notebook:</span>
                <button
                  onClick={() => setSelectedFolder(null)}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium border cursor-pointer ${!selectedFolder ? 'bg-amber-500/15 text-amber-400 border-amber-500/20 font-bold' : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10'}`}
                >
                  All
                </button>
                {uniqueFolders.map(folder => (
                  <button
                    key={folder}
                    onClick={() => setSelectedFolder(selectedFolder === folder ? null : folder)}
                    className={`px-2.5 py-1 rounded-md transition-all border flex items-center gap-1 cursor-pointer ${selectedFolder === folder ? 'bg-amber-500/15 text-amber-400 border-amber-500/20 font-extrabold shadow-sm' : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10'}`}
                  >
                    <Folder className="w-3 h-3 opacity-60" />
                    {folder}
                  </button>
                ))}
              </div>
            )}

            {/* Category tags */}
            {uniqueCategories.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full border-t border-white/5 sm:border-0 pt-2 sm:pt-0 pb-1 sm:pb-0 scrollbar-hide">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest shrink-0">Category:</span>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium border cursor-pointer ${!selectedCategory ? 'bg-amber-500/15 text-amber-400 border-amber-500/20 font-bold' : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10'}`}
                >
                  All
                </button>
                {uniqueCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    className={`px-2.5 py-1 rounded-md transition-all border flex items-center gap-1 cursor-pointer ${selectedCategory === cat ? 'bg-amber-500/15 text-amber-400 border-amber-500/20 font-bold' : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10'}`}
                  >
                    <Tag className="w-3 h-3 opacity-60" />
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Double Column Panel Content */}
          <div className="flex-1 flex overflow-hidden min-h-0 bg-[#070709]">
            
            {/* Left Column: List Results (Adaptive Width) */}
            <div 
              ref={resultsContainerRef}
              className="w-full md:w-1/2 overflow-y-auto custom-scrollbar border-r border-white/5 p-3 space-y-1 bg-black/10"
            >
              
              {/* If query has length 0, display Recent Search Pills and Default Navigation options */}
              {!query && recentSearches.length > 0 && (
                <div className="p-2 mb-4 animate-fade-in select-none">
                  <div className="flex items-center justify-between text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2.5">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Recent Searches</span>
                    <button 
                      onClick={() => {
                        SearchHistoryCache.clearRecent();
                        setRecentSearches([]);
                      }}
                      className="hover:text-amber-500 hover:underline cursor-pointer"
                    >
                      Clear History
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((recSearchVal, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setQuery(recSearchVal);
                          inputRef.current?.focus();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 rounded-xl text-xs text-white/70 hover:text-white cursor-pointer transition-all"
                      >
                        <Search className="w-3 h-3 text-white/30" />
                        {recSearchVal}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic Static Actions Trigger block, visible only when query is short to streamline quick actions */}
              {!query && (
                <div className="p-2 border-b border-white/5 pb-3 mb-3 text-slate-400 select-none">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest pl-1 block mb-2">Quick Navigation</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => { onNewNote(); setIsOpen(false); }}
                      className="flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-white/5 hover:text-white text-xs border border-transparent hover:border-white/5 transition-all cursor-pointer"
                    >
                      <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg"><Plus className="w-4 h-4" /></div>
                      <div>
                        <div className="font-semibold text-white/90">New Note</div>
                        <div className="text-[10px] text-white/40">Draft brain contents</div>
                      </div>
                    </button>
                    <button 
                      onClick={() => { onSwitchView('graph'); setIsOpen(false); }}
                      className="flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-white/5 hover:text-white text-xs border border-transparent hover:border-white/5 transition-all cursor-pointer"
                    >
                      <div className="p-1.5 bg-cyan-500/10 text-cyan-500 rounded-lg"><LayoutTemplate className="w-4 h-4" /></div>
                      <div>
                        <div className="font-semibold text-white/90">Visual Graph</div>
                        <div className="text-[10px] text-white/40">Map notes layout</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Loop Search engine matches */}
              {searchResults.length > 0 ? (
                searchResults.map((result, idx) => {
                  const isActive = idx === selectedResultIndex;
                  return (
                    <div
                      key={result.note.id}
                      data-active={isActive}
                      onClick={() => handleSubmitResult(result)}
                      onMouseEnter={() => setSelectedResultIndex(idx)}
                      className={`group p-3 rounded-2xl cursor-pointer text-left transition-all border outline-none ${
                        isActive 
                          ? 'bg-amber-500/10 border-amber-500/25 text-white shadow-xl shadow-amber-500/5' 
                          : 'bg-[#0f0f13]/40 hover:bg-[#0f0f13]/80 border-white/5 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2 font-medium">
                          <FileText className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-amber-500' : 'text-white/40 group-hover:text-amber-500/70'}`} />
                          <h4 className="text-sm font-bold tracking-tight text-white/90 group-hover:text-white line-clamp-1">
                            {renderHighlights(result.highlightedTitle)}
                          </h4>
                          {result.note.isPinned && (
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                          )}
                          {result.note.isConfidential && (
                            <EyeOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )}
                        </div>

                        {/* Relevance BM25 Quality Badge */}
                        {query.trim().length > 0 && (
                          <span className={`text-[9px] font-mono font-extrabold tracking-wide px-1.5 py-0.5 rounded-md ${
                            isActive ? 'bg-amber-500 text-amber-950 font-black shadow-md' : 'bg-white/5 text-amber-400/80 border border-white/5'
                          }`}>
                            RELEVANCE: {result.score.toFixed(1)}
                          </span>
                        )}
                      </div>

                      {/* Matching Context Dynamic Text snippet with highlight styling */}
                      <p className="text-xs text-white/45 mt-1.5 line-clamp-2 leading-relaxed">
                        {renderHighlights(result.snippet)}
                      </p>

                      {/* Metadata Labels list footer row */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        {result.note.folder && (
                          <span className="text-[9px] font-mono bg-white/5 text-white/40 border border-white/5 px-2 py-0.5 rounded flex items-center gap-1">
                            <Folder className="w-2.5 h-2.5 opacity-60" /> {result.note.folder}
                          </span>
                        )}
                        {(result.note.categories || []).slice(0, 2).map(cat => (
                          <span key={cat} className="text-[9px] font-mono bg-amber-500/10 text-amber-400/90 border border-amber-500/10 px-1.5 py-0.5 rounded">
                            {cat}
                          </span>
                        ))}
                        {result.matchedField !== 'content' && result.matchedField !== 'none' && (
                          <span className="text-[9px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 px-1.5 py-0.5 rounded-md uppercase ml-auto">
                            Matched: {result.matchedField}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-20 text-center flex flex-col items-center justify-center text-white/30">
                  <Search className="w-12 h-12 mb-4 opacity-15 stroke-1" />
                  <p className="text-sm font-semibold text-white/60">No notes matched your search query</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs leading-normal">
                    Try checking spelling or apply fuzzy search logic or change quick metadata notebook scopes.
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Detailed High Fidelity Live Note Preview Panel (Visible on Desktop) */}
            <div className="hidden md:flex md:w-1/2 flex-col bg-black/20 overflow-y-auto custom-scrollbar p-6">
              {currentResultNote ? (
                <div className="space-y-5 animate-fade-in">
                  
                  {/* Preview Navigation title & metadata block */}
                  <div className="border-b border-white/5 pb-4 space-y-2">
                    <span className="text-[9px] font-mono font-extrabold uppercase tracking-widest text-amber-500/80 bg-amber-500/5 px-2.5 py-1 border border-amber-500/10 rounded-md">
                      Live Note Content Preview
                    </span>
                    <h2 className="text-2xl font-black text-white leading-none mt-2">
                      {currentResultNote.title || 'Untitled Note'}
                    </h2>
                    
                    {currentResultNote.folder && (
                      <div className="flex items-center gap-1 text-xs text-white/40">
                        <Folder className="w-3.5 h-3.5" /> Book Folder: <span className="text-white/60 font-medium font-mono">{currentResultNote.folder}</span>
                      </div>
                    )}
                  </div>

                  {/* High Quality Rich Markdown parsed render engine */}
                  <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed font-sans markdown-body select-text">
                    <WikiMarkdown 
                      content={currentResultNote.content || ''}
                      onLinkClick={(targetTitle) => {
                        const referencedNote = notes.find(n => n.title?.toLowerCase() === targetTitle.toLowerCase());
                        if (referencedNote) {
                          onOpenNote(referencedNote);
                          setIsOpen(false);
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-white/20 text-center select-none">
                  <FileText className="w-16 h-16 stroke-1 stroke-white/5 mb-3" />
                  <p className="text-xs font-semibold text-white/40 font-mono tracking-wider">SELECT A NOTE ITEM TO DENSE PORTAL PREVIEW</p>
                </div>
              )}
            </div>

          </div>

          {/* Core Footer Keybindings Bar */}
          <div className="px-5 py-3 border-t border-white/10 bg-[#060608] flex items-center justify-between text-[11px] font-mono text-white/30 shrink-0 select-none">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><ChevronRight className="w-3 h-3 text-amber-500" /> <b className="text-white/40 font-medium">Arrows</b> navigate</span>
              <span className="flex items-center gap-1.5"><ChevronRight className="w-3 h-3 text-amber-500" /> <b className="text-white/40 font-medium">Enter</b> open note</span>
            </div>
            <div className="hidden sm:inline-block">
              Double-panel index sync active 
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
