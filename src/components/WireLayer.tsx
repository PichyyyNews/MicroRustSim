import React, { useState } from 'react';
import { CircuitWire } from '../types';

export interface WireLayerProps {
  wires: CircuitWire[];
  getPinWorldPos: (compId: string, pinName: string) => { x: number; y: number } | null;
  draggingWire: { fromX: number; fromY: number; toX: number; toY: number; color: string } | null;
  activeTool: 'select' | 'move' | 'wire' | 'eraser';
  globalRoutingMode?: 'curve' | 'ortho';
  selectedWireId?: string | null;
  onWireClick?: (wireId: string) => void;
  onStartDragWaypoint?: (wireId: string, waypointIndex: number, e: React.MouseEvent) => void;
  onAddAndDragWaypoint?: (
    wireId: string,
    insertIndex: number,
    initialPoint: { x: number; y: number },
    e: React.MouseEvent
  ) => void;
  onDeleteWaypoint?: (wireId: string, waypointIndex: number) => void;
}

export function generateWirePath(
  p1: { x: number; y: number },
  waypoints: { x: number; y: number }[] | undefined,
  p2: { x: number; y: number },
  mode: 'curve' | 'ortho' = 'curve'
): string {
  const wps = waypoints || [];

  if (mode === 'ortho') {
    // Diagram / Orthogonal right-angle routing
    if (wps.length === 0) {
      const midX = Math.round((p1.x + p2.x) / 2);
      return `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`;
    }

    // Route cleanly through every waypoint at 90-degree right angles
    let d = `M ${p1.x} ${p1.y}`;
    let prev = p1;
    for (let i = 0; i < wps.length; i++) {
      const wp = wps[i];
      d += ` L ${wp.x} ${prev.y} L ${wp.x} ${wp.y}`;
      prev = wp;
    }
    d += ` L ${p2.x} ${prev.y} L ${p2.x} ${p2.y}`;
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
        const allPoints = [p1, ...waypoints, p2];

        return (
          <g
            key={wire.id}
            className="pointer-events-auto group"
            onMouseEnter={() => setHoveredWireId(wire.id)}
            onMouseLeave={() => setHoveredWireId((curr) => (curr === wire.id ? null : curr))}
          >
            {/* Selection Aura / Glow */}
            {isSelected && (
              <path
                d={pathData}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="7"
                strokeOpacity="0.45"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none"
              />
            )}

            {/* Wider transparent hit area for easy clicking & erasing */}
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

            {/* Visual wire shadow */}
            <path
              d={pathData}
              fill="none"
              stroke="#09090b"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-50"
            />

            {/* Visual colored wire stroke */}
            <path
              d={pathData}
              fill="none"
              stroke={
                activeTool === 'eraser' && isHovered
                  ? '#f43f5e'
                  : isSelected
                  ? '#38bdf8'
                  : wire.color
              }
              strokeWidth={isSelected ? '3.8' : isHovered ? '3.6' : '3.2'}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-[stroke,stroke-width] duration-75"
              onClick={(e) => {
                e.stopPropagation();
                onWireClick?.(wire.id);
              }}
            />

            {/* Terminal End Caps */}
            <circle cx={p1.x} cy={p1.y} r="3" fill="#cbd5e1" stroke="#334155" strokeWidth="1" />
            <circle cx={p2.x} cy={p2.y} r="3" fill="#cbd5e1" stroke="#334155" strokeWidth="1" />

            {/* Interactive Bend Handles - Stably visible only when Selected (Zero Flicker/Jitter) */}
            {activeTool !== 'eraser' && isSelected && (
              <>
                {/* Existing Waypoint Handles */}
                {waypoints.map((wp, wpIdx) => (
                  <circle
                    key={`wp-${wire.id}-${wpIdx}`}
                    cx={wp.x}
                    cy={wp.y}
                    r="5.5"
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="cursor-move drop-shadow"
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

                {/* Initial Bend Point Handle when wire has no waypoints yet */}
                {waypoints.length === 0 && (() => {
                  const midX = Math.round((p1.x + p2.x) / 2);
                  const midY =
                    mode === 'ortho'
                      ? Math.round((p1.y + p2.y) / 2)
                      : Math.round(
                          (p1.y + p2.y) / 2 +
                            Math.min(
                              80,
                              Math.max(25, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.25)
                            ) *
                              0.75
                        );

                  return (
                    <circle
                      key={`init-wp-${wire.id}`}
                      cx={midX}
                      cy={midY}
                      r="5"
                      fill="#ffffff"
                      stroke="#0284c7"
                      strokeWidth="2"
                      className="cursor-crosshair drop-shadow"
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
