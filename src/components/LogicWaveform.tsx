import React, { useEffect, useRef, useState } from 'react';
import { Activity, Eye, EyeOff } from 'lucide-react';

export interface WaveformChannel {
  id: string;
  label: string;
  color: string;
  unit: string;
  maxVal: number;
  history: [number, number][]; // [timeMs, value]
  isDigital?: boolean;
}

interface LogicWaveformProps {
  history?: [number, number][]; // Backward compatibility
  channels?: WaveformChannel[];
}

export const LogicWaveform: React.FC<LogicWaveformProps> = ({ history, channels }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Default active channels state
  const [activeChannels, setActiveChannels] = useState<Record<string, boolean>>({
    'ch_pin13': true,
    'ch_pin2': true,
    'ch_pina0': true,
  });

  const toggleChannel = (id: string) => {
    setActiveChannels((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Build normalized channels list
  const channelList: WaveformChannel[] = channels && channels.length > 0 ? channels : [
    {
      id: 'ch_pin13',
      label: 'Pin 13 (LED)',
      color: '#10b981', // Emerald
      unit: 'V',
      maxVal: 5.0,
      history: history || [],
      isDigital: false,
    },
    {
      id: 'ch_pin2',
      label: 'Pin 2 (Button)',
      color: '#f59e0b', // Amber
      unit: 'V',
      maxVal: 5.0,
      history: history || [],
      isDigital: false,
    },
    {
      id: 'ch_pina0',
      label: 'Pin A0 (Pot Wiper)',
      color: '#3b82f6', // Blue
      unit: 'V',
      maxVal: 5.0,
      history: history || [],
      isDigital: false,
    },
  ];

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI scaling
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(300, rect.width);
    const height = Math.max(90, rect.height);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Flat Dark Background
    ctx.fillStyle = '#0c0d10';
    ctx.fillRect(0, 0, width, height);

    // Grid coordinates
    const leftGutter = 44;
    const rightMargin = 16;
    const topMargin = 14;
    const bottomMargin = 20;

    const y0 = height - bottomMargin;
    const y5 = topMargin;
    const yMid = Math.round((y0 + y5) / 2);

    // Draw Subtle Grid Lines
    ctx.strokeStyle = '#222329';
    ctx.lineWidth = 1;

    // Horizontal Voltage lines (0.0V, 2.5V, 5.0V)
    ctx.beginPath();
    ctx.moveTo(leftGutter, y5);
    ctx.lineTo(width - rightMargin, y5);
    ctx.moveTo(leftGutter, yMid);
    ctx.lineTo(width - rightMargin, yMid);
    ctx.moveTo(leftGutter, y0);
    ctx.lineTo(width - rightMargin, y0);
    ctx.stroke();

    // Time Vertical Grid Lines (5 division marks)
    const plotWidth = width - leftGutter - rightMargin;
    const divisions = 5;
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = '#1a1b20';
    ctx.beginPath();
    for (let i = 1; i < divisions; i++) {
      const gx = Math.round(leftGutter + (plotWidth / divisions) * i);
      ctx.moveTo(gx, y5);
      ctx.lineTo(gx, y0);
    }
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Voltage Labels
    ctx.fillStyle = '#71717a';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('5.0V', leftGutter - 6, y5);
    ctx.fillText('2.5V', leftGutter - 6, yMid);
    ctx.fillText('0.0V', leftGutter - 6, y0);

    // Render active channels
    const enabledChannels = channelList.filter((ch) => activeChannels[ch.id] !== false);

    for (const ch of enabledChannels) {
      const hist = ch.history;
      if (hist.length < 2) {
        // Flatline
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(leftGutter, y0);
        ctx.lineTo(width - rightMargin, y0);
        ctx.stroke();
        continue;
      }

      const tEnd = hist[hist.length - 1][0];
      const tStart = Math.max(0, tEnd - 5000); // 5-second sliding window
      const tRange = Math.max(100, tEnd - tStart);

      ctx.strokeStyle = ch.color;
      ctx.lineWidth = 1.8;
      ctx.lineCap = ch.isDigital ? 'square' : 'round';
      ctx.lineJoin = ch.isDigital ? 'miter' : 'round';
      ctx.beginPath();

      let prevY = y0;
      let started = false;

      for (let i = 0; i < hist.length; i++) {
        const [t, v] = hist[i];
        if (t < tStart && i < hist.length - 1 && hist[i + 1][0] < tStart) {
          continue;
        }

        const clampedT = Math.max(tStart, t);
        const x = leftGutter + ((clampedT - tStart) / tRange) * plotWidth;
        const normalizedVal = Math.min(ch.maxVal, Math.max(0.0, v)) / (ch.maxVal || 5.0);
        const y = Math.round(y0 - normalizedVal * (y0 - y5));

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          if (ch.isDigital) {
            // Step waveform
            ctx.lineTo(x, prevY);
            ctx.lineTo(x, y);
          } else {
            // Analog continuous curve
            ctx.lineTo(x, y);
          }
        }
        prevY = y;
      }
      ctx.stroke();
    }

    ctx.restore();
  }, [channelList, activeChannels]);

  return (
    <div className="w-full h-full flex flex-col justify-between p-2 select-none">
      {/* Multi-Channel Selector Bar */}
      <div className="flex items-center justify-between px-1 pb-1.5 text-xs text-zinc-400">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Activity className="w-3.5 h-3.5 text-zinc-400 mr-1" />
          <span className="font-semibold text-zinc-300 mr-1">Signals:</span>
          {channelList.map((ch) => {
            const isActive = activeChannels[ch.id] !== false;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => toggleChannel(ch.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1.5 border transition-all ${
                  isActive
                    ? 'bg-[#18181c] border-zinc-700 text-zinc-200'
                    : 'bg-[#121215] border-transparent text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full transition-opacity"
                  style={{
                    backgroundColor: ch.color,
                    opacity: isActive ? 1 : 0.3,
                  }}
                />
                <span>{ch.label}</span>
                {isActive ? (
                  <Eye className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                ) : (
                  <EyeOff className="w-2.5 h-2.5 opacity-40 ml-0.5" />
                )}
              </button>
            );
          })}
        </div>
        <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
          5.0s Window • 60 FPS
        </span>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 w-full min-h-[90px] rounded border border-zinc-800 overflow-hidden bg-[#0c0d10]"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
    </div>
  );
};
