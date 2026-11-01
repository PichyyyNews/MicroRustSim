import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  SlidersHorizontal,
  Lightbulb,
  ToggleLeft,
  Cpu,
  Zap,
  Activity,
  Check,
  X,
  Search,
  RotateCcw,
  Palette,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { CircuitComponent, CircuitWire } from '../types';

export interface WaveformChannelConfig {
  id: string; // e.g. 'ch_led1', 'ch_pot1', 'ch_mcu_13'
  targetId: string; // component id or pin name
  label: string; // display name
  kind: 'led' | 'pushbutton' | 'potentiometer' | 'resistor' | 'mcu' | string;
  color: string;
  enabled: boolean;
  pinConnection?: string;
  wireColor?: string;
  compDetails?: string;
}

export type ChannelCategory = 'all' | 'led' | 'input' | 'mcu' | 'passive';

interface ChannelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  components: CircuitComponent[];
  wires?: CircuitWire[];
  configs: WaveformChannelConfig[];
  onSave: (newConfigs: WaveformChannelConfig[]) => void;
}

// Curated 8 Dark Zinc-compatible vibrant channel colors
export const CHANNEL_PALETTE = [
  '#38bdf8', // Sky (Potentiometer / Analog)
  '#10b981', // Emerald (LED 1 / Output)
  '#f59e0b', // Amber (Button 1 / Input)
  '#f43f5e', // Rose (LED 2 / Alert)
  '#a855f7', // Purple (MCU Pin / Clock)
  '#14b8a6', // Teal (Sensor / I2C)
  '#eab308', // Yellow (LED 3 / Warning)
  '#6366f1', // Indigo (LED 4 / Bus)
];

/**
 * Builds complete channel list synchronized with the real-time circuit diagram.
 * Inspects all components (LEDs, Pots, Buttons, Resistors) and wires to MCU pins.
 */
