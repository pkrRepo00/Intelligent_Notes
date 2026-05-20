import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { FileText, Sparkles, Folder, Database, LayoutTemplate, BrainCircuit } from 'lucide-react';
import { Note } from '../../types';

export interface NoteNodeData extends Record<string, unknown> {
  id: string;
  title?: string;
  summary?: string;
  categories?: string[];
  color?: string;
  onOpenNote?: (n: Note) => void;
  isConfidential?: boolean;
  folder?: string;
  content: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
}

export const NoteNode = memo(({ data, selected }: { data: any; selected?: boolean }) => {
  const { title, summary, categories = [], color, onOpenNote } = data || {};
  
  // Determine if it maps to a specialized pseudo-node type based on tags/categories
  const isAI = categories.some(c => c.toLowerCase().includes('ai') || c.toLowerCase().includes('prompt') || c.toLowerCase().includes('agent'));
  const isDB = categories.some(c => c.toLowerCase().includes('data') || c.toLowerCase().includes('db') || c.toLowerCase().includes('sql'));
  
  let nodeStyle = {
    themeColor: color || 'rgba(255,255,255,0.1)',
    glowColor: color || 'rgba(255,255,255,0.03)',
    borderColor: 'border-white/5',
    hoverBorderColor: 'hover:border-white/10',
    selectedBorderColor: 'border-amber-500',
    shadowColor: 'rgba(245,158,11,0.2)',
    icon: <FileText className="w-4 h-4 text-white/70" />
  };

  if (isAI) {
    nodeStyle = {
      themeColor: '#8b5cf6', // purple
      glowColor: '#8b5cf6',
      borderColor: 'border-purple-500/20',
      hoverBorderColor: 'hover:border-purple-500/50',
      selectedBorderColor: 'border-purple-500',
      shadowColor: 'rgba(139,92,246,0.3)',
      icon: <BrainCircuit className="w-4 h-4 text-purple-400" />
    };
  } else if (isDB) {
    nodeStyle = {
      themeColor: '#3b82f6', // blue
      glowColor: '#3b82f6',
      borderColor: 'border-blue-500/20',
      hoverBorderColor: 'hover:border-blue-500/50',
      selectedBorderColor: 'border-blue-500',
      shadowColor: 'rgba(59,130,246,0.3)',
      icon: <Database className="w-4 h-4 text-blue-400" />
    };
  }

  return (
    <div 
      onClick={() => onOpenNote?.(data as Note)}
      className={`group relative flex flex-col w-[280px] bg-[#0c0c0c]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-xl transition-all duration-300 cursor-pointer 
        ${selected ? `!border-t-2 !border-solid shadow-2xl scale-[1.02]` : `hover:shadow-2xl hover:-translate-y-0.5`}`}
      style={{
         borderColor: selected ? nodeStyle.themeColor : undefined,
         boxShadow: selected ? `0 8px 30px ${nodeStyle.shadowColor}` : undefined
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-white/10 !w-12 !h-1.5 !rounded-full !border-0 !-mt-1 transition-all group-hover:!bg-white/30" />
      <Handle type="target" position={Position.Left} className="!bg-white/10 !w-1.5 !h-8 !rounded-full !border-0 !-ml-1 transition-all group-hover:!bg-white/30" id="left" />
      
      {/* Glow Effect */}
      <div 
        className="absolute inset-x-0 inset-y-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-2xl" 
        style={{ 
          background: `radial-gradient(circle at top right, ${nodeStyle.glowColor}15, transparent 70%)`
        }} 
      />

      <div className="flex items-start justify-between mb-3 w-full relative z-10">
         <div className="flex items-center gap-2 max-w-[80%]">
            <div className="p-1.5 rounded-lg bg-[#111] shrink-0 border border-white/10 shadow-inner">
               {nodeStyle.icon}
            </div>
            <h3 className="font-semibold text-white/90 text-[15px] truncate tracking-tight">{title || 'Untitled Note'}</h3>
         </div>
         {data.isConfidential && (
           <div className="shrink-0 text-[8px] px-1.5 py-0.5 rounded border border-rose-500/30 text-rose-400 bg-rose-500/10 font-mono tracking-widest">
             LOCAL
           </div>
         )}
      </div>

      <div className="text-xs text-white/40 line-clamp-3 leading-relaxed mb-4 relative z-10 font-medium group-hover:text-white/60 transition-colors">
        {summary || 'No summary available.'}
      </div>

      {(categories.length > 0 || data.folder) && (
        <div className="flex items-center gap-2 pt-3 border-t border-white/5 relative z-10 mt-auto">
          {data.folder && (
            <span className="flex items-center gap-1 text-[10px] text-white/30 font-mono">
              <Folder className="w-3 h-3" />
              {data.folder}
            </span>
          )}
          {categories.slice(0, 2).map((cat, i) => (
             <span key={i} className="text-[9px] px-1.5 py-0.5 bg-white/5 text-white/50 rounded uppercase font-bold tracking-wider border border-white/10">
               {cat}
             </span>
          ))}
          {categories.length > 2 && (
             <span className="text-[9px] text-white/30">+{categories.length - 2}</span>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-white/10 !w-12 !h-1.5 !rounded-full !border-0 !-mb-1 transition-all group-hover:!bg-white/30" />
      <Handle type="source" position={Position.Right} className="!bg-white/10 !w-1.5 !h-8 !rounded-full !border-0 !-mr-1 transition-all group-hover:!bg-white/30" id="right" />
    </div>
  );
});
