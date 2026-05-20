
import { Note } from '../types';

export interface GraphNode {
  id: string;
  name: string;
  color: string;
  val: number;
  note: Note;
  neighbors: GraphNode[];
  links: any[];
}

export interface GraphLink {
  source: string;
  target: string;
  color: string;
  label?: string;
  animated?: boolean;
}

export interface GraphIndex {
  nodes: GraphNode[];
  links: GraphLink[];
  backlinksMap: Map<string, Note[]>; // targetNoteId -> sourceNotes[]
  outgoingMap: Map<string, Note[]>; // sourceNoteId -> targetNotes[]
  unresolvedLinks: Map<string, string[]>; // targetTitleLowerCase -> sourceNoteId[]
}

const parseWikiLinks = (content: string) => {
  const links: { target: string, display: string }[] = [];
  const regex = /\[\[(.*?)\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const parts = match[1].split('|');
    links.push({
      target: parts[0],
      display: parts.length > 1 ? parts[1] : parts[0]
    });
  }
  return links;
};

export const buildGraphIndex = (notes: Note[]): GraphIndex => {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const backlinksMap = new Map<string, Note[]>();
  const outgoingMap = new Map<string, Note[]>();
  const unresolvedLinks = new Map<string, string[]>();
  
  const titleToIdMap = new Map<string, string>();
  
  notes.forEach(note => {
    if (note.title) {
      titleToIdMap.set(note.title.toLowerCase(), note.id);
    }
    
    nodes.push({
      id: note.id,
      name: note.title || 'Untitled',
      color: note.color || '#3b82f6',
      val: Math.max(3, Math.min(12, Math.sqrt(note.content?.length || 0) / 4)),
      note: note,
      neighbors: [],
      links: []
    });
    
    backlinksMap.set(note.id, []);
    outgoingMap.set(note.id, []);
  });

  notes.forEach(note => {
    if (!note.content) return;
    
    const parsedLinks = parseWikiLinks(note.content);
    const seenTargets = new Set<string>(); // prevent duplicate edges
    
    parsedLinks.forEach(l => {
      const targetTitle = l.target.toLowerCase();
      if (seenTargets.has(targetTitle)) return;
      seenTargets.add(targetTitle);
      
      const targetId = titleToIdMap.get(targetTitle);
      if (targetId && targetId !== note.id) {
        links.push({
          source: note.id,
          target: targetId,
          color: 'rgba(255,255,255,0.15)',
          animated: true
        });
        
        backlinksMap.get(targetId)?.push(note);
        outgoingMap.get(note.id)?.push(notes.find(n => n.id === targetId)!);
      } else if (!targetId) {
        if (!unresolvedLinks.has(targetTitle)) {
          unresolvedLinks.set(targetTitle, []);
        }
        unresolvedLinks.get(targetTitle)!.push(note.id);
      }
    });
  });

  // Populate node neighbors for visualization
  links.forEach(link => {
    const a = nodes.find(n => n.id === link.source);
    const b = nodes.find(n => n.id === link.target);
    if (a && b) {
      a.neighbors.push(b);
      b.neighbors.push(a);
      a.links.push(link);
      b.links.push(link);
    }
  });

  return { nodes, links, backlinksMap, outgoingMap, unresolvedLinks };
};

export const getNotesToUpdateOnRename = (
  notes: Note[], 
  oldTitle: string, 
  newTitle: string
): { note: Note, newContent: string }[] => {
  if (!oldTitle || !newTitle || oldTitle === newTitle) return [];
  
  const modifiedNotes: { note: Note, newContent: string }[] = [];
  
  const escapedOld = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp("(\\[\\[)(" + escapedOld + ")((?:\\|.*?)?\\]\\])", "gi");

  notes.forEach(note => {
    if (!note.content) return;
    let modified = false;
    const newContent = note.content.replace(regex, (match, prefix, linkName, suffix) => {
      modified = true;
      return prefix + newTitle + suffix;
    });

    if (modified) {
      modifiedNotes.push({ note, newContent });
    }
  });

  return modifiedNotes;
};
