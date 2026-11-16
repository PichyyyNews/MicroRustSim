import React from 'react';

interface BreadboardProps {
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const Breadboard: React.FC<BreadboardProps> = ({ onPinMouseDown }) => {
  const columns = Array.from({ length: 30 }, (_, i) => i + 1);
  const rowsTop = ['a', 'b', 'c', 'd', 'e'];
  const rowsBottom = ['f', 'g', 'h', 'i', 'j'];

  // Proportional 13px x 13px square grid (aligned with standard 0.1" pitch)
  const X0 = 31;
  const dx = 13;

  const rowY: Record<string, number> = {
    a: 60,
    b: 73,
    c: 86,
    d: 99,
    e: 112,
    f: 130,
    g: 143,
    h: 156,
    i: 169,
    j: 182,
  };

  const labeledCols = [1, 5, 10, 15, 20, 25, 30];

  return (
    <div className="relative select-none filter drop-shadow-xl">
      <svg
        width="440"
        height="226"
        viewBox="0 0 440 226"
        className="overflow-visible"
        style={{ display: 'block' }}
      >
        {/* Solid Injected Plastic Chassis */}
        <rect
          x="0"
          y="0"
          width="440"
          height="226"
          rx="12"
          fill="#f8fafc"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />

        {/* Outer Bevel Shadow */}
        <rect
          x="3"
          y="3"
          width="434"
          height="220"
          rx="9"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="1"
        />

        {/* ----------------- TOP POWER RAILS ----------------- */}
        {/* Red + Power Line */}
        <text x="14" y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ef4444">
          +
        </text>
        <line x1="22" y1="20" x2="418" y2="20" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />

        {/* Top + Pins */}
        {columns.map((col) => {
          const cx = X0 + (col - 1) * dx;
          const pinName = `top_plus_${col}`;
          return (
            <g key={pinName}>
              <circle
                cx={cx}
                cy={20}
                r="2.5"
                fill="#1e293b"
                stroke="#64748b"
                strokeWidth="0.75"
                className="transition-colors group-hover:fill-white"
              />
              {/* Invisible generous 13px hit target */}
              <circle
                cx={cx}
                cy={20}
                r="6.5"
                fill="transparent"
                className="cursor-crosshair hover:stroke-white/70 hover:stroke-1 transition-all"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onPinMouseDown?.(pinName, e);
                }}
              >
                <title>{`Top + (Col ${col})`}</title>
              </circle>
            </g>
          );
        })}

