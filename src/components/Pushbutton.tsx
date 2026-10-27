import React, { useState } from 'react';

interface PushbuttonProps {
  id: string;
  onPressChange?: (pressed: boolean) => void;
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const Pushbutton: React.FC<PushbuttonProps> = ({ onPressChange, onPinMouseDown }) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
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
      {/* 4 Corner Pins */}
      {/* 1a (Top-Left) */}
      <div
        title="1a"
        className="absolute -top-1.5 -left-1 w-2 h-2 rounded-full bg-zinc-400 border border-zinc-600 hover:bg-[#8b5cf6] cursor-crosshair"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('1a', e);
        }}
      />
      {/* 1b (Top-Right) */}
      <div
        title="1b"
        className="absolute -top-1.5 -right-1 w-2 h-2 rounded-full bg-zinc-400 border border-zinc-600 hover:bg-[#8b5cf6] cursor-crosshair"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('1b', e);
        }}
      />
      {/* 2a (Bottom-Left) */}
      <div
        title="2a"
        className="absolute -bottom-1.5 -left-1 w-2 h-2 rounded-full bg-zinc-400 border border-zinc-600 hover:bg-[#8b5cf6] cursor-crosshair"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('2a', e);
        }}
      />
      {/* 2b (Bottom-Right) */}
      <div
        title="2b"
        className="absolute -bottom-1.5 -right-1 w-2 h-2 rounded-full bg-zinc-400 border border-zinc-600 hover:bg-[#8b5cf6] cursor-crosshair"
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
              ? 'scale-90 bg-blue-700 shadow-inner'
              : 'scale-100 bg-blue-500 shadow-md hover:brightness-110'
          }`}
          onMouseDown={handleMouseDown}
        >
          <div className="w-2 h-2 rounded-full bg-blue-300/40" />
        </div>
      </div>
    </div>
  );
};
