import React from 'react';
import {
  GoGear,
  GoTrash,
  GoSync,
  GoCheck,
  GoZap,
  GoDotFill,
} from 'react-icons/go';
import { RotateCw, FlipHorizontal, CornerDownRight, Spline, SlidersHorizontal, Palette } from 'lucide-react';
import { CircuitComponent, CircuitWire } from '../types';
import { Input } from './ui/input';
import { Button } from './ui/button';

export interface PropertyInspectorProps {
  selectedCompId: string | null;
  selectedWireId: string | null;
  components: CircuitComponent[];
  wires: CircuitWire[];
  onUpdateComponent: (id: string, updates: Partial<CircuitComponent>) => void;
  onUpdateWire: (id: string, updates: Partial<CircuitWire>) => void;
  onDeleteComponent: (id: string) => void;
  onDeleteWire: (id: string) => void;
  onClose?: () => void;
}

const RESISTOR_COLOR_CODES: Record<number, { name: string; hex: string }> = {
  0: { name: 'Black', hex: '#000000' },
  1: { name: 'Brown', hex: '#8b4513' },
  2: { name: 'Red', hex: '#ef4444' },
  3: { name: 'Orange', hex: '#f97316' },
  4: { name: 'Yellow', hex: '#eab308' },
  5: { name: 'Green', hex: '#22c55e' },
  6: { name: 'Blue', hex: '#3b82f6' },
  7: { name: 'Violet', hex: '#a855f7' },
  8: { name: 'Gray', hex: '#71717a' },
  9: { name: 'White', hex: '#f8fafc' },
};

function getResistorBands(ohms: number): [string, string, string, string] {
  const val = Math.max(1, Math.round(ohms));
  const s = val.toString();
  const d1 = parseInt(s[0], 10) || 1;
  const d2 = s.length > 1 ? parseInt(s[1], 10) : 0;
  const multiplier = Math.max(0, s.length - 2);

  const b1 = RESISTOR_COLOR_CODES[d1]?.hex || '#8b4513';
  const b2 = RESISTOR_COLOR_CODES[d2]?.hex || '#000000';
  const b3 = RESISTOR_COLOR_CODES[multiplier]?.hex || '#8b4513';
  const b4 = '#d97706'; // Gold (5%)
  return [b1, b2, b3, b4];
}

