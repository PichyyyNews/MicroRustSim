import React from 'react';

interface BreadboardProps {
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

export const Breadboard: React.FC<BreadboardProps> = ({ onPinMouseDown }) => {
  const columns = Array.from({ length: 30 }, (_, i) => i + 1);
  const rowsTop = ['a', 'b', 'c', 'd', 'e'];
  const rowsBottom = ['f', 'g', 'h', 'i', 'j'];

  const X0 = 38;
  const dx = 16;

  const rowY: Record<string, number> = {
    a: 72,
    b: 82,
    c: 92,
    d: 102,
    e: 112,
    f: 134,
    g: 144,
    h: 154,
    i: 164,
    j: 174,
  };

  const labeledCols = [1, 5, 10, 15, 20, 25, 30];

  return (
    <div className="relative select-none filter drop-shadow-xl">
      <svg
        width="540"
        height="240"
        viewBox="0 0 540 240"
        className="overflow-visible"
        style={{ display: 'block' }}
      >
        {/* Solid Injected Plastic Chassis */}
        <rect
          x="0"
          y="0"
          width="540"
          height="240"
          rx="14"
          fill="#f8fafc"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />

        {/* Outer Bevel Shadow */}
        <rect
          x="4"
          y="4"
          width="532"
          height="232"
          rx="10"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="1"
        />

        {/* ----------------- TOP POWER RAILS ----------------- */}
        {/* Red + Power Line */}
        <text x="18" y="19" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ef4444">
          +
        </text>
        <line x1="28" y1="16" x2="512" y2="16" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />

        {/* Top + Pins */}
        {columns.map((col) => {
          const cx = X0 + (col - 1) * dx;
          const pinName = `top_plus_${col}`;
          return (
            <circle
              key={pinName}
              cx={cx}
              cy={26}
              r="2.8"
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="0.75"
              className="cursor-crosshair transition-all hover:fill-white hover:stroke-white filter hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.95)]"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPinMouseDown?.(pinName, e);
              }}
            >
              <title>{`Top + (Col ${col})`}</title>
            </circle>
          );
        })}

