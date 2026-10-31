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
  Split,
  Play,
  Pause,
  ChevronDown,
  Search,
  Check,
  Radio,
  SlidersHorizontal,
  Lightbulb,
  ToggleLeft,
  Plus,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { CircuitComponent, ComponentKind } from '../types';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from './ui/chart';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

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
  onOpenChannelConfig?: () => void;
}

type ViewMode = 'tracks' | 'overlay';
type TimebaseMs = 500 | 1000 | 2000 | 5000 | 10000;

export const LogicWaveform: React.FC<LogicWaveformProps> = ({
  history,
  channels,
  onClear,
  components = [],
  selectedCompId,
  onSelectComponent,
  onOpenChannelConfig,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 160 });

  // Probe Picker Popover State
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Waveform View & Resolution State
  const [viewMode, setViewMode] = useState<ViewMode>('tracks');
  const [timebaseMs, setTimebaseMs] = useState<TimebaseMs>(2000);
  const [isPaused, setIsPaused] = useState(false);

  // Active Channels state
  const [activeChannels, setActiveChannels] = useState<Record<string, boolean>>({
    ch_pin13: true,
    ch_pin2: true,
    ch_pina0: true,
  });

  // Local probe selection if parent doesn't provide
  const [localTargetId, setLocalTargetId] = useState<string>('mcu');

  // Close picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    if (isPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPickerOpen]);

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

  // Genuine Real-world Electrical Physics Calculations
  const electricalMetrics = useMemo(() => {
    const resistorComp = components.find((c) => c.kind === 'resistor');
    const rOhms = resistorComp?.props?.ohms || 220;

    const ledForwardDrop = 2.0;
    const vResistor = vPin13 > ledForwardDrop ? vPin13 - ledForwardDrop : 0.0;
    const iResistorMa = (vResistor / rOhms) * 1000;

    const vLed = Math.min(ledForwardDrop, vPin13);
    const iLedMa = iResistorMa;

    const totalPotOhms = 10000;
    const potRatio = Math.max(0.0, Math.min(1.0, vPinA0 / 5.0));
    const wiperOhms = Math.round(totalPotOhms * potRatio);
    const iPotMa = (5.0 / totalPotOhms) * 1000;

    const isButtonPressed = vPin2 < 1.0;
    const internalPullupOhms = 30000;
    const iButtonMa = isButtonPressed ? (5.0 / internalPullupOhms) * 1000 : 0.0;

    return {
      vPin13,
      vResistor,
      iResistorMa,
      rOhms,
      vLed,
      iLedMa,
      vPinA0,
      wiperOhms,
      iPotMa,
      vPin2,
      isButtonPressed,
      iButtonMa,
    };
  }, [components, vPin13, vPin2, vPinA0]);

  // Currently probed component object
  const activeCompId = selectedCompId || localTargetId;
  const activeComp = useMemo(() => {
    if (!activeCompId || activeCompId === 'mcu') return null;
    return components.find((c) => c.id === activeCompId) || null;
  }, [components, activeCompId]);

  // Categorized component lists for clean dropdown selection
  const categorizedComponents = useMemo(() => {
    const valid = components.filter(
      (c) => c.kind !== 'arduino_uno' && c.kind !== 'breadboard' && c.kind !== 'text_label'
    );
    const filtered = valid.filter((c) => {
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return c.id.toLowerCase().includes(q) || c.kind.toLowerCase().includes(q);
    });

    return {
      inputs: filtered.filter((c) => c.kind === 'pushbutton' || c.kind === 'potentiometer'),
      outputs: filtered.filter((c) => c.kind === 'led'),
      passives: filtered.filter((c) => c.kind === 'resistor'),
    };
  }, [components, searchFilter]);

  // Keep canvas sized with devicePixelRatio
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      });
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 60 FPS Real-time High-DPI Multi-lane Canvas Rendering
  useEffect(() => {
    if (isPaused) return; // Do not draw canvas when in Pause & Inspect mode
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = dimensions.width;
    const h = dimensions.height;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Deep Dark Surface background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, w, h);

    const leftGutter = 54;
    const rightGutter = 44;
    const topGutter = 10;
    const bottomGutter = 18;
    const plotWidth = Math.max(10, w - leftGutter - rightGutter);
    const plotHeight = Math.max(10, h - topGutter - bottomGutter);

    // Dynamic Time window based on timebaseMs
    const tRange = timebaseMs;
    let maxT = 0;
    for (const ch of channelList) {
      if (ch.history.length > 0) {
        maxT = Math.max(maxT, ch.history[ch.history.length - 1][0]);
      }
    }
    const tEnd = Math.max(tRange, maxT);
    const tStart = tEnd - tRange;

    // Filter visible channels
    const visibleChannels = channelList.filter((ch) => activeChannels[ch.id] !== false);

    if (viewMode === 'tracks') {
      // ==========================================
      // MULTI-LANE TRACKS MODE (Saleae / Logic Analyzer)
      // ==========================================
      const laneCount = Math.max(1, visibleChannels.length);
      const laneHeight = plotHeight / laneCount;

      // Draw Time Grid Lines across all tracks
      ctx.strokeStyle = '#18181c';
      ctx.lineWidth = 1;
      const numTimeDivs = 4;
      for (let i = 0; i <= numTimeDivs; i++) {
        const x = Math.round(leftGutter + (i / numTimeDivs) * plotWidth);
        ctx.beginPath();
        ctx.moveTo(x, topGutter);
        ctx.lineTo(x, topGutter + plotHeight);
        ctx.stroke();

        // Time division text at the bottom
        if (i < numTimeDivs) {
          const dtSec = ((tRange - (i / numTimeDivs) * tRange) / 1000).toFixed(1);
          ctx.fillStyle = '#52525b';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`-${dtSec}s`, x, h - 5);
        }
      }

      // "NOW" label on right edge
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('NOW', w - 8, h - 5);

      // Render each channel into its dedicated track lane
      visibleChannels.forEach((ch, idx) => {
        const laneTop = topGutter + idx * laneHeight;
        const laneBottom = laneTop + laneHeight;
        const innerTop = laneTop + 12;
        const innerBottom = laneBottom - 8;
        const innerHeight = Math.max(1, innerBottom - innerTop);

        // Track lane divider
        if (idx > 0) {
          ctx.strokeStyle = '#222226';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(leftGutter, Math.round(laneTop));
          ctx.lineTo(w - rightGutter, Math.round(laneTop));
          ctx.stroke();
        }

        // Dashed baseline 0V
        ctx.save();
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = '#1e1e24';
        ctx.beginPath();
        ctx.moveTo(leftGutter, Math.round(innerBottom));
        ctx.lineTo(w - rightGutter, Math.round(innerBottom));
        ctx.stroke();
        ctx.restore();

        // Track Header Pill on left gutter
        const latestVal = ch.history.length > 0 ? ch.history[ch.history.length - 1][1] : 0.0;
        ctx.fillStyle = ch.color;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(ch.label.split(' ')[0], leftGutter - 8, Math.round(laneTop + 14));
        ctx.fillStyle = '#71717a';
        ctx.font = '8px monospace';
        ctx.fillText(`${latestVal.toFixed(1)}V`, leftGutter - 8, Math.round(laneTop + 24));

        // Waveform Trace
        const hist = ch.history;
        if (hist.length > 0) {
          ctx.strokeStyle = ch.color;
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();

          let lastX = leftGutter;
          let lastY = innerBottom;
          let started = false;

          for (let i = 0; i < hist.length; i++) {
            const [t, v] = hist[i];
            if (t < tStart && i < hist.length - 1 && hist[i + 1][0] < tStart) {
              continue;
            }

            const clampedT = Math.max(tStart, t);
            const x = leftGutter + ((clampedT - tStart) / tRange) * plotWidth;
            const norm = Math.min(ch.maxVal, Math.max(0.0, v)) / (ch.maxVal || 5.0);
            const y = Math.round(innerBottom - norm * innerHeight);

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
      });
    } else {
      // ==========================================
      // COMBINED OVERLAY MODE
      // ==========================================
      const y0 = Math.round(topGutter + plotHeight);
      const y5 = Math.round(topGutter);
      const y25 = Math.round(topGutter + plotHeight * 0.5);

      // Grid horizontal lines
      ctx.strokeStyle = '#18181c';
      ctx.lineWidth = 1;
      [y5, y25, y0].forEach((y) => {
        ctx.beginPath();
        ctx.moveTo(leftGutter, y);
        ctx.lineTo(w - rightGutter, y);
        ctx.stroke();
      });

      // Time division vertical lines
      const numTimeDivs = 4;
      for (let i = 0; i <= numTimeDivs; i++) {
        const x = Math.round(leftGutter + (i / numTimeDivs) * plotWidth);
        ctx.beginPath();
        ctx.moveTo(x, topGutter);
        ctx.lineTo(x, y0);
        ctx.stroke();

        if (i < numTimeDivs) {
          const dtSec = ((tRange - (i / numTimeDivs) * tRange) / 1000).toFixed(1);
          ctx.fillStyle = '#52525b';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`-${dtSec}s`, x, h - 5);
        }
      }

      // Voltage labels
      ctx.fillStyle = '#71717a';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('5.0V', leftGutter - 8, y5 + 4);
      ctx.fillText('2.5V', leftGutter - 8, y25 + 3);
      ctx.fillText('0.0V', leftGutter - 8, y0 + 3);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('NOW', w - 8, h - 5);

      // Render traces
      for (const ch of visibleChannels) {
        const hist = ch.history;
        if (!hist || hist.length === 0) continue;

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

        // Glowing cursor
        ctx.fillStyle = ch.color;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `${ch.color}35`;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }, [channelList, activeChannels, dimensions, viewMode, timebaseMs, isPaused]);

  // Transform historical data for Shadcn Recharts (Pause & Inspect Mode)
  const inspectData = useMemo(() => {
    if (!isPaused) return [];
    const tRange = timebaseMs;
    let maxT = 0;
    for (const ch of channelList) {
      if (ch.history.length > 0) {
        maxT = Math.max(maxT, ch.history[ch.history.length - 1][0]);
      }
    }
    const tStart = Math.max(0, maxT - tRange);

    // Collect timestamps and map values
    const primaryCh = channelList[0];
    if (!primaryCh || primaryCh.history.length === 0) return [];

    const sampled = primaryCh.history.filter(([t]) => t >= tStart);
    // Decimate to max 60 points for high performance rendering
    const step = Math.max(1, Math.floor(sampled.length / 50));

    return sampled
      .filter((_, idx) => idx % step === 0)
      .map(([t, v]) => {
        const row: Record<string, any> = {
          timeMs: t,
          timeLabel: `${((t - maxT) / 1000).toFixed(2)}s`,
          [primaryCh.id]: Number(v.toFixed(2)),
        };
        for (let i = 1; i < channelList.length; i++) {
          const ch = channelList[i];
          const closest = ch.history.reduce((prev, curr) =>
            Math.abs(curr[0] - t) < Math.abs(prev[0] - t) ? curr : prev,
            [t, 0]
          );
          row[ch.id] = Number(closest[1].toFixed(2));
        }
        return row;
      });
  }, [channelList, isPaused, timebaseMs]);

  // Shadcn Chart configuration
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    channelList.forEach((ch) => {
      config[ch.id] = {
        label: ch.label,
        color: ch.color,
      };
    });
    return config;
  }, [channelList]);

  // Probed component display label
  const activeLabel = useMemo(() => {
    if (!activeCompId || activeCompId === 'mcu') return 'ATmega328P';
    if (!activeComp) return activeCompId;
    return `${activeComp.kind.toUpperCase()} (${activeComp.id})`;
  }, [activeCompId, activeComp]);

  return (
    <div className="w-full h-full flex flex-col justify-between p-2 select-none gap-2">
      {/* Top Header: Organized Toolbar & Dropdown Probe Picker */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-1 text-xs">
        {/* Left: Compact Component Dropdown Picker + Mode Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1 mr-0.5">
            <Cpu className="w-3 h-3 text-zinc-400" />
            <span>Probe:</span>
          </span>

          {/* Component Dropdown Trigger */}
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setIsPickerOpen((prev) => !prev)}
              className="h-6 px-2.5 rounded-full bg-[#18181b] hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Click to select probed component"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="font-semibold text-white truncate max-w-[140px]">{activeLabel}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
            </button>

            {/* Popover Menu with Categories & Search */}
            {isPickerOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 w-68 bg-[#141416] border border-[#27272a] rounded-xl shadow-2xl p-2 z-50 space-y-2 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* Search Filter Input */}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-[#1c1c20] rounded-lg border border-[#27272a]">
                  <Search className="w-3 h-3 text-zinc-500 shrink-0" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search component..."
                    className="w-full bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600 font-sans"
                    autoFocus
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1 pr-1 text-xs">
                  {/* Category: Microcontroller */}
                  <div className="pt-0.5 pb-1">
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-500 px-2">
                      Microcontroller
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setLocalTargetId('mcu');
                        onSelectComponent?.(null);
                        setIsPickerOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer mt-0.5 ${
                        (!selectedCompId || selectedCompId === 'mcu') && localTargetId === 'mcu'
                          ? 'bg-zinc-800 text-white font-medium'
                          : 'text-zinc-300 hover:bg-[#1c1c20]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>ATmega328P</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] py-0 h-4 border-zinc-700">
                        16&nbsp;MHz
                      </Badge>
                    </button>
                  </div>

                  {/* Category: Inputs */}
                  {categorizedComponents.inputs.length > 0 && (
                    <div className="pt-1 border-t border-[#222226]">
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-500 px-2">
                        Inputs & Switches
                      </span>
                      {categorizedComponents.inputs.map((c) => {
                        const isSelected = selectedCompId === c.id || localTargetId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setLocalTargetId(c.id);
                              onSelectComponent?.(c.id);
                              setIsPickerOpen(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer mt-0.5 ${
                              isSelected
                                ? 'bg-zinc-800 text-white font-medium'
                                : 'text-zinc-300 hover:bg-[#1c1c20]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <ToggleLeft className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="capitalize">{c.kind}</span>
                              <span className="font-mono text-[10px] text-zinc-500">({c.id})</span>
                            </div>
                            {isSelected && <Check className="w-3 h-3 text-emerald-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Category: Outputs */}
                  {categorizedComponents.outputs.length > 0 && (
                    <div className="pt-1 border-t border-[#222226]">
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-500 px-2">
                        Outputs & Actuators
                      </span>
                      {categorizedComponents.outputs.map((c) => {
                        const isSelected = selectedCompId === c.id || localTargetId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setLocalTargetId(c.id);
                              onSelectComponent?.(c.id);
                              setIsPickerOpen(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer mt-0.5 ${
                              isSelected
                                ? 'bg-zinc-800 text-white font-medium'
                                : 'text-zinc-300 hover:bg-[#1c1c20]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Lightbulb className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="capitalize">{c.kind}</span>
                              <span className="font-mono text-[10px] text-zinc-500">({c.id})</span>
                            </div>
                            {isSelected && <Check className="w-3 h-3 text-emerald-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Category: Passives */}
                  {categorizedComponents.passives.length > 0 && (
                    <div className="pt-1 border-t border-[#222226]">
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-500 px-2">
                        Passive Components
                      </span>
                      {categorizedComponents.passives.map((c) => {
                        const isSelected = selectedCompId === c.id || localTargetId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setLocalTargetId(c.id);
                              onSelectComponent?.(c.id);
                              setIsPickerOpen(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer mt-0.5 ${
                              isSelected
                                ? 'bg-zinc-800 text-white font-medium'
                                : 'text-zinc-300 hover:bg-[#1c1c20]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Zap className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span className="capitalize">{c.kind}</span>
                              <span className="font-mono text-[10px] text-zinc-500">({c.id})</span>
                            </div>
                            <Badge variant="outline" className="text-[9px] py-0 h-4 border-zinc-700">
                              {c.props?.ohms || 220}&nbsp;Ω
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Popover Footer: Open Channels Config Modal */}
                {onOpenChannelConfig && (
                  <div className="pt-2 border-t border-[#222226]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPickerOpen(false);
                        onOpenChannelConfig();
                      }}
                      className="w-full h-7 rounded-lg bg-[#1c1c20] hover:bg-zinc-800 text-zinc-300 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-zinc-800"
                    >
                      <SlidersHorizontal className="w-3 h-3 text-emerald-400" />
                      <span>Configure Channels Modal</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="w-px h-4 bg-[#27272a] mx-0.5" />

          {/* View Mode Toggle: Tracks vs Overlay */}
          <div className="flex items-center bg-[#141416] border border-[#27272a] rounded-full p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('tracks')}
              title="Split Tracks (Multi-lane Logic Analyzer view)"
              className={`h-5 px-2 rounded-full text-[10px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'tracks'
                  ? 'bg-zinc-200 text-zinc-950 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Split className="w-2.5 h-2.5" />
              <span>Tracks</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('overlay')}
              title="Combined Overlay view"
              className={`h-5 px-2 rounded-full text-[10px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'overlay'
                  ? 'bg-zinc-200 text-zinc-950 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers className="w-2.5 h-2.5" />
              <span>Overlay</span>
            </button>
          </div>

          {/* Timebase Zoom Selector */}
          <div className="flex items-center bg-[#141416] border border-[#27272a] rounded-full p-0.5">
            {([500, 1000, 2000, 5000] as TimebaseMs[]).map((tb) => (
              <button
                key={tb}
                type="button"
                onClick={() => setTimebaseMs(tb)}
                title={`Set waveform timebase window to ${tb >= 1000 ? `${tb / 1000}s` : `${tb}ms`}`}
                className={`h-5 px-1.5 rounded-full text-[10px] font-mono transition-all cursor-pointer ${
                  timebaseMs === tb
                    ? 'bg-zinc-700 text-white font-semibold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tb >= 1000 ? `${tb / 1000}s` : `${tb}ms`}
              </button>
            ))}
          </div>

          {/* Pause / Inspect Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            title={isPaused ? 'Resume Real-time 60 FPS' : 'Pause & Inspect with Shadcn Chart'}
            className={`h-6 px-2 rounded-full border text-[10px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
              isPaused
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                : 'bg-[#18181b] hover:bg-zinc-800 border-zinc-700/80 text-zinc-300 hover:text-white'
            }`}
          >
            {isPaused ? <Play className="w-2.5 h-2.5 text-amber-400" /> : <Pause className="w-2.5 h-2.5" />}
            <span>{isPaused ? 'Resume' : 'Inspect'}</span>
          </button>
        </div>

        {/* Right: Live Genuine Electrical Telemetry Pills (V, I, R) */}
        <div className="flex items-center gap-1.5">
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

      {/* Main Realtime Display Area: Canvas OR Shadcn Chart (Inspect Mode) */}
      <div
        ref={containerRef}
        className="flex-1 w-full min-h-[90px] rounded-xl border border-[#222226] overflow-hidden bg-[#09090b] relative shadow-inner"
      >
        {isPaused ? (
          // ==========================================
          // SHADCN CHART INSPECTOR (Recharts)
          // ==========================================
          <div className="w-full h-full p-2 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 px-2 pb-1">
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Frozen Waveform Inspector • Hover any point to inspect exact voltage & timestamp</span>
              </span>
              <span className="font-mono text-zinc-500">Shadcn / Recharts</span>
            </div>

            <div className="flex-1 w-full min-h-[80px]">
              <ChartContainer config={chartConfig} className="h-full aspect-auto w-full">
                <LineChart data={inspectData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c1c20" />
                  <XAxis
                    dataKey="timeLabel"
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                    tick={{ fill: '#71717a', fontSize: 10 }}
                  />
                  <YAxis
                    domain={[0, 5]}
                    ticks={[0, 2.5, 5]}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                    tick={{ fill: '#71717a', fontSize: 10 }}
                    unit="V"
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(val) => `Δt: ${val}`}
                        indicator="line"
                      />
                    }
                  />
                  {channelList
                    .filter((ch) => activeChannels[ch.id] !== false)
                    .map((ch) => (
                      <Line
                        key={ch.id}
                        type="monotone"
                        dataKey={ch.id}
                        name={ch.label}
                        stroke={ch.color}
                        strokeWidth={1.8}
                        dot={false}
                        activeDot={{ r: 4, stroke: '#fff', strokeWidth: 1 }}
                        isAnimationActive={false}
                      />
                    ))}
                </LineChart>
              </ChartContainer>
            </div>
          </div>
        ) : (
          // ==========================================
          // 60 FPS REAL-TIME CANVAS
          // ==========================================
          <canvas ref={canvasRef} className="block w-full h-full" />
        )}
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
                <span
                  className="font-mono font-semibold whitespace-nowrap [word-break:keep-all]"
                  style={{ color: isActive ? ch.color : '#71717a' }}
                >
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

          {/* Add / Configure Channels Button */}
          {onOpenChannelConfig && (
            <button
              type="button"
              onClick={onOpenChannelConfig}
              title="Add or configure channels for circuit components (e.g. multiple LEDs)"
              className="px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-dashed border-zinc-700 hover:border-zinc-500 bg-[#141416] hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-2.5 h-2.5 text-emerald-400" />
              <span>+ Channels</span>
            </button>
          )}
        </div>

        {/* Engine Telemetry & Resolution Pill */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
          <span>{viewMode === 'tracks' ? 'Multi-lane' : 'Overlay'}</span>
          <span>•</span>
          <span>{timebaseMs}ms window</span>
          <span>•</span>
          <span className="text-zinc-400 font-semibold">{isPaused ? 'PAUSED' : '60 FPS'}</span>
        </div>
      </div>
    </div>
  );
};