const LED_PRESET_COLORS = [
  { name: 'Red', hex: '#ef4444', vf: 2.0 },
  { name: 'Green', hex: '#22c55e', vf: 2.2 },
  { name: 'Blue', hex: '#3b82f6', vf: 3.2 },
  { name: 'Yellow', hex: '#eab308', vf: 2.1 },
  { name: 'White', hex: '#f8fafc', vf: 3.3 },
  { name: 'Orange', hex: '#f97316', vf: 2.0 },
];

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  selectedCompId,
  selectedWireId,
  components,
  wires,
  onUpdateComponent,
  onUpdateWire,
  onDeleteComponent,
  onDeleteWire,
  onClose,
}) => {
  const selectedComp = components.find((c) => c.id === selectedCompId);
  const selectedWire = wires.find((w) => w.id === selectedWireId);

  return (
    <div className="h-full flex flex-col bg-[#121215] border-t border-[#222226] overflow-hidden select-none text-xs">
      {/* Header */}
      <div className="h-7 px-3 border-b border-[#222226] flex items-center justify-between text-zinc-400 bg-[#121215] shrink-0">
        <div className="flex items-center gap-1.5 font-medium text-zinc-300">
          <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
          <span>Properties</span>
          {selectedComp && (
            <span className="font-mono text-[10px] text-zinc-500 bg-[#18181b] px-1.5 py-0.5 rounded">
              {selectedComp.kind}
            </span>
          )}
          {selectedWire && (
            <span className="font-mono text-[10px] text-zinc-500 bg-[#18181b] px-1.5 py-0.5 rounded">
              wire
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 text-zinc-300 space-y-3 font-sans">
        {/* State 1: Nothing selected */}
        {!selectedComp && !selectedWire && (
          <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 py-6">
            <SlidersHorizontal className="w-6 h-6 mb-2 opacity-40" />
            <p className="text-xs">No element selected</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              Click a component or wire on the canvas to inspect its parameters.
            </p>
          </div>
        )}

        {/* State 2: Component Selected */}
        {selectedComp && (
          <div className="space-y-3 animate-in fade-in duration-100">
            {/* Identity & Basic Transform */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block mb-1">
                  ID / Name
                </label>
                <Input
                  value={selectedComp.id}
                  disabled
                  className="h-6 text-xs bg-[#18181b] border-zinc-800 text-zinc-300 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block mb-1">
                  Kind
                </label>
                <div className="h-6 flex items-center px-2 text-xs bg-[#18181b] border border-zinc-800/80 rounded text-zinc-400 capitalize">
                  {selectedComp.kind.replace('_', ' ')}
                </div>
              </div>
            </div>

            {/* Position & Orientation */}
            <div>
              <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block mb-1">
                Position & Orientation
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-[#18181b] border border-zinc-800/80 rounded px-1.5 h-6 text-xs text-zinc-400">
                  <span className="text-[10px] text-zinc-500 font-mono">X</span>
                  <input
                    type="number"
                    value={selectedComp.x}
                    onChange={(e) =>
                      onUpdateComponent(selectedComp.id, { x: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-14 bg-transparent text-zinc-200 outline-none font-mono text-xs"
                  />
                </div>

                <div className="flex items-center gap-1 bg-[#18181b] border border-zinc-800/80 rounded px-1.5 h-6 text-xs text-zinc-400">
                  <span className="text-[10px] text-zinc-500 font-mono">Y</span>
                  <input
                    type="number"
                    value={selectedComp.y}
                    onChange={(e) =>
                      onUpdateComponent(selectedComp.id, { y: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-14 bg-transparent text-zinc-200 outline-none font-mono text-xs"
                  />
                </div>

                <button
                  type="button"
                  title="Rotate 90°"
                  onClick={() =>
                    onUpdateComponent(selectedComp.id, {
                      rotation: (((selectedComp.rotation || 0) + 90) % 360),
                    })
                  }
                  className="h-6 px-2 flex items-center gap-1 text-xs bg-[#18181b] hover:bg-[#27272a] border border-zinc-800 rounded text-zinc-300"
                >
                  <RotateCw className="w-3 h-3 text-zinc-400" />
                  <span className="font-mono text-[10px]">{selectedComp.rotation || 0}°</span>
                </button>

                <button
                  type="button"
                  title="Flip Horizontal"
                  onClick={() =>
                    onUpdateComponent(selectedComp.id, { flipped: !selectedComp.flipped })
                  }
                  className={`h-6 px-2 flex items-center gap-1 text-xs border rounded transition-colors ${
                    selectedComp.flipped
                      ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                      : 'bg-[#18181b] hover:bg-[#27272a] border-zinc-800 text-zinc-400'
                  }`}
                >
                  <FlipHorizontal className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* --- Component-Specific Parameters --- */}

            {/* 1. Resistor: Resistance (Ohms) + Color Code Bands */}
            {selectedComp.kind === 'resistor' && (() => {
              const currentOhms = selectedComp.props.ohms || 220;
              const bands = getResistorBands(currentOhms);

              return (
                <div className="space-y-2 border-t border-[#222226] pt-2">
                  <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block">
                    Resistance
                  </label>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="10000000"
                      value={currentOhms}
                      onChange={(e) => {
                        const ohms = Math.max(1, parseInt(e.target.value, 10) || 1);
                        onUpdateComponent(selectedComp.id, {
                          props: { ...selectedComp.props, ohms },
                        });
                      }}
                      className="w-24 h-6 px-2 bg-[#18181b] border border-zinc-800 rounded font-mono text-xs text-zinc-200 outline-none focus:border-zinc-500"
                    />
                    <span className="text-zinc-400 font-mono text-xs">Ω (Ohms)</span>
                  </div>

                  {/* Resistor Color Code Bands Preview */}
                  <div className="bg-[#18181b] border border-zinc-800/80 rounded p-2 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">Color Bands:</span>
                    <div className="flex items-center gap-1 bg-[#d4b996] px-2 py-1 rounded">
                      <div className="w-1.5 h-3.5 rounded-xs" style={{ backgroundColor: bands[0] }} />
                      <div className="w-1.5 h-3.5 rounded-xs" style={{ backgroundColor: bands[1] }} />
                      <div className="w-1.5 h-3.5 rounded-xs" style={{ backgroundColor: bands[2] }} />
                      <div className="w-1.5 h-3.5 rounded-xs ml-1" style={{ backgroundColor: bands[3] }} />
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-zinc-500">Presets:</span>
                    {[220, 330, 1000, 4700, 10000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          onUpdateComponent(selectedComp.id, {
                            props: { ...selectedComp.props, ohms: preset },
                          })
                        }
                        className="px-1.5 py-0.5 rounded bg-[#18181b] hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                      >
                        {preset >= 1000 ? `${preset / 1000}k` : `${preset}Ω`}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 2. LED: Color Picker + Forward Voltage */}
            {selectedComp.kind === 'led' && (
              <div className="space-y-2 border-t border-[#222226] pt-2">
                <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block">
                  LED Color & Forward Voltage
                </label>

                {/* Color Presets */}
                <div className="flex items-center gap-2">
                  {LED_PRESET_COLORS.map((p) => {
                    const isSelected = selectedComp.props.color === p.hex;
                    return (
                      <button
                        key={p.name}
                        type="button"
                        title={`${p.name} (${p.vf}V)`}
                        onClick={() =>
                          onUpdateComponent(selectedComp.id, {
                            props: { ...selectedComp.props, color: p.hex, vf: p.vf },
                          })
                        }
                        className={`w-6 h-6 rounded-full flex items-center justify-center border transition-transform hover:scale-110 ${
                          isSelected ? 'border-white scale-110' : 'border-zinc-700'
                        }`}
                        style={{ backgroundColor: p.hex }}
                      >
                        {isSelected && <GoCheck className="w-3 h-3 text-black" />}
                      </button>
                    );
                  })}
                </div>

                {/* Forward Voltage (Vf) */}
                <div className="flex items-center justify-between bg-[#18181b] border border-zinc-800 rounded px-2 py-1 text-xs">
                  <span className="text-zinc-400">Forward Voltage (Vf):</span>
                  <span className="font-mono text-zinc-200">
                    {selectedComp.props.vf || 2.0} V
                  </span>
                </div>
              </div>
            )}

            {/* 3. Potentiometer: Wiper Value & Total Resistance */}
            {selectedComp.kind === 'potentiometer' && (
              <div className="space-y-2 border-t border-[#222226] pt-2">
                <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block">
                  Wiper Position (ADC Input)
                </label>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                    <span>Position:</span>
                    <span>{Math.round((selectedComp.props.value ?? 0.5) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedComp.props.value ?? 0.5}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdateComponent(selectedComp.id, {
                        props: { ...selectedComp.props, value: val },
                      });
                    }}
                    className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between bg-[#18181b] border border-zinc-800 rounded px-2 py-1 text-xs">
                  <span className="text-zinc-400">Total Track:</span>
                  <span className="font-mono text-zinc-200">10 kΩ (Linear B)</span>
                </div>
              </div>
            )}

            {/* 4. Arduino Uno Spec Card */}
            {selectedComp.kind === 'arduino_uno' && (
              <div className="space-y-1.5 border-t border-[#222226] pt-2 text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Microcontroller:</span>
                  <span className="font-mono text-zinc-200">ATmega328P</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Operating Frequency:</span>
                  <span className="font-mono text-zinc-200">16.0 MHz</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Flash Memory:</span>
                  <span className="font-mono text-zinc-200">32 KB (0.5 KB Boot)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">SRAM:</span>
                  <span className="font-mono text-zinc-200">2 KB</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* State 3: Wire Selected */}
        {selectedWire && (
          <div className="space-y-3 animate-in fade-in duration-100">
            {/* Endpoints */}
            <div className="space-y-1.5 bg-[#18181b] border border-zinc-800/80 rounded p-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">From:</span>
                <span className="font-mono text-zinc-200">
                  {selectedWire.fromComp}:{selectedWire.fromPin}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">To:</span>
                <span className="font-mono text-zinc-200">
                  {selectedWire.toComp}:{selectedWire.toPin}
                </span>
              </div>
            </div>

            {/* Wire Color */}
            <div>
              <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block mb-1">
                Wire Color
              </label>
              <div className="flex items-center gap-1.5">
                {[
                  '#22c55e',
                  '#ef4444',
                  '#3b82f6',
                  '#eab308',
                  '#18181b',
                  '#f8fafc',
                  '#f97316',
                  '#8b5cf6',
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onUpdateWire(selectedWire.id, { color: c })}
                    className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${
                      selectedWire.color === c ? 'border-white scale-110' : 'border-zinc-700'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Routing Style */}
            <div>
              <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block mb-1">
                Routing Mode
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateWire(selectedWire.id, { routingMode: 'ortho' })}
                  className={`h-6 px-2.5 flex items-center gap-1.5 rounded border text-xs transition-colors ${
                    selectedWire.routingMode === 'ortho'
                      ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400 font-medium'
                      : 'bg-[#18181b] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <CornerDownRight className="w-3.5 h-3.5" />
                  <span>Ortho 90°</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateWire(selectedWire.id, { routingMode: 'curve' })}
                  className={`h-6 px-2.5 flex items-center gap-1.5 rounded border text-xs transition-colors ${
                    selectedWire.routingMode !== 'ortho'
                      ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400 font-medium'
                      : 'bg-[#18181b] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Spline className="w-3.5 h-3.5" />
                  <span>Curve</span>
                </button>
              </div>
            </div>

            {/* Waypoints Controls */}
            {selectedWire.waypoints && selectedWire.waypoints.length > 0 && (
              <div className="flex items-center justify-between bg-[#18181b] border border-zinc-800 rounded px-2 py-1 text-xs">
                <span className="text-zinc-400">Bends / Corners:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-zinc-300">
                    {selectedWire.waypoints.length} points
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateWire(selectedWire.id, { waypoints: [] })}
                    className="text-[10px] text-zinc-400 hover:text-zinc-200 underline"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* Delete Wire Button */}
            <div className="pt-2 border-t border-[#222226]">
              <button
                type="button"
                onClick={() => onDeleteWire(selectedWire.id)}
                className="w-full h-6 px-2 bg-red-950/30 hover:bg-red-900/40 text-red-400 hover:text-red-300 border border-red-900/50 rounded flex items-center justify-center gap-1.5 transition-colors text-xs"
              >
                <GoTrash className="w-3 h-3" />
                <span>Delete Wire</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
