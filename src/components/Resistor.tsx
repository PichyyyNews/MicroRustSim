import React from 'react';

interface ResistorProps {
  ohms: number;
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const Resistor: React.FC<ResistorProps> = ({ ohms, onPinMouseDown }) => {
  // Compute color bands for 4-band resistor
  const getBands = (val: number) => {
    if (val === 220) return ['#dc2626', '#dc2626', '#78350f', '#eab308']; // Red, Red, Brown, Gold
    if (val === 1000) return ['#78350f', '#000000', '#dc2626', '#eab308']; // Brown, Black, Red, Gold
    if (val === 10000) return ['#78350f', '#000000', '#ea580c', '#eab308']; // Brown, Black, Orange, Gold
    return ['#dc2626', '#dc2626', '#78350f', '#eab308'];
  };

  const bands = getBands(ohms);

  return (
    <div className="relative flex items-center select-none cursor-move">
      {/* Left Lead */}
      <div
        title="Pin 1"
        className="w-4 h-1.5 bg-zinc-300 hover:bg-white hover:scale-105 hover:shadow-[0_0_4px_rgba(255,255,255,0.85)] hover:ring-1 hover:ring-white/80 transition-all cursor-crosshair rounded-l shadow"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('1', e);
        }}
      />

      {/* Resistor Ceramic Body */}
      <div className="w-12 h-5 bg-[#e0d6be] border border-[#a89f81] rounded-full flex items-center justify-around px-1.5 shadow-md">
        {bands.map((color, idx) => (
          <div
            key={idx}
            className="w-1 h-full"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      {/* Right Lead */}
      <div
        title="Pin 2"
        className="w-4 h-1.5 bg-zinc-300 hover:bg-white hover:scale-105 hover:shadow-[0_0_4px_rgba(255,255,255,0.85)] hover:ring-1 hover:ring-white/80 transition-all cursor-crosshair rounded-r shadow"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('2', e);
        }}
      />
    </div>
  );
};