export function buildDiagramChannels(
  components: CircuitComponent[],
  wires: CircuitWire[] = [],
  savedConfigs: WaveformChannelConfig[] = []
): WaveformChannelConfig[] {
  const savedMap = new Map(savedConfigs.map((c) => [c.id, c]));
  const result: WaveformChannelConfig[] = [];
  let colorIdx = 0;

  // 1. Identify MCU
  const mcuComp = components.find((c) => c.kind === 'arduino_uno');
  const mcuId = mcuComp?.id || 'uno1';

  // 2. Add all circuit components in the diagram (LEDs, Pots, Buttons, Resistors)
  const diagramComps = components.filter(
    (c) => c.kind !== 'arduino_uno' && c.kind !== 'breadboard' && c.kind !== 'text_label'
  );

  diagramComps.forEach((comp) => {
    const channelId = `ch_${comp.id}`;
    const compWires = wires.filter((w) => w.fromComp === comp.id || w.toComp === comp.id);

    const mcuWire = compWires.find(
      (w) =>
        (w.fromComp === comp.id && (w.toComp === mcuId || w.toComp.toLowerCase().includes('uno'))) ||
        (w.toComp === comp.id && (w.fromComp === mcuId || w.fromComp.toLowerCase().includes('uno')))
    );

    let pinConn = '';
    let wireColor: string | undefined = undefined;
    let compDetails = '';

    if (comp.kind === 'potentiometer') {
      const wiperWire = compWires.find(
        (w) =>
          (w.fromComp === comp.id && (w.fromPin === '2' || w.fromPin === 'sig' || w.fromPin === 'wiper')) ||
          (w.toComp === comp.id && (w.toPin === '2' || w.toPin === 'sig' || w.toPin === 'wiper'))
      );
      if (wiperWire) {
        const mcuPin = wiperWire.fromComp === comp.id ? wiperWire.toPin : wiperWire.fromPin;
        pinConn = `Pin 2 (Wiper) → MCU Pin ${mcuPin}`;
        wireColor = wiperWire.color;
      } else if (mcuWire) {
        const mcuPin = mcuWire.fromComp === comp.id ? mcuWire.toPin : mcuWire.fromPin;
        pinConn = `Connected → MCU Pin ${mcuPin}`;
        wireColor = mcuWire.color;
      } else {
        pinConn = '3-Pin Voltage Divider';
      }
      compDetails = '10 kΩ Rotary Knob (0.00 – 5.00 V)';
    } else if (comp.kind === 'led') {
      const anodeWire = compWires.find(
        (w) =>
          (w.fromComp === comp.id && (w.fromPin === 'anode' || w.fromPin === '1')) ||
          (w.toComp === comp.id && (w.toPin === 'anode' || w.toPin === '1'))
      );
      if (anodeWire) {
        const mcuPin = anodeWire.fromComp === comp.id ? anodeWire.toPin : anodeWire.fromPin;
        pinConn = `Anode → MCU Pin ${mcuPin}`;
        wireColor = anodeWire.color;
      } else if (mcuWire) {
        const mcuPin = mcuWire.fromComp === comp.id ? mcuWire.toPin : mcuWire.fromPin;
        pinConn = `Connected → MCU Pin ${mcuPin}`;
        wireColor = mcuWire.color;
      } else {
        pinConn = 'Digital Output';
      }
      compDetails = `${comp.props?.color || 'Red'} LED (Forward Vf ~ 2.0 V)`;
    } else if (comp.kind === 'pushbutton') {
      if (mcuWire) {
        const mcuPin = mcuWire.fromComp === comp.id ? mcuWire.toPin : mcuWire.fromPin;
        pinConn = `Pin 1a → MCU Pin ${mcuPin}`;
        wireColor = mcuWire.color;
      } else {
        pinConn = 'Momentary Switch';
      }
      compDetails = 'Active-Low with 30 kΩ Internal Pullup';
    } else if (comp.kind === 'resistor') {
      pinConn = `${comp.props?.ohms || 220}\u00A0Ω Limiter`;
      compDetails = 'Series Current Limiting Resistor';
    } else if (comp.kind === 'capacitor') {
      const farads = comp.props?.capacitance || 10e-6;
      const str = farads >= 1e-6 ? `${(farads * 1e6).toFixed(0)}\u00A0µF` : `${(farads * 1e9).toFixed(0)}\u00A0nF`;
      pinConn = `${str} Storage Element`;
      compDetails = `${comp.props?.polarized ? 'Electrolytic' : 'Ceramic'} Capacitor (${str})`;
    }

    let label = `${comp.kind.toUpperCase()} (${comp.id})`;
    if (comp.kind === 'led') label = `LED (${comp.id})`;
    if (comp.kind === 'pushbutton') label = `Button (${comp.id})`;
    if (comp.kind === 'potentiometer') label = `Pot Wiper (${comp.id})`;
    if (comp.kind === 'resistor') label = `Resistor (${comp.id})`;
    if (comp.kind === 'capacitor') label = `Capacitor (${comp.id})`;

    const isConnected = compWires.length > 0;
    const existing = savedMap.get(channelId);
    result.push({
      id: channelId,
      targetId: comp.id,
      label: existing?.label || label,
      kind: comp.kind,
      color: existing?.color || CHANNEL_PALETTE[colorIdx++ % CHANNEL_PALETTE.length],
      // Respect user's previous toggle if exists, otherwise auto-enable connected interactive components
      // Unwired spare components default to false to prevent dead 0V flatlines cluttering the scope
      enabled: existing !== undefined ? existing.enabled : (isConnected && comp.kind !== 'resistor'),
      pinConnection: pinConn,
      wireColor,
      compDetails,
    });
  });

  // 3. Add MCU Pins Wired in Diagram
  const mcuWires = wires.filter(
    (w) =>
      w.fromComp === mcuId ||
      w.toComp === mcuId ||
      w.fromComp.toLowerCase().includes('uno') ||
      w.toComp.toLowerCase().includes('uno')
  );
  const wiredMcuPins = new Set<string>();
  mcuWires.forEach((w) => {
    const pin =
      w.fromComp === mcuId || w.fromComp.toLowerCase().includes('uno') ? w.fromPin : w.toPin;
    if (pin && pin !== '5V' && pin !== '3.3V' && !pin.startsWith('GND')) {
      wiredMcuPins.add(pin);
    }
  });

  // Always include standard Pin 13
  wiredMcuPins.add('13');

  wiredMcuPins.forEach((pin) => {
    const channelId = `ch_mcu_${pin.toLowerCase()}`;
    const legacyId = `ch_pin${pin.toLowerCase()}`;
    const existing = savedMap.get(channelId) || savedMap.get(legacyId);

    if (!result.some((r) => r.id === channelId)) {
      result.push({
        id: channelId,
        targetId: pin,
        label: `MCU Pin ${pin}`,
        kind: 'mcu',
        color: existing?.color || CHANNEL_PALETTE[colorIdx++ % CHANNEL_PALETTE.length],
        enabled: existing !== undefined ? existing.enabled : pin === '13',
        pinConnection: `ATmega328P Pin ${pin}`,
        compDetails: 'Hardware Microcontroller GPIO',
      });
    }
  });

  return result;
}

