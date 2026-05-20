import { memo } from 'react';
import { BaseEdge, EdgeProps, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';

export const AnimatedEdge = memo(({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* Background glow for selected or subtle track */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 4 : 2,
          stroke: selected ? '#f59e0b' : '#333333',
          opacity: selected ? 0.4 : 0.8,
          filter: selected ? 'drop-shadow(0 0 8px rgba(245,158,11,0.5))' : 'none',
          transition: 'all 0.3s ease',
        }}
      />
      {/* Animated dashed line on top */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: 2,
          stroke: selected ? '#fbbf24' : '#555555',
          strokeDasharray: '4 4',
          animation: 'dashdraw 20s linear infinite',
          transition: 'all 0.3s ease',
        }}
        className="react-flow__edge-path-animated"
      />
      <style>{`
        @keyframes dashdraw {
          from {
            stroke-dashoffset: 1000;
          }
        }
      `}</style>
    </>
  );
});
