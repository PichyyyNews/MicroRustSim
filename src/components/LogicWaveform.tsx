import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Activity, Eye, EyeOff, RotateCcw } from 'lucide-react';

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
  onClear?: () => void;
}

export const LogicWaveform: React.FC<LogicWaveformProps> = ({ history, channels, onClear }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 140 });

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
  const channelList: WaveformChannel[] = useMemo(() => {
    if (channels && channels.length > 0) return channels;
    return [
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
        history: [],
        isDigital: false,
      },
      {
        id: 'ch_pina0',
        label: 'Pin A0 (Pot Wiper)',
        color: '#3b82f6', // Blue
        unit: 'V',
        maxVal: 5.0,
        history: [],
        isDigital: false,
      },
    ];
  }, [channels, history]);

  // Robust ResizeObserver: handles drawer collapse, tab switches, and window resizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.floor(width),
            height: Math.floor(height),
          });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Main Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = dimensions;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Deep Dark Oscilloscope Screen Background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    // Layout margins
    const leftGutter = 46;
    const rightMargin = 20;
    const topMargin = 16;
    const bottomMargin = 22;

    const y0 = height - bottomMargin;
    const y5 = topMargin;
    const yMid = Math.round((y0 + y5) / 2);
    const plotWidth = Math.max(50, width - leftGutter - rightMargin);

    // Grid Horizontal Lines (0.0V, 2.5V, 5.0V)
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#1e1e24';
    ctx.beginPath();
    ctx.moveTo(leftGutter, y5);
    ctx.lineTo(width - rightMargin, y5);
    ctx.moveTo(leftGutter, yMid);
    ctx.lineTo(width - rightMargin, yMid);
    ctx.moveTo(leftGutter, y0);
    ctx.lineTo(width - rightMargin, y0);
    ctx.stroke();

    // Time Vertical Grid Divisions (6 segments)
    const divisions = 6;
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = '#18181f';
    ctx.beginPath();
    for (let i = 1; i < divisions; i++) {
      const gx = Math.round(leftGutter + (plotWidth / divisions) * i);
      ctx.moveTo(gx, y5);
      ctx.lineTo(gx, y0);
    }
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Voltage Axis Labels
    ctx.fillStyle = '#71717a';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('5.0V', leftGutter - 6, y5);
    ctx.fillText('2.5V', leftGutter - 6, yMid);
    ctx.fillText('0.0V', leftGutter - 6, y0);

    // Time labels at bottom
    ctx.textAlign = 'center';
    ctx.fillText('-5.0s', leftGutter, height - 8);
    ctx.fillText('-2.5s', leftGutter + plotWidth / 2, height - 8);
    ctx.fillText('NOW', leftGutter + plotWidth, height - 8);

    // Render Enabled Channels
    const enabledChannels = channelList.filter((ch) => activeChannels[ch.id] !== false);

    for (const ch of enabledChannels) {
      const hist = ch.history;
      const latestVal = hist.length > 0 ? hist[hist.length - 1][1] : 0.0;

      if (hist.length < 2) {
        // Flatline at current live voltage
        const norm = Math.min(ch.maxVal, Math.max(0.0, latestVal)) / (ch.maxVal || 5.0);
        const y = Math.round(y0 - norm * (y0 - y5));

        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(leftGutter, y);
        ctx.lineTo(width - rightMargin, y);
        ctx.stroke();

        // Latest value indicator dot
        ctx.fillStyle = ch.color;
        ctx.beginPath();
        ctx.arc(width - rightMargin, y, 3, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      const tEnd = hist[hist.length - 1][0];
      const timeWindow = 5000; // 5.0 seconds
      const tStart = Math.max(0, tEnd - timeWindow);
      const tRange = Math.max(100, tEnd - tStart);

      // 1. Draw Waveform Curve
      ctx.strokeStyle = ch.color;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      let lastX = leftGutter;
      let lastY = y0;
      let started = false;

      for (let i = 0; i < hist.length; i++) {
        const [t, v] = hist[i];
        if (t < tStart && i < hist.length - 1 && hist[i + 1][0] < tStart) {
          continue;
        }

        const clampedT = Math.max(tStart, t);
        const x = leftGutter + ((clampedT - tStart) / tRange) * plotWidth;
        const norm = Math.min(ch.maxVal, Math.max(0.0, v)) / (ch.maxVal || 5.0);
        const y = Math.round(y0 - norm * (y0 - y5));

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
        lastX = x;
        lastY = y;
      }
      ctx.stroke();

      // 2. Draw Live Voltage Indicator on the right edge
      ctx.fillStyle = ch.color;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Glow halo on the active cursor dot
      ctx.fillStyle = `${ch.color}40`;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [channelList, activeChannels, dimensions]);

  return (
    <div className="w-full h-full flex flex-col justify-between p-2 select-none">
      {/* Multi-Channel Selector Bar with Live Voltage Readouts */}
      <div className="flex items-center justify-between px-1 pb-1.5 text-xs text-zinc-400">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Activity className="w-3.5 h-3.5 text-zinc-400 mr-1" />
          <span className="font-semibold text-zinc-300 mr-1 text-[11px]">Channels:</span>
          {channelList.map((ch) => {
            const isActive = activeChannels[ch.id] !== false;
            const latestVal = ch.history.length > 0 ? ch.history[ch.history.length - 1][1] : 0.0;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => toggleChannel(ch.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1.5 border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#18181c] border-zinc-700 text-zinc-200 shadow-xs'
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
                <span className="font-sans font-medium">{ch.label}:</span>
                <span className="font-mono font-semibold" style={{ color: isActive ? ch.color : '#71717a' }}>
                  {latestVal.toFixed(2)}V
                </span>
                {isActive ? (
                  <Eye className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                ) : (
                  <EyeOff className="w-2.5 h-2.5 opacity-40 ml-0.5" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              title="Reset Waveform History"
              className="h-5 px-1.5 rounded bg-[#18181c] hover:bg-[#222226] border border-[#27272a] text-[10px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Clear</span>
            </button>
          )}
          <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
            5.0s Sweep • 60 FPS
          </span>
        </div>
      </div>

      {/* Oscilloscope Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 w-full min-h-[90px] rounded border border-zinc-800 overflow-hidden bg-[#09090b] relative"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
    </div>
  );
};
