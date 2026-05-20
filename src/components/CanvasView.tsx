import React, { useMemo, useCallback } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
  addEdge,
  Connection
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Note } from '../types';
import { NoteNode } from './canvas/NoteNode';
import { AnimatedEdge } from './canvas/AnimatedEdge';

interface CanvasViewProps {
  notes: Note[];
  onOpenNote: (note: Note) => void;
}

const nodeTypes = {
  noteNode: NoteNode as any,
};

const edgeTypes = {
  animatedEdge: AnimatedEdge,
};

export function CanvasView({ notes, onOpenNote }: CanvasViewProps) {
  // Compute initial layout in a simple circle/grid if no coordinates exist
  // We'll calculate a simple grid layout based on node counts
  const initialNodes = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(notes.length));
    const spacingX = 350;
    const spacingY = 250;
    
    return notes.map((note, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      return {
        id: note.id,
        type: 'noteNode',
        position: { x: col * spacingX, y: row * spacingY },
        data: {
          ...note,
          onOpenNote,
        },
      };
    });
  }, [notes, onOpenNote]);

  const initialEdges = useMemo(() => {
    const e: any[] = [];
    const indexMap = new Map<string, string>(); // lowercase Title -> ID
    notes.forEach(note => {
      if (note.title) {
        indexMap.set(note.title.toLowerCase(), note.id);
      }
    });

    notes.forEach(note => {
      const wikiLinkRegex = /\[\[(.*?)\]\]/g;
      let match;
      if (!note.content) return;
      while ((match = wikiLinkRegex.exec(note.content)) !== null) {
        const targetTitle = match[1].toLowerCase();
        if (indexMap.has(targetTitle)) {
          const targetId = indexMap.get(targetTitle);
          // Only add edge if source and target are different
          if (targetId && targetId !== note.id) {
             e.push({
                id: `e-${note.id}-${targetId}`,
                source: note.id,
                target: targetId,
                type: 'animatedEdge',
                markerEnd: {
                   type: MarkerType.ArrowClosed,
                   color: '#555',
                   width: 15,
                   height: 15,
                },
             });
          }
        }
      }
    });
    return e;
  }, [notes]);

  // Use state to enable dragging
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync state when props notes change
  React.useEffect(() => {
    setNodes(currentNodes => {
      const existingPositions = new Map(currentNodes.map(n => [n.id, n.position]));
      
      return initialNodes.map(inNode => ({
        ...inNode,
        position: existingPositions.get(inNode.id) || inNode.position
      }));
    });
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);
  
  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({
    ...params,
    type: 'animatedEdge',
    markerEnd: {
       type: MarkerType.ArrowClosed,
       color: '#555',
       width: 15,
       height: 15,
    }
  }, eds)), [setEdges]);

  return (
    <div className="w-full h-full bg-[#050505] rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={2}
        snapToGrid={true}
        snapGrid={[24, 24]}
        colorMode="dark"
        className="bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-neutral-900/40 via-[#050505] to-[#050505]"
        connectionLineStyle={{ stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '4 4' }}
        defaultEdgeOptions={{ type: 'animatedEdge', markerEnd: { type: MarkerType.ArrowClosed, color: '#555' } }}
        elementsSelectable={true}
        selectNodesOnDrag={false}
      >
        <Background 
           variant={BackgroundVariant.Dots} 
           gap={24} 
           size={1} 
           color="rgba(255, 255, 255, 0.05)" 
        />
        
        <Controls 
          className="!bg-[#0c0c0c] !border !border-white/10 !rounded-xl overflow-hidden !m-4 shadow-xl fill-white/60"
          showInteractive={false}
        />
        
        <MiniMap 
           className="!bg-[#0c0c0c]/80 backdrop-blur-md !border !border-white/10 !rounded-xl overflow-hidden !m-4 shadow-xl"
           maskColor="rgba(0, 0, 0, 0.6)"
           nodeColor={(node) => {
             const data = node.data as any;
             return data?.color || 'rgba(255, 255, 255, 0.1)';
           }}
           nodeBorderRadius={4}
        />

        <Panel position="top-left" className="m-4">
           <div className="flex items-center gap-3 bg-[#0c0c0c]/80 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-xl shadow-xl">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-white/50">Graph Network</span>
           </div>
        </Panel>
      </ReactFlow>
      
      {/* Premium glow edge styles */}
      <style>{`
        .react-flow__controls-button {
           background: transparent !important;
           border-bottom: 1px solid rgba(255,255,255,0.05) !important;
           transition: all 0.2s ease;
        }
        .react-flow__controls-button:hover {
           background: rgba(255,255,255,0.05) !important;
           fill: #fff;
        }
        .react-flow__controls-button:last-child {
           border-bottom: none !important;
        }
      `}</style>
    </div>
  );
}