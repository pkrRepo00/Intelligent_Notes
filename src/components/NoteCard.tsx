import React from "react";
import { motion } from "motion/react";
import { Folder, Pin, Lock, Trash2, Sparkles, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
import { Note } from "../types";
import { WikiMarkdown } from "./WikiMarkdown";

export interface NoteCardProps {
  note: Note;
  notes: Note[];
  onOpen: () => void;
  onTogglePin: (note: Note, e: React.MouseEvent) => void;
  onLinkClick: (title: string) => void;
  onTagClick: (kw: string) => void;
  onDelete: (e: React.MouseEvent) => void;
  onEnhance: (e: React.MouseEvent) => void;
  isEnhancing: boolean;
}

export const NoteCard = React.memo(function NoteCard({
  note,
  onOpen,
  onTogglePin,
  onLinkClick,
  onTagClick,
  onDelete,
  onEnhance,
  isEnhancing
}: NoteCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onClick={onOpen}
      className="bg-[#0a0a0a]/60 backdrop-blur-xl break-inside-avoid border border-white/5 rounded-3xl p-6 transition-all duration-300 group relative flex flex-col cursor-pointer hover:-translate-y-1 overflow-hidden shadow-xl hover:shadow-2xl hover:border-white/10"
      style={{
        boxShadow: note.color ? `0 8px 32px ${note.color}0f` : undefined,
      }}
    >
      <div 
        className="absolute inset-x-0 inset-y-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" 
        style={{ 
          background: note.color ? `radial-gradient(circle at top right, ${note.color}15, transparent 70%)` : 'radial-gradient(circle at top right, rgba(255,255,255,0.03), transparent 70%)'
        }} 
      />
      <div 
        className="absolute inset-x-0 top-0 h-[2px] opacity-40 group-hover:opacity-100 transition-opacity duration-300" 
        style={{ background: note.color ? `linear-gradient(90deg, transparent, ${note.color}, transparent)` : 'linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.4), transparent)' }} 
      />
      
      <button
        onClick={(e) => { e.stopPropagation(); onTogglePin(note, e); }}
        className={cn(
          "absolute top-4 right-4 p-2 rounded-full transition-all z-10",
          note.isPinned
            ? "text-amber-500 bg-amber-500/10"
            : "text-white/20 hover:text-white/60 hover:bg-white/5 opacity-0 group-hover:opacity-100"
        )}
        title={note.isPinned ? "Unpin note" : "Pin note"}
      >
        <Pin className={cn("w-4 h-4", note.isPinned && "fill-amber-500")} />
      </button>

      {note.isConfidential && (
        <div className="absolute top-4 left-4 p-2 text-rose-400/80 bg-rose-500/10 rounded-full z-10" title="Confidential - Kept safe from AI">
          <Lock className="w-4 h-4" />
        </div>
      )}

      {!note.title && !note.categories?.length && !note.isConfidential && (
        <div className="absolute top-14 right-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-500 border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 rounded-md">
           <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          AI Analyzing
        </div>
      )}
      
      {note.folder && (
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-500/80 uppercase tracking-widest mb-2.5 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 w-fit">
          <Folder className="w-3 h-3 text-amber-500" />
          {note.folder}
        </div>
      )}

      {note.title && (
        <h3 className="text-xl font-semibold tracking-tight text-white/90 mb-2 group-hover:text-white transition-colors duration-300 pr-12">
          {note.title}
        </h3>
      )}
      
      {note.summary && (
        <p className="text-[13px] text-white/50 mb-4 leading-relaxed border-l-2 border-white/10 group-hover:border-amber-500/40 pl-3 italic transition-colors duration-300">
           {note.summary}
        </p>
      )}

      <div className={cn(
        "prose prose-sm prose-invert prose-neutral line-clamp-6 mb-4",
        note.isConfidential ? "text-white/30 blur-[2px] hover:blur-0 transition-all duration-300" : "text-white/70 group-hover:text-white/90 transition-colors duration-300"
      )}>
        <div className="markdown-body text-xs relative z-0">
          <WikiMarkdown content={note.content} onLinkClick={onLinkClick} />
        </div>
      </div>

      {note.categories && note.categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-auto mb-2 relative z-10">
          {note.categories.map(cat => (
            <span 
              key={cat} 
              className="px-2.5 py-1 bg-white/5 group-hover:bg-white/10 border border-white/5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors duration-300"
              style={{
                color: note.color || 'rgba(255,255,255,0.7)',
              }}
            >
              #{cat}
            </span>
          ))}
        </div>
      )}

      {note.keywords && note.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 mb-2.5 border-t border-white/5 pt-2 relative z-10">
          {note.keywords.map(kw => (
            <span 
              key={kw} 
              className="text-[9px] font-mono text-white/35 hover:text-amber-400 hover:underline transition-colors shrink-0 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onTagClick(kw);
              }}
            >
              🔑 {kw}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-auto opacity-0 group-hover:opacity-100 transition-opacity z-10 relative">
        <span className="text-[10px] text-white/30 font-medium uppercase tracking-wider">
          {formatDistanceToNow(note.createdAt, { addSuffix: true })}
        </span>
        
        <div className="flex items-center gap-2">
           {!note.isConfidential && (
             <button
               disabled={isEnhancing}
               onClick={onEnhance}
               className="text-white/20 hover:text-amber-400 p-1.5 hover:bg-amber-500/10 rounded-md transition-colors"
               title="Regenerate Insights"
             >
               {isEnhancing ? <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> : <Sparkles className="w-4 h-4" />}
             </button>
           )}
           <button
            onClick={onDelete}
            className="text-white/20 hover:text-rose-400 p-1.5 hover:bg-rose-500/10 rounded-md transition-colors"
            title="Delete Note"
           >
             <Trash2 className="w-4 h-4" />
           </button>
        </div>
      </div>
    </motion.div>
  );
});
