import React, { useState, useRef } from 'react';

interface PotentiometerProps {
  id: string;
  value: number; // 0.0 to 1.0
  onValueChange?: (val: number) => void;
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const Potentiometer: React.FC<PotentiometerProps> = ({ value, onValueChange, onPinMouseDown }) => {
  const [val, setVal] = useState(value);
  const isDragging = useRef(false);
  const startY = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    isDragging.current = true;
    startY.current = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaY = startY.current - moveEvent.clientY;
      const newVal = Math.min(1.0, Math.max(0.0, val + deltaY * 0.005));
      setVal(newVal);
      onValueChange?.(newVal);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Convert 0.0-1.0 to rotation degrees (-135 to +135 deg)
  const rotationDeg = -135 + val * 270;
  const voltage = (val * 5.0).toFixed(2);

  return (
    <div className="relative w-16 h-20 flex flex-col items-center select-none cursor-move">
      {/* Knob Dial */}
      <div
        className="w-12 h-12 rounded-full bg-zinc-800 border-2 border-zinc-600 shadow-xl flex items-center justify-center cursor-ns-resize hover:border-[#8b5cf6] transition-colors"
        onMouseDown={handleMouseDown}
        title={`Rotate Wiper: ${voltage}V (Drag Up/Down)`}
      >
        {/* Rotating dial marker */}
        <div
          className="w-full h-full flex items-center justify-center transition-transform duration-75"
          style={{ transform: `rotate(${rotationDeg}deg)` }}
        >
          <div className="w-1 h-4 bg-amber-400 rounded-full -translate-y-3 shadow" />
        </div>
      </div>

      <span className="text-[9px] font-mono text-amber-300 mt-1">{voltage}V</span>

      {/* 3 Leads at the bottom: 1 (GND), 2 (WIPER), 3 (VCC) */}
      <div className="flex justify-between w-8 mt-1">
        {/* GND */}
        <div
          title="GND (Pin 1)"
          className="w-2 h-3 bg-zinc-400 hover:bg-[#8b5cf6] cursor-crosshair rounded-b flex items-end justify-center shadow"
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
          className="w-2 h-3 bg-amber-400 hover:bg-[#8b5cf6] cursor-crosshair rounded-b flex items-end justify-center shadow"
          onMouseDown={(e) => {
            e.stopPropagation();
            onPinMouseDown?.('2', e);
          }}
        >
          <div className="w-1 h-1 bg-amber-600 rounded-full" />
        </div>

        {/* VCC */}
        <div
          title="5V VCC (Pin 3)"
          className="w-2 h-3 bg-zinc-400 hover:bg-[#8b5cf6] cursor-crosshair rounded-b flex items-end justify-center shadow"
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
