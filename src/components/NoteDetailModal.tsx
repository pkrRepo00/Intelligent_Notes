import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, Folder, ChevronUp, ChevronDown, Sparkles, GripHorizontal,
  Bold, Italic, Heading, List, CheckSquare, Code, Quote, Table, Columns, Trash2
} from "lucide-react";
import { Note } from "../types";
import { WikiMarkdown } from "./WikiMarkdown";
import { BacklinksPanel } from "./BacklinksPanel";
import { toast } from "sonner";
import { PluginManager } from "../lib/PluginManager";
import { updateNoteData, deleteNote } from "../lib/api";
import { getNotesToUpdateOnRename } from "../lib/graphEngine";

export interface NoteDetailModalProps {
  note: Note;
  notes: Note[];
  onClose: () => void;
  onLinkClick: (title: string) => void;
  onCreateLinkedNote: (title: string) => void;
  onOpenNote: (note: Note) => void;
  isEnhancingNote: boolean;
  onAutoCategorize: (note: Note) => void;
}

export function NoteDetailModal({
  note: initialNote,
  notes,
  onClose,
  onLinkClick,
  onCreateLinkedNote,
  onOpenNote,
  isEnhancingNote,
  onAutoCategorize
}: NoteDetailModalProps) {
  const [editingNote, setEditingNote] = useState<Note>(initialNote);
  const [categoriesStr, setCategoriesStr] = useState(initialNote.categories?.join(", ") || "");
  const [keywordsStr, setKeywordsStr] = useState(initialNote.keywords?.join(", ") || "");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorHeight, setEditorHeight] = useState(550);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const isDragging = useRef(false);

  // Advanced Editor display modes
  const [editorMode, setEditorMode] = useState<'standard' | 'split' | 'zen'>('standard');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [titleStr, setTitleStr] = useState(initialNote.title || "");
  const loadedTitle = useRef(initialNote.title || "");

  useEffect(() => {
    setEditingNote(initialNote);
    setTitleStr(initialNote.title || "");
    loadedTitle.current = initialNote.title || "";
    setCategoriesStr(initialNote.categories?.join(", ") || "");
    setKeywordsStr(initialNote.keywords?.join(", ") || "");
  }, [initialNote.id]);

  const prevEnhancing = useRef(isEnhancingNote);
  useEffect(() => {
    if (prevEnhancing.current && !isEnhancingNote) {
       // AI finished, sync state to reflect changes!
       setEditingNote(initialNote);
       setTitleStr(initialNote.title || "");
       loadedTitle.current = initialNote.title || "";
       setCategoriesStr(initialNote.categories?.join(", ") || "");
       setKeywordsStr(initialNote.keywords?.join(", ") || "");
    }
    prevEnhancing.current = isEnhancingNote;
  }, [isEnhancingNote, initialNote]);

  const handleMouseDown = () => {
    isDragging.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const newHeight = window.innerHeight - e.clientY;
    setEditorHeight(Math.max(250, Math.min(newHeight, window.innerHeight * 0.85)));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  // Auto-saving logic
  useEffect(() => {
    const timer = setTimeout(async () => {
      const modifiedNote = PluginManager.runOnNoteSave(editingNote as any);
      const originalNote = notes.find(n => n.id === editingNote.id);
      
      if (
         originalNote &&
         originalNote.title === modifiedNote.title &&
         originalNote.content === modifiedNote.content &&
         originalNote.summary === modifiedNote.summary &&
         originalNote.folder === modifiedNote.folder &&
         originalNote.color === modifiedNote.color &&
         JSON.stringify(originalNote.categories) === JSON.stringify(modifiedNote.categories) &&
         JSON.stringify(originalNote.keywords) === JSON.stringify(modifiedNote.keywords)
      ) {
         return; // no changes to save
      }

      setIsSaving(true);
      await updateNoteData(editingNote.id, {
        title: modifiedNote.title,
        folder: modifiedNote.folder,
        content: modifiedNote.content,
        summary: modifiedNote.summary,
        categories: modifiedNote.categories,
        keywords: modifiedNote.keywords,
        color: modifiedNote.color
      });
      setIsSaving(false);
      setLastSaved(new Date());
    }, 1000);

    return () => clearTimeout(timer);
  }, [editingNote, notes]);

  // Insert formatting markup into editor
  const insertMarkdown = (syntax: string, placeholder = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editingNote.content || "";
    const selectedText = text.substring(start, end);
    
    let replacement = "";
    if (syntax === "bold") {
      replacement = `**${selectedText || placeholder || "bold text"}**`;
    } else if (syntax === "italic") {
      replacement = `*${selectedText || placeholder || "italic text"}*`;
    } else if (syntax === "heading") {
      replacement = `\n## ${selectedText || placeholder || "Heading 2"}\n`;
    } else if (syntax === "heading3") {
      replacement = `\n### ${selectedText || placeholder || "Heading 3"}\n`;
    } else if (syntax === "checklist") {
      replacement = `\n- [ ] ${selectedText || placeholder || "Task item"}\n`;
    } else if (syntax === "list") {
      replacement = `\n- ${selectedText || placeholder || "List item"}\n`;
    } else if (syntax === "wikilink") {
      replacement = `[[${selectedText || placeholder || "Note Name"}]]`;
    } else if (syntax === "code") {
      replacement = selectedText ? `\`${selectedText}\`` : `\n\`\`\`javascript\n${placeholder || "// code here"}\n\`\`\`\n`;
    } else if (syntax === "quote") {
      replacement = `\n> ${selectedText || placeholder || "Blockquote text"}\n`;
    } else if (syntax === "table") {
      replacement = `\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Item 1   | Item 2   |\n`;
    }

    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setEditingNote(prev => ({ ...prev, content: newContent }));

    // Refocus and restore cursor selection
    setTimeout(() => {
      textarea.focus();
      const selectionPos = start + replacement.length;
      textarea.setSelectionRange(selectionPos, selectionPos);
    }, 50);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 pb-safe">
      <motion.div
        initial={{ scale: 0.98, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.98, opacity: 0, y: 10 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="bg-[#0f0f11] border border-white/10 rounded-3xl w-full max-w-5xl h-[85vh] sm:h-[90vh] flex flex-col overflow-hidden shadow-2xl relative ring-1 ring-white/5 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:20px_20px]"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0f0f11] pointer-events-none" />
        <div className="h-1.5 shrink-0 transition-colors duration-500" style={{ backgroundColor: editingNote.color || "rgba(245, 158, 11, 0.4)", boxShadow: editingNote.color ? `0 0 10px ${editingNote.color}` : "none" }} />

        {/* Note View panel */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative pb-14">
          <div className="p-4 md:p-6 flex items-center justify-between shrink-0 sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-md font-bold uppercase tracking-widest flex items-center gap-1.5 font-mono shadow-md backdrop-blur-md">
                <Folder className="w-3.5 h-3.5" /> Note View
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 bg-black/40 backdrop-blur-lg shadow-md text-white/40 hover:text-white rounded-xl hover:bg-white/10 transition-colors border border-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 md:px-12 pb-24 max-w-4xl mx-auto w-full">
            <h1 className="text-4xl font-extrabold text-white/90 mb-4 tracking-tight">{editingNote.title || "Untitled Note"}</h1>
            
            {(editingNote.categories?.length > 0 || editingNote.keywords?.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-8">
                {editingNote.categories?.map((cat: string) => (
                  <span key={cat} className="px-2.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    {cat}
                  </span>
                ))}
                {editingNote.keywords?.map((kw: string) => (
                  <span key={kw} className="px-2.5 py-0.5 bg-white/5 text-white/40 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    {kw}
                  </span>
                ))}
              </div>
            )}

            <div className="prose prose-invert prose-lg md:prose-xl max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-white/95 prose-p:text-white/85 prose-p:leading-relaxed prose-a:text-amber-400 hover:prose-a:text-amber-500 prose-pre:bg-[#0a0a0a] prose-pre:border prose-pre:border-white/10 prose-pre:shadow-xl markdown-body">
              <WikiMarkdown 
                content={editingNote.content || ""} 
                onLinkClick={onLinkClick} 
                onContentChange={(newContent) => {
                  setEditingNote(prev => ({ ...prev, content: newContent }));
                }}
              />
            </div>
            
            <div className="mt-12 pt-8 border-t border-white/10">
               <BacklinksPanel 
                 note={editingNote} 
                 allNotes={notes} 
                 onOpenNote={onOpenNote} 
                 onCreateLinkedNote={onCreateLinkedNote}
               />
            </div>
          </div>
        </div>

        {/* Expanded / Interactive Editor Drawer (Highly Polished) */}
        <div 
          className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-[#070709] bg-[radial-gradient(#ffffff04_1px,transparent_1px)] [background-size:16px_16px] flex flex-col shrink-0 transition-all duration-300 ease-in-out z-20 shadow-[0_-12px_45px_rgba(0,0,0,0.9)]"
          style={{ height: isEditorOpen ? editorHeight : '56px' }}
        >
          {isEditorOpen && (
            <div 
              className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 cursor-ns-resize flex items-center justify-center z-10 group"
              onMouseDown={handleMouseDown}
            >
              <div className="w-14 h-1.5 bg-white/15 group-hover:bg-amber-500 rounded-full transition-colors duration-200" />
            </div>
          )}

          {/* Interactive Toolbar for editing content & choosing layout modes */}
          <div 
            className="flex items-center justify-between px-6 h-14 shrink-0 bg-[#0b0b0e] border-b border-white/5 select-none"
          >
             <div className="flex items-center gap-4 cursor-pointer" onClick={() => setIsEditorOpen(!isEditorOpen)}>
               <span className="text-xs font-bold uppercase tracking-widest text-amber-500/90 flex items-center gap-2">
                 {isEditorOpen ? 'Collapse Editor' : 'Edit Note Content'} 
               </span>
               <div className="flex items-center gap-2">
                 {isSaving ? (
                   <span className="text-[10px] bg-amber-500/10 text-amber-500/80 px-2.5 py-1 rounded-md font-mono flex items-center gap-1.5 opacity-100 transition-opacity">
                     <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                     Saving Note...
                   </span>
                 ) : lastSaved ? (
                   <span className="text-[10px] text-white/30 px-2.5 py-1 font-mono transition-opacity">
                     Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </span>
                 ) : (
                   <span className="text-[10px] hidden sm:inline-block bg-white/5 text-white/30 px-2.5 py-1 rounded-md font-mono">
                     Auto-saving active
                   </span>
                 )}
               </div>
             </div>

             {/* Mode Selector Tabs (Visible only if editor drawer is open) */}
             {isEditorOpen && (
               <div className="flex items-center bg-[#101014] border border-white/5 rounded-xl p-0.5 shrink-0">
                 {[
                   { id: 'standard', label: 'Standard Configuration' },
                   { id: 'split', label: 'Split Live Preview' },
                   { id: 'zen', label: 'Zen Focus' }
                 ].map(m => (
                   <button
                     key={m.id}
                     onClick={(e) => {
                       e.stopPropagation();
                       setEditorMode(m.id as any);
                     }}
                     className={`px-3 py-1.5 text-[9px] uppercase tracking-wider font-extrabold rounded-lg transition-all cursor-pointer ${
                       editorMode === m.id 
                         ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15 shadow-md shadow-amber-500/5' 
                         : 'text-white/40 hover:text-white/75 border border-transparent'
                     }`}
                   >
                     {m.label}
                   </button>
                 ))}
               </div>
             )}

             <button className="text-white/40 hover:text-white transition-colors cursor-pointer" onClick={() => setIsEditorOpen(!isEditorOpen)}>
               {isEditorOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
             </button>
          </div>

          {isEditorOpen && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar flex flex-col justify-between">
               
               {/* 1. View: standard Configuration Mode */}
               {editorMode === 'standard' && (
                 <div className="space-y-4 flex-1">
                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Title</label>
                       <input
                         type="text"
                         value={titleStr}
                         onChange={(e) => {
                           setTitleStr(e.target.value);
                           setEditingNote({ ...editingNote, title: e.target.value });
                         }}
                         onBlur={async () => {
                           const newTitle = titleStr.trim();
                           if (loadedTitle.current && newTitle && loadedTitle.current !== newTitle) {
                              const updates = getNotesToUpdateOnRename(notes, loadedTitle.current, newTitle);
                              await Promise.all(updates.map(u => updateNoteData(u.note.id, { content: u.newContent })));
                              loadedTitle.current = newTitle;
                           }
                         }}
                         className="w-full bg-[#000]/40 shadow-inner border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500/50 focus:bg-[#000]/60 transition-all duration-300 outline-none"
                       />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 flex items-center gap-1"><Folder className="w-3 h-3 text-white/30" /> Parent Folder</label>
                       <input
                         type="text"
                         value={editingNote.folder || ""}
                         onChange={(e) => setEditingNote({ ...editingNote, folder: e.target.value })}
                         className="w-full bg-[#000]/40 shadow-inner border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500/50 focus:bg-[#000]/60 transition-all duration-300 outline-none"
                       />
                     </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Categories (comma sep)</label>
                       <input
                         type="text"
                         value={categoriesStr}
                         onChange={(e) => {
                           setCategoriesStr(e.target.value);
                           const parsed = e.target.value.split(",").map(c => c.trim()).filter(Boolean);
                           setEditingNote(prev => ({ ...prev, categories: parsed }));
                         }}
                         className="w-full bg-[#000]/40 shadow-inner border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500/50 focus:bg-[#000]/60 transition-all duration-300 outline-none"
                       />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Keywords (comma sep)</label>
                       <input
                         type="text"
                         value={keywordsStr}
                         onChange={(e) => {
                           setKeywordsStr(e.target.value);
                           const parsed = e.target.value.split(",").map(k => k.trim()).filter(Boolean);
                           setEditingNote(prev => ({ ...prev, keywords: parsed }));
                         }}
                         className="w-full bg-[#000]/40 shadow-inner border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500/50 focus:bg-[#000]/60 transition-all duration-300 outline-none"
                       />
                     </div>
                   </div>

                   <div className="flex gap-4 h-full min-h-[220px] flex-1">
                     <div className="w-1/2 space-y-1.5 flex flex-col">
                       <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 shrink-0">Markdown Content</label>
                       
                       {/* Formatting Inline Tool Bar */}
                       <div className="flex items-center gap-1.5 p-1 bg-black/50 border border-white/5 rounded-xl self-start shrink-0 mb-1.5">
                         <button onClick={() => insertMarkdown("bold")} title="Bold" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><Bold className="w-3.5 h-3.5" /></button>
                         <button onClick={() => insertMarkdown("italic")} title="Italic" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><Italic className="w-3.5 h-3.5" /></button>
                         <button onClick={() => insertMarkdown("heading")} title="Heading 2" className="p-1.5 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors text-xs font-bold leading-none cursor-pointer">H2</button>
                         <button onClick={() => insertMarkdown("heading3")} title="Heading 3" className="p-1.5 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors text-[10px] font-bold leading-none cursor-pointer">H3</button>
                         <button onClick={() => insertMarkdown("list")} title="Bullet List" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><List className="w-3.5 h-3.5" /></button>
                         <button onClick={() => insertMarkdown("checklist")} title="Task Checklist" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><CheckSquare className="w-3.5 h-3.5" /></button>
                         <button onClick={() => insertMarkdown("code")} title="Code Block" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><Code className="w-3.5 h-3.5" /></button>
                         <button onClick={() => insertMarkdown("quote")} title="Blockquote" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><Quote className="w-3.5 h-3.5" /></button>
                         <button onClick={() => insertMarkdown("table")} title="Insert Table" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><Table className="w-3.5 h-3.5" /></button>
                         <button onClick={() => insertMarkdown("wikilink")} title="Wiki Link" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors text-[10px] font-extrabold shrink-0 cursor-pointer">[[]]</button>
                       </div>

                       <textarea
                         ref={textareaRef}
                         value={editingNote.content || ""}
                         onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                         className="w-full bg-[#000]/40 shadow-inner border border-white/5 rounded-xl p-4 text-sm text-white flex-1 font-mono outline-none focus:border-amber-500/50 focus:bg-[#000]/60 transition-all duration-300 resize-none"
                         placeholder="Write markdown here... use [[Note Name]] to link..."
                       />
                     </div>
                     
                     <div className="w-1/2 flex flex-col gap-4">
                       <div className="space-y-1.5 shrink-0">
                         <label className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">AI Insight Summary</label>
                         <textarea
                           value={editingNote.summary || ""}
                           onChange={(e) => setEditingNote({ ...editingNote, summary: e.target.value })}
                           className="w-full bg-[#000]/40 shadow-inner border border-white/5 rounded-xl p-3 text-xs text-white/70 resize-none h-16 outline-none focus:border-amber-500/50 focus:bg-[#000]/60 transition-all duration-300"
                           placeholder="Short summary insight..."
                         />
                       </div>
                       
                       <div className="space-y-2 mt-auto">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/45">Topic Theme Color</label>
                          <div className="flex items-center gap-2">
                           {["#3b82f6", "#10b981", "#ef4444", "#d97706", "#8b5cf6", "#ec4899", "#6b7280"].map(c => (
                             <button
                               key={c}
                               onClick={() => setEditingNote({ ...editingNote, color: c })}
                               className={`my-theme-color-btn w-6 h-6 rounded-full border-2 ${
                                 editingNote.color === c ? "border-white" : "border-transparent text-transparent"
                               }`}
                               style={{ backgroundColor: c }}
                             />
                           ))}
                         </div>
                       </div>

                       <div className="flex items-center gap-3 mt-4 shrink-0">
                         <button
                           type="button"
                           onClick={async () => {
                             if (window.confirm("Are you sure you want to delete this note permanently?")) {
                               await deleteNote(editingNote.id);
                               onClose();
                             }
                           }}
                           className="px-4 py-2 border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                         >
                           Delete
                         </button>
                         {!editingNote.isConfidential && (
                         <button
                           onClick={() => onAutoCategorize(editingNote)}
                           disabled={isEnhancingNote}
                           className="flex items-center gap-1.5 px-4 py-2 border border-amber-500/20 text-amber-500 hover:bg-amber-500/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                         >
                           <Sparkles className="w-3.5 h-3.5" />
                           {isEnhancingNote ? "Analyzing..." : "Auto-Categorize"}
                         </button>
                         )}
                       </div>
                     </div>
                   </div>
                 </div>
               )}

               {/* 2. View: Split Live Preview Mode */}
               {editorMode === 'split' && (
                 <div className="flex gap-5 flex-1 h-full min-h-[300px]">
                   
                   {/* Left Panel: Raw text input config */}
                   <div className="w-1/2 flex flex-col space-y-1.5 h-full">
                     <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Markdown Content</label>

                     {/* Formatting Inline Tool Bar */}
                     <div className="flex items-center gap-1.5 p-1 bg-black/50 border border-white/5 rounded-xl self-start shrink-0 mb-1.5">
                       <button onClick={() => insertMarkdown("bold")} title="Bold" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><Bold className="w-3.5 h-3.5" /></button>
                       <button onClick={() => insertMarkdown("italic")} title="Italic" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><Italic className="w-3.5 h-3.5" /></button>
                       <button onClick={() => insertMarkdown("heading")} title="Heading 2" className="p-1.5 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors text-xs font-bold leading-none cursor-pointer">H2</button>
                       <button onClick={() => insertMarkdown("heading3")} title="Heading 3" className="p-1.5 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors text-[10px] font-bold leading-none cursor-pointer">H3</button>
                       <button onClick={() => insertMarkdown("list")} title="Bullet List" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><List className="w-3.5 h-3.5" /></button>
                       <button onClick={() => insertMarkdown("checklist")} title="Task Checklist" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><CheckSquare className="w-3.5 h-3.5" /></button>
                       <button onClick={() => insertMarkdown("code")} title="Code Block" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><Code className="w-3.5 h-3.5" /></button>
                       <button onClick={() => insertMarkdown("quote")} title="Blockquote" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><Quote className="w-3.5 h-3.5" /></button>
                       <button onClick={() => insertMarkdown("table")} title="Insert Table" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><Table className="w-3.5 h-3.5" /></button>
                       <button onClick={() => insertMarkdown("wikilink")} title="Wiki Link" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors text-[10px] font-extrabold shrink-0 cursor-pointer">[[]]</button>
                     </div>

                     <textarea
                       ref={textareaRef}
                       value={editingNote.content || ""}
                       onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                       className="w-full bg-[#000]/40 shadow-inner border border-white/5 rounded-xl p-4 text-sm text-white flex-1 font-mono outline-none focus:border-amber-500/50 focus:bg-[#000]/60 transition-all duration-300 resize-none"
                       placeholder="Write markdown here... use [[Note Name]] to link..."
                     />
                   </div>

                   {/* Right Panel: Live compiling render engine */}
                   <div className="w-1/2 flex flex-col space-y-1.5 h-full border-l border-white/5 pl-5">
                     <label className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80">Real-time Markdown Live preview</label>
                     <div className="flex-1 bg-black/10 rounded-2xl border border-white/5 p-4 overflow-y-auto custom-scrollbar prose prose-invert prose-sm max-w-none">
                       <WikiMarkdown 
                         content={editingNote.content || ""} 
                         onLinkClick={onLinkClick} 
                         onContentChange={(newContent) => {
                           setEditingNote(prev => ({ ...prev, content: newContent }));
                         }}
                       />
                     </div>
                   </div>
                 </div>
               )}

               {/* 3. View: Zen Focus Editor Mode */}
               {editorMode === 'zen' && (
                 <div className="w-full max-w-4xl mx-auto flex flex-col space-y-1.5 flex-1 h-full min-h-[320px]">
                   <label className="text-[10px] font-bold uppercase tracking-wider text-white/35">Zen Drafting Canvas</label>

                   {/* Formatting Inline Tool Bar */}
                   <div className="flex items-center gap-1.5 p-1 bg-black/50 border border-white/5 rounded-xl self-start shrink-0 mb-1.5">
                     <button onClick={() => insertMarkdown("bold")} title="Bold" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><Bold className="w-3.5 h-3.5" /></button>
                     <button onClick={() => insertMarkdown("italic")} title="Italic" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><Italic className="w-3.5 h-3.5" /></button>
                     <button onClick={() => insertMarkdown("heading")} title="Heading 2" className="p-1.5 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors text-xs font-bold leading-none cursor-pointer">H2</button>
                     <button onClick={() => insertMarkdown("heading3")} title="Heading 3" className="p-1.5 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors text-[10px] font-bold leading-none cursor-pointer">H3</button>
                     <button onClick={() => insertMarkdown("list")} title="Bullet List" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><List className="w-3.5 h-3.5" /></button>
                     <button onClick={() => insertMarkdown("checklist")} title="Task Checklist" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><CheckSquare className="w-3.5 h-3.5" /></button>
                     <button onClick={() => insertMarkdown("code")} title="Code Block" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><Code className="w-3.5 h-3.5" /></button>
                     <button onClick={() => insertMarkdown("quote")} title="Blockquote" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><Quote className="w-3.5 h-3.5" /></button>
                     <button onClick={() => insertMarkdown("table")} title="Insert Table" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors cursor-pointer"><Table className="w-3.5 h-3.5" /></button>
                     <button onClick={() => insertMarkdown("wikilink")} title="Wiki Link" className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors text-[10px] font-extrabold shrink-0 cursor-pointer">[[]]</button>
                   </div>

                   <textarea
                     ref={textareaRef}
                     value={editingNote.content || ""}
                     onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                     className="w-full bg-[#000]/40 shadow-inner border border-white/5 rounded-2xl p-6 text-sm text-white flex-1 font-mono outline-none focus:border-amber-500/50 focus:bg-[#000]/60 transition-all duration-300 resize-none leading-relaxed"
                     placeholder="Uninterrupted focus writing mode..."
                   />
                 </div>
               )}

            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