        {/* Top - Pins */}
        {columns.map((col) => {
          const cx = X0 + (col - 1) * dx;
          const pinName = `top_minus_${col}`;
          return (
            <circle
              key={pinName}
              cx={cx}
              cy={39}
              r="2.8"
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="0.75"
              className="cursor-crosshair transition-all hover:fill-white hover:stroke-white filter hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.95)]"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPinMouseDown?.(pinName, e);
              }}
            >
              <title>{`Top - (Col ${col})`}</title>
            </circle>
          );
        })}

        {/* Blue - Power Line */}
        <line x1="28" y1="49" x2="512" y2="49" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
        <text x="18" y="52" textAnchor="middle" fontSize="13" fontWeight="700" fill="#3b82f6">
          -
        </text>

        {/* ----------------- TOP TERMINAL STRIP (Rows a - e) ----------------- */}
        {/* Top Column Numbers */}
        {labeledCols.map((col) => (
          <text
            key={`top_lbl_${col}`}
            x={X0 + (col - 1) * dx}
            y={62}
            textAnchor="middle"
            fontSize="8"
            fontFamily="monospace"
            fill="#94a3b8"
          >
            {col}
          </text>
        ))}

        {/* Rows a to e */}
        {rowsTop.map((row) => {
          const y = rowY[row];
          return (
            <g key={`row_group_${row}`}>
              {/* Left & Right Row Labels */}
              <text x="20" y={y + 3} textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#94a3b8">
                {row}
              </text>
              <text x="520" y={y + 3} textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#94a3b8">
                {row}
              </text>

              {/* Pin Sockets (30 columns) */}
              {columns.map((col) => {
                const cx = X0 + (col - 1) * dx;
                const pinName = `${row}_${col}`;
                return (
                  <rect
                    key={pinName}
                    x={cx - 2.6}
                    y={y - 2.6}
                    width="5.2"
                    height="5.2"
                    rx="1"
                    fill="#1e293b"
                    stroke="#475569"
                    strokeWidth="0.75"
                    className="cursor-crosshair transition-all hover:fill-white hover:stroke-white filter hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.95)]"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onPinMouseDown?.(pinName, e);
                    }}
                  >
                    <title>{`${row}${col}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}

        {/* Central DIP Divider Trough */}
        <rect x="24" y="119" width="492" height="7.5" rx="2" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.5" />
        <text
          x="270"
          y="125"
          textAnchor="middle"
          fontSize="6.5"
          fontWeight="700"
          fill="#94a3b8"
          letterSpacing="2"
        >
          MICRORUSTSIM
        </text>

        {/* ----------------- BOTTOM TERMINAL STRIP (Rows f - j) ----------------- */}
        {rowsBottom.map((row) => {
          const y = rowY[row];
          return (
            <g key={`row_group_${row}`}>
              {/* Left & Right Row Labels */}
              <text x="20" y={y + 3} textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#94a3b8">
                {row}
              </text>
              <text x="520" y={y + 3} textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#94a3b8">
                {row}
              </text>

              {/* Pin Sockets (30 columns) */}
              {columns.map((col) => {
                const cx = X0 + (col - 1) * dx;
                const pinName = `${row}_${col}`;
                return (
                  <rect
                    key={pinName}
                    x={cx - 2.6}
                    y={y - 2.6}
                    width="5.2"
                    height="5.2"
                    rx="1"
                    fill="#1e293b"
                    stroke="#475569"
                    strokeWidth="0.75"
                    className="cursor-crosshair transition-all hover:fill-white hover:stroke-white filter hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.95)]"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onPinMouseDown?.(pinName, e);
                    }}
                  >
                    <title>{`${row}${col}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}

        {/* Bottom Column Numbers */}
        {labeledCols.map((col) => (
          <text
            key={`bot_lbl_${col}`}
            x={X0 + (col - 1) * dx}
            y={188}
            textAnchor="middle"
            fontSize="8"
            fontFamily="monospace"
            fill="#94a3b8"
          >
            {col}
          </text>
        ))}

        {/* ----------------- BOTTOM POWER RAILS ----------------- */}
        {/* Bottom + Pins */}
        {columns.map((col) => {
          const cx = X0 + (col - 1) * dx;
          const pinName = `bot_plus_${col}`;
          return (
            <circle
              key={pinName}
              cx={cx}
              cy={201}
              r="2.8"
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="0.75"
              className="cursor-crosshair transition-all hover:fill-white hover:stroke-white filter hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.95)]"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPinMouseDown?.(pinName, e);
              }}
            >
              <title>{`Bottom + (Col ${col})`}</title>
            </circle>
          );
        })}

        {/* Red + Power Line */}
        <line x1="28" y1="210" x2="512" y2="210" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
        <text x="18" y="213" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ef4444">
          +
        </text>

        {/* Bottom - Pins */}
        {columns.map((col) => {
          const cx = X0 + (col - 1) * dx;
          const pinName = `bot_minus_${col}`;
          return (
            <circle
              key={pinName}
              cx={cx}
              cy={223}
              r="2.8"
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="0.75"
              className="cursor-crosshair transition-all hover:fill-white hover:stroke-white filter hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.95)]"
              onMouseDown={(e) => {
                e.stopPropagation();
                onPinMouseDown?.(pinName, e);
              }}
            >
              <title>{`Bottom - (Col ${col})`}</title>
            </circle>
          );
        })}

        {/* Blue - Power Line */}
        <line x1="28" y1="231" x2="512" y2="231" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
        <text x="18" y="234" textAnchor="middle" fontSize="13" fontWeight="700" fill="#3b82f6">
          -
        </text>
      </svg>
    </div>
  );
};
