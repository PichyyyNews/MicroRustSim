import React from 'react';
import { Badge } from './ui/badge';
import { Activity } from 'lucide-react';

export interface Hcsr04Props {
  id: string;
  distance?: number; // 2.0 to 400.0 cm (default: 25.0)
  isSelected?: boolean;
  isSimRunning?: boolean;
  onDistanceChange?: (val: number) => void;
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const Hcsr04: React.FC<Hcsr04Props> = ({
  id,
  distance = 25.0,
  isSelected = false,
  isSimRunning = false,
  onDistanceChange,
  onPinMouseDown,
}) => {
  const safeDistance = typeof distance === 'number' && !isNaN(distance)
    ? Math.max(2.0, Math.min(400.0, distance))
    : 25.0;

  return (
    <div
      className="relative select-none flex flex-col items-center group cursor-move"
      style={{ width: '168px', height: '80px' }}
    >
      {/* Floating Canvas Micro-Pill Control (Dual Controls on Canvas) */}
      {(isSelected || true) && (
        <div
          className={`absolute -top-11 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#121215]/95 border border-[#27272a] shadow-xl backdrop-blur-md transition-opacity duration-200 pointer-events-auto ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Activity className="w-3 h-3 text-cyan-400 shrink-0" />
          <input
            type="range"
            min={2}
            max={400}
            step={0.5}
            value={safeDistance}
            onChange={(e) => onDistanceChange?.(parseFloat(e.target.value))}
            className="w-16 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            title="Adjust Obstacle Distance (cm)"
          />
          <Badge
            variant="outline"
            className="h-5 px-1.5 font-mono text-[10px] text-zinc-100 border-[#3f3f46] tabular-nums whitespace-nowrap shrink-0 [word-break:keep-all]"
          >
            {safeDistance.toFixed(1)}&nbsp;cm
          </Badge>
        </div>
      )}

      {/* Main HC-SR04 PCB Body */}
      <div className="w-[160px] h-[66px] rounded-md bg-[#133e75] border border-[#1e5aa0] shadow-md relative overflow-hidden flex items-center justify-around px-2">
        {/* PCB Silkscreen & Gold Mounting Holes */}
        <div className="absolute top-1 left-1.5 w-2 h-2 rounded-full border border-amber-300/60 bg-[#0d2a4f]" />
        <div className="absolute top-1 right-1.5 w-2 h-2 rounded-full border border-amber-300/60 bg-[#0d2a4f]" />
        <div className="absolute bottom-1 left-1.5 w-2 h-2 rounded-full border border-amber-300/60 bg-[#0d2a4f]" />
        <div className="absolute bottom-1 right-1.5 w-2 h-2 rounded-full border border-amber-300/60 bg-[#0d2a4f]" />

        {/* Silkscreen Brand */}
        <span className="absolute top-1 text-[8px] font-mono tracking-wider text-white/70 font-bold select-none pointer-events-none">
          HC-SR04
        </span>

        {/* Left Ultrasonic Metal Transducer (Transmitter 'T') */}
        <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-500 border border-zinc-200 shadow-inner flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border border-zinc-400/80 bg-zinc-700/90 flex items-center justify-center">
            {/* Mesh grille effect */}
            <div className="w-7 h-7 rounded-full border border-zinc-500 bg-zinc-800 flex items-center justify-center">
              <span className="text-[10px] font-bold text-zinc-300">T</span>
            </div>
          </div>
          {isSimRunning && (
            <div className="absolute -inset-1 rounded-full border border-cyan-400/30 animate-ping pointer-events-none" />
          )}
        </div>

        {/* Center Quartz Crystal & Resonator */}
        <div className="w-4 h-7 rounded-sm bg-gradient-to-r from-zinc-300 to-zinc-400 border border-zinc-400 flex flex-col items-center justify-center shadow-xs">
          <span className="text-[5px] font-mono text-zinc-800 font-bold">4.0M</span>
        </div>

        {/* Right Ultrasonic Metal Transducer (Receiver 'R') */}
        <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-500 border border-zinc-200 shadow-inner flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border border-zinc-400/80 bg-zinc-700/90 flex items-center justify-center">
            <div className="w-7 h-7 rounded-full border border-zinc-500 bg-zinc-800 flex items-center justify-center">
              <span className="text-[10px] font-bold text-zinc-300">R</span>
            </div>
          </div>
        </div>

        {/* Header Pin Labels Silkscreen */}
        <div className="absolute bottom-0 inset-x-0 flex justify-center gap-4 text-[7px] font-mono text-white/80 pb-0.5 pointer-events-none">
          <span>VCC</span>
          <span>TRIG</span>
          <span>ECHO</span>
          <span>GND</span>
        </div>
      </div>

      {/* 4 Connection Header Pins at the bottom */}
      <div className="flex justify-center gap-4 w-[120px] h-[14px]">
        {/* Pin: VCC */}
        <button
          type="button"
          onMouseDown={(e) => onPinMouseDown?.('VCC', e)}
          title={`${id}:VCC (Power +5V)`}
          className="w-3 h-3 rounded-full bg-amber-400 border border-amber-600 hover:scale-125 hover:ring-2 hover:ring-cyan-400 transition-transform cursor-crosshair z-20 flex items-center justify-center shadow-xs"
        >
          <div className="w-1 h-1 rounded-full bg-amber-800" />
        </button>

        {/* Pin: TRIG */}
        <button
          type="button"
          onMouseDown={(e) => onPinMouseDown?.('TRIG', e)}
          title={`${id}:TRIG (Trigger Pulse Input)`}
          className="w-3 h-3 rounded-full bg-amber-400 border border-amber-600 hover:scale-125 hover:ring-2 hover:ring-cyan-400 transition-transform cursor-crosshair z-20 flex items-center justify-center shadow-xs"
        >
          <div className="w-1 h-1 rounded-full bg-amber-800" />
        </button>

        {/* Pin: ECHO */}
        <button
          type="button"
          onMouseDown={(e) => onPinMouseDown?.('ECHO', e)}
          title={`${id}:ECHO (Echo Pulse Output)`}
          className="w-3 h-3 rounded-full bg-amber-400 border border-amber-600 hover:scale-125 hover:ring-2 hover:ring-cyan-400 transition-transform cursor-crosshair z-20 flex items-center justify-center shadow-xs"
        >
          <div className="w-1 h-1 rounded-full bg-amber-800" />
        </button>

        {/* Pin: GND */}
        <button
          type="button"
          onMouseDown={(e) => onPinMouseDown?.('GND', e)}
          title={`${id}:GND (Ground 0V)`}
          className="w-3 h-3 rounded-full bg-amber-400 border border-amber-600 hover:scale-125 hover:ring-2 hover:ring-cyan-400 transition-transform cursor-crosshair z-20 flex items-center justify-center shadow-xs"
        >
          <div className="w-1 h-1 rounded-full bg-amber-800" />
        </button>
      </div>
    </div>
  );
};
