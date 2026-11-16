import React from 'react';
import { Badge } from './ui/badge';
import { Sun } from 'lucide-react';

export interface PhotoresistorProps {
  id: string;
  lux?: number; // 0.0 to 1000.0 lux (default: 500.0)
  isSelected?: boolean;
  onLuxChange?: (val: number) => void;
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const Photoresistor: React.FC<PhotoresistorProps> = ({
  id,
  lux = 500.0,
  isSelected = false,
  onLuxChange,
  onPinMouseDown,
}) => {
  const safeLux = typeof lux === 'number' && !isNaN(lux)
    ? Math.max(0.0, Math.min(1000.0, lux))
    : 500.0;

  // Approximate resistance based on lux:
  // R = 50 + 500,000 / (1 + lux)^0.7
  const rOhms = 50.0 + 500_000.0 / Math.pow(1.0 + safeLux, 0.7);
  const rFormatted = rOhms >= 1000
    ? `${(rOhms / 1000).toFixed(1)}\u00A0kΩ`
    : `${rOhms.toFixed(0)}\u00A0Ω`;

  return (
    <div
      className="relative select-none flex flex-col items-center group cursor-move"
      style={{ width: '60px', height: '70px' }}
    >
      {/* Floating Canvas Micro-Pill Control (Dual Controls on Canvas) */}
      {(isSelected || true) && (
        <div
          className={`absolute -top-11 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#121215]/95 border border-[#27272a] shadow-xl backdrop-blur-md transition-opacity duration-200 pointer-events-auto ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Sun className="w-3 h-3 text-amber-400 shrink-0" />
          <input
            type="range"
            min={0}
            max={1000}
            step={5}
            value={safeLux}
            onChange={(e) => onLuxChange?.(parseFloat(e.target.value))}
            className="w-16 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
            title="Adjust Ambient Light (lux)"
          />
          <Badge
            variant="outline"
            className="h-5 px-1.5 font-mono text-[10px] text-zinc-100 border-[#3f3f46] tabular-nums whitespace-nowrap shrink-0 [word-break:keep-all]"
          >
            {Math.round(safeLux)}&nbsp;lux
          </Badge>
        </div>
      )}

      {/* Main LDR Head: Round ceramic disc with serpentine track */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c2410c] to-[#9a3412] border-2 border-[#7c2d12] shadow-md relative flex items-center justify-center p-1">
        {/* Serpentine CdS Photo-conductive track */}
        <svg viewBox="0 0 32 32" className="w-6 h-6">
          <path
            d="M 6 8 C 12 8, 12 14, 20 14 C 26 14, 26 20, 16 20 C 8 20, 8 24, 24 24"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 10 10 L 22 10 M 10 16 L 22 16 M 10 22 L 22 22"
            stroke="#78350f"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>

        {/* Clear epoxy coating shine */}
        <div className="absolute top-1 left-2 w-3 h-2 rounded-full bg-white/20 blur-[0.5px] pointer-events-none" />
      </div>

      {/* Resistance indicator */}
      <span className="text-[8px] font-mono text-zinc-400 mt-0.5 tabular-nums whitespace-nowrap [word-break:keep-all]">
        ~{rFormatted}
      </span>

      {/* Two Metal Wire Leads at the bottom: 1, 2 */}
      <div className="flex justify-between w-6 h-[16px] mt-0.5">
        {/* Lead 1 */}
        <button
          type="button"
          onMouseDown={(e) => onPinMouseDown?.('1', e)}
          title={`${id}:1 (Terminal 1)`}
          className="w-2.5 h-2.5 rounded-full bg-zinc-300 border border-zinc-500 hover:scale-125 hover:ring-2 hover:ring-amber-400 transition-transform cursor-crosshair z-20 flex items-center justify-center shadow-xs"
        >
          <div className="w-1 h-1 rounded-full bg-zinc-600" />
        </button>

        {/* Lead 2 */}
        <button
          type="button"
          onMouseDown={(e) => onPinMouseDown?.('2', e)}
          title={`${id}:2 (Terminal 2)`}
          className="w-2.5 h-2.5 rounded-full bg-zinc-300 border border-zinc-500 hover:scale-125 hover:ring-2 hover:ring-amber-400 transition-transform cursor-crosshair z-20 flex items-center justify-center shadow-xs"
        >
          <div className="w-1 h-1 rounded-full bg-zinc-600" />
        </button>
      </div>
    </div>
  );
};
