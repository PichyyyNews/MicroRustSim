import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { CircuitComponent, CircuitWire } from '../types';

export interface WaveformChannelConfig {
  id: string; // e.g. 'ch_led1', 'ch_pin13'
  targetId: string; // component id or pin name
  label: string; // display name
  kind: 'led' | 'pushbutton' | 'potentiometer' | 'resistor' | 'mcu' | string;
  color: string;
  enabled: boolean;
  pinConnection?: string;
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
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#38bdf8', // Sky
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#14b8a6', // Teal
  '#eab308', // Yellow
  '#6366f1', // Indigo
];

export const ChannelConfigModal: React.FC<ChannelConfigModalProps> = ({
  isOpen,
  onClose,
  components = [],
  wires = [],
  configs,
  onSave,
}) => {
  if (!isOpen) return null;

  // Local copy of configs for editing
  const [localConfigs, setLocalConfigs] = useState<WaveformChannelConfig[]>(() => {
    // Merge existing configs with any new components detected in the circuit
    const existingMap = new Map(configs.map((c) => [c.targetId, c]));
    let colorIdx = 0;

    // Standard MCU Pin 13
    const result: WaveformChannelConfig[] = [];
    if (existingMap.has('13')) {
      result.push(existingMap.get('13')!);
    } else {
      result.push({
        id: 'ch_pin13',
        targetId: '13',
        label: 'Pin 13 (Builtin LED)',
        kind: 'mcu',
        color: CHANNEL_PALETTE[colorIdx++ % CHANNEL_PALETTE.length],
        enabled: true,
        pinConnection: 'ATmega328P Pin 13',
      });
    }

    // Process all circuit components (LEDs, Pushbuttons, Pots, etc.)
    const validComps = components.filter(
      (c) => c.kind !== 'arduino_uno' && c.kind !== 'breadboard' && c.kind !== 'text_label'
    );

    validComps.forEach((comp) => {
      if (existingMap.has(comp.id)) {
        result.push(existingMap.get(comp.id)!);
      } else {
        // Find connected wire to MCU if available
        const connectedWire = wires.find(
          (w) =>
            (w.fromComp === comp.id && w.toComp === 'arduino_uno') ||
            (w.toComp === comp.id && w.fromComp === 'arduino_uno')
        );
        const mcuPin = connectedWire
          ? connectedWire.fromComp === 'arduino_uno'
            ? connectedWire.fromPin
            : connectedWire.toPin
          : undefined;

        let compLabel = `${comp.kind.toUpperCase()} (${comp.id})`;
        if (comp.kind === 'led') compLabel = `LED (${comp.id})`;
        if (comp.kind === 'pushbutton') compLabel = `Button (${comp.id})`;
        if (comp.kind === 'potentiometer') compLabel = `Pot Wiper (${comp.id})`;

        result.push({
          id: `ch_${comp.id}`,
          targetId: comp.id,
          label: compLabel,
          kind: comp.kind,
          color: CHANNEL_PALETTE[colorIdx++ % CHANNEL_PALETTE.length],
          enabled: comp.kind === 'led' || comp.kind === 'pushbutton', // Auto-enable first components
          pinConnection: mcuPin ? `Wired to MCU Pin ${mcuPin}` : undefined,
        });
      }
    });

    return result;
  });

  const [searchQuery, setSearchQuery] = useState('');

  // Toggle channel enabled state
  const handleToggle = (targetId: string) => {
    setLocalConfigs((prev) =>
      prev.map((c) => (c.targetId === targetId ? { ...c, enabled: !c.enabled } : c))
    );
  };

  // Cycle color to next in palette
  const handleCycleColor = (targetId: string) => {
    setLocalConfigs((prev) =>
      prev.map((c) => {
        if (c.targetId !== targetId) return c;
        const currentIdx = CHANNEL_PALETTE.indexOf(c.color);
        const nextColor =
          CHANNEL_PALETTE[(currentIdx + 1) % CHANNEL_PALETTE.length] || CHANNEL_PALETTE[0];
        return { ...c, color: nextColor };
      })
    );
  };

  // Quick Action: Select All LEDs
  const handleSelectAllLeds = () => {
    setLocalConfigs((prev) =>
      prev.map((c) => (c.kind === 'led' ? { ...c, enabled: true } : c))
    );
  };

  // Quick Action: Select All Inputs (Buttons, Pots)
  const handleSelectAllInputs = () => {
    setLocalConfigs((prev) =>
      prev.map((c) =>
        c.kind === 'pushbutton' || c.kind === 'potentiometer' ? { ...c, enabled: true } : c
      )
    );
  };

  // Quick Action: Reset to Pin 13 only
  const handleResetDefaults = () => {
    setLocalConfigs((prev) =>
      prev.map((c, idx) => ({
        ...c,
        enabled: c.targetId === '13' || idx < 3,
      }))
    );
  };

  // Filtered list
  const filteredConfigs = useMemo(() => {
    if (!searchQuery.trim()) return localConfigs;
    const q = searchQuery.toLowerCase();
    return localConfigs.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.targetId.toLowerCase().includes(q) ||
        c.kind.toLowerCase().includes(q)
    );
  }, [localConfigs, searchQuery]);

  const enabledCount = localConfigs.filter((c) => c.enabled).length;

  const handleApply = () => {
    onSave(localConfigs);
    onClose();
  };

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
                  {enabledCount}&nbsp;Active
                </Badge>
              </h2>
              <p className="text-[11px] text-zinc-400 leading-normal">
                Enable separate logic channels for multiple LEDs, inputs, and pins.
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

        {/* Quick Preset Action Bar */}
        <div className="px-4 py-2.5 bg-[#0e0e11] border-b border-[#222226] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleSelectAllLeds}
              className="h-6 px-2.5 rounded-full bg-[#18181b] hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-[10px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Lightbulb className="w-3 h-3 text-emerald-400" />
              <span>Select All LEDs</span>
            </button>
            <button
              type="button"
              onClick={handleSelectAllInputs}
              className="h-6 px-2.5 rounded-full bg-[#18181b] hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-[10px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ToggleLeft className="w-3 h-3 text-amber-400" />
              <span>Select All Inputs</span>
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="h-6 px-2 rounded-full hover:bg-zinc-800 border border-transparent text-zinc-400 hover:text-zinc-200 text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* Search box */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#18181b] border border-zinc-800 rounded-full text-xs">
            <Search className="w-3 h-3 text-zinc-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter channels..."
              className="bg-transparent text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600 w-28"
            />
          </div>
        </div>

        {/* Channel Selection Ledger (Inset Box) */}
        <div className="p-3 overflow-y-auto flex-1 space-y-1.5">
          {filteredConfigs.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">
              No matching components or channels found.
            </div>
          ) : (
            filteredConfigs.map((cfg) => {
              return (
                <div
                  key={cfg.targetId}
                  className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                    cfg.enabled
                      ? 'bg-[#1c1c20] border-zinc-700/80 shadow-xs'
                      : 'bg-[#121215] border-[#222226] opacity-60 hover:opacity-90'
                  }`}
                >
                  {/* Left: Checkbox & Name */}
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleToggle(cfg.targetId)}
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-colors cursor-pointer ${
                        cfg.enabled
                          ? 'bg-white border-white text-zinc-950 font-bold'
                          : 'border-zinc-700 bg-transparent'
                      }`}
                    >
                      {cfg.enabled && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>

                    <div className="flex items-center gap-2">
                      {cfg.kind === 'led' && <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />}
                      {cfg.kind === 'pushbutton' && <ToggleLeft className="w-3.5 h-3.5 text-amber-400" />}
                      {cfg.kind === 'potentiometer' && <Zap className="w-3.5 h-3.5 text-sky-400" />}
                      {cfg.kind === 'mcu' && <Cpu className="w-3.5 h-3.5 text-purple-400" />}

                      <div>
                        <div className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                          <span>{cfg.label}</span>
                          <span className="font-mono text-[10px] text-zinc-500">({cfg.targetId})</span>
                        </div>
                        {cfg.pinConnection && (
                          <div className="text-[10px] text-zinc-500 leading-tight">
                            {cfg.pinConnection}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Color Swatch & Unit Tag */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCycleColor(cfg.targetId)}
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
