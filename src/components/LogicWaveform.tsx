import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Activity,
  Eye,
  EyeOff,
  RotateCcw,
  Zap,
  Gauge,
  Cpu,
  Layers,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { CircuitComponent } from '../types';

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
  components?: CircuitComponent[];
  selectedCompId?: string | null;
  onSelectComponent?: (id: string | null) => void;
}

export const LogicWaveform: React.FC<LogicWaveformProps> = ({
  history,
  channels,
  onClear,
  components = [],
  selectedCompId,
  onSelectComponent,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 160 });

  // Default active channels state
  const [activeChannels, setActiveChannels] = useState<Record<string, boolean>>({
    'ch_pin13': true,
    'ch_pin2': true,
    'ch_pina0': true,
  });

  // Local probe selection if parent doesn't provide or for local switching
  const [localTargetId, setLocalTargetId] = useState<string>('mcu');

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
        color: '#38bdf8', // Sky
        unit: 'V',
        maxVal: 5.0,
        history: [],
        isDigital: false,
      },
    ];
  }, [channels, history]);

  // Current real-time circuit readings
  const pin13Ch = channelList.find((c) => c.id === 'ch_pin13');
  const pin2Ch = channelList.find((c) => c.id === 'ch_pin2');
  const pinA0Ch = channelList.find((c) => c.id === 'ch_pina0');

  const vPin13 = pin13Ch?.history.length ? pin13Ch.history[pin13Ch.history.length - 1][1] : 0.0;
  const vPin2 = pin2Ch?.history.length ? pin2Ch.history[pin2Ch.history.length - 1][1] : 5.0;
  const vPinA0 = pinA0Ch?.history.length ? pinA0Ch.history[pinA0Ch.history.length - 1][1] : 0.0;

  // Genuine Real-world Electrical Physics Calculations (No messy mocks!)
  const electricalMetrics = useMemo(() => {
    // 1. Resistor R1 (Typically 220 ohms in series with LED on Pin 13)
    const resistorComp = components.find((c) => c.kind === 'resistor');
    const rOhms = resistorComp?.props?.ohms || 220;
    
    // When Pin 13 is HIGH (5V): LED forward drop Vf ~ 2.0V, so Resistor voltage Vr = 5.0 - 2.0 = 3.0V
    // Current I = Vr / R
    const ledForwardDrop = 2.0;
    const vResistor = vPin13 > ledForwardDrop ? vPin13 - ledForwardDrop : 0.0;
    const iResistorMa = (vResistor / rOhms) * 1000; // in mA
    const pResistorMw = (vResistor * (iResistorMa / 1000)) * 1000; // in mW

    // 2. LED1 (Forward drop ~ 2.0V when forward biased)
    const vLed = Math.min(ledForwardDrop, vPin13);
    const iLedMa = iResistorMa;

    // 3. Potentiometer (Total ~ 10,000 ohms)
    const potComp = components.find((c) => c.kind === 'potentiometer');
    const totalPotOhms = potComp?.props?.value || 10000;
    const wiperRatio = Math.min(1.0, Math.max(0.0, vPinA0 / 5.0));
    const wiperOhms = Math.round(totalPotOhms * wiperRatio);
    const iPotMa = (5.0 / totalPotOhms) * 1000; // ~0.5 mA bias current

    // 4. Pushbutton
    const isButtonPressed = vPin2 < 1.0;
    const iButtonMa = isButtonPressed ? (5.0 / 30000) * 1000 : 0.0; // 30k internal pullup

    return {
      vPin13,
      vPin2,
      vPinA0,
      rOhms,
      vResistor,
      iResistorMa,
      pResistorMw,
      vLed,
      iLedMa,
      totalPotOhms,
      wiperOhms,
      iPotMa,
      isButtonPressed,
      iButtonMa,
    };
  }, [components, vPin13, vPin2, vPinA0]);

  // Selected Target Info
  const activeComp = useMemo(() => {
    const targetId = selectedCompId || localTargetId;
    if (!targetId || targetId === 'mcu') return null;
    return components.find((c) => c.id === targetId) || null;
  }, [components, selectedCompId, localTargetId]);

  // Robust ResizeObserver for Drawer Collapse/Expand
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

  // Main High-DPI Realtime Oscilloscope Canvas
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

    // Deep Dark Canvas Base (#09090b)
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    // Layout margins
    const leftGutter = 42;
    const rightMargin = 16;
    const topMargin = 14;
    const bottomMargin = 20;

    const y0 = height - bottomMargin;
    const y5 = topMargin;
    const yMid = Math.round((y0 + y5) / 2);
    const plotWidth = Math.max(50, width - leftGutter - rightMargin);

    // Subtle 1px Grid Lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#1a1a20';
    ctx.beginPath();
    ctx.moveTo(leftGutter, y5);
    ctx.lineTo(width - rightMargin, y5);
    ctx.moveTo(leftGutter, yMid);
    ctx.lineTo(width - rightMargin, yMid);
    ctx.moveTo(leftGutter, y0);
    ctx.lineTo(width - rightMargin, y0);
    ctx.stroke();

    // Time Vertical Grid Divisions (Dashed Guides)
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

    // Voltage Scale Labels (font-mono tabular-nums)
    ctx.fillStyle = '#71717a';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('5.0V', leftGutter - 6, y5);
    ctx.fillText('2.5V', leftGutter - 6, yMid);
    ctx.fillText('0.0V', leftGutter - 6, y0);

    // Time labels at bottom
    ctx.textAlign = 'center';
    ctx.fillText('-5.0s', leftGutter, height - 7);
    ctx.fillText('-2.5s', leftGutter + plotWidth / 2, height - 7);
    ctx.fillText('NOW', leftGutter + plotWidth, height - 7);

    // Render Enabled Channels
    const enabledChannels = channelList.filter((ch) => activeChannels[ch.id] !== false);

    for (const ch of enabledChannels) {
      const hist = ch.history;
      const latestVal = hist.length > 0 ? hist[hist.length - 1][1] : 0.0;

      if (hist.length < 2) {
        const norm = Math.min(ch.maxVal, Math.max(0.0, latestVal)) / (ch.maxVal || 5.0);
        const y = Math.round(y0 - norm * (y0 - y5));

        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(leftGutter, y);
        ctx.lineTo(width - rightMargin, y);
        ctx.stroke();

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

      // Glowing cursor on the leading edge
      ctx.fillStyle = ch.color;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `${ch.color}35`;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [channelList, activeChannels, dimensions]);

  return (
    <div className="w-full h-full flex flex-col justify-between p-2 select-none gap-2">
      {/* Top Header: Probed Component Selector + Live Metrics Pill Strip */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-1 text-xs">
        {/* Left: Component Probe Selection Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Cpu className="w-3 h-3 text-zinc-400" />
            <span>Probe:</span>
          </span>

          {/* Quick Select Buttons */}
          <button
            type="button"
            onClick={() => {
              setLocalTargetId('mcu');
              onSelectComponent?.(null);
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
              (!selectedCompId || selectedCompId === 'mcu') && localTargetId === 'mcu'
                ? 'bg-white text-zinc-950 border-white shadow-xs font-semibold'
                : 'bg-[#18181b] border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>ATmega328P</span>
          </button>

          {components
            .filter((c) => c.kind !== 'arduino_uno' && c.kind !== 'breadboard' && c.kind !== 'text_label')
            .map((c) => {
              const isSelected = selectedCompId === c.id || localTargetId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setLocalTargetId(c.id);
                    onSelectComponent?.(c.id);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-zinc-950 border-white shadow-xs font-semibold'
                      : 'bg-[#18181b] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="capitalize">{c.kind}</span>
                  <span className="font-mono text-[9px] opacity-70">({c.id})</span>
                </button>
              );
            })}
        </div>

        {/* Right: Live Genuine Electronics Telemetry (V, I, R) */}
        <div className="flex items-center gap-2">
          {/* Voltage Pill */}
          <div className="flex items-center gap-1 bg-[#141416] border border-[#222226] rounded-full px-2.5 py-0.5 text-[11px]">
            <span className="text-zinc-500 text-[10px]">V:</span>
            <span className="font-mono tabular-nums text-emerald-400 font-semibold whitespace-nowrap [word-break:keep-all]">
              {(activeComp?.kind === 'potentiometer'
                ? electricalMetrics.vPinA0
                : activeComp?.kind === 'resistor'
                ? electricalMetrics.vResistor
                : electricalMetrics.vPin13
              ).toFixed(2)}&nbsp;V
            </span>
          </div>

          {/* Current Pill */}
          <div className="flex items-center gap-1 bg-[#141416] border border-[#222226] rounded-full px-2.5 py-0.5 text-[11px]">
            <span className="text-zinc-500 text-[10px]">I:</span>
            <span className="font-mono tabular-nums text-sky-400 font-semibold whitespace-nowrap [word-break:keep-all]">
              {(activeComp?.kind === 'potentiometer'
                ? electricalMetrics.iPotMa
                : activeComp?.kind === 'pushbutton'
                ? electricalMetrics.iButtonMa
                : electricalMetrics.iResistorMa
              ).toFixed(1)}&nbsp;mA
            </span>
          </div>

          {/* Resistance Pill */}
          <div className="flex items-center gap-1 bg-[#141416] border border-[#222226] rounded-full px-2.5 py-0.5 text-[11px]">
            <span className="text-zinc-500 text-[10px]">R:</span>
            <span className="font-mono tabular-nums text-amber-400 font-semibold whitespace-nowrap [word-break:keep-all]">
              {activeComp?.kind === 'potentiometer'
                ? `${electricalMetrics.wiperOhms}\u00A0Ω`
                : `${electricalMetrics.rOhms}\u00A0Ω`}
            </span>
          </div>

          {onClear && (
            <button
              type="button"
              onClick={onClear}
              title="Reset Waveform History"
              className="h-6 px-2 rounded-full bg-[#18181b] hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Realtime Oscilloscope Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 w-full min-h-[90px] rounded-xl border border-[#222226] overflow-hidden bg-[#09090b] relative shadow-inner"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* Bottom Channels Indicator Strip */}
      <div className="flex items-center justify-between px-1 text-[11px] text-zinc-400">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Channels:
          </span>
          {channelList.map((ch) => {
            const isActive = activeChannels[ch.id] !== false;
            const latestVal = ch.history.length > 0 ? ch.history[ch.history.length - 1][1] : 0.0;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => toggleChannel(ch.id)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono flex items-center gap-1.5 border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#18181c] border-zinc-700 text-zinc-200 shadow-xs'
                    : 'bg-transparent border-transparent text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full transition-opacity"
                  style={{
                    backgroundColor: ch.color,
                    opacity: isActive ? 1 : 0.3,
                  }}
                />
                <span className="font-sans">{ch.label}:</span>
                <span className="font-mono font-semibold whitespace-nowrap [word-break:keep-all]" style={{ color: isActive ? ch.color : '#71717a' }}>
                  {latestVal.toFixed(2)}&nbsp;V
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

        <span className="text-[10px] font-mono text-zinc-500 shrink-0 tabular-nums">
          16&nbsp;MHz Core • 60&nbsp;FPS
        </span>
      </div>
    </div>
  );
};
