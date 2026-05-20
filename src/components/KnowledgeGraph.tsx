import React, { useMemo, useRef, useEffect, useState } from 'react';
import * as go from 'gojs';
import { Note } from '../types';
import { buildGraphIndex } from '../lib/graphEngine';
import { 
  Network, 
  GitBranch, 
  Compass, 
  Layers, 
  Activity, 
  Crosshair, 
  Eye, 
  EyeOff, 
  Search, 
  RefreshCw, 
  X, 
  ZoomIn, 
  ZoomOut, 
  Maximize,
  Sparkles,
  Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface KnowledgeGraphProps {
  notes: Note[];
  onNodeClick: (note: Note) => void;
}

export function KnowledgeGraph({ notes, onNodeClick }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramDivRef = useRef<HTMLDivElement>(null);
  const overviewDivRef = useRef<HTMLDivElement>(null);
  
  const diagramRef = useRef<go.Diagram | null>(null);
  const overviewRef = useRef<go.Overview | null>(null);

  // Graph state controls
  const [activeLayout, setActiveLayout] = useState<'force' | 'circular' | 'tree' | 'layered' | 'radial'>('force');
  const [focusMode, setFocusMode] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Hover states for high-fidelity React previews
  const [hoveredNote, setHoveredNote] = useState<Note | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);

  // Compute standard graph index using existing graphEngine
  const graphIndex = useMemo(() => buildGraphIndex(notes), [notes]);

  // Extract all categories for dynamic filtering
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    notes.forEach(note => {
      note.categories?.forEach(cat => cats.add(cat));
    });
    return Array.from(cats);
  }, [notes]);

  // Define Layout constructor mappings
  const getGoJSLayout = (layoutType: typeof activeLayout) => {
    switch (layoutType) {
      case 'circular':
        return new go.CircularLayout({
          spacing: 60,
          sorting: go.CircularLayout.Optimized,
          radius: NaN
        });
      case 'tree':
        return new go.TreeLayout({
          angle: 90,
          nodeSpacing: 40,
          layerSpacing: 80,
          alignment: go.TreeLayout.AlignmentCenterChildren
        });
      case 'layered':
        return new go.LayeredDigraphLayout({
          direction: 90,
          columnSpacing: 40,
          layerSpacing: 80
        });
      case 'radial':
        return new go.CircularLayout({
          spacing: 140,
          radius: 180
        });
      case 'force':
      default:
        return new go.ForceDirectedLayout({
          defaultSpringLength: 150,
          defaultElectricalCharge: -350,
          maxIterations: 300
        });
    }
  };

  // 1. Initialize GoJS Diagram
  useEffect(() => {
    if (!diagramDivRef.current) return;

    // Build diagram
    const diagram = new go.Diagram(diagramDivRef.current, {
      isReadOnly: false,
      allowDelete: false,
      allowCopy: false,
      initialContentAlignment: go.Spot.Center,
      initialScale: 0.8,
      "undoManager.isEnabled": true,
      "animationManager.isEnabled": true,
      "animationManager.duration": 600,
      "toolManager.hoverDelay": 150,
      padding: 60,
      hasHorizontalScrollbar: false,
      hasVerticalScrollbar: false,
      "clickSelectingTool.standardMouseSelect": function() {
        go.ClickSelectingTool.prototype.standardMouseSelect.call(this);
        const selObj = diagram.selection.first();
        if (selObj instanceof go.Node) {
          setSelectedNodeId(selObj.data.key);
        } else {
          setSelectedNodeId(null);
        }
      }
    });

    diagramRef.current = diagram;

    // Define custom templates
    const $ = go.GraphObject.make;

    // Dynamic color gradient helper
    const getGlowColor = (color: string) => {
      // Return beautiful matching halo color
      return color || '#3b82f6';
    };

    // Node Template
    diagram.nodeTemplate =
      $(go.Node, "Vertical",
        {
          selectionAdorned: false,
          locationSpot: go.Spot.Center,
          isShadowed: true,
          shadowOffset: new go.Point(0, 4),
          shadowBlur: 12,
          shadowColor: "rgba(0, 0, 0, 0.6)",
          mouseEnter: (e, obj) => {
            const node = obj as go.Node;
            if (node && node.data) {
              const rect = diagramDivRef.current?.getBoundingClientRect();
              if (rect) {
                const docPt = node.location;
                const viewPt = diagram.transformDocToView(docPt);
                setHoveredNote(node.data.note);
                setHoverPosition({
                  x: viewPt.x + rect.left,
                  y: viewPt.y + rect.top - 20
                });
              }
              diagram.startTransaction("highlight neighbors");
              node.isHighlighted = true;
              node.findLinksConnected().each(l => l.isHighlighted = true);
              node.findNodesConnected().each(n => n.isHighlighted = true);
              diagram.commitTransaction("highlight neighbors");
            }
          },
          mouseLeave: (e, obj) => {
            setHoveredNote(null);
            const node = obj as go.Node;
            diagram.startTransaction("unhighlight neighbors");
            diagram.nodes.each(n => n.isHighlighted = false);
            diagram.links.each(l => l.isHighlighted = false);
            diagram.commitTransaction("unhighlight neighbors");
          },
          doubleClick: (e, obj) => {
            const node = obj as go.Node;
            if (node && node.data && node.data.note) {
              onNodeClick(node.data.note);
            }
          }
        },
        new go.Binding("visible", "visible"),
        new go.Binding("opacity", "opacity"),

        // Inner glowing shape panel
        $(go.Panel, "Auto",
          $(go.Shape, "Circle",
            {
              fill: "#0a0a0c",
              strokeWidth: 2,
              desiredSize: new go.Size(32, 32),
              cursor: "pointer"
            },
            new go.Binding("fill", "color", (c) => c || "#3b82f6"),
            new go.Binding("stroke", "isHighlighted", (h, obj) => {
              const node = obj.part as go.Node;
              const color = node?.data?.color || "#3b82f6";
              return h ? "#ffffff" : go.Brush.lightenBy(color, 0.1);
            }),
            new go.Binding("strokeWidth", "isHighlighted", h => h ? 3.5 : 2)
          ),
          // Glow filter simulation
          $(go.Shape, "Circle",
            {
              fill: "transparent",
              strokeWidth: 4,
              desiredSize: new go.Size(42, 42),
              opacity: 0.15
            },
            new go.Binding("stroke", "color", (c) => c || "#3b82f6")
          )
        ),

        // Note Labels
        $(go.TextBlock,
          {
            margin: new go.Margin(8, 0, 0, 0),
            font: "500 11.5px 'Inter', sans-serif",
            stroke: "rgba(255, 255, 255, 0.75)",
            isMultiline: false,
            maxSize: new go.Size(130, NaN),
            overflow: go.TextBlock.OverflowEllipsis,
            cursor: "pointer",
            alignment: go.Spot.Center
          },
          new go.Binding("text", "title"),
          new go.Binding("stroke", "isHighlighted", (h) => h ? "#ffffff" : "rgba(255, 255, 255, 0.75)"),
          new go.Binding("font", "isHighlighted", (h) => h ? "600 11.5px 'Inter', sans-serif" : "500 11.5px 'Inter', sans-serif")
        )
      );

    // Link Template with animation capabilities
    diagram.linkTemplate =
      $(go.Link,
        {
          routing: go.Link.Normal,
          curve: go.Link.Bezier,
          adjusting: go.Link.End,
          selectionAdorned: false,
          layerName: "Background"
        },
        new go.Binding("visible", "visible"),
        new go.Binding("opacity", "opacity"),
        $(go.Shape,
          {
            stroke: "rgba(255, 255, 255, 0.18)",
            strokeWidth: 1.5,
            strokeDashArray: [6, 4]
          },
          new go.Binding("stroke", "isHighlighted", (h, obj) => {
            const link = obj.part as go.Link;
            if (h) {
              const node = link.fromNode;
              return node?.data?.color || "#f59e0b";
            }
            return "rgba(255, 255, 255, 0.18)";
          }),
          new go.Binding("strokeWidth", "isHighlighted", h => h ? 2.5 : 1.5),
          new go.Binding("strokeDashArray", "isHighlighted", h => h ? null : [6, 4])
        )
      );

    // Initial Overview Setup
    if (overviewDivRef.current) {
      const overview = new go.Overview(overviewDivRef.current, {
        observed: diagram,
        drawsTemporaryLayers: false,
        padding: 5
      });
      overviewRef.current = overview;
    }

    // Interactive animated pulse for edges
    let dashOffset = 0;
    const intervalId = setInterval(() => {
      dashOffset = (dashOffset - 0.75) % 20;
      diagram.links.each(link => {
        const shape = link.findObject("") as go.Shape;
        if (shape && !link.isHighlighted) {
          shape.strokeDashOffset = dashOffset;
        }
      });
    }, 45);

    // Cleanup resources
    return () => {
      clearInterval(intervalId);
      if (diagramRef.current) {
        diagramRef.current.div = null;
        diagramRef.current.clear();
      }
      if (overviewRef.current) {
        overviewRef.current.div = null;
        overviewRef.current.clear();
      }
    };
  }, [onNodeClick]);

  // 2. Dynamic layouts mapping and updating
  useEffect(() => {
    const diagram = diagramRef.current;
    if (!diagram) return;

    diagram.startTransaction("apply layout");
    diagram.layout = getGoJSLayout(activeLayout);
    diagram.commitTransaction("apply layout");
    diagram.zoomToFit();
  }, [activeLayout]);

  // 3. Process, Filter, and Synchronize data into GoJS
  useEffect(() => {
    const diagram = diagramRef.current;
    if (!diagram) return;

    const { nodes: parsedNodes, links: parsedLinks } = graphIndex;

    // Filter based on search queries and categories selection
    const visibleNodeIds = new Set<string>();

    const nodesData = parsedNodes.map(n => {
      let isVisible = true;
      
      // Match category filter
      if (selectedCategory && !n.note.categories?.includes(selectedCategory)) {
        isVisible = false;
      }

      // Match Search queries
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = n.name.toLowerCase().includes(query);
        const matchesContent = n.note.content?.toLowerCase().includes(query);
        const matchesCategory = n.note.categories?.some(c => c.toLowerCase().includes(query));
        if (!matchesTitle && !matchesContent && !matchesCategory) {
          isVisible = false;
        }
      }

      if (isVisible) {
        visibleNodeIds.add(n.id);
      }

      let isDimmed = false;
      if (focusMode && selectedNodeId) {
        // Focus mode logic: Check if node is the selected one or connected to it
        const isSelected = n.id === selectedNodeId;
        const isNeighbor = parsedLinks.some(l => 
          (l.source === selectedNodeId && l.target === n.id) ||
          (l.target === selectedNodeId && l.source === n.id)
        );
        if (!isSelected && !isNeighbor) {
          isDimmed = true;
        }
      }

      return {
        key: n.id,
        title: n.name,
        color: n.color || '#3b82f6',
        visible: isVisible,
        opacity: isDimmed ? 0.25 : 1.0,
        note: n.note
      };
    });

    const linksData = parsedLinks.map(l => {
      // Link is visible only if BOTH source and target are visible
      const isVisible = visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target);
      
      let isDimmed = false;
      if (focusMode && selectedNodeId) {
        // If focus mode is active, dim links that do not connect to the selected node
        if (l.source !== selectedNodeId && l.target !== selectedNodeId) {
          isDimmed = true;
        }
      }

      return {
        from: l.source,
        to: l.target,
        visible: isVisible,
        opacity: isDimmed ? 0.1 : 1.0
      };
    });

    // Replace model directly (GoJS handles model replacements as their own transaction automatically)
    diagram.model = new go.GraphLinksModel(nodesData, linksData);
    
    // Highlight the selected node in its own transaction
    diagram.startTransaction("select node");
    if (selectedNodeId) {
      const selectedNode = diagram.findNodeForKey(selectedNodeId);
      if (selectedNode) {
        selectedNode.isSelected = true;
        diagram.select(selectedNode);
        diagram.centerRect(selectedNode.actualBounds);
      }
    }
    diagram.commitTransaction("select node");
  }, [graphIndex, searchQuery, selectedCategory, focusMode, selectedNodeId]);

  // Handle zooming & UI helpers
  const handleZoomIn = () => {
    diagramRef.current?.commandHandler.increaseZoom();
  };

  const handleZoomOut = () => {
    diagramRef.current?.commandHandler.decreaseZoom();
  };

  const handleZoomFit = () => {
    diagramRef.current?.zoomToFit();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setFocusMode(false);
    setSelectedNodeId(null);
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-[#030304] rounded-3xl border border-white/5 relative overflow-hidden flex flex-col md:flex-row select-none"
    >
      {/* 1. Sleek Obsidian Left sidebar panel (Filter / Layout Controls) */}
      <div className="w-full md:w-80 bg-[#070709]/90 border-r border-white/5 backdrop-blur-xl p-5 flex flex-col gap-5 z-20 overflow-y-auto">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Knowledge Graph</h2>
        </div>

        {/* Dynamic Search Box */}
        <div className="relative">
          <Search className="absolute left-3 top-[11px] w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search within graph..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#000]/60 border border-white/5 hover:border-white/10 focus:border-amber-500/50 rounded-xl py-2 px-9 text-xs text-white placeholder-white/30 transition-all outline-none"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-[11px] hover:text-white text-white/40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Layout Mode Selector Grid */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Visual Layout Map</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'force', label: 'Obsidian Force', icon: Network },
              { id: 'circular', label: 'Concentric Ring', icon: Compass },
              { id: 'tree', label: 'Hierarchy Tree', icon: GitBranch },
              { id: 'layered', label: 'Step Layered', icon: Layers },
              { id: 'radial', label: 'Cluster Radial', icon: Activity },
            ].map(layout => {
              const Icon = layout.icon;
              const isActive = activeLayout === layout.id;
              return (
                <button
                  key={layout.id}
                  onClick={() => setActiveLayout(layout.id as any)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-300 gap-1.5 ${
                    isActive 
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.05)]' 
                      : 'bg-white/[0.02] border-white/5 hover:border-white/10 text-white/55 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] font-medium tracking-tight whitespace-nowrap">{layout.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Focus Mode & Controls */}
        <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 flex items-center justify-between">
            <span>Special Views</span>
            {focusMode && <span className="text-[9px] bg-amber-500/20 text-amber-500 px-1 rounded font-normal">Active</span>}
          </label>
          <button
            onClick={() => setFocusMode(prev => !prev)}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-medium transition-all duration-300 ${
              focusMode 
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' 
                : 'bg-white/[0.02] border-white/5 hover:border-white/10 text-white/70 hover:text-white'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            <span>Focus Mode (1st Degree Only)</span>
          </button>
        </div>

        {/* Category Filters panel */}
        <div className="flex flex-col gap-2 flex-grow overflow-hidden border-t border-white/5 pt-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 flex items-center justify-between">
            <span>Tags & Categories</span>
            {selectedCategory && (
              <button onClick={() => setSelectedCategory(null)} className="text-[10px] text-amber-500/70 hover:text-amber-500 font-bold uppercase tracking-wide">
                Clear
              </button>
            )}
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
            {allCategories.length === 0 ? (
              <span className="text-xs text-white/30 italic">No category tags present.</span>
            ) : (
              allCategories.map(cat => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(isSelected ? null : cat)}
                    className={`text-[10px] px-2.5 py-1.5 rounded-lg border font-medium transition-all ${
                      isSelected 
                        ? 'bg-white/10 border-white/20 text-white shadow-sm' 
                        : 'bg-white/[0.02] border-white/5 hover:border-white/10 text-white/50 hover:text-white/80'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Filter Reset */}
        {(searchQuery || selectedCategory || focusMode || selectedNodeId) && (
          <button
            onClick={handleResetFilters}
            className="w-full flex items-center justify-center gap-2 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 py-2.5 rounded-xl text-xs font-bold transition-all text-center"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>RESET FILTERS</span>
          </button>
        )}
      </div>

      {/* 2. Primary GoJS interactive canvas graph map */}
      <div className="flex-grow h-[450px] md:h-auto relative">
        {/* Canvas div for GoJS */}
        <div 
          ref={diagramDivRef} 
          className="w-full h-full cursor-grab active:cursor-grabbing bg-radial-[circle_at_center,_var(--tw-gradient-stops)] from-[#07070a] to-[#010102]"
        />

        {/* Dynamic UI Overlay Badges */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
          <div className="bg-black/60 border border-white/5 backdrop-blur-md px-3.5 py-2 rounded-xl text-[10px] font-mono text-white/50 flex items-center gap-2 shadow-xl">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>NODES: {notes.length}</span>
            <span className="text-white/20">|</span>
            <span>LINKS: {graphIndex.links.length}</span>
          </div>
          {selectedNodeId && (
            <div className="bg-amber-500/10 border border-amber-500/20 backdrop-blur-md px-3.5 py-2 rounded-xl text-[10px] font-mono text-amber-500 flex items-center gap-2 shadow-xl">
              <span>SELECTED INDEX NODE</span>
            </div>
          )}
        </div>

        {/* Canvas Toolbar Controls (Bottom-left) */}
        <div className="absolute bottom-4 left-4 z-10 flex items-center bg-black/60 border border-white/5 backdrop-blur-md p-1.5 rounded-xl gap-1 shadow-2xl">
          <button 
            onClick={handleZoomIn} 
            title="Zoom In"
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button 
            onClick={handleZoomOut} 
            title="Zoom Out"
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button 
            onClick={handleZoomFit} 
            title="Fit Entire Graph"
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all"
          >
            <Maximize className="w-4 h-4" />
          </button>
          <span className="w-[1px] h-4 bg-white/10 mx-1" />
          <button 
            onClick={() => setShowMinimap(!showMinimap)} 
            title="Toggle Minimap"
            className={`p-2 rounded-lg transition-all ${
              showMinimap ? 'text-amber-500 hover:text-amber-400 hover:bg-amber-500/5' : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {showMinimap ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>

        {/* GoJS Minimap / Overview panel (Bottom-right) */}
        <AnimatePresence>
          {showMinimap && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute bottom-4 right-4 z-10 w-[140px] h-[100px] bg-black/80 rounded-2xl border border-white/5 overflow-hidden shadow-2xl shadow-black/80"
            >
              <div ref={overviewDivRef} className="w-full h-full bg-[#030305]" />
              <div className="absolute top-1 left-2 pointer-events-none text-[8px] font-mono uppercase tracking-wider text-white/30">
                Minimap
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* High-Fidelity Floating HTML Hover Tooltip Preview */}
        <AnimatePresence>
          {hoveredNote && hoverPosition && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                left: hoverPosition.x,
                top: hoverPosition.y,
                transform: 'translate(-50%, -100%)',
              }}
              className="z-50 pointer-events-none w-72 bg-gradient-to-b from-[#0f0f13] to-[#070709] border border-white/10 rounded-2xl p-4 shadow-[0_12px_30px_rgb(0,0,0,0.85)] flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold text-white tracking-tight line-clamp-1">
                  {hoveredNote.title || 'Untitled'}
                </span>
                {hoveredNote.color && (
                  <span 
                    className="w-2.5 h-2.5 rounded-full shadow-inner flex-shrink-0"
                    style={{ backgroundColor: hoveredNote.color }}
                  />
                )}
              </div>

              {hoveredNote.summary ? (
                <p className="text-[11px] text-white/50 leading-relaxed font-normal">
                  {hoveredNote.summary}
                </p>
              ) : (
                <p className="text-[11px] text-white/40 italic font-light truncate">
                  {hoveredNote.content ? hoveredNote.content.slice(0, 100) : "Empty note content."}
                </p>
              )}

              {/* Tag Badges row */}
              {hoveredNote.categories && hoveredNote.categories.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {hoveredNote.categories.map(cat => (
                    <span 
                      key={cat} 
                      className="text-[9px] bg-white/[0.04] text-white/60 px-1.5 py-0.5 rounded border border-white/5 font-mono"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5 text-[9px] font-mono text-white/30 pt-1 border-t border-white/5 mt-0.5">
                <Link2 className="w-3 h-3 text-white/20" />
                <span>Double-click node to open</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
