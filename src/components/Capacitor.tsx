import React from 'react';

interface CapacitorProps {
  id: string;
  capacitance?: number; // Farads, e.g. 10e-6
  isPolarized?: boolean;
  voltageRating?: number; // e.g. 25V
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const Capacitor: React.FC<CapacitorProps> = ({
  capacitance = 10e-6,
  isPolarized = false,
  voltageRating = 25,
  onPinMouseDown,
}) => {
  // Format capacitance string for display (e.g. "10 µF", "100 nF")
  const formatCapacitance = (c: number): string => {
    if (c >= 1e-3) return `${(c * 1e3).toFixed(0)} mF`;
    if (c >= 1e-6) {
      const uF = c * 1e6;
      return `${uF >= 10 ? uF.toFixed(0) : uF.toFixed(1)} µF`;
    }
    if (c >= 1e-9) return `${(c * 1e9).toFixed(0)} nF`;
    return `${(c * 1e12).toFixed(0)} pF`;
  };

  const capLabel = formatCapacitance(capacitance);

  return (
    <div
      className="relative flex items-center select-none cursor-move"
      style={{ width: '60px', height: '40px' }}
    >
      {/* Pin 1 (Anode / + for polarized, Left lead) */}
      <div
        title={isPolarized ? 'Pin 1 (Anode +)' : 'Pin 1'}
        className="w-3.5 h-1.5 bg-zinc-300 hover:bg-white hover:scale-105 hover:shadow-[0_0_4px_rgba(255,255,255,0.85)] hover:ring-1 hover:ring-white/80 transition-all cursor-crosshair rounded-l shadow"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('1', e);
        }}
      />

      {/* Capacitor Body */}
      {isPolarized ? (
        // Polarized Electrolytic Can
        <div className="relative w-8 h-8 rounded-full bg-[#18181b] border border-zinc-700 shadow-md flex items-center justify-center overflow-hidden">
          {/* Negative Stripe on the right side */}
          <div className="absolute top-0 bottom-0 right-0 w-2.5 bg-zinc-800 border-l border-zinc-600 flex flex-col items-center justify-around py-0.5">
            <span className="text-[7px] text-zinc-400 font-bold leading-none select-none">-</span>
            <span className="text-[7px] text-zinc-400 font-bold leading-none select-none">-</span>
          </div>
          {/* Front text */}
          <div className="flex flex-col items-center justify-center z-10 pr-1 pointer-events-none">
            <span className="text-[8px] font-mono font-bold text-zinc-200 tracking-tighter leading-none whitespace-nowrap [word-break:keep-all]">
              {capLabel}
            </span>
            <span className="text-[6.5px] font-mono text-zinc-400 leading-none mt-0.5 whitespace-nowrap [word-break:keep-all]">
              {voltageRating}V
            </span>
          </div>
        </div>
      ) : (
        // Ceramic Disc / Film Capacitor
        <div className="w-8 h-7 rounded-sm bg-[#27272a] border border-zinc-600 shadow-md flex flex-col items-center justify-center px-0.5">
          {/* Parallel Plates Graphic */}
          <div className="flex items-center gap-1 mb-0.5 pointer-events-none">
            <div className="w-0.5 h-3 bg-zinc-400 rounded-full" />
            <div className="w-0.5 h-3 bg-zinc-400 rounded-full" />
          </div>
          <span className="text-[7.5px] font-mono font-semibold text-zinc-200 leading-none tracking-tight whitespace-nowrap [word-break:keep-all] pointer-events-none">
            {capLabel}
          </span>
        </div>
      )}

      {/* Pin 2 (Cathode / - for polarized, Right lead) */}
      <div
        title={isPolarized ? 'Pin 2 (Cathode -)' : 'Pin 2'}
        className="w-3.5 h-1.5 bg-zinc-300 hover:bg-white hover:scale-105 hover:shadow-[0_0_4px_rgba(255,255,255,0.85)] hover:ring-1 hover:ring-white/80 transition-all cursor-crosshair rounded-r shadow"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('2', e);
        }}
      />
    </div>
  );
};