export const ChannelConfigModal: React.FC<ChannelConfigModalProps> = ({
  isOpen,
  onClose,
  components = [],
  wires = [],
  configs = [],
  onSave,
}) => {
  // Navigation & Filter State
  const [activeTab, setActiveTab] = useState<ChannelCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [localConfigs, setLocalConfigs] = useState<WaveformChannelConfig[]>([]);

  // 0-Latency Dragging via Direct DOM Transform (Matches SettingsModal)
  const modalBoxRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });

  useEffect(() => {
    if (isOpen) {
      posRef.current = { x: 0, y: 0 };
      if (modalBoxRef.current) {
        modalBoxRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
      }
      // Re-generate fresh, synchronized channels from the diagram on open
      const freshChannels = buildDiagramChannels(components, wires, configs);
      setLocalConfigs(freshChannels);
    }
  }, [isOpen, components, wires]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select')) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: posRef.current.x,
      startY: posRef.current.y,
    };

    const header = e.currentTarget as HTMLElement;
    header.setPointerCapture(e.pointerId);

    const onPointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - dragStartRef.current.mouseX;
      const dy = ev.clientY - dragStartRef.current.mouseY;
      posRef.current = {
        x: dragStartRef.current.startX + dx,
        y: dragStartRef.current.startY + dy,
      };
      if (modalBoxRef.current) {
        modalBoxRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0px)`;
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      isDraggingRef.current = false;
      try {
        header.releasePointerCapture(ev.pointerId);
      } catch {}
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Toggle channel enabled state by unique channel ID
  const handleToggle = (id: string) => {
    setLocalConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  // Cycle color to next in palette by unique channel ID
  const handleCycleColor = (id: string) => {
    setLocalConfigs((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const currentIdx = CHANNEL_PALETTE.indexOf(c.color);
        const nextColor =
          CHANNEL_PALETTE[(currentIdx + 1) % CHANNEL_PALETTE.length] || CHANNEL_PALETTE[0];
        return { ...c, color: nextColor };
      })
    );
  };

  // Preset actions
  const handleSelectAllInTab = () => {
    setLocalConfigs((prev) =>
      prev.map((c) => {
        if (activeTab === 'all') return { ...c, enabled: true };
        if (activeTab === 'led' && c.kind === 'led') return { ...c, enabled: true };
        if (activeTab === 'input' && (c.kind === 'pushbutton' || c.kind === 'potentiometer'))
          return { ...c, enabled: true };
        if (activeTab === 'mcu' && c.kind === 'mcu') return { ...c, enabled: true };
        if (activeTab === 'passive' && (c.kind === 'resistor' || c.kind === 'capacitor')) return { ...c, enabled: true };
        return c;
      })
    );
  };

  const handleResetDefaults = () => {
    setLocalConfigs(buildDiagramChannels(components, wires, []));
  };

  // Category counts
  const counts = useMemo(() => {
    return {
      all: localConfigs.length,
      led: localConfigs.filter((c) => c.kind === 'led').length,
      input: localConfigs.filter((c) => c.kind === 'pushbutton' || c.kind === 'potentiometer').length,
      mcu: localConfigs.filter((c) => c.kind === 'mcu').length,
      passive: localConfigs.filter((c) => c.kind === 'resistor' || c.kind === 'capacitor').length,
    };
  }, [localConfigs]);

  // Sidebar navigation items
  const SIDEBAR_ITEMS: {
    id: ChannelCategory;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number;
  }[] = [
    { id: 'all', label: 'All Channels', icon: Layers, count: counts.all },
    { id: 'led', label: 'Outputs & LEDs', icon: Lightbulb, count: counts.led },
    { id: 'input', label: 'Inputs & Switches', icon: ToggleLeft, count: counts.input },
    { id: 'mcu', label: 'MCU Pins (Uno)', icon: Cpu, count: counts.mcu },
    { id: 'passive', label: 'Passives & Capacitors', icon: Zap, count: counts.passive },
  ];

  // Filtered list based on active category and search query
  const filteredConfigs = useMemo(() => {
    let list = localConfigs;
    if (activeTab === 'led') {
      list = list.filter((c) => c.kind === 'led');
    } else if (activeTab === 'input') {
      list = list.filter((c) => c.kind === 'pushbutton' || c.kind === 'potentiometer');
    } else if (activeTab === 'mcu') {
      list = list.filter((c) => c.kind === 'mcu');
    } else if (activeTab === 'passive') {
      list = list.filter((c) => c.kind === 'resistor' || c.kind === 'capacitor');
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.targetId.toLowerCase().includes(q) ||
        c.kind.toLowerCase().includes(q) ||
        (c.pinConnection && c.pinConnection.toLowerCase().includes(q))
    );
  }, [localConfigs, activeTab, searchQuery]);

  const enabledCount = localConfigs.filter((c) => c.enabled).length;
  const totalCount = localConfigs.length;

  const handleApply = () => {
    onSave(localConfigs);
    onClose();
  };

  // Safe early return placed AFTER all hooks (Adheres strictly to React Rules of Hooks)
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center select-none bg-black/60 backdrop-blur-xs">
      <div
        ref={modalBoxRef}
        className="pointer-events-auto w-[820px] h-[560px] max-w-[94vw] max-h-[92vh] bg-[#141416] border border-[#242428] rounded-2xl shadow-2xl flex flex-col overflow-hidden outline-none will-change-transform"
        style={{ transform: 'translate3d(0px, 0px, 0px)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Draggable Header (Matches SettingsModal standard) */}
        <div
          onPointerDown={handlePointerDown}
          className="h-11 px-4 bg-[#18181b] border-b border-[#222226] flex items-center justify-between cursor-move select-none shrink-0"
        >
          <div className="flex items-center gap-2.5 text-zinc-100 font-semibold text-xs tracking-tight">
            <span>Logic Waveform Channels</span>
            <span className="text-[10px] text-zinc-500 font-mono font-normal">| Diagram Probes</span>
            <Badge
              variant="outline"
              className="text-[9px] font-mono h-4 border-zinc-700/80 text-zinc-300 ml-1 whitespace-nowrap [word-break:keep-all]"
            >
              {enabledCount}&nbsp;/&nbsp;{totalCount}&nbsp;Active
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative w-44">
              <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter channels..."
                className="h-7 pl-7 pr-2 bg-[#121215] border-zinc-800 text-zinc-200 text-xs rounded-full focus-visible:border-zinc-500"
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Left Flat Sidebar + Right Content Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation Menu (Flat Items - Anti-Card-Nesting) */}
          <div className="w-48 bg-[#121215] border-r border-[#222226] p-2 space-y-0.5 shrink-0 overflow-y-auto scrollbar-none">
            <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Categories
            </div>
            {SIDEBAR_ITEMS.map((item) => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors text-left cursor-pointer ${
                    isActive
                      ? 'bg-[#26262a] text-white shadow-xs font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <IconComp
                      className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-zinc-500'}`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                    {item.count}
                  </span>
                </button>
              );
            })}

            <div className="pt-3 border-t border-[#222226] px-1 space-y-1">
              <div className="px-1.5 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Quick Actions
              </div>
              <button
                type="button"
                onClick={handleSelectAllInTab}
                className="w-full px-2 py-1.5 rounded-lg text-[11px] text-zinc-300 hover:text-white hover:bg-zinc-800/50 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3 h-3 text-zinc-400 shrink-0" />
                <span>Select All in View</span>
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="w-full px-2 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3 text-zinc-500 shrink-0" />
                <span>Reset to Diagram</span>
              </button>
            </div>
          </div>

          {/* Right Main Content Panel */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin bg-[#141416]">
            {/* Category Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#222226]">
              <div>
                <h3 className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span>
                    {activeTab === 'all' && 'All Diagram Components & MCU Pins'}
                    {activeTab === 'led' && 'Outputs & LED Indicators'}
                    {activeTab === 'input' && 'Inputs, Potentiometers & Switches'}
                    {activeTab === 'mcu' && 'ATmega328P Microcontroller Pins'}
                    {activeTab === 'passive' && 'Passive Circuit Components'}
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono h-4 border-zinc-700">
                    {filteredConfigs.length} channels
                  </Badge>
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Synchronized with the active breadboard circuit diagram and wiring nets.
                </p>
              </div>
            </div>

            {/* Flat Channel Items (Level 2 Inset Box Architecture - Anti-Card-Nesting) */}
            <div className="space-y-2">
              {filteredConfigs.length === 0 ? (
                <div className="p-12 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                  No matching components found in this category.
                </div>
              ) : (
                filteredConfigs.map((cfg) => {
                  return (
                    <div
                      key={cfg.id}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        cfg.enabled
                          ? 'bg-[#1c1c20] border-zinc-700/80 shadow-xs'
                          : 'bg-[#161619] border-[#222226] opacity-60 hover:opacity-90'
                      }`}
                    >
                      {/* Left: Checkbox + Icon + Detailed Pin Information */}
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggle(cfg.id)}
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-colors cursor-pointer shrink-0 ${
                            cfg.enabled
                              ? 'bg-white border-white text-zinc-950 font-bold'
                              : 'border-zinc-700 bg-transparent hover:border-zinc-500'
                          }`}
                        >
                          {cfg.enabled && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>

                        <div className="w-7 h-7 rounded-lg bg-[#141416] border border-[#27272a] flex items-center justify-center shrink-0">
                          {cfg.kind === 'led' && <Lightbulb className="w-3.5 h-3.5 text-zinc-200" />}
                          {cfg.kind === 'pushbutton' && <ToggleLeft className="w-3.5 h-3.5 text-zinc-200" />}
                          {cfg.kind === 'potentiometer' && <Zap className="w-3.5 h-3.5 text-zinc-200" />}
                          {cfg.kind === 'resistor' && <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-200" />}
                          {cfg.kind === 'capacitor' && <Activity className="w-3.5 h-3.5 text-zinc-200" />}
                          {cfg.kind === 'mcu' && <Cpu className="w-3.5 h-3.5 text-zinc-200" />}
                        </div>

                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5 truncate">
                            <span>{cfg.label}</span>
                            <span className="font-mono text-[10px] text-zinc-500">({cfg.targetId})</span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {cfg.pinConnection && (
                              <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                                {cfg.wireColor ? (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: cfg.wireColor }}
                                  />
                                ) : (
                                  <ArrowRight className="w-2.5 h-2.5 text-zinc-600 shrink-0" />
                                )}
                                <span className="truncate">{cfg.pinConnection}</span>
                              </div>
                            )}
                            {cfg.compDetails && (
                              <span className="text-[10px] text-zinc-500 hidden sm:inline truncate">
                                • {cfg.compDetails}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Color Swatch Capsule + Range Badge */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCycleColor(cfg.id)}
                          title="Click to cycle channel trace color"
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-zinc-800 bg-[#121215] hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cfg.color }}
                          />
                          <Palette className="w-3 h-3 text-zinc-500" />
                        </button>

                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono h-5 px-2 border-zinc-700/60 whitespace-nowrap [word-break:keep-all]"
                        >
                          0.00&nbsp;–&nbsp;5.00&nbsp;V
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer (Matches SettingsModal standard) */}
        <div className="h-12 px-4 bg-[#18181b] border-t border-[#222226] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="text-[11px] text-zinc-500">Active Probes:</span>
            <span className="font-mono font-semibold text-white tabular-nums">{enabledCount}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-[11px] text-zinc-500">Available:</span>
            <span className="font-mono text-zinc-300 tabular-nums">{totalCount}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-full h-7 text-xs px-3 border-zinc-700 bg-transparent text-zinc-300 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleApply}
              className="rounded-full h-7 text-xs px-4 bg-white text-zinc-950 hover:bg-zinc-200 font-semibold shadow-xs"
            >
              Apply Channels
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
