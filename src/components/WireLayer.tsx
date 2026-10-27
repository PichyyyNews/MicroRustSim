import React, { useState } from 'react';
import { CircuitWire } from '../types';

export interface OrthoSegment {
  index: number;
  orientation: 'horizontal' | 'vertical';
  pStart: { x: number; y: number };
  pEnd: { x: number; y: number };
  mid: { x: number; y: number };
  length: number;
}

export interface WireLayerProps {
  wires: CircuitWire[];
  getPinWorldPos: (compId: string, pinName: string) => { x: number; y: number } | null;
  draggingWire: { fromX: number; fromY: number; toX: number; toY: number; color: string } | null;
  activeTool: 'select' | 'move' | 'wire' | 'eraser';
  globalRoutingMode?: 'curve' | 'ortho';
  selectedWireId?: string | null;
  onWireClick?: (wireId: string) => void;
  onStartDragSegment?: (
    wireId: string,
    segIndex: number,
    orientation: 'horizontal' | 'vertical',
    e: React.MouseEvent
  ) => void;
  onStartDragWaypoint?: (wireId: string, waypointIndex: number, e: React.MouseEvent) => void;
  onAddAndDragWaypoint?: (
    wireId: string,
    insertIndex: number,
    initialPoint: { x: number; y: number },
    e: React.MouseEvent
  ) => void;
  onDeleteWaypoint?: (wireId: string, waypointIndex: number) => void;
}

/**
 * Resolves full list of orthogonal vertices from p1 through waypoints to p2.
 * Guarantees every segment is strictly horizontal or vertical.
 */
export function getOrthoVertices(
  p1: { x: number; y: number },
  waypoints: { x: number; y: number }[] | undefined,
  p2: { x: number; y: number }
): { x: number; y: number }[] {
  if (!waypoints || waypoints.length === 0) {
    if (p1.x === p2.x || p1.y === p2.y) {
      return [p1, p2];
    }
    const midX = Math.round((p1.x + p2.x) / 2);
    return [p1, { x: midX, y: p1.y }, { x: midX, y: p2.y }, p2];
  }

  // Route cleanly through intermediate waypoints at 90-degree right angles
  const result: { x: number; y: number }[] = [p1];
  let prev = p1;
  for (const wp of waypoints) {
    if (wp.x !== prev.x && wp.y !== prev.y) {
      const corner = { x: wp.x, y: prev.y };
      result.push(corner);
      prev = corner;
    }
    result.push(wp);
    prev = wp;
  }
  if (p2.x !== prev.x && p2.y !== prev.y) {
    result.push({ x: p2.x, y: prev.y });
  }
  result.push(p2);

  // Clean consecutive identical points
  const deduped: { x: number; y: number }[] = [];
  for (let i = 0; i < result.length; i++) {
    if (i === 0 || result[i].x !== result[i - 1].x || result[i].y !== result[i - 1].y) {
      deduped.push(result[i]);
    }
  }
  return deduped.length >= 2 ? deduped : [p1, p2];
}

/**
 * Computes segments from orthogonal vertices for Canva-style segment dragging.
 */
export function computeOrthoSegments(vertices: { x: number; y: number }[]): OrthoSegment[] {
  const segments: OrthoSegment[] = [];
  for (let i = 0; i < vertices.length - 1; i++) {
    const pStart = vertices[i];
    const pEnd = vertices[i + 1];
    const dx = Math.abs(pEnd.x - pStart.x);
    const dy = Math.abs(pEnd.y - pStart.y);
    const orientation: 'horizontal' | 'vertical' = dx >= dy ? 'horizontal' : 'vertical';
    const mid = {
      x: Math.round((pStart.x + pEnd.x) / 2),
      y: Math.round((pStart.y + pEnd.y) / 2),
    };
    const length = orientation === 'horizontal' ? dx : dy;
    segments.push({
      index: i,
      orientation,
      pStart,
      pEnd,
      mid,
      length,
    });
  }
  return segments;
}

/**
 * Updates orthogonal polyline when dragging a segment by (dx, dy).
 * Shifts the entire line segment while keeping all corners at 90 degrees.
 */
