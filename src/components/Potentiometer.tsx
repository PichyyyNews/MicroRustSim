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

  // Strictly sanitize value to a normalized 0.0..1.0 numeric float (prevent string concatenation jumps from Wokwi attrs.value)
  const rawNum = typeof value === 'number' ? value : parseFloat(String(value));
  const safeVal = isNaN(rawNum) ? 0.5 : rawNum > 1.0 ? 0.5 : Math.max(0, Math.min(1, rawNum));

  // Map 0.0..1.0 to -135deg..+135deg (270 degrees sweep)
  const angle = -135 + safeVal * 270;
  const percent = Math.round(safeVal * 100);
  const r12 = (safeVal * 10).toFixed(1);
  const r23 = ((1 - safeVal) * 10).toFixed(1);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isInteractive) return;
    e.stopPropagation();
    isDragging.current = true;
    const startY = e.clientY;
    const startVal = safeVal;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      const dy = startY - moveEvent.clientY; // drag up increases, down decreases
      const delta = dy / 100;
      const next = Math.max(0, Math.min(1, startVal + delta));
      onValueChange?.(Number(next.toFixed(3)));
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
    <div
      className="relative select-none cursor-move flex flex-col items-center"
      style={{ width: '56px', height: '64px' }}
    >
      {/* Rotary Knob Body */}
      <div
        className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-zinc-600 shadow-md relative flex items-center justify-center cursor-ns-resize"
        onMouseDown={handleMouseDown}
        title={`Rotate Wiper: ${percent}% (R1-2: ${r12}kΩ, R2-3: ${r23}kΩ) (Drag Up/Down)`}
      >
        {/* Rotating dial container that orbits strictly around the knob center */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: 'center center',
          }}
        >
          {/* Radial indicator needle (cleanly positioned) */}
          <div className="w-1 h-3 bg-zinc-100 rounded-full shadow-sm absolute top-1" />
        </div>

        {/* Metal center cap */}
        <div className="w-3.5 h-3.5 rounded-full bg-zinc-600 border border-zinc-500 shadow-inner z-10" />
      </div>

      <span className="text-[9px] font-mono text-zinc-400 mt-1 whitespace-nowrap tabular-nums">{percent}%</span>

      {/* 3 Leads at the bottom: 1 (Terminal 1), 2 (Wiper), 3 (Terminal 2) */}
      <div className="flex justify-between w-8 mt-0.5">
        {/* Terminal 1 */}
        <div
          title="Terminal 1 (Pin 1)"
          className="w-2 h-3.5 bg-zinc-400 hover:bg-white hover:scale-110 hover:shadow-[0_0_4px_rgba(255,255,255,0.85)] hover:ring-1 hover:ring-white/80 transition-all cursor-crosshair rounded-b flex items-end justify-center shadow"
          onMouseDown={(e) => {
            e.stopPropagation();
            onPinMouseDown?.('1', e);
          }}
        >
          <div className="w-1 h-1 bg-zinc-600 rounded-full" />
        </div>

        {/* Wiper */}
        <div
          title="Wiper (Pin 2)"
          className="w-2 h-3.5 bg-zinc-300 hover:bg-white hover:scale-110 hover:shadow-[0_0_4px_rgba(255,255,255,0.85)] hover:ring-1 hover:ring-white/80 transition-all cursor-crosshair rounded-b flex items-end justify-center shadow"
          onMouseDown={(e) => {
            e.stopPropagation();
            onPinMouseDown?.('2', e);
          }}
        >
          <div className="w-1 h-1 bg-zinc-500 rounded-full" />
        </div>

        {/* Terminal 2 */}
        <div
          title="Terminal 2 (Pin 3)"
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
