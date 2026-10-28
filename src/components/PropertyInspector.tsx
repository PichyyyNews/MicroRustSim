import React, { useState } from 'react';
import {
  GoTrash,
  GoCheck,
  GoChevronDown,
  GoChevronRight,
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

export interface PropertyInspectorProps {
  selectedCompId: string | null;
  selectedWireId: string | null;
  components: CircuitComponent[];
  wires: CircuitWire[];
  litLeds?: Set<string>;
  ledBrightness?: Record<string, number>;
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
  litLeds,
  ledBrightness,
  onUpdateComponent,
  onUpdateWire,
  onDeleteComponent,
  onDeleteWire,
  onButtonPress,
}) => {
  const selectedComp = components.find((c) => c.id === selectedCompId);
  const selectedWire = wires.find((w) => w.id === selectedWireId);

  // Collapsible section states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identity: true,
    transform: true,
    specs: true,
    pins: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [isInspectorButtonPressed, setIsInspectorButtonPressed] = useState(false);

  return (
    <div className="h-full flex flex-col bg-[#121215] border-t border-[#222226] overflow-hidden select-none text-xs">
      {/* Clean Top Title Bar */}
      <div className="h-7 px-3 border-b border-[#222226] flex items-center justify-between text-zinc-400 bg-[#121215] shrink-0">
        <div className="flex items-center gap-1.5 font-medium text-zinc-300">
          <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
          <span>Inspector</span>
          {selectedComp && (
            <span className="font-mono text-[10px] text-zinc-400 ml-1">
              • {selectedComp.id}
            </span>
          )}
          {selectedWire && (
            <span className="font-mono text-[10px] text-zinc-400 ml-1">
              • wire
            </span>
          )}
        </div>
        {selectedComp && (
          <button
            type="button"
            title="Delete Selected Component (Del)"
            onClick={() => onDeleteComponent(selectedComp.id)}
            className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800/60 rounded transition-colors"
          >
            <GoTrash className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Clean Flat Body */}
      <div className="flex-1 overflow-y-auto px-3 py-2 text-zinc-300 space-y-3 font-sans">
        {/* State 1: Nothing selected */}
        {!selectedComp && !selectedWire && (
          <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 py-12">
            <SlidersHorizontal className="w-6 h-6 mb-2 opacity-30 text-zinc-400" />
            <p className="text-xs text-zinc-400">No Object Selected</p>
            <p className="text-[11px] text-zinc-600 mt-1 max-w-[190px]">
              Click any component or wire to inspect its properties.
            </p>
          </div>
        )}

        {/* State 2: Component Selected */}
        {selectedComp && (
          <div className="divide-y divide-[#1f1f23] animate-in fade-in duration-100">
            {/* Section 1: Identity */}
            <div className="pb-3">
              <button
                type="button"
                onClick={() => toggleSection('identity')}
                className="w-full py-1 flex items-center justify-between text-zinc-400 hover:text-zinc-200 text-[11px] font-semibold uppercase tracking-wider transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Identity</span>
                </span>
                {openSections.identity ? (
                  <GoChevronDown className="w-3 h-3 text-zinc-500" />
                ) : (
                  <GoChevronRight className="w-3 h-3 text-zinc-500" />
                )}
              </button>

              {openSections.identity && (
                <div className="pt-2 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-zinc-500">Instance ID</span>
                    <span className="font-mono text-zinc-200">{selectedComp.id}</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-zinc-500">Class</span>
                    <span className="font-mono text-zinc-200 capitalize">
                      {selectedComp.kind.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Transform */}
            <div className="py-3">
              <button
                type="button"
                onClick={() => toggleSection('transform')}
                className="w-full py-1 flex items-center justify-between text-zinc-400 hover:text-zinc-200 text-[11px] font-semibold uppercase tracking-wider transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Transform</span>
                </span>
                {openSections.transform ? (
                  <GoChevronDown className="w-3 h-3 text-zinc-500" />
                ) : (
                  <GoChevronRight className="w-3 h-3 text-zinc-500" />
                )}
              </button>

              {openSections.transform && (
                <div className="pt-2 space-y-2 text-xs">
                  {/* Position */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Position</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 bg-[#18181b] border border-[#27272a] rounded px-1.5 h-6">
                        <span className="text-[10px] font-mono text-zinc-500 font-semibold">X</span>
                        <input
                          type="number"
                          value={selectedComp.x}
                          onChange={(e) =>
                            onUpdateComponent(selectedComp.id, {
                              x: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-12 bg-transparent text-zinc-200 outline-none font-mono text-xs text-right"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-[#18181b] border border-[#27272a] rounded px-1.5 h-6">
                        <span className="text-[10px] font-mono text-zinc-500 font-semibold">Y</span>
                        <input
                          type="number"
                          value={selectedComp.y}
                          onChange={(e) =>
                            onUpdateComponent(selectedComp.id, {
                              y: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-12 bg-transparent text-zinc-200 outline-none font-mono text-xs text-right"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Orientation */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Orientation</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title="Rotate 90° Clockwise"
                        onClick={() =>
                          onUpdateComponent(selectedComp.id, {
                            rotation: (((selectedComp.rotation || 0) + 90) % 360),
                          })
                        }
                        className="h-6 px-2 flex items-center gap-1 bg-[#18181b] hover:bg-[#222226] border border-[#27272a] rounded text-zinc-300 transition-colors"
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
                        className={`h-6 px-2 flex items-center gap-1 rounded border text-[11px] transition-colors ${
                          selectedComp.flipped
                            ? 'bg-zinc-800 border-zinc-600 text-white'
                            : 'bg-[#18181b] hover:bg-[#222226] border-[#27272a] text-zinc-400'
                        }`}
                      >
                        <FlipHorizontal className="w-3 h-3" />
                        <span>Flip</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Physical Parameters & Controls */}
            <div className="py-3">
              <button
                type="button"
                onClick={() => toggleSection('specs')}
                className="w-full py-1 flex items-center justify-between text-zinc-400 hover:text-zinc-200 text-[11px] font-semibold uppercase tracking-wider transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Physical Specs</span>
                </span>
                {openSections.specs ? (
                  <GoChevronDown className="w-3 h-3 text-zinc-500" />
                ) : (
                  <GoChevronRight className="w-3 h-3 text-zinc-500" />
                )}
              </button>

              {openSections.specs && (
                <div className="pt-2 space-y-2.5 text-xs">
                  {/* Potentiometer */}
                  {selectedComp.kind === 'potentiometer' && (() => {
                    const wiperVal = selectedComp.props.value ?? 0.5;
                    const voltage = (wiperVal * 5.0).toFixed(2);
                    const adcRaw = Math.round(wiperVal * 1023);
                    const percent = Math.round(wiperVal * 100);

                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Wiper Position</span>
                          <span className="font-mono text-zinc-100 font-semibold text-xs">
                            {voltage} V <span className="text-zinc-500 font-normal">({percent}%)</span>
                          </span>
                        </div>

                        {/* Flat Minimal Slider */}
                        <div className="space-y-1">
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
                            className="w-full accent-white h-1.5 bg-[#1f1f23] rounded cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                            <span>0V (0)</span>
                            <span>ADC: {adcRaw}</span>
                            <span>5V (1023)</span>
                          </div>
                        </div>

                        {/* Flat Preset Pills */}
                        <div className="grid grid-cols-5 gap-1 text-[10px] font-mono pt-1">
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
                                  : 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {(v * 5).toFixed(1)}V
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-zinc-500">Total Track</span>
                          <span className="font-mono text-zinc-300">10 kΩ (Linear B)</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Pushbutton */}
                  {selectedComp.kind === 'pushbutton' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Switch State</span>
                        <span
                          className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                            isInspectorButtonPressed || selectedComp.props.pressed
                              ? 'bg-amber-950/40 text-amber-300 font-semibold'
                              : 'bg-zinc-800/60 text-zinc-400'
                          }`}
                        >
                          {isInspectorButtonPressed || selectedComp.props.pressed
                            ? 'CLOSED (0V GND)'
                            : 'OPEN (5V Pull-up)'}
                        </span>
                      </div>

                      {/* Clean Actuation Button */}
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
                        className={`w-full py-2 px-3 rounded border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          isInspectorButtonPressed
                            ? 'bg-zinc-200 text-black border-white shadow-inner scale-[0.99]'
                            : 'bg-[#18181b] hover:bg-[#202024] text-zinc-200 border-[#27272a] active:scale-[0.99]'
                        }`}
                      >
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            isInspectorButtonPressed
                              ? 'bg-amber-500 animate-pulse'
                              : 'bg-zinc-600'
                          }`}
                        />
                        <span>
                          {isInspectorButtonPressed ? 'Depressed (Holding Down)' : 'Press to Actuate (Hold)'}
                        </span>
                      </button>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-zinc-500">Mechanism</span>
                        <span className="font-mono text-zinc-300">SPST Tactile Switch</span>
                      </div>
                    </div>
                  )}

                  {/* Resistor */}
                  {selectedComp.kind === 'resistor' && (() => {
                    const currentOhms = selectedComp.props.ohms || 220;
                    const bands = getResistorBands(currentOhms);

                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Resistance</span>
                          <div className="flex items-center gap-1.5">
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
                              className="w-20 h-6 px-1.5 bg-[#18181b] border border-[#27272a] rounded font-mono text-xs text-zinc-200 outline-none text-right"
                            />
                            <span className="text-zinc-400 font-mono text-xs">Ω</span>
                          </div>
                        </div>

                        {/* Flat Color Bands Row */}
                        <div className="flex items-center justify-between py-1">
                          <span className="text-zinc-500">Color Bands</span>
                          <div className="flex items-center gap-1 bg-[#c9ab85] px-2 py-0.5 rounded">
                            <div className="w-1.5 h-3 rounded-xs" style={{ backgroundColor: bands[0] }} />
                            <div className="w-1.5 h-3 rounded-xs" style={{ backgroundColor: bands[1] }} />
                            <div className="w-1.5 h-3 rounded-xs" style={{ backgroundColor: bands[2] }} />
                            <div className="w-1.5 h-3 rounded-xs ml-0.5" style={{ backgroundColor: bands[3] }} />
                          </div>
                        </div>

                        {/* Flat Presets */}
                        <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono pt-1">
                          <span className="text-zinc-500 mr-0.5">Presets:</span>
                          {[220, 330, 1000, 4700, 10000].map((preset) => (
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
                                  : 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {preset >= 1000 ? `${preset / 1000}k` : `${preset}Ω`}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* LED */}
                  {selectedComp.kind === 'led' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Color</span>
                        <div className="flex items-center gap-1.5">
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
                                className={`w-5 h-5 rounded-full flex items-center justify-center border transition-transform hover:scale-115 ${
                                  isSelected ? 'border-white scale-110' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: p.hex }}
                              >
                                {isSelected && <GoCheck className="w-2.5 h-2.5 text-black" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Interactive Forward Drop (Vf) */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Forward Drop (Vf)</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0.5"
                              max="5.0"
                              step="0.1"
                              value={selectedComp.props.vf ?? 2.0}
                              onChange={(e) => {
                                const vfVal = Math.max(0.5, Math.min(5.0, parseFloat(e.target.value) || 2.0));
                                onUpdateComponent(selectedComp.id, {
                                  props: { ...selectedComp.props, vf: vfVal },
                                });
                              }}
                              className="w-16 h-6 px-1.5 bg-[#18181b] border border-[#27272a] rounded text-right font-mono text-xs text-zinc-100 focus:border-zinc-500 outline-none"
                            />
                            <span className="text-zinc-400 font-mono text-[11px]">V</span>
                          </div>
                        </div>

                        {/* Quick Vf Presets */}
                        <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                          <span className="text-zinc-500 mr-0.5">Presets:</span>
                          {[1.8, 2.0, 2.2, 3.0, 3.2].map((presetVf) => (
                            <button
                              key={presetVf}
                              type="button"
                              onClick={() =>
                                onUpdateComponent(selectedComp.id, {
                                  props: { ...selectedComp.props, vf: presetVf },
                                })
                              }
                              className={`px-1.5 py-0.5 rounded border transition-colors ${
                                (selectedComp.props.vf ?? 2.0) === presetVf
                                  ? 'bg-zinc-800 border-zinc-500 text-white font-medium'
                                  : 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {presetVf.toFixed(1)}V
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-0.5">
                        <span className="text-zinc-500">Max Current</span>
                        <span className="font-mono text-zinc-300">20 mA</span>
                      </div>
                    </div>
                  )}

                  {/* Text Label Controls */}
                  {selectedComp.kind === 'text_label' && (
                    <div className="space-y-3">
                      {/* Text Input */}
                      <div className="space-y-1">
                        <span className="text-zinc-500">Label Text</span>
                        <input
                          type="text"
                          value={selectedComp.props.text ?? 'Text Label'}
                          onChange={(e) =>
                            onUpdateComponent(selectedComp.id, {
                              props: { ...selectedComp.props, text: e.target.value },
                            })
                          }
                          className="w-full h-7 px-2 bg-[#18181b] border border-[#27272a] rounded text-xs text-zinc-100 focus:border-zinc-500 outline-none"
                        />
                      </div>

                      {/* Font Family */}
                      <div className="space-y-1">
                        <span className="text-zinc-500">Font Family</span>
                        <select
                          value={selectedComp.props.fontFamily ?? 'Inter, sans-serif'}
                          onChange={(e) =>
                            onUpdateComponent(selectedComp.id, {
                              props: { ...selectedComp.props, fontFamily: e.target.value },
                            })
                          }
                          className="w-full h-7 px-2 bg-[#18181b] border border-[#27272a] rounded text-xs text-zinc-200 focus:border-zinc-500 outline-none"
                        >
                          <option value="Inter, -apple-system, sans-serif">Sans-Serif (System)</option>
                          <option value="Consolas, 'Courier New', monospace">Monospace (Code)</option>
                          <option value="'Segoe UI', Tahoma, sans-serif">Segoe UI</option>
                          <option value="Arial, sans-serif">Arial</option>
                          <option value="Georgia, 'Times New Roman', serif">Serif</option>
                        </select>
                      </div>

                      {/* Font Size & Styles */}
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Size & Style</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="10"
                            max="72"
                            value={selectedComp.props.fontSize ?? 16}
                            onChange={(e) =>
                              onUpdateComponent(selectedComp.id, {
                                props: {
                                  ...selectedComp.props,
                                  fontSize: Math.max(8, parseInt(e.target.value, 10) || 14),
                                },
                              })
                            }
                            className="w-12 h-6 px-1 bg-[#18181b] border border-[#27272a] rounded text-right font-mono text-xs text-zinc-100 focus:border-zinc-500 outline-none"
                          />
                          <span className="text-zinc-500 text-[10px]">px</span>

                          {/* Bold */}
                          <button
                            type="button"
                            title="Bold"
                            onClick={() =>
                              onUpdateComponent(selectedComp.id, {
                                props: { ...selectedComp.props, bold: !selectedComp.props.bold },
                              })
                            }
                            className={`w-6 h-6 rounded border font-bold text-xs transition-colors ${
                              selectedComp.props.bold
                                ? 'bg-zinc-800 border-zinc-500 text-white'
                                : 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            B
                          </button>

                          {/* Italic */}
                          <button
                            type="button"
                            title="Italic"
                            onClick={() =>
                              onUpdateComponent(selectedComp.id, {
                                props: { ...selectedComp.props, italic: !selectedComp.props.italic },
                              })
                            }
                            className={`w-6 h-6 rounded border italic text-xs transition-colors ${
                              selectedComp.props.italic
                                ? 'bg-zinc-800 border-zinc-500 text-white'
                                : 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            I
                          </button>

                          {/* Underline */}
                          <button
                            type="button"
                            title="Underline"
                            onClick={() =>
                              onUpdateComponent(selectedComp.id, {
                                props: { ...selectedComp.props, underline: !selectedComp.props.underline },
                              })
                            }
                            className={`w-6 h-6 rounded border underline text-xs transition-colors ${
                              selectedComp.props.underline
                                ? 'bg-zinc-800 border-zinc-500 text-white'
                                : 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            U
                          </button>
                        </div>
                      </div>

                      {/* Text Color Swatches */}
                      <div className="space-y-1">
                        <span className="text-zinc-500">Text Color</span>
                        <div className="flex items-center gap-1.5">
                          {['#f4f4f5', '#a1a1aa', '#10b981', '#3b82f6', '#ef4444', '#eab308'].map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() =>
                                onUpdateComponent(selectedComp.id, {
                                  props: { ...selectedComp.props, color: c },
                                })
                              }
                              className={`w-5 h-5 rounded-full border transition-transform hover:scale-115 ${
                                (selectedComp.props.color || '#f4f4f5') === c
                                  ? 'border-white scale-110'
                                  : 'border-transparent'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Arduino Uno */}
                  {selectedComp.kind === 'arduino_uno' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Port (COM)</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={selectedComp.props.comPort || selectedComp.props.port || 'COM1'}
                            onChange={(e) =>
                              onUpdateComponent(selectedComp.id, {
                                props: { ...selectedComp.props, comPort: e.target.value },
                              })
                            }
                            className="w-20 h-6 px-1.5 bg-[#18181b] border border-[#27272a] rounded text-right font-mono text-xs text-zinc-100 focus:border-zinc-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-zinc-500">Processor</span>
                        <span className="font-mono text-zinc-200">ATmega328P @ 16 MHz</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-zinc-500">Operating Voltage</span>
                        <span className="font-mono text-zinc-200">5.0 V Logic</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-zinc-500">Flash Memory</span>
                        <span className="font-mono text-zinc-200">32 KB (0.5 KB Boot)</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-zinc-500">SRAM / EEPROM</span>
                        <span className="font-mono text-zinc-200">2 KB / 1 KB</span>
                      </div>
                    </div>
                  )}

                  {/* Breadboard */}
                  {selectedComp.kind === 'breadboard' && (
                    <div className="space-y-1">
                      <div className="flex justify-between py-0.5">
                        <span className="text-zinc-500">Type</span>
                        <span className="font-mono text-zinc-200">Half (400 Tie Points)</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-zinc-500">Terminal Rows</span>
                        <span className="font-mono text-zinc-200">30 Rows (A-E, F-J)</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-zinc-500">Power Buses</span>
                        <span className="font-mono text-zinc-200">2 Pairs (+/–)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 4: Electrical Telemetry */}
            <div className="py-3">
              <button
                type="button"
                onClick={() => toggleSection('pins')}
                className="w-full py-1 flex items-center justify-between text-zinc-400 hover:text-zinc-200 text-[11px] font-semibold uppercase tracking-wider transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Telemetry</span>
                </span>
                {openSections.pins ? (
                  <GoChevronDown className="w-3 h-3 text-zinc-500" />
                ) : (
                  <GoChevronRight className="w-3 h-3 text-zinc-500" />
                )}
              </button>

              {openSections.pins && (
                <div className="pt-2 space-y-1 text-xs">
                  {selectedComp.kind === 'potentiometer' && (
                    <>
                      <div className="flex justify-between py-0.5">
                        <span className="font-mono text-zinc-400">Pin 1 (GND):</span>
                        <span className="font-mono text-zinc-300">0.00 V</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="font-mono text-zinc-400">Pin 2 (Wiper/SIG):</span>
                        <span className="font-mono text-zinc-100 font-semibold">
                          {((selectedComp.props.value ?? 0.5) * 5.0).toFixed(2)} V
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="font-mono text-zinc-400">Pin 3 (VCC):</span>
                        <span className="font-mono text-zinc-300">5.00 V</span>
                      </div>
                    </>
                  )}

                  {selectedComp.kind === 'pushbutton' && (
                    <>
                      <div className="flex justify-between py-0.5">
                        <span className="font-mono text-zinc-400">Pin 1a / 1b:</span>
                        <span className="font-mono text-zinc-300">GND (Reference)</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="font-mono text-zinc-400">Pin 2a / 2b:</span>
                        <span className="font-mono text-zinc-100">
                          {isInspectorButtonPressed || selectedComp.props.pressed
                            ? '0.00 V (Active LOW)'
                            : '5.00 V (Pull-up Active)'}
                        </span>
                      </div>
                    </>
                  )}

                  {selectedComp.kind === 'led' && (() => {
                    const isLit = litLeds?.has(selectedComp.id);
                    const b = isLit ? (ledBrightness?.[selectedComp.id] ?? 1.0) : 0;
                    const estCurrentMa = isLit ? (b * 15).toFixed(1) : '0.0';
                    return (
                      <>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Emission:</span>
                          <span className={`font-mono font-semibold ${isLit ? 'text-emerald-400' : 'text-zinc-500'}`}>
                            {isLit ? `ON (${Math.round(b * 100)}%)` : 'OFF'}
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Current (est.):</span>
                          <span className="font-mono text-zinc-300">{estCurrentMa} mA</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Anode (+):</span>
                          <span className="font-mono text-zinc-300">Logic Drive</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Cathode (–):</span>
                          <span className="font-mono text-zinc-300">GND Return</span>
                        </div>
                      </>
                    );
                  })()}

                  {selectedComp.kind === 'resistor' && (
                    <div className="flex justify-between py-0.5">
                      <span className="font-mono text-zinc-400">Impedance:</span>
                      <span className="font-mono text-zinc-300">
                        {selectedComp.props.ohms || 220} Ω
                      </span>
                    </div>
                  )}

                  {selectedComp.kind === 'arduino_uno' && (
                    <div className="space-y-1">
                      <div className="flex justify-between py-0.5">
                        <span className="font-mono text-zinc-400">Pin 13 (SCK):</span>
                        <span className="font-mono text-zinc-300">Digital Out (LED)</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="font-mono text-zinc-400">Pin 2 (INT0):</span>
                        <span className="font-mono text-zinc-300">Digital In (Pullup)</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="font-mono text-zinc-400">Pin A0 (ADC0):</span>
                        <span className="font-mono text-zinc-300">Analog In (10-bit)</span>
                      </div>
                    </div>
                  )}

                  {selectedComp.kind === 'breadboard' && (
                    <div className="flex justify-between py-0.5">
                      <span className="font-mono text-zinc-400">Conductance:</span>
                      <span className="font-mono text-zinc-300">0.05 Ω Spring Clip</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* State 3: Wire Selected */}
        {selectedWire && (
          <div className="divide-y divide-[#1f1f23] animate-in fade-in duration-100">
            {/* Endpoints */}
            <div className="pb-3 space-y-1 text-xs">
              <span className="text-zinc-500 uppercase tracking-wider text-[11px] font-semibold block mb-1">
                Endpoints
              </span>
              <div className="flex justify-between py-0.5">
                <span className="text-zinc-500">Source:</span>
                <span className="font-mono text-zinc-200">
                  {selectedWire.fromComp}:{selectedWire.fromPin}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-zinc-500">Target:</span>
                <span className="font-mono text-zinc-200">
                  {selectedWire.toComp}:{selectedWire.toPin}
                </span>
              </div>
            </div>

            {/* Wire Color */}
            <div className="py-3 space-y-1.5">
              <span className="text-zinc-500 uppercase tracking-wider text-[11px] font-semibold block">
                Color
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
                    className={`w-5 h-5 rounded-full border transition-transform hover:scale-115 ${
                      selectedWire.color === c ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Routing Style */}
            <div className="py-3 space-y-1.5">
              <span className="text-zinc-500 uppercase tracking-wider text-[11px] font-semibold block">
                Routing Mode
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateWire(selectedWire.id, { routingMode: 'ortho' })}
                  className={`flex-1 h-6.5 px-2 flex items-center justify-center gap-1.5 rounded border text-xs transition-colors ${
                    selectedWire.routingMode === 'ortho'
                      ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                      : 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200'
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
                      : 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Spline className="w-3.5 h-3.5" />
                  <span>Curve</span>
                </button>
              </div>
            </div>

            {/* Waypoints */}
            {selectedWire.waypoints && selectedWire.waypoints.length > 0 && (
              <div className="py-3 flex items-center justify-between text-xs">
                <span className="text-zinc-500">Waypoints</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-zinc-200">
                    {selectedWire.waypoints.length} pts
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

            {/* Delete Wire */}
            <div className="pt-3">
              <button
                type="button"
                onClick={() => onDeleteWire(selectedWire.id)}
                className="w-full h-7 px-2 bg-red-950/20 hover:bg-red-900/30 text-red-400 hover:text-red-300 border border-red-900/40 rounded flex items-center justify-center gap-1.5 transition-colors text-xs cursor-pointer"
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