export function updateOrthoSegment(
  startVertices: { x: number; y: number }[],
  segIndex: number,
  orientation: 'horizontal' | 'vertical',
  dx: number,
  dy: number,
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): { x: number; y: number }[] {
  const N = startVertices.length - 1;
  if (N <= 0) return [p1, p2];

  const verts = startVertices.map((v) => ({ ...v }));
  verts[0] = { ...p1 };
  verts[N] = { ...p2 };

  // Single segment straight line
  if (N === 1) {
    if (orientation === 'horizontal') {
      const newY = Math.round(startVertices[0].y + dy);
      return [p1, { x: p1.x, y: newY }, { x: p2.x, y: newY }, p2];
    } else {
      const newX = Math.round(startVertices[0].x + dx);
      return [p1, { x: newX, y: p1.y }, { x: newX, y: p2.y }, p2];
    }
  }

  // First segment (connected to p1)
  if (segIndex === 0) {
    if (orientation === 'horizontal') {
      const newY = Math.round(startVertices[0].y + dy);
      return [p1, { x: p1.x, y: newY }, { x: verts[1].x, y: newY }, ...verts.slice(2)];
    } else {
      const newX = Math.round(startVertices[0].x + dx);
      return [p1, { x: newX, y: p1.y }, { x: newX, y: verts[1].y }, ...verts.slice(2)];
    }
  }

  // Last segment (connected to p2)
  if (segIndex === N - 1) {
    if (orientation === 'horizontal') {
      const newY = Math.round(startVertices[N].y + dy);
      return [
        ...verts.slice(0, N - 1),
        { x: verts[N - 1].x, y: newY },
        { x: p2.x, y: newY },
        p2,
      ];
    } else {
      const newX = Math.round(startVertices[N].x + dx);
      return [
        ...verts.slice(0, N - 1),
        { x: newX, y: verts[N - 1].y },
        { x: newX, y: p2.y },
        p2,
      ];
    }
  }

  // Internal segment (between intermediate corners)
  if (orientation === 'vertical') {
    const newX = Math.round(startVertices[segIndex].x + dx);
    verts[segIndex].x = newX;
    verts[segIndex + 1].x = newX;
  } else {
    const newY = Math.round(startVertices[segIndex].y + dy);
    verts[segIndex].y = newY;
    verts[segIndex + 1].y = newY;
  }

  return verts;
}

