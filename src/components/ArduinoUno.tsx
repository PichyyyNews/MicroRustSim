import React from 'react';
import unoSvgUrl from '../assets/ArduinoUno.svg';

interface ArduinoUnoProps {
  pin13Lit: boolean;
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

// 1:1 Exact Pin Coordinates extracted from official ArduinoUno.svg (viewBox: 0 0 285.2 209)
export const ARDUINO_PINS: Record<string, { x: number; y: number }> = {
  // Top Digital Header (left to right by X position, cy = 19.0)
  'SCL': { x: 98.8, y: 19.0 },
  'SDA': { x: 107.8, y: 19.0 },
  'AREF': { x: 116.8, y: 19.0 },
  'GND': { x: 125.8, y: 19.0 },
  '13': { x: 134.8, y: 19.0 },
  '12': { x: 143.8, y: 19.0 },
  '11': { x: 152.8, y: 19.0 },
  '10': { x: 161.8, y: 19.0 },
  '9': { x: 170.8, y: 19.0 },
  '8': { x: 179.8, y: 19.0 },
  '7': { x: 194.2, y: 19.0 },
  '6': { x: 203.2, y: 19.0 },
  '5': { x: 212.2, y: 19.0 },
  '4': { x: 221.2, y: 19.0 },
  '3': { x: 230.2, y: 19.0 },
  '2': { x: 239.2, y: 19.0 },
  '1': { x: 248.2, y: 19.0 },
  '0': { x: 257.2, y: 19.0 },

  // Bottom Power Header (left to right, cy = 190.0)
  'IOREF': { x: 140.2, y: 190.0 },
  'RESET': { x: 149.2, y: 190.0 },
  '3.3V': { x: 158.2, y: 190.0 },
  '5V': { x: 167.2, y: 190.0 },
  'GND_1': { x: 176.2, y: 190.0 },
  'GND_2': { x: 185.2, y: 190.0 },
  'VIN': { x: 194.2, y: 190.0 },

  // Bottom Analog In Header (left to right, cy = 190.0)
  'A0': { x: 212.2, y: 190.0 },
  'A1': { x: 221.2, y: 190.0 },
  'A2': { x: 230.2, y: 190.0 },
  'A3': { x: 239.2, y: 190.0 },
  'A4': { x: 248.2, y: 190.0 },
  'A5': { x: 257.2, y: 190.0 },
};

export const ArduinoUno: React.FC<ArduinoUnoProps> = ({ pin13Lit, onPinMouseDown }) => {
  return (
    <div
      className="relative w-[285.2px] h-[209px] select-none filter drop-shadow-2xl"
      style={{ width: '285.2px', height: '209px' }}
    >
      {/* Official Vector SVG Board Art */}
      <img
        src={unoSvgUrl}
        alt="Arduino Uno R3"
        className="w-full h-full pointer-events-none select-none block"
        draggable={false}
      />

      {/* Dynamic Status LEDs Overlay */}
      {/* Power LED (ON - Green) at cx=242.4, cy=69.6 */}
      <div
        title="Power LED (ON)"
        className="absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981] pointer-events-none"
        style={{ left: '242.4px', top: '69.6px' }}
      />

      {/* Builtin Pin 13 LED (L - Amber/Yellow) at cx=130.8, cy=52.7 */}
      <div
        title="Builtin LED (L - Pin 13)"
        className={`absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2 rounded transition-all duration-75 pointer-events-none ${
          pin13Lit
            ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b] opacity-100 ring-1 ring-amber-300'
            : 'bg-amber-950/40 opacity-30'
        }`}
        style={{ left: '130.8px', top: '52.7px' }}
      />

      {/* Interactive Pin Holes Overlay (Exact 1:1 Pin Holes Matching Official SVG Headers) */}
      {Object.entries(ARDUINO_PINS).map(([name, pos]) => (
        <div
          key={name}
          title={`Pin: ${name}`}
          className="absolute w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-transparent hover:border-white hover:bg-white hover:scale-115 hover:shadow-[0_0_5px_rgba(255,255,255,0.9)] hover:ring-1 hover:ring-white/80 transition-all cursor-crosshair z-30 flex items-center justify-center group"
          style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onPinMouseDown?.(name, e);
          }}
        >
          <div className="w-1 h-1 rounded-full bg-transparent group-hover:bg-zinc-950 transition-colors" />
        </div>
      ))}
    </div>
  );
};
