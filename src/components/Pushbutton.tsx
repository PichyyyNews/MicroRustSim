import React, { useState, useEffect, useRef } from 'react';

interface PushbuttonProps {
  id: string;
  isInteractive?: boolean;
  onPressChange?: (pressed: boolean) => void;
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const Pushbutton: React.FC<PushbuttonProps> = ({
  isInteractive = true,
  onPressChange,
  onPinMouseDown,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const pressedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isInteractive || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    setIsPressed(true);
    pressedRef.current = true;
    onPressChange?.(true);

    const handlePointerUp = () => {
      if (pressedRef.current) {
        setIsPressed(false);
        pressedRef.current = false;
        onPressChange?.(false);
      }
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  useEffect(() => {
    return () => {
      if (pressedRef.current) {
        onPressChange?.(false);
      }
    };
  }, [onPressChange]);

  return (
    <div
      className="relative bg-[#18181b] border-2 border-[#3f3f46] rounded-[8px] shadow-md flex items-center justify-center select-none"
      style={{ width: '52px', height: '52px' }}
    >
      {/* 4 Corner Pins with high-visibility targets */}
      {/* 1a (Top-Left) */}
      <div
        title="Pin 1a (Terminal 1 Left)"
        style={{ left: '0px', top: '0px' }}
        className="absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-zinc-300 border border-zinc-600 hover:bg-white hover:scale-125 hover:shadow-[0_0_6px_rgba(255,255,255,0.95)] hover:ring-2 hover:ring-white/90 transition-all cursor-crosshair z-30 flex items-center justify-center"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('1a', e);
        }}
      >
        <div className="w-1 h-1 rounded-full bg-zinc-600" />
      </div>

      {/* 1b (Top-Right) */}
      <div
        title="Pin 1b (Terminal 1 Right)"
        style={{ left: '52px', top: '0px' }}
        className="absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-zinc-300 border border-zinc-600 hover:bg-white hover:scale-125 hover:shadow-[0_0_6px_rgba(255,255,255,0.95)] hover:ring-2 hover:ring-white/90 transition-all cursor-crosshair z-30 flex items-center justify-center"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('1b', e);
        }}
      >
        <div className="w-1 h-1 rounded-full bg-zinc-600" />
      </div>

      {/* 2a (Bottom-Left) */}
      <div
        title="Pin 2a (Terminal 2 Left)"
        style={{ left: '0px', top: '52px' }}
        className="absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-zinc-300 border border-zinc-600 hover:bg-white hover:scale-125 hover:shadow-[0_0_6px_rgba(255,255,255,0.95)] hover:ring-2 hover:ring-white/90 transition-all cursor-crosshair z-30 flex items-center justify-center"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('2a', e);
        }}
      >
        <div className="w-1 h-1 rounded-full bg-zinc-600" />
      </div>

      {/* 2b (Bottom-Right) */}
      <div
        title="Pin 2b (Terminal 2 Right)"
        style={{ left: '52px', top: '52px' }}
        className="absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-zinc-300 border border-zinc-600 hover:bg-white hover:scale-125 hover:shadow-[0_0_6px_rgba(255,255,255,0.95)] hover:ring-2 hover:ring-white/90 transition-all cursor-crosshair z-30 flex items-center justify-center"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('2b', e);
        }}
      >
        <div className="w-1 h-1 rounded-full bg-zinc-600" />
      </div>

      {/* Tactile Pushbutton Actuator Container (Generous Hit Area) */}
      <div
        title={isPressed ? 'Pushbutton (CLOSED)' : 'Pushbutton (Click to Press)'}
        className={`w-9 h-9 rounded-full bg-[#27272a] border border-[#52525b] flex items-center justify-center shadow-inner cursor-pointer transition-all duration-75 ${
          isPressed ? 'scale-90 ring-2 ring-amber-500/50' : 'hover:border-zinc-400'
        }`}
        onPointerDown={handlePointerDown}
      >
        {/* Round Plunger Cap */}
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-75 shadow-md ${
            isPressed
              ? 'bg-[#09090b] shadow-inner scale-95 border border-amber-500/40'
              : 'bg-gradient-to-b from-[#3f3f46] to-[#27272a] border border-zinc-500/60 hover:brightness-115'
          }`}
        >
          {/* Tactile concave indicator dot */}
          <div
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              isPressed ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]' : 'bg-zinc-600/70'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
