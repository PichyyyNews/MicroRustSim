import React from 'react';

interface LedProps {
  id?: string;
  color?: string;
  isLit: boolean;
  brightness?: number; // 0.0 to 1.0 from physics simulation
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

interface ColorStyle {
  bg: string;
  glow: string;
  border: string;
}

const COLOR_MAP: Record<string, ColorStyle> = {
  red: { bg: '#ef4444', glow: '#ef4444', border: '#b91c1c' },
  '#ef4444': { bg: '#ef4444', glow: '#ef4444', border: '#b91c1c' },
  green: { bg: '#22c55e', glow: '#22c55e', border: '#15803d' },
  '#22c55e': { bg: '#22c55e', glow: '#22c55e', border: '#15803d' },
  blue: { bg: '#3b82f6', glow: '#3b82f6', border: '#1d4ed8' },
  '#3b82f6': { bg: '#3b82f6', glow: '#3b82f6', border: '#1d4ed8' },
  yellow: { bg: '#eab308', glow: '#eab308', border: '#a16207' },
  '#eab308': { bg: '#eab308', glow: '#eab308', border: '#a16207' },
  white: { bg: '#f8fafc', glow: '#ffffff', border: '#cbd5e1' },
  '#f8fafc': { bg: '#f8fafc', glow: '#ffffff', border: '#cbd5e1' },
  orange: { bg: '#f97316', glow: '#f97316', border: '#c2410c' },
  '#f97316': { bg: '#f97316', glow: '#f97316', border: '#c2410c' },
};

function resolveColorStyle(color?: string): ColorStyle {
  if (!color) return COLOR_MAP.red;
  const key = color.toLowerCase();
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  if (color.startsWith('#')) {
    return { bg: color, glow: color, border: color };
  }
  return COLOR_MAP.red;
}

export const Led: React.FC<LedProps> = ({ color, isLit, brightness, onPinMouseDown }) => {
  const current = resolveColorStyle(color);

  // Physical brightness clamp between 0.04 and 1.0 when lit
  const b = isLit ? Math.min(1.0, Math.max(0.04, brightness !== undefined ? brightness : 1.0)) : 0.0;

  // Layered glowing shadows proportional to current
  const blur1 = Math.round(b * 16 + 3);
  const spread1 = Math.round(b * 4 + 1);
  const blur2 = Math.round(b * 32 + 6);
  const spread2 = Math.round(b * 6);

  const boxShadow = isLit
    ? `0 0 ${blur1}px ${spread1}px ${current.glow}, 0 0 ${blur2}px ${spread2}px ${current.glow}80${
        b > 0.5 ? `, inset 0 0 8px rgba(255, 255, 255, ${(b * 0.45).toFixed(2)})` : ''
      }`
    : 'none';

  const domeFilter = isLit
    ? `brightness(${(0.85 + b * 0.5).toFixed(2)}) saturate(${(0.9 + b * 0.35).toFixed(2)})`
    : 'brightness(0.65) saturate(0.75)';

  const domeOpacity = isLit ? Math.min(1.0, 0.75 + b * 0.25) : 0.75;

  return (
    <div
      className="relative select-none cursor-move flex flex-col items-center"
      style={{ width: '48px', height: '64px' }}
    >
      {/* 5mm LED Epoxy Dome */}
      <div
        className="w-7 h-7 rounded-t-full rounded-b-sm border-2 transition-all duration-100 relative overflow-hidden"
        style={{
          backgroundColor: current.bg,
          borderColor: current.border,
          boxShadow,
          filter: domeFilter,
          opacity: domeOpacity,
        }}
      >
        {/* Core luminous center when lit */}
        {isLit && (
          <div
            className="absolute inset-x-1.5 top-1.5 bottom-1 rounded-full bg-white blur-[1.5px] pointer-events-none transition-opacity"
            style={{ opacity: (b * 0.75).toFixed(2) }}
          />
        )}

        {/* Epoxy lens light reflection */}
        <div
          className="absolute top-1 left-1.5 w-2 h-2 rounded-full bg-white blur-[0.5px] transition-opacity"
          style={{ opacity: isLit ? Math.min(1.0, 0.35 + b * 0.5) : 0.3 }}
        />
      </div>

      {/* Flat rim / base */}
      <div className="w-8 h-1 bg-zinc-700 rounded-sm -mt-0.5" />

      {/* Leads (Anode + and Cathode -) */}
      <div className="flex justify-between w-5 mt-1">
        {/* Anode (Longer lead, curved) */}
        <div
          title="Anode (+)"
          className="w-1.5 h-6 bg-zinc-300 hover:bg-white hover:scale-105 hover:shadow-[0_0_4px_rgba(255,255,255,0.85)] hover:ring-1 hover:ring-white/80 transition-all cursor-crosshair rounded-b-sm flex items-end justify-center shadow"
          onMouseDown={(e) => {
            e.stopPropagation();
            onPinMouseDown?.('anode', e);
          }}
        >
          <div className="w-1 h-1 rounded-full bg-zinc-500" />
        </div>

        {/* Cathode (Shorter lead) */}
        <div
          title="Cathode (-)"
          className="w-1.5 h-5 bg-zinc-400 hover:bg-white hover:scale-105 hover:shadow-[0_0_4px_rgba(255,255,255,0.85)] hover:ring-1 hover:ring-white/80 transition-all cursor-crosshair rounded-b-sm flex items-end justify-center shadow"
          onMouseDown={(e) => {
            e.stopPropagation();
            onPinMouseDown?.('cathode', e);
          }}
        >
          <div className="w-1 h-1 rounded-full bg-zinc-600" />
        </div>
      </div>
    </div>
  );
};
