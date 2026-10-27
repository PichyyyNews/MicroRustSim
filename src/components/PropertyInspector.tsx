import React, { useState } from 'react';
import {
  GoGear,
  GoTrash,
  GoSync,
  GoCheck,
  GoZap,
  GoDotFill,
  GoChevronDown,
  GoChevronRight,
  GoCopy,
} from 'react-icons/go';
import {
  RotateCw,
  FlipHorizontal,
  CornerDownRight,
  Spline,
  SlidersHorizontal,
  Activity,
  Cpu,
  Layers,
  Zap,
} from 'lucide-react';
import { CircuitComponent, CircuitWire } from '../types';
import { Input } from './ui/input';

export interface PropertyInspectorProps {
  selectedCompId: string | null;
  selectedWireId: string | null;
  components: CircuitComponent[];
  wires: CircuitWire[];
  onUpdateComponent: (id: string, updates: Partial<CircuitComponent>) => void;
  onUpdateWire: (id: string, updates: Partial<CircuitWire>) => void;
  onDeleteComponent: (id: string) => void;
  onDeleteWire: (id: string) => void;
  onButtonPress?: (id: string, pressed: boolean) => void;
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
  onButtonPress,
  onClose,
}) => {
  const selectedComp = components.find((c) => c.id === selectedCompId);
  const selectedWire = wires.find((w) => w.id === selectedWireId);

  // Collapsible section states for OOP Game-Engine inspector
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identity: true,
    transform: true,
    specs: true,
    interactive: true,
    pins: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // State for momentary button press inside inspector
  const [isInspectorButtonPressed, setIsInspectorButtonPressed] = useState(false);

  return (
    <div className="h-full flex flex-col bg-[#121215] border-t border-[#222226] overflow-hidden select-none text-xs">
      {/* Header */}
      <div className="h-7 px-3 border-b border-[#222226] flex items-center justify-between text-zinc-400 bg-[#121215] shrink-0">
        <div className="flex items-center gap-1.5 font-medium text-zinc-300">
          <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
          <span>Inspector</span>
          {selectedComp && (
            <span className="font-mono text-[10px] text-zinc-300 bg-[#1e1e24] px-1.5 py-0.5 rounded border border-[#27272a]">
              {selectedComp.kind}
            </span>
          )}
          {selectedWire && (
            <span className="font-mono text-[10px] text-zinc-300 bg-[#1e1e24] px-1.5 py-0.5 rounded border border-[#27272a]">
              wire
            </span>
          )}
        </div>
        {selectedComp && (
          <button
            type="button"
            title="Delete Selected Component (Del)"
            onClick={() => onDeleteComponent(selectedComp.id)}
            className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
          >
            <GoTrash className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-2.5 text-zinc-300 space-y-3 font-sans">
        {/* State 1: Nothing selected */}
        {!selectedComp && !selectedWire && (
          <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 py-10">
            <SlidersHorizontal className="w-7 h-7 mb-2 opacity-30 text-zinc-400" />
            <p className="text-xs font-medium text-zinc-400">No Object Selected</p>
            <p className="text-[11px] text-zinc-600 mt-1 max-w-[200px]">
              Click any breadboard component or wire to inspect its OOP class properties and electrical parameters.
            </p>
          </div>
        )}

        {/* State 2: Component Selected */}
        {selectedComp && (
          <div className="space-y-2.5 animate-in fade-in duration-100">
            {/* Section 1: Identity & Class Hierarchy */}
            <div className="border border-[#222226] rounded bg-[#151519] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('identity')}
                className="w-full px-2.5 py-1.5 bg-[#18181d] flex items-center justify-between text-zinc-300 font-medium text-[11px] border-b border-[#222226] hover:bg-[#1f1f26] transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Identity & Class</span>
                </span>
                {openSections.identity ? <GoChevronDown className="w-3 h-3 text-zinc-500" /> : <GoChevronRight className="w-3 h-3 text-zinc-500" />}
              </button>

              {openSections.identity && (
                <div className="p-2.5 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
                        Instance ID
                      </span>
                      <div className="h-6 flex items-center px-2 bg-[#121215] border border-zinc-800 rounded font-mono text-xs text-zinc-300">
                        {selectedComp.id}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
                        Class Type
                      </span>
                      <div className="h-6 flex items-center px-2 bg-[#121215] border border-zinc-800 rounded font-mono text-xs text-zinc-300 capitalize truncate">
                        {selectedComp.kind.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Transform (Game Engine Vector2 & Rotation) */}
            <div className="border border-[#222226] rounded bg-[#151519] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('transform')}
                className="w-full px-2.5 py-1.5 bg-[#18181d] flex items-center justify-between text-zinc-300 font-medium text-[11px] border-b border-[#222226] hover:bg-[#1f1f26] transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Transform</span>
                </span>
                {openSections.transform ? <GoChevronDown className="w-3 h-3 text-zinc-500" /> : <GoChevronRight className="w-3 h-3 text-zinc-500" />}
              </button>

              {openSections.transform && (
                <div className="p-2.5 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 bg-[#121215] border border-zinc-800 rounded px-2 h-6.5 text-xs">
                      <span className="text-[10px] font-mono text-zinc-500 font-semibold">X:</span>
                      <input
                        type="number"
                        value={selectedComp.x}
                        onChange={(e) =>
                          onUpdateComponent(selectedComp.id, { x: parseInt(e.target.value, 10) || 0 })
                        }
                        className="w-full bg-transparent text-zinc-200 outline-none font-mono text-xs"
                      />
                      <span className="text-[10px] text-zinc-600 font-mono">px</span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-[#121215] border border-zinc-800 rounded px-2 h-6.5 text-xs">
                      <span className="text-[10px] font-mono text-zinc-500 font-semibold">Y:</span>
                      <input
                        type="number"
                        value={selectedComp.y}
                        onChange={(e) =>
                          onUpdateComponent(selectedComp.id, { y: parseInt(e.target.value, 10) || 0 })
                        }
                        className="w-full bg-transparent text-zinc-200 outline-none font-mono text-xs"
                      />
                      <span className="text-[10px] text-zinc-600 font-mono">px</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      title="Rotate 90° Clockwise"
                      onClick={() =>
                        onUpdateComponent(selectedComp.id, {
                          rotation: (((selectedComp.rotation || 0) + 90) % 360),
                        })
                      }
                      className="flex-1 h-6 px-2 flex items-center justify-center gap-1.5 text-xs bg-[#18181b] hover:bg-[#27272a] border border-zinc-800 rounded text-zinc-300 transition-colors"
                    >
                      <RotateCw className="w-3 h-3 text-zinc-400" />
                      <span className="font-mono text-[11px]">{selectedComp.rotation || 0}°</span>
                    </button>

                    <button
                      type="button"
                      title="Flip Horizontal"
                      onClick={() =>
                        onUpdateComponent(selectedComp.id, { flipped: !selectedComp.flipped })
                      }
                      className={`h-6 px-2.5 flex items-center justify-center gap-1.5 text-xs border rounded transition-colors ${
                        selectedComp.flipped
                          ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                          : 'bg-[#18181b] hover:bg-[#27272a] border-zinc-800 text-zinc-400'
                      }`}
                    >
                      <FlipHorizontal className="w-3 h-3" />
                      <span className="text-[11px]">Flip</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Physical Specifications & Interactive Input Controls */}
            <div className="border border-[#222226] rounded bg-[#151519] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('specs')}
                className="w-full px-2.5 py-1.5 bg-[#18181d] flex items-center justify-between text-zinc-300 font-medium text-[11px] border-b border-[#222226] hover:bg-[#1f1f26] transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Physical Specs & Controls</span>
                </span>
                {openSections.specs ? <GoChevronDown className="w-3 h-3 text-zinc-500" /> : <GoChevronRight className="w-3 h-3 text-zinc-500" />}
              </button>

              {openSections.specs && (
                <div className="p-2.5 space-y-3">
                  {/* Potentiometer Interactive Rotary Dial & Sliders */}
                  {selectedComp.kind === 'potentiometer' && (() => {
                    const wiperVal = selectedComp.props.value ?? 0.5;
                    const voltage = (wiperVal * 5.0).toFixed(2);
                    const adcRaw = Math.round(wiperVal * 1023);
                    const percent = Math.round(wiperVal * 100);

                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                            Wiper Meter
                          </span>
                          <span className="font-mono text-zinc-100 font-semibold text-xs">
                            {voltage} V <span className="text-zinc-500 font-normal">({percent}%)</span>
                          </span>
                        </div>

                        {/* Interactive Dial SVG + Slider Row */}
                        <div className="bg-[#121215] border border-zinc-800 rounded p-2.5 flex items-center gap-3">
                          {/* Circular Knob Graphic */}
                          <div
                            className="relative w-12 h-12 rounded-full border border-zinc-700 bg-[#1c1c22] flex items-center justify-center shrink-0 shadow-inner cursor-pointer"
                            title={`Wiper Angle: ${Math.round(wiperVal * 270)}°`}
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const dx = e.clientX - (rect.left + rect.width / 2);
                              const dy = e.clientY - (rect.top + rect.height / 2);
                              let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
                              if (angle < 0) angle += 360;
                              const clamped = Math.max(0, Math.min(1, angle / 300));
                              onUpdateComponent(selectedComp.id, {
                                props: { ...selectedComp.props, value: Math.round(clamped * 100) / 100 },
                              });
                            }}
                          >
                            {/* Dial Notch */}
                            <div
                              className="absolute w-1 h-3.5 bg-zinc-200 rounded-full top-1"
                              style={{
                                transformOrigin: '50% 20px',
                                transform: `rotate(${-135 + wiperVal * 270}deg)`,
                              }}
                            />
                            <div className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-600" />
                          </div>

                          {/* Fine Slider & Info */}
                          <div className="flex-1 space-y-1">
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={wiperVal}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                onUpdateComponent(selectedComp.id, {
                                  props: { ...selectedComp.props, value: val },
                                });
                              }}
                              className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                              <span>0.0V (0)</span>
                              <span>ADC: {adcRaw}</span>
                              <span>5.0V (1023)</span>
                            </div>
                          </div>
                        </div>

                        {/* Quick Presets Stepper */}
                        <div className="grid grid-cols-5 gap-1 text-[10px] font-mono">
                          {[0, 0.25, 0.5, 0.75, 1.0].map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() =>
                                onUpdateComponent(selectedComp.id, {
                                  props: { ...selectedComp.props, value: v },
                                })
                              }
                              className={`py-0.5 rounded border transition-colors ${
                                Math.abs(wiperVal - v) < 0.05
                                  ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                                  : 'bg-[#18181b] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {(v * 5).toFixed(1)}V
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center justify-between bg-[#121215] border border-zinc-800 rounded px-2 py-1 text-xs">
                          <span className="text-zinc-500">Total Track:</span>
                          <span className="font-mono text-zinc-300">10 kΩ (Linear B)</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Pushbutton Interactive Momentary & Latch Controls */}
                  {selectedComp.kind === 'pushbutton' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                          Button Actuation
                        </span>
                        <span
                          className={`font-mono text-xs px-1.5 py-0.5 rounded border ${
                            isInspectorButtonPressed || selectedComp.props.pressed
                              ? 'bg-amber-950/40 text-amber-300 border-amber-800/60 font-semibold'
                              : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60'
                          }`}
                        >
                          {isInspectorButtonPressed || selectedComp.props.pressed
                            ? 'CLOSED (GND)'
                            : 'OPEN (Floating/Pullup)'}
                        </span>
                      </div>

                      {/* Interactive Depress Button */}
                      <button
                        type="button"
                        onMouseDown={() => {
                          setIsInspectorButtonPressed(true);
                          onButtonPress?.(selectedComp.id, true);
                          onUpdateComponent(selectedComp.id, {
                            props: { ...selectedComp.props, pressed: true },
                          });
                        }}
                        onMouseUp={() => {
                          setIsInspectorButtonPressed(false);
                          onButtonPress?.(selectedComp.id, false);
                          onUpdateComponent(selectedComp.id, {
                            props: { ...selectedComp.props, pressed: false },
                          });
                        }}
                        onMouseLeave={() => {
                          if (isInspectorButtonPressed) {
                            setIsInspectorButtonPressed(false);
                            onButtonPress?.(selectedComp.id, false);
                            onUpdateComponent(selectedComp.id, {
                              props: { ...selectedComp.props, pressed: false },
                            });
                          }
                        }}
                        className={`w-full py-2.5 px-3 rounded border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          isInspectorButtonPressed
                            ? 'bg-zinc-200 text-black border-white shadow-inner scale-[0.98]'
                            : 'bg-[#1e1e24] hover:bg-[#27272e] text-zinc-200 border-zinc-700 active:scale-[0.98]'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full border ${
                            isInspectorButtonPressed
                              ? 'bg-amber-500 border-amber-300 animate-pulse'
                              : 'bg-zinc-600 border-zinc-500'
                          }`}
                        />
                        <span>
                          {isInspectorButtonPressed ? 'Depressed (Holding Down)' : 'Press to Actuate (Hold)'}
                        </span>
                      </button>

                      <div className="flex items-center justify-between bg-[#121215] border border-zinc-800 rounded px-2 py-1 text-xs">
                        <span className="text-zinc-500">Mechanism:</span>
                        <span className="font-mono text-zinc-300">SPST Tactile Switch</span>
                      </div>
                    </div>
                  )}

                  {/* Resistor Resistance + Units + 4-Band Preview */}
                  {selectedComp.kind === 'resistor' && (() => {
                    const currentOhms = selectedComp.props.ohms || 220;
                    const bands = getResistorBands(currentOhms);

                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                            Resistance Value
                          </span>
                          <span className="font-mono text-zinc-200 text-xs">
                            {currentOhms >= 1000000
                              ? `${(currentOhms / 1000000).toFixed(1)} MΩ`
                              : currentOhms >= 1000
                              ? `${(currentOhms / 1000).toFixed(1)} kΩ`
                              : `${currentOhms} Ω`}
                          </span>
                        </div>

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
                            className="flex-1 h-6.5 px-2 bg-[#121215] border border-zinc-800 rounded font-mono text-xs text-zinc-200 outline-none focus:border-zinc-500"
                          />
                          <span className="text-zinc-400 font-mono text-xs">Ω</span>
                        </div>

                        {/* Color Bands Graphic */}
                        <div className="bg-[#121215] border border-zinc-800 rounded p-2 flex items-center justify-between">
                          <span className="text-[10px] text-zinc-500">4-Band Code:</span>
                          <div className="flex items-center gap-1 bg-[#d4b996] px-2.5 py-1 rounded">
                            <div className="w-1.5 h-3.5 rounded-xs" style={{ backgroundColor: bands[0] }} />
                            <div className="w-1.5 h-3.5 rounded-xs" style={{ backgroundColor: bands[1] }} />
                            <div className="w-1.5 h-3.5 rounded-xs" style={{ backgroundColor: bands[2] }} />
                            <div className="w-1.5 h-3.5 rounded-xs ml-1" style={{ backgroundColor: bands[3] }} />
                          </div>
                        </div>

                        {/* Presets */}
                        <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                          <span className="text-zinc-500">Presets:</span>
                          {[220, 330, 1000, 4700, 10000, 100000].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() =>
                                onUpdateComponent(selectedComp.id, {
                                  props: { ...selectedComp.props, ohms: preset },
                                })
                              }
                              className={`px-1.5 py-0.5 rounded border transition-colors ${
                                currentOhms === preset
                                  ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                                  : 'bg-[#121215] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {preset >= 1000 ? `${preset / 1000}k` : `${preset}Ω`}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* LED Color & Voltage Drop */}
                  {selectedComp.kind === 'led' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                          LED Emitting Color
                        </span>
                        <span className="font-mono text-zinc-300 text-xs">
                          Vf = {selectedComp.props.vf || 2.0} V
                        </span>
                      </div>

                      {/* Swatches */}
                      <div className="flex items-center gap-2">
                        {LED_PRESET_COLORS.map((p) => {
                          const isSelected = selectedComp.props.color === p.hex;
                          return (
                            <button
                              key={p.name}
                              type="button"
                              title={`${p.name} (Vf: ${p.vf}V)`}
                              onClick={() =>
                                onUpdateComponent(selectedComp.id, {
                                  props: { ...selectedComp.props, color: p.hex, vf: p.vf },
                                })
                              }
                              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-transform hover:scale-110 ${
                                isSelected ? 'border-white scale-110 shadow' : 'border-zinc-700'
                              }`}
                              style={{ backgroundColor: p.hex }}
                            >
                              {isSelected && <GoCheck className="w-3 h-3 text-black" />}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between bg-[#121215] border border-zinc-800 rounded px-2 py-1 text-xs">
                        <span className="text-zinc-500">Max Current Rating:</span>
                        <span className="font-mono text-zinc-300">20 mA (Nominal)</span>
                      </div>
                    </div>
                  )}

                  {/* Arduino Uno Specifications */}
                  {selectedComp.kind === 'arduino_uno' && (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-zinc-800/60">
                        <span className="text-zinc-500">Processor:</span>
                        <span className="font-mono text-zinc-200">ATmega328P @ 16 MHz</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-zinc-800/60">
                        <span className="text-zinc-500">Operating Voltage:</span>
                        <span className="font-mono text-zinc-200">5.0 V Logic</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-zinc-800/60">
                        <span className="text-zinc-500">Flash Memory:</span>
                        <span className="font-mono text-zinc-200">32 KB (0.5 KB Boot)</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-zinc-500">SRAM / EEPROM:</span>
                        <span className="font-mono text-zinc-200">2 KB / 1 KB</span>
                      </div>
                    </div>
                  )}

                  {/* Breadboard Specifications */}
                  {selectedComp.kind === 'breadboard' && (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-zinc-800/60">
                        <span className="text-zinc-500">Type:</span>
                        <span className="font-mono text-zinc-200">Half Breadboard (400 Ties)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-zinc-800/60">
                        <span className="text-zinc-500">Terminal Rows:</span>
                        <span className="font-mono text-zinc-200">30 Rows (A-E, F-J)</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-zinc-500">Power Buses:</span>
                        <span className="font-mono text-zinc-200">2 Distribution Pairs (+/–)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 4: Live Electrical Telemetry (Pins) */}
            <div className="border border-[#222226] rounded bg-[#151519] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('pins')}
                className="w-full px-2.5 py-1.5 bg-[#18181d] flex items-center justify-between text-zinc-300 font-medium text-[11px] border-b border-[#222226] hover:bg-[#1f1f26] transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Electrical Telemetry</span>
                </span>
                {openSections.pins ? <GoChevronDown className="w-3 h-3 text-zinc-500" /> : <GoChevronRight className="w-3 h-3 text-zinc-500" />}
              </button>

              {openSections.pins && (
                <div className="p-2 space-y-1 text-xs">
                  {selectedComp.kind === 'potentiometer' && (
                    <>
                      <div className="flex justify-between py-0.5 px-1 bg-[#121215] rounded">
                        <span className="font-mono text-zinc-400">Pin 1 (GND):</span>
                        <span className="font-mono text-zinc-200">0.00 V</span>
                      </div>
                      <div className="flex justify-between py-0.5 px-1 bg-[#121215] rounded">
                        <span className="font-mono text-zinc-400">Pin 2 (SIG/Wiper):</span>
                        <span className="font-mono text-zinc-100 font-semibold">
                          {((selectedComp.props.value ?? 0.5) * 5.0).toFixed(2)} V
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 px-1 bg-[#121215] rounded">
                        <span className="font-mono text-zinc-400">Pin 3 (VCC):</span>
                        <span className="font-mono text-zinc-200">5.00 V</span>
                      </div>
                    </>
                  )}

                  {selectedComp.kind === 'pushbutton' && (
                    <>
                      <div className="flex justify-between py-0.5 px-1 bg-[#121215] rounded">
                        <span className="font-mono text-zinc-400">Terminals 1a / 1b:</span>
                        <span className="font-mono text-zinc-200">GND (Reference)</span>
                      </div>
                      <div className="flex justify-between py-0.5 px-1 bg-[#121215] rounded">
                        <span className="font-mono text-zinc-400">Terminals 2a / 2b:</span>
                        <span className="font-mono text-zinc-100">
                          {isInspectorButtonPressed || selectedComp.props.pressed
                            ? '0.00 V (Active LOW)'
                            : '5.00 V (Pull-up Active)'}
                        </span>
                      </div>
                    </>
                  )}

                  {selectedComp.kind === 'led' && (
                    <>
                      <div className="flex justify-between py-0.5 px-1 bg-[#121215] rounded">
                        <span className="font-mono text-zinc-400">Anode (+):</span>
                        <span className="font-mono text-zinc-200">Logic Drive</span>
                      </div>
                      <div className="flex justify-between py-0.5 px-1 bg-[#121215] rounded">
                        <span className="font-mono text-zinc-400">Cathode (–):</span>
                        <span className="font-mono text-zinc-200">GND Return</span>
                      </div>
                    </>
                  )}

                  {selectedComp.kind === 'resistor' && (
                    <div className="flex justify-between py-0.5 px-1 bg-[#121215] rounded">
                      <span className="font-mono text-zinc-400">Terminal Impedance:</span>
                      <span className="font-mono text-zinc-200">
                        {selectedComp.props.ohms || 220} Ω
                      </span>
                    </div>
                  )}

                  {selectedComp.kind === 'arduino_uno' && (
                    <div className="space-y-1">
                      <div className="flex justify-between py-0.5 px-1 bg-[#121215] rounded">
                        <span className="font-mono text-zinc-400">Pin 13 (SCK):</span>
                        <span className="font-mono text-zinc-200">Digital Out (LED)</span>
                      </div>
                      <div className="flex justify-between py-0.5 px-1 bg-[#121215] rounded">
                        <span className="font-mono text-zinc-400">Pin 2 (INT0):</span>
                        <span className="font-mono text-zinc-200">Digital In (Pullup)</span>
                      </div>
                      <div className="flex justify-between py-0.5 px-1 bg-[#121215] rounded">
                        <span className="font-mono text-zinc-400">Pin A0 (ADC0):</span>
                        <span className="font-mono text-zinc-200">Analog In (10-bit)</span>
                      </div>
                    </div>
                  )}

                  {selectedComp.kind === 'breadboard' && (
                    <div className="flex justify-between py-0.5 px-1 bg-[#121215] rounded">
                      <span className="font-mono text-zinc-400">Bus Conductance:</span>
                      <span className="font-mono text-zinc-200">0.05 Ω Spring Clip</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* State 3: Wire Selected */}
        {selectedWire && (
          <div className="space-y-2.5 animate-in fade-in duration-100">
            {/* Endpoints */}
            <div className="border border-[#222226] rounded bg-[#151519] p-2.5 space-y-1.5 text-xs">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                Wire Connection Endpoints
              </span>
              <div className="flex justify-between py-1 px-1.5 bg-[#121215] rounded border border-zinc-800">
                <span className="text-zinc-500">Source:</span>
                <span className="font-mono text-zinc-200">
                  {selectedWire.fromComp}:{selectedWire.fromPin}
                </span>
              </div>
              <div className="flex justify-between py-1 px-1.5 bg-[#121215] rounded border border-zinc-800">
                <span className="text-zinc-500">Target:</span>
                <span className="font-mono text-zinc-200">
                  {selectedWire.toComp}:{selectedWire.toPin}
                </span>
              </div>
            </div>

            {/* Wire Color */}
            <div className="border border-[#222226] rounded bg-[#151519] p-2.5 space-y-1.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                Insulation Color
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
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
                      selectedWire.color === c ? 'border-white scale-110 shadow' : 'border-zinc-700'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Routing Style (Clean Monochrome - No Green) */}
            <div className="border border-[#222226] rounded bg-[#151519] p-2.5 space-y-1.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                Routing Geometry
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateWire(selectedWire.id, { routingMode: 'ortho' })}
                  className={`flex-1 h-6.5 px-2 flex items-center justify-center gap-1.5 rounded border text-xs transition-colors ${
                    selectedWire.routingMode === 'ortho'
                      ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                      : 'bg-[#121215] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <CornerDownRight className="w-3.5 h-3.5" />
                  <span>Ortho 90°</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateWire(selectedWire.id, { routingMode: 'curve' })}
                  className={`flex-1 h-6.5 px-2 flex items-center justify-center gap-1.5 rounded border text-xs transition-colors ${
                    selectedWire.routingMode !== 'ortho'
                      ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                      : 'bg-[#121215] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Spline className="w-3.5 h-3.5" />
                  <span>Curve</span>
                </button>
              </div>
            </div>

            {/* Waypoints Controls */}
            {selectedWire.waypoints && selectedWire.waypoints.length > 0 && (
              <div className="flex items-center justify-between bg-[#151519] border border-[#222226] rounded px-2.5 py-1.5 text-xs">
                <span className="text-zinc-400">Waypoints:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-zinc-200">
                    {selectedWire.waypoints.length} points
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateWire(selectedWire.id, { waypoints: [] })}
                    className="text-[10px] text-zinc-400 hover:text-white underline"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* Delete Wire Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onDeleteWire(selectedWire.id)}
                className="w-full h-7 px-2 bg-red-950/30 hover:bg-red-900/40 text-red-400 hover:text-red-300 border border-red-900/50 rounded flex items-center justify-center gap-1.5 transition-colors text-xs"
              >
                <GoTrash className="w-3.5 h-3.5" />
                <span>Delete Wire</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
