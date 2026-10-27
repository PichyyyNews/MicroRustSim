import React from 'react';

interface BreadboardProps {
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const Breadboard: React.FC<BreadboardProps> = ({ onPinMouseDown }) => {
  const columns = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <div className="relative w-[480px] h-[210px] bg-[#f8fafc] rounded-[14.4px] shadow-2xl border border-zinc-300 p-3 select-none flex flex-col justify-between">
      {/* Top Power Rails (+ and -) */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-red-500 w-3 text-center">+</span>
          <div className="h-0.5 flex-1 bg-red-400 rounded-full" />
        </div>
        <div className="flex justify-between px-5">
          {columns.filter((c) => c % 2 === 1).map((col) => (
            <div
              key={`top_plus_${col}`}
              title={`Power + (Col ${col})`}
              className="w-2.5 h-2.5 rounded-full bg-zinc-800 border border-zinc-400 hover:bg-[#8b5cf6] cursor-crosshair"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPinMouseDown?.(`top_plus_${col}`, e);
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-blue-500 w-3 text-center">-</span>
          <div className="h-0.5 flex-1 bg-blue-400 rounded-full" />
        </div>
        <div className="flex justify-between px-5">
          {columns.filter((c) => c % 2 === 1).map((col) => (
            <div
              key={`top_minus_${col}`}
              title={`Power - (Col ${col})`}
              className="w-2.5 h-2.5 rounded-full bg-zinc-800 border border-zinc-400 hover:bg-[#8b5cf6] cursor-crosshair"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPinMouseDown?.(`top_minus_${col}`, e);
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Terminal Strips (Rows a-e & f-j) */}
      <div className="bg-zinc-100/80 rounded-[8.0px] p-2 border border-zinc-200">
        {/* Top 5 rows: a, b, c, d, e */}
        <div className="space-y-1">
          {['a', 'b', 'c', 'd', 'e'].map((row) => (
            <div key={row} className="flex justify-between px-2 items-center">
              <span className="text-[8px] text-zinc-400 w-2 font-mono">{row}</span>
              {columns.map((col) => (
                <div
                  key={`${row}_${col}`}
                  title={`${row}${col}`}
                  className="w-2 h-2 rounded-[2px] bg-zinc-800 hover:bg-[#8b5cf6] cursor-crosshair"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onPinMouseDown?.(`${row}_${col}`, e);
                  }}
                />
              ))}
              <span className="text-[8px] text-zinc-400 w-2 font-mono text-right">{row}</span>
            </div>
          ))}
        </div>

        {/* Central Divider Notch */}
        <div className="h-2 w-full my-1 border-y border-zinc-300 bg-zinc-200/50 flex items-center justify-center">
          <span className="text-[7px] text-zinc-400 font-bold uppercase tracking-widest">MicroRustSim</span>
        </div>

        {/* Bottom 5 rows: f, g, h, i, j */}
        <div className="space-y-1">
          {['f', 'g', 'h', 'i', 'j'].map((row) => (
            <div key={row} className="flex justify-between px-2 items-center">
              <span className="text-[8px] text-zinc-400 w-2 font-mono">{row}</span>
              {columns.map((col) => (
                <div
                  key={`${row}_${col}`}
                  title={`${row}${col}`}
                  className="w-2 h-2 rounded-[2px] bg-zinc-800 hover:bg-[#8b5cf6] cursor-crosshair"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onPinMouseDown?.(`${row}_${col}`, e);
                  }}
                />
              ))}
              <span className="text-[8px] text-zinc-400 w-2 font-mono text-right">{row}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Power Rails */}
      <div className="space-y-1">
        <div className="flex justify-between px-5">
          {columns.filter((c) => c % 2 === 1).map((col) => (
            <div
              key={`bot_plus_${col}`}
              title={`Power + (Col ${col})`}
              className="w-2.5 h-2.5 rounded-full bg-zinc-800 border border-zinc-400 hover:bg-[#8b5cf6] cursor-crosshair"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPinMouseDown?.(`bot_plus_${col}`, e);
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-red-500 w-3 text-center">+</span>
          <div className="h-0.5 flex-1 bg-red-400 rounded-full" />
        </div>

        <div className="flex justify-between px-5">
          {columns.filter((c) => c % 2 === 1).map((col) => (
            <div
              key={`bot_minus_${col}`}
              title={`Power - (Col ${col})`}
              className="w-2.5 h-2.5 rounded-full bg-zinc-800 border border-zinc-400 hover:bg-[#8b5cf6] cursor-crosshair"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPinMouseDown?.(`bot_minus_${col}`, e);
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-blue-500 w-3 text-center">-</span>
          <div className="h-0.5 flex-1 bg-blue-400 rounded-full" />
        </div>
      </div>
    </div>
  );
};
