import React from 'react';

interface LedProps {
  id: string;
  color: 'red' | 'green' | 'blue' | 'yellow' | 'white';
  isLit: boolean;
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

const COLOR_MAP = {
  red: { bg: '#ef4444', glow: '#ef4444', border: '#b91c1c' },
  green: { bg: '#22c55e', glow: '#22c55e', border: '#15803d' },
  blue: { bg: '#3b82f6', glow: '#3b82f6', border: '#1d4ed8' },
  yellow: { bg: '#eab308', glow: '#eab308', border: '#a16207' },
  white: { bg: '#f8fafc', glow: '#ffffff', border: '#cbd5e1' },
};

export const Led: React.FC<LedProps> = ({ color, isLit, onPinMouseDown }) => {
  const current = COLOR_MAP[color] || COLOR_MAP.red;

  return (
    <div className="relative w-12 h-16 flex flex-col items-center select-none cursor-move">
      {/* 5mm LED Epoxy Dome */}
      <div
        className={`w-7 h-7 rounded-t-full rounded-b-sm border-2 transition-all duration-150 relative ${
          isLit ? 'brightness-125' : 'brightness-75 opacity-90'
        }`}
        style={{
          backgroundColor: current.bg,
          borderColor: current.border,
          boxShadow: isLit ? `0 0 20px 4px ${current.glow}` : 'none',
        }}
      >
        {/* Epoxy lens light reflection */}
        <div className="absolute top-1 left-1.5 w-2 h-2 rounded-full bg-white/60 blur-[0.5px]" />
      </div>

      {/* Flat rim / base */}
      <div className="w-8 h-1 bg-zinc-700 rounded-sm -mt-0.5" />

      {/* Leads (Anode + and Cathode -) */}
      <div className="flex justify-between w-5 mt-1">
        {/* Anode (Longer lead, curved) */}
        <div
          title="Anode (+)"
          className="w-1.5 h-6 bg-zinc-300 hover:bg-[#8b5cf6] cursor-crosshair rounded-b-sm flex items-end justify-center shadow"
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
          className="w-1.5 h-5 bg-zinc-400 hover:bg-[#8b5cf6] cursor-crosshair rounded-b-sm flex items-end justify-center shadow"
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