        {/* Top - Pins */}
        <text x="14" y="37" textAnchor="middle" fontSize="13" fontWeight="700" fill="#3b82f6">
          -
        </text>
        <line x1="22" y1="33" x2="418" y2="33" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
        {columns.map((col) => {
          const cx = X0 + (col - 1) * dx;
          const pinName = `top_minus_${col}`;
          return (
            <g key={pinName}>
              <circle
                cx={cx}
                cy={33}
                r="2.5"
                fill="#1e293b"
                stroke="#64748b"
                strokeWidth="0.75"
              />
              <circle
                cx={cx}
                cy={33}
                r="6.5"
                fill="transparent"
                className="cursor-crosshair hover:stroke-white/70 hover:stroke-1 transition-all"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onPinMouseDown?.(pinName, e);
                }}
              >
                <title>{`Top - (Col ${col})`}</title>
              </circle>
            </g>
          );
        })}

        {/* Separator Groove */}
        <line x1="16" y1="46" x2="424" y2="46" stroke="#e2e8f0" strokeWidth="1" />

        {/* ----------------- COLUMN LABELS (Top) ----------------- */}
        {labeledCols.map((col) => {
          const cx = X0 + (col - 1) * dx;
          return (
            <text
              key={`top-lbl-${col}`}
              x={cx}
              y={53}
              textAnchor="middle"
              fontSize="7.5"
              fill="#64748b"
              fontWeight="600"
              fontFamily="monospace"
            >
              {col}
            </text>
          );
        })}

        {/* ----------------- UPPER TERMINAL ROWS (a-e) ----------------- */}
        {rowsTop.map((row) => (
          <g key={`row-${row}`}>
            {/* Left Row Label */}
            <text
              x="16"
              y={rowY[row] + 2.5}
              textAnchor="middle"
              fontSize="8.5"
              fill="#64748b"
              fontWeight="700"
              fontFamily="monospace"
            >
              {row}
            </text>

            {/* Right Row Label */}
            <text
              x="424"
              y={rowY[row] + 2.5}
              textAnchor="middle"
              fontSize="8.5"
              fill="#64748b"
              fontWeight="700"
              fontFamily="monospace"
            >
              {row}
            </text>

            {/* 30 Pin Sockets */}
            {columns.map((col) => {
              const cx = X0 + (col - 1) * dx;
              const cy = rowY[row];
              const pinName = `${row}_${col}`;
              return (
                <g key={pinName}>
                  <rect
                    x={cx - 2.5}
                    y={cy - 2.5}
                    width="5"
                    height="5"
                    rx="1"
                    fill="#0f172a"
                    stroke="#475569"
                    strokeWidth="0.6"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r="6.5"
                    fill="transparent"
                    className="cursor-crosshair hover:stroke-white/70 hover:stroke-1 transition-all"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onPinMouseDown?.(pinName, e);
                    }}
                  >
                    <title>{`Row ${row.toUpperCase()} Col ${col}`}</title>
                  </circle>
                </g>
              );
            })}
          </g>
        ))}

        {/* ----------------- CENTER IC TROUGH DIVIDER ----------------- */}
        <rect x="14" y="119" width="412" height="4" fill="#e2e8f0" rx="1.5" />
        <rect x="16" y="120" width="408" height="2" fill="#cbd5e1" rx="1" />

        {/* ----------------- LOWER TERMINAL ROWS (f-j) ----------------- */}
        {rowsBottom.map((row) => (
          <g key={`row-${row}`}>
            {/* Left Row Label */}
            <text
              x="16"
              y={rowY[row] + 2.5}
              textAnchor="middle"
              fontSize="8.5"
              fill="#64748b"
              fontWeight="700"
              fontFamily="monospace"
            >
              {row}
            </text>

            {/* Right Row Label */}
            <text
              x="424"
              y={rowY[row] + 2.5}
              textAnchor="middle"
              fontSize="8.5"
              fill="#64748b"
              fontWeight="700"
              fontFamily="monospace"
            >
              {row}
            </text>

            {/* 30 Pin Sockets */}
            {columns.map((col) => {
              const cx = X0 + (col - 1) * dx;
              const cy = rowY[row];
              const pinName = `${row}_${col}`;
              return (
                <g key={pinName}>
                  <rect
                    x={cx - 2.5}
                    y={cy - 2.5}
                    width="5"
                    height="5"
                    rx="1"
                    fill="#0f172a"
                    stroke="#475569"
                    strokeWidth="0.6"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r="6.5"
                    fill="transparent"
                    className="cursor-crosshair hover:stroke-white/70 hover:stroke-1 transition-all"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onPinMouseDown?.(pinName, e);
                    }}
                  >
                    <title>{`Row ${row.toUpperCase()} Col ${col}`}</title>
                  </circle>
                </g>
              );
            })}
          </g>
        ))}

        {/* ----------------- COLUMN LABELS (Bottom) ----------------- */}
        {labeledCols.map((col) => {
          const cx = X0 + (col - 1) * dx;
          return (
            <text
              key={`bot-lbl-${col}`}
              x={cx}
              y={190}
              textAnchor="middle"
              fontSize="7.5"
              fill="#64748b"
              fontWeight="600"
              fontFamily="monospace"
            >
              {col}
            </text>
          );
        })}

        {/* Separator Groove */}
        <line x1="16" y1="193" x2="424" y2="193" stroke="#e2e8f0" strokeWidth="1" />

        {/* ----------------- BOTTOM POWER RAILS ----------------- */}
        {/* Red + Power Line */}
        <text x="14" y="200" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ef4444">
          +
        </text>
        <line x1="22" y1="196" x2="418" y2="196" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
        {columns.map((col) => {
          const cx = X0 + (col - 1) * dx;
          const pinName = `bot_plus_${col}`;
          return (
            <g key={pinName}>
              <circle
                cx={cx}
                cy={196}
                r="2.5"
                fill="#1e293b"
                stroke="#64748b"
                strokeWidth="0.75"
              />
              <circle
                cx={cx}
                cy={196}
                r="6.5"
                fill="transparent"
                className="cursor-crosshair hover:stroke-white/70 hover:stroke-1 transition-all"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onPinMouseDown?.(pinName, e);
                }}
              >
                <title>{`Bottom + (Col ${col})`}</title>
              </circle>
            </g>
          );
        })}

        {/* Blue - Power Line */}
        <text x="14" y="213" textAnchor="middle" fontSize="13" fontWeight="700" fill="#3b82f6">
          -
        </text>
        <line x1="22" y1="209" x2="418" y2="209" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
        {columns.map((col) => {
          const cx = X0 + (col - 1) * dx;
          const pinName = `bot_minus_${col}`;
          return (
            <g key={pinName}>
              <circle
                cx={cx}
                cy={209}
                r="2.5"
                fill="#1e293b"
                stroke="#64748b"
                strokeWidth="0.75"
              />
              <circle
                cx={cx}
                cy={209}
                r="6.5"
                fill="transparent"
                className="cursor-crosshair hover:stroke-white/70 hover:stroke-1 transition-all"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onPinMouseDown?.(pinName, e);
                }}
              >
                <title>{`Bottom - (Col ${col})`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
