import React, { useState, useEffect, useMemo } from 'react';
import {
  SlidersHorizontal,
  Lightbulb,
  ToggleLeft,
  Cpu,
  Zap,
  Check,
  X,
  Search,
  Sparkles,
  RotateCcw,
  Palette,
  Layers,
} from 'lucide-react';
import { Button } from './ui/button';
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
}

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
  '#10b981', // Emerald (LED 1 / Pin 13)
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
    // Find all wires connected to this component
    const compWires = wires.filter((w) => w.fromComp === comp.id || w.toComp === comp.id);

    // Find wire connected to MCU
    const mcuWire = compWires.find(
      (w) =>
        (w.fromComp === comp.id && (w.toComp === mcuId || w.toComp.toLowerCase().includes('uno'))) ||
        (w.toComp === comp.id && (w.fromComp === mcuId || w.fromComp.toLowerCase().includes('uno')))
    );

    let pinConn = '';
    let wireColor: string | undefined = undefined;

    if (comp.kind === 'potentiometer') {
      // Find wiper wire (pin 2)
      const wiperWire = compWires.find(
        (w) =>
          (w.fromComp === comp.id && (w.fromPin === '2' || w.fromPin === 'sig' || w.fromPin === 'wiper')) ||
          (w.toComp === comp.id && (w.toPin === '2' || w.toPin === 'sig' || w.toPin === 'wiper'))
      );
      if (wiperWire) {
        const mcuPin = wiperWire.fromComp === comp.id ? wiperWire.toPin : wiperWire.fromPin;
        pinConn = `Wiper (Pin 2) → MCU Pin ${mcuPin}`;
        wireColor = wiperWire.color;
      } else if (mcuWire) {
        const mcuPin = mcuWire.fromComp === comp.id ? mcuWire.toPin : mcuWire.fromPin;
        pinConn = `Connected → MCU Pin ${mcuPin}`;
        wireColor = mcuWire.color;
      } else {
        pinConn = '3-Pin Potentiometer Divider';
      }
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
        pinConn = 'LED Output';
      }
    } else if (comp.kind === 'pushbutton') {
      if (mcuWire) {
        const mcuPin = mcuWire.fromComp === comp.id ? mcuWire.toPin : mcuWire.fromPin;
        pinConn = `Pin 1a → MCU Pin ${mcuPin}`;
        wireColor = mcuWire.color;
      } else {
        pinConn = 'Digital Pushbutton (Active Low)';
      }
    } else if (comp.kind === 'resistor') {
      pinConn = `${comp.props?.ohms || 220}\u00A0Ω Limiter`;
    }

    let label = `${comp.kind.toUpperCase()} (${comp.id})`;
    if (comp.kind === 'led') label = `LED (${comp.id})`;
    if (comp.kind === 'pushbutton') label = `Button (${comp.id})`;
    if (comp.kind === 'potentiometer') label = `Pot Wiper (${comp.id})`;
    if (comp.kind === 'resistor') label = `Resistor (${comp.id})`;

    const existing = savedMap.get(channelId);
    result.push({
      id: channelId,
      targetId: comp.id,
      label: existing?.label || label,
      kind: comp.kind,
      color: existing?.color || CHANNEL_PALETTE[colorIdx++ % CHANNEL_PALETTE.length],
      // Respect user's previous toggle if exists, otherwise auto-enable all interactive components
      enabled: existing !== undefined ? existing.enabled : comp.kind !== 'resistor',
      pinConnection: pinConn,
      wireColor,
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
  // Local working copy of channel configurations
  const [localConfigs, setLocalConfigs] = useState<WaveformChannelConfig[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'led' | 'input' | 'mcu'>('all');

  // ALWAYS re-generate fresh, synchronized channels from the diagram whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      const freshChannels = buildDiagramChannels(components, wires, configs);
      setLocalConfigs(freshChannels);
    }
  }, [isOpen, components, wires, configs]);

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

  // Quick Presets
  const handleSelectAllDiagram = () => {
    setLocalConfigs((prev) => prev.map((c) => ({ ...c, enabled: true })));
  };

  const handleSelectAllLeds = () => {
    setLocalConfigs((prev) =>
      prev.map((c) => (c.kind === 'led' ? { ...c, enabled: true } : c))
    );
  };

  const handleSelectAllInputs = () => {
    setLocalConfigs((prev) =>
      prev.map((c) =>
        c.kind === 'pushbutton' || c.kind === 'potentiometer' ? { ...c, enabled: true } : c
      )
    );
  };

  const handleResetDefaults = () => {
    setLocalConfigs(buildDiagramChannels(components, wires, []));
  };

  // Filtered list based on category and search query (Hooks MUST run before any early return)
  const filteredConfigs = useMemo(() => {
    let list = localConfigs;
    if (filterCategory === 'led') {
      list = list.filter((c) => c.kind === 'led');
    } else if (filterCategory === 'input') {
      list = list.filter((c) => c.kind === 'pushbutton' || c.kind === 'potentiometer');
    } else if (filterCategory === 'mcu') {
      list = list.filter((c) => c.kind === 'mcu');
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
  }, [localConfigs, filterCategory, searchQuery]);

  const enabledCount = localConfigs.filter((c) => c.enabled).length;
  const totalCount = localConfigs.length;

  const handleApply = () => {
    onSave(localConfigs);
    onClose();
  };

  // Safe early return placed AFTER all hooks to adhere strictly to React Rules of Hooks
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-100">
      <div
        className="w-full max-w-lg bg-[#141416] border border-[#222226] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-100 max-h-[85vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#222226] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>Configure Waveform Channels</span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono h-4 border-zinc-700 whitespace-nowrap [word-break:keep-all]"
                >
                  {enabledCount}&nbsp;/&nbsp;{totalCount}&nbsp;Active
                </Badge>
              </h2>
              <p className="text-[11px] text-zinc-400 leading-normal">
                Directly synchronized with all circuit components and wires in the diagram.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Tabs & Quick Presets Bar */}
        <div className="px-4 py-2 bg-[#0e0e11] border-b border-[#222226] space-y-2">
          {/* Top Row: Category Tabs */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center bg-[#141416] border border-[#27272a] rounded-full p-0.5">
              <button
                type="button"
                onClick={() => setFilterCategory('all')}
                className={`h-5 px-2.5 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                  filterCategory === 'all'
                    ? 'bg-zinc-200 text-zinc-950 font-semibold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All ({localConfigs.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('led')}
                className={`h-5 px-2 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                  filterCategory === 'led'
                    ? 'bg-zinc-200 text-zinc-950 font-semibold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                LEDs ({localConfigs.filter((c) => c.kind === 'led').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('input')}
                className={`h-5 px-2 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                  filterCategory === 'input'
                    ? 'bg-zinc-200 text-zinc-950 font-semibold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Inputs ({localConfigs.filter((c) => c.kind === 'pushbutton' || c.kind === 'potentiometer').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('mcu')}
                className={`h-5 px-2 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                  filterCategory === 'mcu'
                    ? 'bg-zinc-200 text-zinc-950 font-semibold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                MCU Pins ({localConfigs.filter((c) => c.kind === 'mcu').length})
              </button>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#18181b] border border-zinc-800 rounded-full text-xs">
              <Search className="w-3 h-3 text-zinc-500 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="bg-transparent text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600 w-24"
              />
            </div>
          </div>

          {/* Bottom Row: Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleSelectAllDiagram}
              className="h-5 px-2 rounded-full bg-[#18181b] hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Layers className="w-2.5 h-2.5 text-sky-400" />
              <span>Select All</span>
            </button>
            <button
              type="button"
              onClick={handleSelectAllLeds}
              className="h-5 px-2 rounded-full bg-[#18181b] hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Lightbulb className="w-2.5 h-2.5 text-emerald-400" />
              <span>All LEDs</span>
            </button>
            <button
              type="button"
              onClick={handleSelectAllInputs}
              className="h-5 px-2 rounded-full bg-[#18181b] hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ToggleLeft className="w-2.5 h-2.5 text-amber-400" />
              <span>All Inputs</span>
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="h-5 px-2 rounded-full hover:bg-zinc-800 border border-transparent text-zinc-400 hover:text-zinc-200 text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Channel Selection Ledger (Level 2 Inset Box) */}
        <div className="p-3 overflow-y-auto flex-1 space-y-1.5">
          {filteredConfigs.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No matching diagram components found.
            </div>
          ) : (
            filteredConfigs.map((cfg) => {
              return (
                <div
                  key={cfg.id}
                  className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                    cfg.enabled
                      ? 'bg-[#1c1c20] border-zinc-700/80 shadow-xs'
                      : 'bg-[#121215] border-[#222226] opacity-60 hover:opacity-90'
                  }`}
                >
                  {/* Left: Checkbox & Name & Diagram Wire Badge */}
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleToggle(cfg.id)}
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-colors cursor-pointer ${
                        cfg.enabled
                          ? 'bg-white border-white text-zinc-950 font-bold'
                          : 'border-zinc-700 bg-transparent'
                      }`}
                    >
                      {cfg.enabled && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>

                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#141416] border border-[#27272a] flex items-center justify-center shrink-0">
                        {cfg.kind === 'led' && <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />}
                        {cfg.kind === 'pushbutton' && <ToggleLeft className="w-3.5 h-3.5 text-amber-400" />}
                        {cfg.kind === 'potentiometer' && <Zap className="w-3.5 h-3.5 text-sky-400" />}
                        {cfg.kind === 'resistor' && <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />}
                        {cfg.kind === 'mcu' && <Cpu className="w-3.5 h-3.5 text-purple-400" />}
                      </div>

                      <div>
                        <div className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                          <span>{cfg.label}</span>
                          <span className="font-mono text-[10px] text-zinc-500">({cfg.targetId})</span>
                        </div>
                        {cfg.pinConnection && (
                          <div className="text-[10px] text-zinc-400 leading-tight flex items-center gap-1 mt-0.5">
                            {cfg.wireColor && (
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: cfg.wireColor }}
                              />
                            )}
                            <span>{cfg.pinConnection}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Color Swatch & Unit Tag */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCycleColor(cfg.id)}
                      title="Click to cycle channel trace color"
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-zinc-800 bg-[#141416] hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: cfg.color }}
                      />
                      <Palette className="w-2.5 h-2.5 text-zinc-500" />
                    </button>

                    <Badge
                      variant="outline"
                      className="text-[9px] font-mono h-4 border-zinc-700/60 whitespace-nowrap [word-break:keep-all]"
                    >
                      0&nbsp;-&nbsp;5&nbsp;V
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#222226] bg-[#0e0e11] flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            Selected: <span className="text-zinc-200 font-semibold font-mono">{enabledCount}</span> channel{enabledCount !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-full h-8 text-xs px-3.5 border-zinc-700 bg-transparent text-zinc-300 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleApply}
              className="rounded-full h-8 text-xs px-4 bg-white text-zinc-950 hover:bg-zinc-200 font-semibold shadow-xs"
            >
              Apply Channels
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
