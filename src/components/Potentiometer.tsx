import React, { useRef } from 'react';

interface PotentiometerProps {
  id: string;
  value?: number; // 0.0 to 1.0 (defaults to 0.5)
  isInteractive?: boolean;
  onValueChange?: (val: number) => void;
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const Potentiometer: React.FC<PotentiometerProps> = ({ value = 0.5, isInteractive = true, onValueChange, onPinMouseDown }) => {
  const isDragging = useRef(false);

  // Map 0.0..1.0 to -135deg..+135deg (270 degrees sweep)
  const angle = -135 + value * 270;
  const voltage = (value * 5.0).toFixed(2);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isInteractive) return;
    e.stopPropagation();
    isDragging.current = true;
    const startY = e.clientY;
    const startVal = value;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      const dy = startY - moveEvent.clientY; // drag up increases, down decreases
      const delta = dy / 100;
      const next = Math.max(0, Math.min(1, startVal + delta));
      onValueChange?.(next);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="relative w-14 h-16 flex flex-col items-center select-none cursor-move">
      {/* Rotary Knob Body */}
      <div
        className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-zinc-600 shadow-md relative flex items-center justify-center cursor-ns-resize"
        onMouseDown={handleMouseDown}
        title={`Rotate Wiper: ${voltage}V (Drag Up/Down)`}
      >
        {/* Notch indicator */}
        <div
          className="absolute w-1 h-3.5 bg-zinc-200 rounded-full top-0.5"
          style={{
            transformOrigin: '50% 18px',
            transform: `rotate(${angle}deg)`,
          }}
        />
        {/* Metal center cap */}
        <div className="w-3.5 h-3.5 rounded-full bg-zinc-600 border border-zinc-500 shadow-inner" />
      </div>

      <span className="text-[9px] font-mono text-zinc-400 mt-1">{voltage}V</span>

      {/* 3 Leads at the bottom: 1 (GND), 2 (WIPER), 3 (VCC) */}
      <div className="flex justify-between w-8 mt-0.5">
        {/* GND */}
        <div
          title="GND (Pin 1)"
          className="w-2 h-3.5 bg-zinc-400 hover:bg-white hover:scale-110 hover:shadow-[0_0_4px_rgba(255,255,255,0.85)] hover:ring-1 hover:ring-white/80 transition-all cursor-crosshair rounded-b flex items-end justify-center shadow"
          onMouseDown={(e) => {
            e.stopPropagation();
            onPinMouseDown?.('1', e);
          }}
        >
          <div className="w-1 h-1 bg-zinc-600 rounded-full" />
        </div>

        {/* WIPER */}
        <div
          title="Wiper ADC (Pin 2)"
          className="w-2 h-3.5 bg-zinc-300 hover:bg-white hover:scale-110 hover:shadow-[0_0_4px_rgba(255,255,255,0.85)] hover:ring-1 hover:ring-white/80 transition-all cursor-crosshair rounded-b flex items-end justify-center shadow"
          onMouseDown={(e) => {
            e.stopPropagation();
            onPinMouseDown?.('2', e);
          }}
        >
          <div className="w-1 h-1 bg-zinc-500 rounded-full" />
        </div>

        {/* VCC */}
        <div
          title="5V VCC (Pin 3)"
          className="w-2 h-3.5 bg-zinc-400 hover:bg-white hover:scale-110 hover:shadow-[0_0_4px_rgba(255,255,255,0.85)] hover:ring-1 hover:ring-white/80 transition-all cursor-crosshair rounded-b flex items-end justify-center shadow"
          onMouseDown={(e) => {
            e.stopPropagation();
            onPinMouseDown?.('3', e);
          }}
        >
          <div className="w-1 h-1 bg-zinc-600 rounded-full" />
        </div>
      </div>
    </div>
  );
};
