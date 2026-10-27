import React from 'react';

interface ArduinoUnoProps {
  pin13Lit: boolean;
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const ARDUINO_PINS: Record<string, { x: number; y: number }> = {
  // Digital Header (top row, from right to left or left to right)
  '0': { x: 265, y: 16 },
  '1': { x: 250, y: 16 },
  '2': { x: 235, y: 16 },
  '3': { x: 220, y: 16 },
  '4': { x: 205, y: 16 },
  '5': { x: 190, y: 16 },
  '6': { x: 175, y: 16 },
  '7': { x: 160, y: 16 },
  '8': { x: 140, y: 16 },
  '9': { x: 125, y: 16 },
  '10': { x: 110, y: 16 },
  '11': { x: 95, y: 16 },
  '12': { x: 80, y: 16 },
  '13': { x: 65, y: 16 },
  'GND': { x: 50, y: 16 },
  'AREF': { x: 35, y: 16 },

  // Power & Analog Header (bottom row)
  'IOREF': { x: 60, y: 224 },
  'RESET': { x: 75, y: 224 },
  '3.3V': { x: 90, y: 224 },
  '5V': { x: 105, y: 224 },
  'GND_1': { x: 120, y: 224 },
  'GND_2': { x: 135, y: 224 },
  'VIN': { x: 150, y: 224 },
  'A0': { x: 180, y: 224 },
  'A1': { x: 195, y: 224 },
  'A2': { x: 210, y: 224 },
  'A3': { x: 225, y: 224 },
  'A4': { x: 240, y: 224 },
  'A5': { x: 255, y: 224 },
};

export const ArduinoUno: React.FC<ArduinoUnoProps> = ({ pin13Lit, onPinMouseDown }) => {
  return (
    <div className="relative w-[300px] h-[240px] select-none filter drop-shadow-xl">
      <svg viewBox="0 0 300 240" className="w-full h-full">
        {/* PCB Board Outline */}
        <path
          d="M 10 20 Q 10 10 20 10 L 280 10 Q 290 10 290 20 L 290 220 Q 290 230 280 230 L 20 230 Q 10 230 10 220 Z"
          fill="#005C5E"
          stroke="#008184"
          strokeWidth="2"
        />

        {/* Mounting Holes */}
        <circle cx="25" cy="55" r="5" fill="#13161f" stroke="#e2e8f0" strokeWidth="1.5" />
        <circle cx="275" cy="45" r="5" fill="#13161f" stroke="#e2e8f0" strokeWidth="1.5" />
        <circle cx="160" cy="215" r="5" fill="#13161f" stroke="#e2e8f0" strokeWidth="1.5" />
        <circle cx="275" cy="205" r="5" fill="#13161f" stroke="#e2e8f0" strokeWidth="1.5" />

        {/* USB Connector */}
        <rect x="0" y="35" width="45" height="35" rx="3" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
        <rect x="5" y="42" width="30" height="21" fill="#475569" />

        {/* DC Barrel Jack */}
        <rect x="0" y="160" width="48" height="42" rx="3" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />

        {/* ATmega328P DIP-28 Chip */}
        <rect x="90" y="95" width="130" height="45" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
        {/* Notch */}
        <path d="M 90 112 A 5 5 0 0 1 90 122" fill="#334155" />
        <text x="105" y="122" fill="#94a3b8" fontSize="10" fontFamily="monospace" fontWeight="bold">
          ATmega328P-PU
        </text>

        {/* 16MHz Crystal */}
        <rect x="75" y="65" width="22" height="12" rx="4" fill="#cbd5e1" stroke="#64748b" />
        <text x="77" y="74" fill="#334155" fontSize="7" fontWeight="bold">16.0</text>

        {/* Reset Button */}
        <rect x="25" y="90" width="16" height="16" rx="2" fill="#e2e8f0" />
        <circle cx="33" cy="98" r="4.5" fill="#ef4444" />

        {/* Board Labels (Silkscreen) */}
        <text x="120" y="55" fill="#e0f2fe" fontSize="13" fontWeight="bold" letterSpacing="0.5">
          ARDUINO
        </text>
        <text x="188" y="55" fill="#38bdf8" fontSize="11" fontWeight="bold">
          UNO
        </text>
        <text x="120" y="70" fill="#94a3b8" fontSize="8" fontWeight="600">
          ITALY DESIGN
        </text>

        {/* Status LEDs */}
        {/* Power LED (ON - Green) */}
        <circle cx="85" cy="165" r="3" fill="#22c55e" filter="drop-shadow(0 0 4px #22c55e)" />
        <text x="92" y="167" fill="#cbd5e1" fontSize="7" fontWeight="bold">ON</text>

        {/* Pin 13 Builtin LED (L - Amber/Yellow) */}
        <circle
          cx="85"
          cy="180"
          r="3"
          fill={pin13Lit ? '#f59e0b' : '#78350f'}
          className={pin13Lit ? 'animate-pulse' : ''}
          style={{
            filter: pin13Lit ? 'drop-shadow(0 0 6px #f59e0b)' : 'none',
          }}
        />
        <text x="92" y="182" fill="#cbd5e1" fontSize="7" fontWeight="bold">L</text>

        {/* Top Header Plastic Bar */}
        <rect x="28" y="8" width="248" height="16" rx="2" fill="#0f172a" />
        {/* Bottom Header Plastic Bar */}
        <rect x="52" y="216" width="212" height="16" rx="2" fill="#0f172a" />

        {/* Silkscreen Pin Labels */}
        <text x="60" y="32" fill="#f8fafc" fontSize="7" fontFamily="monospace">13</text>
        <text x="75" y="32" fill="#f8fafc" fontSize="7" fontFamily="monospace">12</text>
        <text x="90" y="32" fill="#f8fafc" fontSize="7" fontFamily="monospace">~11</text>
        <text x="105" y="32" fill="#f8fafc" fontSize="7" fontFamily="monospace">~10</text>
        <text x="122" y="32" fill="#f8fafc" fontSize="7" fontFamily="monospace">~9</text>
        <text x="138" y="32" fill="#f8fafc" fontSize="7" fontFamily="monospace">8</text>
        <text x="157" y="32" fill="#f8fafc" fontSize="7" fontFamily="monospace">7</text>
        <text x="172" y="32" fill="#f8fafc" fontSize="7" fontFamily="monospace">~6</text>
        <text x="187" y="32" fill="#f8fafc" fontSize="7" fontFamily="monospace">~5</text>
        <text x="202" y="32" fill="#f8fafc" fontSize="7" fontFamily="monospace">4</text>
        <text x="217" y="32" fill="#f8fafc" fontSize="7" fontFamily="monospace">~3</text>
        <text x="232" y="32" fill="#f8fafc" fontSize="7" fontFamily="monospace">2</text>
        <text x="247" y="32" fill="#f8fafc" fontSize="7" fontFamily="monospace">TX</text>
        <text x="262" y="32" fill="#f8fafc" fontSize="7" fontFamily="monospace">RX</text>

        <text x="100" y="212" fill="#f8fafc" fontSize="7" fontFamily="monospace">5V</text>
        <text x="115" y="212" fill="#f8fafc" fontSize="7" fontFamily="monospace">GND</text>
        <text x="177" y="212" fill="#f8fafc" fontSize="7" fontFamily="monospace">A0</text>
        <text x="192" y="212" fill="#f8fafc" fontSize="7" fontFamily="monospace">A1</text>
        <text x="207" y="212" fill="#f8fafc" fontSize="7" fontFamily="monospace">A2</text>
        <text x="222" y="212" fill="#f8fafc" fontSize="7" fontFamily="monospace">A3</text>
        <text x="237" y="212" fill="#f8fafc" fontSize="7" fontFamily="monospace">A4</text>
        <text x="252" y="212" fill="#f8fafc" fontSize="7" fontFamily="monospace">A5</text>
      </svg>

      {/* Interactive Pin Holes Overlay */}
      {Object.entries(ARDUINO_PINS).map(([name, pos]) => (
        <div
          key={name}
          title={`Pin: ${name}`}
          className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full border border-[#475569] bg-[#020617] hover:bg-[#8b5cf6] hover:scale-125 transition-transform cursor-crosshair z-20 flex items-center justify-center shadow"
          style={{ left: pos.x, top: pos.y }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onPinMouseDown?.(name, e);
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] hover:bg-white" />
        </div>
      ))}
    </div>
  );
};
