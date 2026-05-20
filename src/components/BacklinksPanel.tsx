import { Note } from '../types';
import { Sparkles, Link, ArrowRight, Network } from 'lucide-react';
import { useMemo } from 'react';
import { buildGraphIndex } from '../lib/graphEngine';

interface BacklinksPanelProps {
  note: Note;
  allNotes: Note[];
  onOpenNote: (note: Note) => void;
  onCreateLinkedNote: (title: string) => void;
}

export function BacklinksPanel({ note, allNotes, onOpenNote, onCreateLinkedNote }: BacklinksPanelProps) {
  const { backlinksMap, outgoingMap } = useMemo(() => buildGraphIndex(allNotes), [allNotes]);
  
  const backlinks = backlinksMap.get(note.id) || [];
  
  const unresolvedLinks = useMemo(() => {
    if (!note.content) return [];
    const targets = new Set<string>();
    const regex = /\[\[(.*?)\]\]/g;
    let match;
    while ((match = regex.exec(note.content)) !== null) {
      const parts = match[1].split('|');
      targets.add(parts[0]);
    }
    const missing: string[] = [];
    targets.forEach(target => {
       if (!allNotes.some(n => n.title?.toLowerCase() === target.toLowerCase())) {
          missing.push(target);
       }
    });
    return missing;
  }, [note.content, allNotes]);

  const relatedNotes = useMemo(() => {
    return allNotes.filter(n => {
      if (n.id === note.id) return false;
      const sharedKeywords = (n.keywords || []).filter(k => (note.keywords || []).includes(k));
      const sharedCats = (n.categories || []).filter(c => (note.categories || []).includes(c));
      return (sharedKeywords.length + sharedCats.length) >= 2;
    }).slice(0, 5);
  }, [allNotes, note.keywords, note.categories]);

  const getContext = (sourceContent: string, targetTitle: string) => {
    if (!targetTitle) return sourceContent.substring(0, 100);
    try {
      const escapedTitle = targetTitle.replace(/[.*k?^$x}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(.{0,40}\\[\\[.*?${escapedTitle}.*?\\]\\].{0,40})`, 'i');
      const match = sourceContent.match(regex);
      return match ? '...' + match[1].replace(/\n/g, ' ') + '...' : sourceContent.substring(0, 100) + '...';
    } catch(e) {
      return sourceContent.substring(0, 100) + '...';
    }
  };

  return (
    <div className="mt-8 flex flex-col gap-6">
      <div className="border-t border-white/10 pt-6">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-4 flex items-center gap-2">
          <Link className="w-3.5 h-3.5" /> Linked Mentions ({
            backlinks.length
          })
        </h4>
        <div className="space-y-2">
          {backlinks.map(n => (
            <button
              key={'bl-' + n.id}
              onClick={() => onOpenNote(n)}
              className="text-left w-full bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-3 text-xs transition-colors group"
            >
              <div className="font-semibold text-amber-500 mb-1 flex items-center justify-between">
                {n.title || 'Untitled'}
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-white/60 font-mono text-[10px] bg-black/20 p-2 rounded line-clamp-2">
                {getContext(n.content, note.title || '')}
              </div>
            </button>
          ))}
          {
            backlinks.length === 0 && (
              <div className="text-xs text-white/30 italic">No backlinks found.</div>
            )
          }
        </div>
      </div>
      
      { unresolvedLinks.length > 0 && (
        <div className="border-t border-white/10 pt-6">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-4 flex items-center gap-2">
            <Link className="w-3.5 h-3.5 text-rose-500" /> Unresolved Links ({unresolvedLinks.length})
          </h4>
          <div className="space-y-2">
            {unresolvedLinks.map(target => (
              <div key={'unres-' + target} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 border border-rose-500/10 rounded-xl p-3 text-xs">
                <span className="font-semibold text-rose-400">{target}</span>
                <button
                  onClick={() => onCreateLinkedNote(target)}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors font-medium text-[10px] uppercase tracking-wider"
                >
                  Create Note
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      { relatedNotes.length > 0 && (
        <div className="border-t border-white/10 pt-6">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-4 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Semantic Related
          </h4>
          <div className="space-y-2">
            { relatedNotes.map(n => (
              <button
                key={'rel-' + n.id}
                onClick={() => onOpenNote(n)}
                className="text-left w-full bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10 rounded-xl p-3 text-xs transition-colors group"
              >
                <div className="font-semibold text-amber-400 mb-1 flex items-center justify-between">
                  {n.title || 'Untitled'}
                  <Network className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-white/50 line-clamp-1">{n.summary || n.content}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}