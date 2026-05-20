import { useState } from "react";
import { getAIHeaders } from "../lib/api";
import { motion, AnimatePresence } from "motion/react";
import { 
  Check, 
  Trash2, 
  Sparkles, 
  Folder, 
  Tag, 
  ChevronRight, 
  GitMerge, 
  FileText, 
  Heading, 
  Plus, 
  Lock, 
  Network, 
  Eye, 
  AlertCircle,
  HelpCircle,
  Link,
  Undo
} from "lucide-react";
import ReactMarkdown from "react-markdown";

export interface DraftNote {
  title: string;
  content: string;
  summary: string;
  categories: string[];
  color: string;
  folder: string;
  keywords: string[];
  relatedIndices: number[];
  isConfidential?: boolean;
}

interface SmartImportWorkbenchProps {
  initialNotes: DraftNote[];
  fileName: string;
  onClose: () => void;
  onSave: (curatedNotes: DraftNote[]) => Promise<void>;
}

export function SmartImportWorkbench({ 
  initialNotes, 
  fileName, 
  onClose, 
  onSave 
}: SmartImportWorkbenchProps) {
  const [drafts, setDrafts] = useState<DraftNote[]>(() => 
    initialNotes.map(n => ({
      ...n,
      relatedIndices: Array.isArray(n.relatedIndices) ? n.relatedIndices : []
    }))
  );
  
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editNotesHistory, setEditNotesHistory] = useState<DraftNote[][]>([]);

  const [isEnhancing, setIsEnhancing] = useState(false);

  // Editing state form inputs
  const currentNote = drafts[activeIndex] || null;

  const saveHistory = (currentDrafts: DraftNote[]) => {
    setEditNotesHistory(prev => [...prev, JSON.parse(JSON.stringify(currentDrafts))]);
  };

  const handleUndo = () => {
    if (editNotesHistory.length === 0) return;
    const previous = editNotesHistory[editNotesHistory.length - 1];
    setDrafts(previous);
    setEditNotesHistory(prev => prev.slice(0, -1));
    if (activeIndex >= previous.length) {
      setActiveIndex(Math.max(0, previous.length - 1));
    }
  };

  // Calls the stage 2 batched AI processing
  const handleAIEnhance = async () => {
    setIsEnhancing(true);
    saveHistory(drafts);
    try {
      const response = await fetch("/api/analyze-notes-batch", {
        method: "POST",
        headers: getAIHeaders(),
        // send minimal payload to save tokens
        body: JSON.stringify({ 
          notes: drafts.map((d, index) => ({ title: d.title, content: d.content.substring(0, 5000), index })) 
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to process batch");
      }
      const data = await response.json();
      if (data.results) {
         setDrafts(prev => {
           const copy = [...prev];
           data.results.forEach((r: any) => {
             if (copy[r.index]) {
               copy[r.index].title = r.title || copy[r.index].title;
               copy[r.index].summary = r.summary || copy[r.index].summary;
               copy[r.index].categories = r.categories || copy[r.index].categories;
               copy[r.index].color = r.color || copy[r.index].color;
               copy[r.index].keywords = r.keywords || copy[r.index].keywords;
             }
           });
           return copy;
         });
      }
    } catch (err: any) {
      console.error(err);
      alert("AI Enhancement failed: " + err.message);
    } finally {
      setIsEnhancing(false);
    }
  };

  const updateDraftProperty = (index: number, key: keyof DraftNote, value: any) => {
    saveHistory(drafts);
    setDrafts(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const handleDeleteNote = (index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (drafts.length <= 1) {
      alert("You must keep at least one note. If you want to cancel the import, click Close.");
      return;
    }
    
    saveHistory(drafts);
    const updated = drafts.filter((_, idx) => idx !== index);
    setDrafts(updated);
    setSelectedIndices(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
    setActiveIndex(prev => {
      if (prev === index) {
        return Math.max(0, index - 1);
      }
      return prev > index ? prev - 1 : prev;
    });
  };

  const handleToggleSelectNote = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIndices(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index) 
        : [...prev, index]
    );
  };

  const handleSelectAll = () => {
    if (selectedIndices.length === drafts.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(drafts.map((_, i) => i));
    }
  };

  const handleMergeSelected = () => {
    if (selectedIndices.length < 2) {
      alert("Please select at least two notes using the checkboxes to merge them.");
      return;
    }

    saveHistory(drafts);
    // Sort selected indices in descending order to handle removal correctly
    const indicesToMerge = [...selectedIndices].sort((a, b) => a - b);
    const notesToMerge = indicesToMerge.map(i => drafts[i]);

    // Construct merged note
    const mergedContent = notesToMerge.map(n => {
      const sectionHeader = n.title ? `### ${n.title}\n\n` : "";
      return `${sectionHeader}${n.content}`;
    }).join("\n\n---\n\n");

    const mergedTitle = notesToMerge[0].title ? `${notesToMerge[0].title} (Merged)` : "Merged Note";
    const mergedSummary = `Merged collection containing: ${notesToMerge.map(n => n.title || "Untitled").join(", ")}.`;
    
    // Union unique categories, keywords, folders
    const mergedCategories = Array.from(new Set(notesToMerge.flatMap(n => n.categories || []))).filter(Boolean);
    const mergedKeywords = Array.from(new Set(notesToMerge.flatMap(n => n.keywords || []))).filter(Boolean);
    const mergedFolder = notesToMerge.find(n => n.folder)?.folder || notesToMerge[0].folder || "Merged Stuff";
    const mergedColor = notesToMerge.find(n => n.color)?.color || notesToMerge[0].color || "#d97706";
    const mergedConfidential = notesToMerge.some(n => n.isConfidential);

    const mergedNote: DraftNote = {
      title: mergedTitle,
      content: mergedContent,
      summary: mergedSummary,
      categories: mergedCategories,
      keywords: mergedKeywords,
      folder: mergedFolder,
      color: mergedColor,
      isConfidential: mergedConfidential,
      relatedIndices: []
    };

    // Remove old drafts and insert merged note at the position of the first merged note
    const firstIdx = indicesToMerge[0];
    const newDrafts = drafts.filter((_, idx) => !indicesToMerge.includes(idx));
    newDrafts.splice(firstIdx, 0, mergedNote);

    setDrafts(newDrafts);
    setSelectedIndices([]);
    setActiveIndex(firstIdx);
  };

  const handleCommit = async () => {
    setIsSubmitting(true);
    try {
      await onSave(drafts);
    } catch (e: any) {
      alert("Error committing imported notes: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="smart-import-workbench" className="fixed inset-0 z-50 bg-[#050505] text-slate-200 flex flex-col overflow-hidden">
      {/* Top bar header */}
      <header className="h-16 border-b border-white/5 bg-[#080808]/90 backdrop-blur px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Smart Import Workbench
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-full font-semibold border border-amber-500/20">
                {drafts.length} notes parsed
              </span>
            </h1>
            <p className="text-xs text-white/40 truncate max-w-md">Source File: {fileName}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleAIEnhance}
            disabled={isEnhancing || drafts.length === 0}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-indigo-500/30 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 transition-all flex items-center gap-1.5 disabled:opacity-50"
            title="Auto-categorize, summarize and tag using Gemini"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isEnhancing ? "Enhancing Notes..." : "Auto-Categorize with AI"}
          </button>
          {editNotesHistory.length > 0 && (
            <button
              onClick={handleUndo}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-white/10 hover:border-amber-500/30 text-white/70 hover:text-white bg-white/5 transition-all flex items-center gap-1.5"
              title="Undo last action"
            >
              <Undo className="w-3.5 h-3.5" /> Undo
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-[#141414] hover:bg-[#1f1f1f] border border-white/10 hover:border-white/20 text-white/80 rounded-xl transition-all"
          >
            Discard Import
          </button>
          <button
            onClick={handleCommit}
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition-all font-bold tracking-wide shadow-lg shadow-amber-500/15 disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>Saving notes into database...</>
            ) : (
              <>Save {drafts.length} Clean Notes</>
            )}
          </button>
        </div>
      </header>

      {/* Main workbench body */}
      <div className="flex-1 flex min-h-0 bg-[#060606]">
        {/* Left Side: Notes list panel */}
        <div className="w-80 border-r border-white/5 flex flex-col bg-[#080808]/50 shrink-0 min-h-0">
          <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#090909]">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40">Parsed Topics</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="text-[10px] uppercase font-bold text-amber-500 hover:text-amber-400"
              >
                {selectedIndices.length === drafts.length ? "Deselect All" : "Select All"}
              </button>
              {selectedIndices.length > 1 && (
                <button
                  onClick={handleMergeSelected}
                  className="bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded flex items-center gap-1 transition-all"
                  title="Combine selected notes"
                >
                  <GitMerge className="w-3 h-3" /> Merge
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {drafts.map((draft, idx) => {
              const active = idx === activeIndex;
              const selected = selectedIndices.includes(idx);
              return (
                <div
                  key={idx}
                  onClick={() => setActiveIndex(idx)}
                  className={`group relative p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                    active
                      ? "bg-amber-500/10 border-amber-500/40 shadow-md shadow-amber-500/5"
                      : "bg-[#0b0b0b] border-white/5 hover:border-white/15"
                  }`}
                >
                  {/* Color strip accent */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-all"
                    style={{ backgroundColor: draft.color || "#d97706" }}
                  />

                  {/* Multi-select check checkmark */}
                  <div 
                    onClick={(e) => handleToggleSelectNote(idx, e)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      selected 
                        ? "bg-amber-500 border-amber-500 text-black font-bold" 
                        : "border-white/20 hover:border-amber-500/50 hover:bg-white/5"
                    }`}
                  >
                    {selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      {draft.folder && (
                        <span className="text-[9px] bg-white/5 text-white/60 border border-white/10 px-1.5 py-0.5 rounded flex items-center gap-1 max-w-[120px] truncate">
                          <Folder className="w-2.5 h-2.5 shrink-0" /> {draft.folder}
                        </span>
                      )}
                      {draft.isConfidential && (
                        <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5 shrink-0" /> Confidential
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-white/90 truncate leading-snug pr-6">
                      {draft.title || <span className="text-amber-500/70 italic">Untitled Note</span>}
                    </h4>
                    <p className="text-xs text-white/40 line-clamp-2 mt-1 border-t border-white/5 pt-1">
                      {draft.summary || draft.content}
                    </p>
                  </div>

                  <button
                    onClick={(e) => handleDeleteNote(idx, e)}
                    className="absolute top-3 right-3 p-1.5 text-white/10 hover:text-rose-400 bg-transparent rounded hover:bg-rose-500/10 md:opacity-0 group-hover:opacity-100 transition-all"
                    title="Discard this note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center/Right Side: Current draft editor panel */}
        {currentNote ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Form Editor column */}
            <div className="flex-1 border-r border-white/5 flex flex-col overflow-y-auto p-6 md:p-8 space-y-6">
              {/* Note Metadata Card Header */}
              <div className="bg-[#0b0b0b] border border-white/5 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Title editor */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Note Title</label>
                    <input
                      type="text"
                      value={currentNote.title}
                      placeholder="Give this note a clean title"
                      onChange={(e) => updateDraftProperty(activeIndex, 'title', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 hover:border-white/15 focus:border-amber-500/50 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors text-white font-medium"
                    />
                  </div>

                  {/* Folder editor */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 flex items-center gap-1"><Folder className="w-3 h-3 text-white/30" /> Parent Folder / Notebook</label>
                    <input
                      type="text"
                      value={currentNote.folder}
                      placeholder="e.g. Work Stuff, Study Guide, Personal"
                      onChange={(e) => updateDraftProperty(activeIndex, 'folder', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 hover:border-white/15 focus:border-amber-500/50 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                  {/* Category Tags editor */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 flex items-center gap-1"><Tag className="w-3 h-3" /> Categories (Comma separated)</label>
                    <input
                      type="text"
                      value={currentNote.categories?.join(", ") || ""}
                      placeholder="Work, Meeting, Idea"
                      onChange={(e) => {
                        const parsed = e.target.value.split(",").map(c => c.trim()).filter(Boolean);
                        updateDraftProperty(activeIndex, 'categories', parsed);
                      }}
                      className="w-full bg-white/5 border border-white/10 hover:border-white/15 focus:border-amber-500/50 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors text-white/90"
                    />
                  </div>

                  {/* Keywords editor */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Search Keywords (Comma separated)</label>
                    <input
                      type="text"
                      value={currentNote.keywords?.join(", ") || ""}
                      placeholder="synergy, finance, study-session"
                      onChange={(e) => {
                        const parsed = e.target.value.split(",").map(k => k.trim()).filter(Boolean);
                        updateDraftProperty(activeIndex, 'keywords', parsed);
                      }}
                      className="w-full bg-white/5 border border-white/10 hover:border-white/15 focus:border-amber-500/50 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors text-white/90"
                    />
                  </div>
                </div>

                {/* Additional controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
                  <div className="flex items-center gap-4">
                    {/* Color picker */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Highlight Accent:</span>
                      <div className="flex items-center gap-1.5">
                        {["#3b82f6", "#10b981", "#ef4444", "#d97706", "#8b5cf6", "#ec4899", "#6b7280"].map(c => (
                          <button
                            key={c}
                            onClick={() => updateDraftProperty(activeIndex, 'color', c)}
                            className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                              currentNote.color === c ? "border-white" : "border-transparent"
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Confidential privacy switch */}
                  <button
                    onClick={() => updateDraftProperty(activeIndex, 'isConfidential', !currentNote.isConfidential)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                      currentNote.isConfidential
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : "bg-white/5 text-white/50 border-white/10 hover:border-white/15"
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {currentNote.isConfidential ? "Private (Bypasses AI)" : "Make Confidential"}
                  </button>
                </div>
              </div>

              {/* Note Content and Summary Editor */}
              <div className="space-y-4 flex-1 flex flex-col min-h-[300px]">
                {/* Summary Box */}
                <div className="space-y-1.5 shrink-0 bg-[#0c0c0c] border border-white/5 rounded-2xl p-4">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" /> AI-Generated Summary (Editable)
                  </label>
                  <textarea
                    value={currentNote.summary}
                    onChange={(e) => updateDraftProperty(activeIndex, 'summary', e.target.value)}
                    className="w-full text-xs text-white/70 bg-transparent border-none outline-none resize-none px-0 py-1"
                    rows={2}
                    placeholder="Short 2-sentence summary..."
                  />
                </div>

                {/* Main Content markdown text container */}
                <div className="space-y-1.5 flex-1 flex flex-col min-h-0 bg-[#080808] border border-white/5 rounded-2xl p-5">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 flex items-center gap-1">
                      <Heading className="w-3 h-3" /> Rich Content (Markdown Supported)
                    </span>
                    <span className="text-[10px] text-white/30 truncate">
                      {currentNote.content.length} characters
                    </span>
                  </div>
                  <textarea
                    value={currentNote.content}
                    onChange={(e) => updateDraftProperty(activeIndex, 'content', e.target.value)}
                    className="flex-1 w-full bg-transparent text-sm leading-relaxed text-white/95 outline-none resize-none py-3 custom-scrollbar"
                    placeholder="Extracted raw text. Edit layout, details..."
                  />
                </div>
              </div>
            </div>

            {/* AI Side Insight Summary (Right Panel) */}
            <div className="w-80 border-l border-white/5 flex flex-col bg-[#080808]/30 shrink-0 min-h-0 p-5 overflow-y-auto space-y-6">
              {/* Interactive preview section */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Note Preview
                </h3>

                <div 
                  className="bg-white/5 border rounded-2xl p-5 relative overflow-hidden flex flex-col space-y-3 min-h-[220px]"
                  style={{ borderColor: `${currentNote.color}20` }}
                >
                  <div 
                    className="absolute inset-x-0 top-0 h-1" 
                    style={{ backgroundColor: currentNote.color || 'rgba(245, 158, 11, 0.3)' }} 
                  />
                  
                  {currentNote.title && (
                    <h4 className="text-md font-bold text-white leading-snug">{currentNote.title}</h4>
                  )}

                  {currentNote.summary && (
                    <p className="text-xs text-white/50 leading-relaxed italic border-l-2 border-white/10 pl-3">
                      {currentNote.summary}
                    </p>
                  )}

                  <div className="prose prose-sm prose-invert prose-neutral line-clamp-6 text-white/70 overflow-hidden text-xs">
                    <ReactMarkdown>{currentNote.content}</ReactMarkdown>
                  </div>

                  {currentNote.categories && currentNote.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {currentNote.categories.map(c => (
                        <span 
                          key={c} 
                          className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] uppercase font-bold text-white/60"
                        >
                          #{c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Suggested Connections visualizer */}
              {Array.isArray(currentNote.relatedIndices) && currentNote.relatedIndices.length > 0 && (
                <div className="space-y-3 border-t border-white/5 pt-4 bg-amber-500/5 rounded-2xl p-4 border border-amber-500/10">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-amber-500" /> Suggested related notes:
                  </h3>
                  <div className="space-y-2">
                    {currentNote.relatedIndices.map(relatedIdx => {
                      const relatedNote = drafts[relatedIdx];
                      if (!relatedNote) return null;
                      return (
                        <button
                          key={relatedIdx}
                          onClick={() => setActiveIndex(relatedIdx)}
                          className="w-full text-left bg-white/5 hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/20 px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between text-white"
                        >
                          <span className="truncate flex-1 pr-2 font-medium">👉 {relatedNote.title || "Untitled Note"}</span>
                          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-white/30 group-hover:text-amber-400" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tag/Keyword Auto Cloud */}
              {currentNote.keywords && currentNote.keywords.length > 0 && (
                <div className="space-y-2 border-t border-white/5 pt-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Search Keywords Cloud</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {currentNote.keywords.map(kw => (
                      <span 
                        key={kw} 
                        className="px-2 py-1 bg-white/5 border border-white/10 text-white/80 hover:border-amber-500/30 rounded-lg text-[9px] font-mono select-none"
                      >
                        🔑 {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-500">
            <AlertCircle className="w-12 h-12 mb-4 text-neutral-600 animate-pulse" />
            <p className="text-sm">No notes available in import list. Please add notes or reload.</p>
          </div>
        )}
      </div>
    </div>
  );
}
