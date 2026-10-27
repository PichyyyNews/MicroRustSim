import React, { useState } from 'react';

interface PushbuttonProps {
  id: string;
  isInteractive?: boolean;
  onPressChange?: (pressed: boolean) => void;
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const Pushbutton: React.FC<PushbuttonProps> = ({ isInteractive = true, onPressChange, onPinMouseDown }) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isInteractive) return;
    e.stopPropagation();
    setIsPressed(true);
    onPressChange?.(true);
  };

  const handleMouseUp = () => {
    setIsPressed(false);
    onPressChange?.(false);
  };

  return (
    <div
      className="relative w-12 h-12 bg-zinc-800 border-2 border-zinc-600 rounded-[6.4px] shadow-lg flex items-center justify-center select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 4 Corner Pins with prominent highlight */}
      {/* 1a (Top-Left) */}
      <div
        title="Pin 1a"
        className="absolute -top-1.5 -left-1 w-2.5 h-2.5 rounded-full bg-zinc-400 border border-zinc-600 hover:bg-white hover:scale-150 hover:shadow-[0_0_10px_rgba(255,255,255,0.95)] hover:ring-2 hover:ring-white transition-all cursor-crosshair z-20"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('1a', e);
        }}
      />
      {/* 1b (Top-Right) */}
      <div
        title="Pin 1b"
        className="absolute -top-1.5 -right-1 w-2.5 h-2.5 rounded-full bg-zinc-400 border border-zinc-600 hover:bg-white hover:scale-150 hover:shadow-[0_0_10px_rgba(255,255,255,0.95)] hover:ring-2 hover:ring-white transition-all cursor-crosshair z-20"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('1b', e);
        }}
      />
      {/* 2a (Bottom-Left) */}
      <div
        title="Pin 2a"
        className="absolute -bottom-1.5 -left-1 w-2.5 h-2.5 rounded-full bg-zinc-400 border border-zinc-600 hover:bg-white hover:scale-150 hover:shadow-[0_0_10px_rgba(255,255,255,0.95)] hover:ring-2 hover:ring-white transition-all cursor-crosshair z-20"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('2a', e);
        }}
      />
      {/* 2b (Bottom-Right) */}
      <div
        title="Pin 2b"
        className="absolute -bottom-1.5 -right-1 w-2.5 h-2.5 rounded-full bg-zinc-400 border border-zinc-600 hover:bg-white hover:scale-150 hover:shadow-[0_0_10px_rgba(255,255,255,0.95)] hover:ring-2 hover:ring-white transition-all cursor-crosshair z-20"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('2b', e);
        }}
      />

      {/* Metal top bezel */}
      <div className="w-8 h-8 rounded-full bg-zinc-600 flex items-center justify-center shadow-inner">
        {/* Plunger Actuator */}
        <div
          className={`w-6 h-6 rounded-full cursor-pointer transition-transform duration-75 flex items-center justify-center ${
            isPressed
              ? 'scale-90 bg-zinc-900 shadow-inner'
              : 'bg-zinc-700 hover:bg-zinc-650 shadow'
          }`}
          onMouseDown={handleMouseDown}
        >
          <div className="w-2 h-2 rounded-full bg-zinc-500/50" />
        </div>
      </div>
    </div>
  );
};