export function generateWirePath(
  p1: { x: number; y: number },
  waypoints: { x: number; y: number }[] | undefined,
  p2: { x: number; y: number },
  mode: 'curve' | 'ortho' = 'curve'
): string {
  const wps = waypoints || [];

  if (mode === 'ortho') {
    const verts = getOrthoVertices(p1, wps, p2);
    let d = `M ${verts[0].x} ${verts[0].y}`;
    for (let i = 1; i < verts.length; i++) {
      d += ` L ${verts[i].x} ${verts[i].y}`;
    }
    return d;
  }

  // Curve / Flexible wire mode
  if (wps.length === 0) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const sag = Math.min(80, Math.max(25, dist * 0.25));
    return `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + sag}, ${p2.x} ${p2.y + sag}, ${p2.x} ${p2.y}`;
  }

  // Smooth spline through waypoints
  const all = [p1, ...wps, p2];
  let d = `M ${all[0].x} ${all[0].y}`;
  for (let i = 0; i < all.length - 1; i++) {
    const curr = all[i];
    const next = all[i + 1];
    const mx = (curr.x + next.x) / 2;
    const my = (curr.y + next.y) / 2;
    d += ` Q ${curr.x} ${curr.y}, ${mx} ${my}`;
  }
  const last = all[all.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export const WireLayer: React.FC<WireLayerProps> = ({
  wires,
  getPinWorldPos,
  draggingWire,
  activeTool,
  globalRoutingMode = 'curve',
  selectedWireId,
  onWireClick,
  onStartDragSegment,
  onStartDragWaypoint,
  onAddAndDragWaypoint,
  onDeleteWaypoint,
}) => {
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20">
      {/* Existing Wires */}
      {wires.map((wire) => {
        const p1 = getPinWorldPos(wire.fromComp, wire.fromPin);
        const p2 = getPinWorldPos(wire.toComp, wire.toPin);
        if (!p1 || !p2) return null;

        const mode = wire.routingMode || globalRoutingMode;
        const waypoints = wire.waypoints || [];
        const pathData = generateWirePath(p1, waypoints, p2, mode);
        const isHovered = hoveredWireId === wire.id;
        const isSelected = selectedWireId === wire.id;

        const orthoVerts = mode === 'ortho' ? getOrthoVertices(p1, waypoints, p2) : [];
        const orthoSegments = mode === 'ortho' ? computeOrthoSegments(orthoVerts) : [];

        return (
          <g
            key={wire.id}
            className="pointer-events-auto group"
            onMouseEnter={() => setHoveredWireId(wire.id)}
            onMouseLeave={() => setHoveredWireId((curr) => (curr === wire.id ? null : curr))}
          >
            {/* 1. Selection Outline: Clean White outline per user request */}
            {isSelected && (
              <path
                d={pathData}
                fill="none"
                stroke="#ffffff"
                strokeWidth="5.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none drop-shadow-sm"
              />
            )}

            {/* 2. Wider transparent hit area for easy selection & clicking */}
            <path
              d={pathData}
              fill="none"
              stroke="transparent"
              strokeWidth="16"
              className={activeTool === 'eraser' ? 'cursor-pointer' : 'cursor-pointer'}
              onClick={(e) => {
                e.stopPropagation();
                onWireClick?.(wire.id);
              }}
            />

            {/* 3. Visual subtle shadow under wire */}
            <path
              d={pathData}
              fill="none"
              stroke="#09090b"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-40"
            />

            {/* 4. Visual colored wire stroke (Preserves authentic wire.color, no blue override) */}
            <path
              d={pathData}
              fill="none"
              stroke={
                activeTool === 'eraser' && isHovered
                  ? '#f43f5e'
                  : wire.color
              }
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-[stroke,stroke-width] duration-75"
              onClick={(e) => {
                e.stopPropagation();
                onWireClick?.(wire.id);
              }}
            />

            {/* Terminal End Caps */}
            <circle
              cx={p1.x}
              cy={p1.y}
              r={isSelected ? 3.5 : 3}
              fill={isSelected ? '#ffffff' : '#cbd5e1'}
              stroke={isSelected ? wire.color : '#334155'}
              strokeWidth={isSelected ? 1.5 : 1}
            />
            <circle
              cx={p2.x}
              cy={p2.y}
              r={isSelected ? 3.5 : 3}
              fill={isSelected ? '#ffffff' : '#cbd5e1'}
              stroke={isSelected ? wire.color : '#334155'}
              strokeWidth={isSelected ? 1.5 : 1}
            />

            {/* 5. Canva-Style Line & Segment Controls (Visible strictly when Selected) */}
            {activeTool !== 'eraser' && isSelected && (
              <>
                {/* --- ORTHOGONAL MODE: Canva-style Segment Dragging & Midpoint Handles --- */}
                {mode === 'ortho' && (
                  <>
                    {/* Drag Line Segments (Hover changes cursor to ew-resize or ns-resize) */}
                    {orthoSegments.map((seg) => {
                      const isVert = seg.orientation === 'vertical';
                      const cursorClass = isVert ? 'cursor-ew-resize' : 'cursor-ns-resize';

                      return (
                        <g key={`seg-${wire.id}-${seg.index}`}>
                          {/* Segment Hit Area: Allows dragging line segment anywhere along its length */}
                          <line
                            x1={seg.pStart.x}
                            y1={seg.pStart.y}
                            x2={seg.pEnd.x}
                            y2={seg.pEnd.y}
                            stroke="transparent"
                            strokeWidth="14"
                            className={cursorClass}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onStartDragSegment?.(wire.id, seg.index, seg.orientation, e);
                            }}
                          >
                            <title>Drag to slide line {isVert ? 'left/right' : 'up/down'}</title>
                          </line>

                          {/* Canva Midpoint Handle on Segment */}
                          {seg.length > 18 && (
                            <rect
                              x={isVert ? seg.mid.x - 3 : seg.mid.x - 7}
                              y={isVert ? seg.mid.y - 7 : seg.mid.y - 3}
                              width={isVert ? 6 : 14}
                              height={isVert ? 14 : 6}
                              rx={3}
                              fill="#ffffff"
                              stroke="#27272a"
                              strokeWidth="1.2"
                              className={`${cursorClass} transition-transform hover:scale-110 drop-shadow`}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                onStartDragSegment?.(wire.id, seg.index, seg.orientation, e);
                              }}
                            >
                              <title>Drag to slide line {isVert ? 'left/right' : 'up/down'}</title>
                            </rect>
                          )}
                        </g>
                      );
                    })}

                    {/* Corner Vertices (Double-click to remove) */}
                    {waypoints.map((wp, wpIdx) => (
                      <circle
                        key={`corner-${wire.id}-${wpIdx}`}
                        cx={wp.x}
                        cy={wp.y}
                        r="4"
                        fill="#ffffff"
                        stroke="#52525b"
                        strokeWidth="1.5"
                        className="cursor-move hover:scale-125 transition-transform drop-shadow"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onStartDragWaypoint?.(wire.id, wpIdx, e);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onDeleteWaypoint?.(wire.id, wpIdx);
                        }}
                      >
                        <title>Corner vertex • Drag to move • Double-click to remove</title>
                      </circle>
                    ))}
                  </>
                )}

                {/* --- CURVE MODE: Waypoints & Initial Bend Handle --- */}
                {mode === 'curve' && (
                  <>
                    {waypoints.map((wp, wpIdx) => (
                      <circle
                        key={`wp-${wire.id}-${wpIdx}`}
                        cx={wp.x}
                        cy={wp.y}
                        r="4.5"
                        fill="#ffffff"
                        stroke="#52525b"
                        strokeWidth="1.5"
                        className="cursor-move drop-shadow hover:scale-125 transition-transform"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onStartDragWaypoint?.(wire.id, wpIdx, e);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onDeleteWaypoint?.(wire.id, wpIdx);
                        }}
                      >
                        <title>Drag to bend • Double-click to delete</title>
                      </circle>
                    ))}

                    {waypoints.length === 0 && (() => {
                      const midX = Math.round((p1.x + p2.x) / 2);
                      const dx = p2.x - p1.x;
                      const dy = p2.y - p1.y;
                      const dist = Math.hypot(dx, dy);
                      const sag = Math.min(80, Math.max(25, dist * 0.25));
                      const midY = Math.round((p1.y + p2.y) / 2 + sag * 0.75);

                      return (
                        <circle
                          key={`init-wp-${wire.id}`}
                          cx={midX}
                          cy={midY}
                          r="4.5"
                          fill="#ffffff"
                          stroke="#27272a"
                          strokeWidth="1.5"
                          className="cursor-crosshair drop-shadow hover:scale-125 transition-transform"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            onAddAndDragWaypoint?.(wire.id, 0, { x: midX, y: midY }, e);
                          }}
                        >
                          <title>Drag to bend wire</title>
                        </circle>
                      );
                    })()}
                  </>
                )}
              </>
            )}
          </g>
        );
      })}

      {/* Wire being drafted/dragged right now */}
      {draggingWire && (
        <g>
          {(() => {
            const dx = draggingWire.toX - draggingWire.fromX;
            const dy = draggingWire.toY - draggingWire.fromY;
            const dist = Math.hypot(dx, dy);
            const sag = Math.min(60, dist * 0.2);
            const pathData = `M ${draggingWire.fromX} ${draggingWire.fromY} C ${draggingWire.fromX} ${
              draggingWire.fromY + sag
            }, ${draggingWire.toX} ${draggingWire.toY + sag}, ${draggingWire.toX} ${draggingWire.toY}`;
            return (
              <>
                <path d={pathData} fill="none" stroke="#000000" strokeWidth="4" className="opacity-40" />
                <path
                  d={pathData}
                  fill="none"
                  stroke={draggingWire.color}
                  strokeWidth="3"
                  strokeDasharray="4 2"
                  strokeLinecap="round"
                />
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
};
