import React from 'react';
import { CircuitWire } from '../types';

interface WireLayerProps {
  wires: CircuitWire[];
  getPinWorldPos: (compId: string, pinName: string) => { x: number; y: number } | null;
  draggingWire: { fromX: number; fromY: number; toX: number; toY: number; color: string } | null;
  onWireClick?: (wireId: string) => void;
}

export const WireLayer: React.FC<WireLayerProps> = ({
  wires,
  getPinWorldPos,
  draggingWire,
  onWireClick,
}) => {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
      {/* Existing Wires */}
      {wires.map((wire) => {
        const p1 = getPinWorldPos(wire.fromComp, wire.fromPin);
        const p2 = getPinWorldPos(wire.toComp, wire.toPin);
        if (!p1 || !p2) return null;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const sag = Math.min(80, Math.max(25, dist * 0.25));

        const pathData = `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + sag}, ${p2.x} ${p2.y + sag}, ${p2.x} ${p2.y}`;

        return (
          <g key={wire.id} className="pointer-events-auto cursor-pointer group">
            {/* Wider transparent hit area */}
            <path
              d={pathData}
              fill="none"
              stroke="transparent"
              strokeWidth="14"
              onClick={() => onWireClick?.(wire.id)}
            />
            {/* Visual wire stroke with shadow */}
            <path
              d={pathData}
              fill="none"
              stroke="#0f172a"
              strokeWidth="4.5"
              strokeLinecap="round"
              className="opacity-40"
            />
            <path
              d={pathData}
              fill="none"
              stroke={wire.color}
              strokeWidth="3.2"
              strokeLinecap="round"
              className="group-hover:stroke-white transition-colors"
            />
            {/* Terminal End Caps */}
            <circle cx={p1.x} cy={p1.y} r="3" fill="#cbd5e1" stroke="#334155" strokeWidth="1" />
            <circle cx={p2.x} cy={p2.y} r="3" fill="#cbd5e1" stroke="#334155" strokeWidth="1" />
          </g>
        );
      })}

      {/* Wire being dragged right now */}
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
