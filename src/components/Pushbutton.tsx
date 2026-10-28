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
  const [isLocked, setIsLocked] = useState(false);
  const pressedRef = useRef(false);

  // Sync with external state (e.g. from Inspector or backend)
  useEffect(() => {
    setIsLocalPressed(pressed);
    pressedRef.current = pressed;
    if (!pressed) {
      setIsLocked(false);
    }
  }, [pressed]);

  const activePressed = isLocalPressed || pressed;

  const handleActuationStart = (e: React.MouseEvent | React.PointerEvent) => {
    if (!isInteractive || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    // If Shift-click: toggle lock mode
    if (e.shiftKey) {
      const nextLocked = !isLocked;
      setIsLocked(nextLocked);
      setIsLocalPressed(nextLocked);
      pressedRef.current = nextLocked;
      onPressChange?.(nextLocked);
      return;
    }

    // If already locked in pressed state, clicking it unlocks/releases it
    if (isLocked) {
      setIsLocked(false);
      setIsLocalPressed(false);
      pressedRef.current = false;
      onPressChange?.(false);
      return;
    }

    // Standard momentary push (press and hold)
    setIsLocalPressed(true);
    pressedRef.current = true;
    onPressChange?.(true);

    const handleActuationEnd = () => {
      if (pressedRef.current && !isLocked) {
        setIsLocalPressed(false);
        pressedRef.current = false;
        onPressChange?.(false);
      }
      window.removeEventListener('pointerup', handleActuationEnd);
      window.removeEventListener('pointercancel', handleActuationEnd);
      window.removeEventListener('mouseup', handleActuationEnd);
    };

    window.addEventListener('pointerup', handleActuationEnd);
    window.addEventListener('pointercancel', handleActuationEnd);
    window.addEventListener('mouseup', handleActuationEnd);
  };

  useEffect(() => {
    return () => {
      if (pressedRef.current && !isLocked) {
        onPressChange?.(false);
      }
    };
  }, [onPressChange, isLocked]);

  return (
    <div
      className="relative bg-[#18181b] border-2 border-[#3f3f46] rounded-[8px] shadow-md flex items-center justify-center select-none"
      style={{ width: '52px', height: '52px' }}
      onMouseDown={(e) => {
        // Prevent canvas component dragging when interacting with button body
        e.stopPropagation();
      }}
    >
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

      {/* Tactile Pushbutton Actuator (Generous Hit Area & Immediate Tactile Click) */}
      <div
        title={
          activePressed
            ? isLocked
              ? 'Pushbutton (LOCKED CLOSED) • Click to release'
              : 'Pushbutton (CLOSED - 0.0V Active)'
            : 'Pushbutton (Click & Hold to Actuate | Shift+Click to Lock)'
        }
        className={`w-10 h-10 rounded-full bg-[#27272a] border border-[#52525b] flex items-center justify-center shadow-inner cursor-pointer transition-all duration-75 ${
          activePressed ? 'scale-90 ring-2 ring-amber-500/70' : 'hover:border-zinc-400'
        }`}
        onPointerDown={handleActuationStart}
        onMouseDown={handleActuationStart}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Round Plunger Cap */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-75 shadow-md ${
            activePressed
              ? 'bg-[#09090b] shadow-inner scale-95 border border-amber-500/50'
              : 'bg-gradient-to-b from-[#3f3f46] to-[#27272a] border border-zinc-500/60 hover:brightness-115'
          }`}
        >
          {/* Tactile concave indicator dot */}
          <div
            className={`w-3 h-3 rounded-full transition-all ${
              activePressed
                ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] scale-110'
                : 'bg-zinc-600/70'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
