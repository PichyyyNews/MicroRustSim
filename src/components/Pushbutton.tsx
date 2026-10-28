import React, { useState, useEffect, useRef } from 'react';

interface PushbuttonProps {
  id: string;
  pressed?: boolean;
  isInteractive?: boolean;
  onPressChange?: (pressed: boolean) => void;
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const Pushbutton: React.FC<PushbuttonProps> = ({
  pressed = false,
  isInteractive = true,
  onPressChange,
  onPinMouseDown,
}) => {
  const [isLocalPressed, setIsLocalPressed] = useState(pressed);
  const pressedRef = useRef(pressed);
  const downTimeRef = useRef(0);

  // Sync with external state (e.g. from Inspector or backend)
  useEffect(() => {
    setIsLocalPressed(pressed);
    pressedRef.current = pressed;
  }, [pressed]);

  const activePressed = isLocalPressed || pressed;

  // Actuation on Center Round Plunger ONLY
  const handlePlungerMouseDown = (e: React.MouseEvent) => {
    if (!isInteractive || e.button !== 0) return;
    // CRITICAL: Stop propagation so outer wrapper does NOT initiate component dragging!
    e.stopPropagation();
    e.preventDefault();

    downTimeRef.current = performance.now();

    // If already pressed, click toggles it off
    if (activePressed) {
      setIsLocalPressed(false);
      pressedRef.current = false;
      onPressChange?.(false);
      return;
    }

    // Otherwise, turn on
    setIsLocalPressed(true);
    pressedRef.current = true;
    onPressChange?.(true);

    const handleWindowMouseUp = () => {
      window.removeEventListener('mouseup', handleWindowMouseUp);
      
      const holdDuration = performance.now() - downTimeRef.current;
      // If user pressed and held for more than 200ms, release on mouseup (momentary hold)
      // If user did a quick tap/click (<200ms), keep it latched so MCU loop does not miss the pulse!
      if (holdDuration >= 200) {
        setIsLocalPressed(false);
        pressedRef.current = false;
        onPressChange?.(false);
      }
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  return (
    <div
      className="relative bg-[#18181b] border-2 border-[#3f3f46] rounded-[8px] shadow-md flex items-center justify-center select-none cursor-move group hover:border-zinc-500 transition-colors"
      style={{ width: '52px', height: '52px' }}
      title="Pushbutton • Drag border to move or select"
    >
      {/* Visual Corner Rivets on the Bezel to emphasize the draggable frame */}
      <div className="absolute top-1 left-1 w-1 h-1 rounded-full bg-zinc-600/70 pointer-events-none" />
      <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-zinc-600/70 pointer-events-none" />
      <div className="absolute bottom-1 left-1 w-1 h-1 rounded-full bg-zinc-600/70 pointer-events-none" />
      <div className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-zinc-600/70 pointer-events-none" />

      {/* 4 Corner Pins with high-visibility targets (Geometry exactly aligned with (0,0), (52,0), (0,52), (52,52)) */}
      {/* 1a (Top-Left) */}
      <div
        title="Pin 1a (Terminal 1 Left)"
        style={{ left: '0px', top: '0px' }}
        className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-zinc-300 border border-zinc-600 hover:bg-white hover:scale-125 hover:shadow-[0_0_6px_rgba(255,255,255,0.95)] hover:ring-2 hover:ring-white/90 transition-all cursor-crosshair z-30 flex items-center justify-center"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('1a', e);
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
      </div>

      {/* 1b (Top-Right) */}
      <div
        title="Pin 1b (Terminal 1 Right)"
        style={{ left: '52px', top: '0px' }}
        className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-zinc-300 border border-zinc-600 hover:bg-white hover:scale-125 hover:shadow-[0_0_6px_rgba(255,255,255,0.95)] hover:ring-2 hover:ring-white/90 transition-all cursor-crosshair z-30 flex items-center justify-center"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('1b', e);
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
      </div>

      {/* 2a (Bottom-Left) */}
      <div
        title="Pin 2a (Terminal 2 Left)"
        style={{ left: '0px', top: '52px' }}
        className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-zinc-300 border border-zinc-600 hover:bg-white hover:scale-125 hover:shadow-[0_0_6px_rgba(255,255,255,0.95)] hover:ring-2 hover:ring-white/90 transition-all cursor-crosshair z-30 flex items-center justify-center"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('2a', e);
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
      </div>

      {/* 2b (Bottom-Right) */}
      <div
        title="Pin 2b (Terminal 2 Right)"
        style={{ left: '52px', top: '52px' }}
        className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-zinc-300 border border-zinc-600 hover:bg-white hover:scale-125 hover:shadow-[0_0_6px_rgba(255,255,255,0.95)] hover:ring-2 hover:ring-white/90 transition-all cursor-crosshair z-30 flex items-center justify-center"
        onMouseDown={(e) => {
          e.stopPropagation();
          onPinMouseDown?.('2b', e);
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
      </div>

      {/* Recessed Metal Collar Bezel around the plunger (Visual buffer between drag border and click plunger) */}
      <div className="w-8 h-8 rounded-full bg-[#121215] border border-zinc-600 flex items-center justify-center shadow-inner pointer-events-none">
        {/* Tactile Plunger Button (The specific circle for clicking / pressing) */}
        <div
          title={
            activePressed
              ? 'Pushbutton (CLOSED - 0.0V Active) • Click to release'
              : 'Pushbutton (OPEN - 5.0V) • Click to press'
          }
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-75 shadow-md cursor-pointer pointer-events-auto ${
            activePressed
              ? 'bg-[#09090b] shadow-inner scale-90 border-2 border-amber-500 ring-2 ring-amber-500/60'
              : 'bg-gradient-to-b from-[#484852] to-[#27272a] border border-zinc-500/80 hover:brightness-125 active:scale-95'
          }`}
          onMouseDown={handlePlungerMouseDown}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tactile concave indicator dot */}
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-75 ${
              activePressed
                ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.95)] scale-110'
                : 'bg-zinc-600/80 group-hover:bg-zinc-500'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
