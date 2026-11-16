import React from 'react';
import { Badge } from './ui/badge';
import { Radio } from 'lucide-react';

export interface PirSensorProps {
  id: string;
  motion?: boolean;
  isSelected?: boolean;
  onMotionChange?: (detected: boolean) => void;
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const PirSensor: React.FC<PirSensorProps> = ({
  id,
  motion = false,
  isSelected = false,
  onMotionChange,
  onPinMouseDown,
}) => {
  return (
    <div
      className="relative select-none flex flex-col items-center group cursor-move"
      style={{ width: '90px', height: '100px' }}
    >
      {/* Floating Canvas Micro-Pill Control (Dual Controls on Canvas) */}
      {(isSelected || true) && (
        <div
          className={`absolute -top-11 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#121215]/95 border border-[#27272a] shadow-xl backdrop-blur-md transition-opacity duration-200 pointer-events-auto ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onMotionChange?.(!motion)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
              motion
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
            }`}
            title="Toggle PIR Motion Detection"
          >
            <Radio className={`w-3 h-3 ${motion ? 'text-emerald-400 animate-pulse' : 'text-zinc-400'}`} />
            <span>{motion ? 'Motion On' : 'Trigger'}</span>
          </button>
          <Badge
            variant="outline"
            className={`h-5 px-1.5 font-mono text-[9px] tabular-nums whitespace-nowrap shrink-0 [word-break:keep-all] ${
              motion ? 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10' : 'text-zinc-400 border-[#3f3f46]'
            }`}
          >
            {motion ? '3.3\u00A0V' : '0.0\u00A0V'}
          </Badge>
        </div>
      )}

      {/* Main HC-SR501 Body (Green PCB with white Fresnel Dome) */}
      <div className="w-[84px] h-[76px] rounded-md bg-[#166534] border-2 border-[#14532d] shadow-md relative overflow-hidden flex flex-col items-center justify-center p-1">
        {/* PCB Silkscreen */}
        <span className="absolute top-1 text-[7px] font-mono tracking-wider text-white/80 font-bold select-none pointer-events-none">
          HC-SR501 PIR
        </span>

        {/* Fresnel Dome Lens */}
        <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-white via-zinc-100 to-zinc-300 border-2 border-zinc-300 shadow-md flex items-center justify-center overflow-hidden">
          {/* Geodesic faceted patterns on Fresnel dome */}
          <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:6px_6px] opacity-70" />
          <div className="w-6 h-6 rounded-full border border-zinc-300/80 bg-white/40 shadow-inner flex items-center justify-center">
            {/* Center pyroelectric sensor window hint */}
            <div className={`w-2.5 h-2.5 rounded-sm border ${motion ? 'bg-emerald-400 shadow-md shadow-emerald-400/50' : 'bg-zinc-400'}`} />
          </div>
        </div>

        {/* 2 Trim pots (Sensitivity & Delay) */}
        <div className="absolute right-1 bottom-3 flex flex-col gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-500 border border-amber-700" title="Sensitivity adjustment" />
          <div className="w-2 h-2 rounded-full bg-amber-500 border border-amber-700" title="Time delay adjustment" />
        </div>

        {/* Silkscreen Pin Labels */}
        <div className="absolute bottom-0.5 inset-x-0 flex justify-around text-[6.5px] font-mono text-white/90 font-bold px-3 pointer-events-none">
          <span>VCC</span>
          <span>OUT</span>
          <span>GND</span>
        </div>
      </div>

      {/* 3 Header Pins at the bottom: VCC, OUT, GND */}
      <div className="flex justify-around w-[64px] h-[16px] mt-1">
        {/* Pin: VCC */}
        <button
          type="button"
          onMouseDown={(e) => onPinMouseDown?.('VCC', e)}
          title={`${id}:VCC (Power 4.5V - 20V)`}
          className="w-3 h-3 rounded-full bg-amber-400 border border-amber-600 hover:scale-125 hover:ring-2 hover:ring-emerald-400 transition-transform cursor-crosshair z-20 flex items-center justify-center shadow-xs"
        >
          <div className="w-1 h-1 rounded-full bg-amber-800" />
        </button>

        {/* Pin: OUT */}
        <button
          type="button"
          onMouseDown={(e) => onPinMouseDown?.('OUT', e)}
          title={`${id}:OUT (Digital Output 3.3V / 0V)`}
          className="w-3 h-3 rounded-full bg-amber-400 border border-amber-600 hover:scale-125 hover:ring-2 hover:ring-emerald-400 transition-transform cursor-crosshair z-20 flex items-center justify-center shadow-xs"
        >
          <div className="w-1 h-1 rounded-full bg-amber-800" />
        </button>

        {/* Pin: GND */}
        <button
          type="button"
          onMouseDown={(e) => onPinMouseDown?.('GND', e)}
          title={`${id}:GND (Ground 0V)`}
          className="w-3 h-3 rounded-full bg-amber-400 border border-amber-600 hover:scale-125 hover:ring-2 hover:ring-emerald-400 transition-transform cursor-crosshair z-20 flex items-center justify-center shadow-xs"
        >
          <div className="w-1 h-1 rounded-full bg-amber-800" />
        </button>
      </div>
    </div>
  );
};
