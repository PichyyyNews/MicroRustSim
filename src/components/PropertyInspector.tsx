import React, { useState, useRef } from 'react';
import {
  GoTrash,
  GoCheck,
  GoChevronDown,
  GoChevronRight,
  GoAlert,
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
import { Badge } from './ui/badge';
import { CircuitComponent, CircuitWire, CircuitFault } from '../types';

export interface PropertyInspectorProps {
  selectedCompId: string | null;
  selectedWireId: string | null;
  components: CircuitComponent[];
  wires: CircuitWire[];
  litLeds?: Set<string>;
  ledBrightness?: Record<string, number>;
  pinVoltages?: Record<string, number>;
  branchCurrents?: Record<string, number>;
  circuitFaults?: CircuitFault[];
  damagedComponents?: Set<string>;
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
  const safeOhms = typeof ohms === 'number' && !isNaN(ohms) && ohms > 0 ? ohms : 220;
  const val = Math.max(1, Math.round(safeOhms));
  const s = val.toString();
  const d1 = parseInt(s[0], 10) || 1;
  const d2 = s.length > 1 ? (parseInt(s[1], 10) || 0) : 0;
  const multiplier = Math.max(0, s.length - 2);

  const b1 = RESISTOR_COLOR_CODES[d1]?.hex || '#8b4513';
  const b2 = RESISTOR_COLOR_CODES[d2]?.hex || '#000000';
  const b3 = RESISTOR_COLOR_CODES[multiplier]?.hex || '#8b4513';
  const b4 = '#d97706'; // Gold (5%)
  return [b1, b2, b3, b4];
}

export interface LedColorPreset {
  name: string;
  hex: string;
  vf: number;
  minVf: number;
  maxVf: number;
  presets: number[];
}

// Physical semiconductor bandgap limits strictly enforced:
// Red/Orange/Yellow: <= 2.4V (standard default 2.2V for Red)
// Green: 2.0V - 3.2V
// Blue/White: 3.0V - 3.4V
const LED_PRESET_COLORS: LedColorPreset[] = [
  { name: 'Red', hex: '#ef4444', vf: 2.2, minVf: 1.6, maxVf: 2.4, presets: [1.8, 2.0, 2.2, 2.4] },
  { name: 'Orange', hex: '#f97316', vf: 2.0, minVf: 1.6, maxVf: 2.4, presets: [1.8, 2.0, 2.2, 2.4] },
  { name: 'Yellow', hex: '#eab308', vf: 2.1, minVf: 1.6, maxVf: 2.4, presets: [1.8, 2.0, 2.1, 2.3] },
  { name: 'Green', hex: '#22c55e', vf: 2.2, minVf: 2.0, maxVf: 3.2, presets: [2.0, 2.2, 2.8, 3.2] },
  { name: 'Blue', hex: '#3b82f6', vf: 3.2, minVf: 3.0, maxVf: 3.4, presets: [3.0, 3.2, 3.4] },
  { name: 'White', hex: '#f8fafc', vf: 3.2, minVf: 3.0, maxVf: 3.4, presets: [3.0, 3.2, 3.4] },
];

function getLedColorConfig(colorHexOrName?: string): LedColorPreset {
  if (!colorHexOrName) return LED_PRESET_COLORS[0];
  const norm = colorHexOrName.toLowerCase().trim();
  return (
    LED_PRESET_COLORS.find(
      (c) => c.hex.toLowerCase() === norm || c.name.toLowerCase() === norm
    ) || LED_PRESET_COLORS[0]
  );
}

function formatTimeConstant(tau: number): string {
  if (tau >= 1.0) return `${tau.toFixed(2)}\u00A0s`;
  if (tau >= 1e-3) return `${(tau * 1e3).toFixed(1)}\u00A0ms`;
  if (tau >= 1e-6) return `${(tau * 1e6).toFixed(1)}\u00A0µs`;
  return `${(tau * 1e9).toFixed(1)}\u00A0ns`;
}

function formatStoredCharge(coulombs: number): string {
  if (coulombs >= 1e-3) return `${(coulombs * 1e3).toFixed(2)}\u00A0mC`;
  if (coulombs >= 1e-6) return `${(coulombs * 1e6).toFixed(2)}\u00A0µC`;
  if (coulombs >= 1e-9) return `${(coulombs * 1e9).toFixed(2)}\u00A0nC`;
  return `${(coulombs * 1e12).toFixed(1)}\u00A0pC`;
}

function formatStoredEnergy(joules: number): string {
  if (joules >= 1.0) return `${joules.toFixed(3)}\u00A0J`;
  if (joules >= 1e-3) return `${(joules * 1e3).toFixed(2)}\u00A0mJ`;
  if (joules >= 1e-6) return `${(joules * 1e6).toFixed(2)}\u00A0µJ`;
  if (joules >= 1e-9) return `${(joules * 1e9).toFixed(2)}\u00A0nJ`;
  return `${(joules * 1e12).toFixed(1)}\u00A0pJ`;
}

function formatPower(watts: number): string {
  if (watts >= 1.0) return `${watts.toFixed(2)}\u00A0W`;
  if (watts >= 1e-3) return `${(watts * 1e3).toFixed(1)}\u00A0mW`;
  if (watts >= 1e-6) return `${(watts * 1e6).toFixed(1)}\u00A0µW`;
  return `0.0\u00A0mW`;
}

function calculateCapacitorTimeConstant(
  capComp: CircuitComponent,
  allComponents: CircuitComponent[],
  allWires: CircuitWire[]
): { req: number | null; tau: number | null; sourceDescription: string | null } {
  const cap = typeof capComp.props?.capacitance === 'number' ? capComp.props.capacitance : 10e-6;

  const connectedWires = allWires.filter(
    (w) =>
      (w.fromComp === capComp.id && (w.fromPin === '1' || w.fromPin === '2')) ||
      (w.toComp === capComp.id && (w.toPin === '1' || w.toPin === '2'))
  );

  let detectedR: number | null = null;
  let sourceDesc: string | null = null;

  for (const wire of connectedWires) {
    const isFrom = wire.fromComp === capComp.id;
    const targetCompId = isFrom ? wire.toComp : wire.fromComp;
    const targetComp = allComponents.find((c) => c.id === targetCompId);

    if (targetComp) {
      if (targetComp.kind === 'resistor') {
        const ohms = typeof targetComp.props?.ohms === 'number' ? targetComp.props.ohms : 220;
        detectedR = (detectedR || 0) + ohms;
        sourceDesc = `${targetComp.id}\u00A0(${ohms}\u00A0Ω)`;
      } else if (targetComp.kind === 'potentiometer') {
        const totalR = typeof targetComp.props?.total_resistance_ohms === 'number' ? targetComp.props.total_resistance_ohms : 10000;
        const val = typeof targetComp.props?.value === 'number' ? targetComp.props.value : 0.5;
        const rEff = Math.max(1, Math.round(totalR * val));
        detectedR = (detectedR || 0) + rEff;
        sourceDesc = `${targetComp.id}\u00A0(~${rEff}\u00A0Ω)`;
      } else if (targetComp.kind === 'arduino_uno') {
        const pinName = isFrom ? wire.toPin : wire.fromPin;
        if (pinName === '5V') {
          detectedR = (detectedR || 0) + 1.0;
          sourceDesc = '5V\u00A0Rail\u00A0(R_int\u00A0~1.0\u00A0Ω)';
        } else if (!pinName.startsWith('GND')) {
          detectedR = (detectedR || 0) + 30.0;
          sourceDesc = `GPIO\u00A0${pinName}\u00A0(R_out\u00A0~30\u00A0Ω)`;
        }
      }
    }
  }

  if (detectedR !== null && detectedR > 0) {
    return {
      req: detectedR,
      tau: detectedR * cap,
      sourceDescription: sourceDesc,
    };
  }

  return { req: null, tau: null, sourceDescription: null };
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  selectedCompId,
  selectedWireId,
  components,
  wires,
  litLeds,
  ledBrightness,
  pinVoltages,
  branchCurrents,
  circuitFaults,
  damagedComponents,
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
    diagnostics: true,
    identity: true,
    transform: true,
    specs: true,
    pins: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [isInspectorButtonPressed, setIsInspectorButtonPressed] = useState(false);

  // Display value smoothing (EMA + Fast Slew Bypass) for steady readable telemetry in realistic mode
  const smoothedTelemetryRef = useRef<Record<string, number>>({});
  const smoothVal = (key: string, val: number | undefined, threshold = 0.15, alpha = 0.15): number => {
    if (typeof val !== 'number' || isNaN(val)) return 0.0;
    const prev = smoothedTelemetryRef.current[key];
    if (prev === undefined || Math.abs(val - prev) > threshold) {
      smoothedTelemetryRef.current[key] = val;
      return val;
    }
    const next = prev * (1 - alpha) + val * alpha;
    smoothedTelemetryRef.current[key] = next;
    return next;
  };

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
            {/* Component Diagnostics & Physical Health */}
            {(() => {
              const isDamaged = Boolean(
                selectedComp.props?.is_damaged ||
                selectedComp.props?.is_blown ||
                damagedComponents?.has(selectedComp.id)
              );
              const compFaults = (circuitFaults || []).filter(
                (f) =>
                  f.component_id === selectedComp.id ||
                  (selectedComp.kind === 'arduino_uno' &&
                    (f.component_id.toLowerCase().includes('uno') ||
                      f.component_id.toLowerCase().includes('mcu') ||
                      f.component_id.toLowerCase().includes('arduino')))
              );

              return (
                <div className="pb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <GoAlert className={`w-3.5 h-3.5 ${isDamaged ? 'text-red-400' : compFaults.length > 0 ? 'text-amber-400' : 'text-emerald-500'}`} />
                      <span>Diagnostics</span>
                    </span>
                    {isDamaged ? (
                      <Badge variant="outline" className="border-red-500/60 text-red-400 bg-red-950/40 text-[10px] font-mono whitespace-nowrap shrink-0 [word-break:keep-all]">
                        DAMAGED&nbsp;•&nbsp;BLOWN
                      </Badge>
                    ) : compFaults.length > 0 ? (
                      <Badge variant="outline" className="border-amber-500/60 text-amber-300 bg-amber-950/40 text-[10px] font-mono whitespace-nowrap shrink-0 [word-break:keep-all]">
                        {compFaults.length}&nbsp;ACTIVE&nbsp;FAULT{compFaults.length > 1 ? 'S' : ''}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-600/40 text-emerald-400 bg-emerald-950/20 text-[10px] font-mono whitespace-nowrap shrink-0 [word-break:keep-all]">
                        HEALTHY
                      </Badge>
                    )}
                  </div>

                  {/* Damaged Alert Box */}
                  {isDamaged && (
                    <div className="bg-red-950/30 border border-red-500/50 rounded-xl p-3 space-y-1.5 animate-in fade-in duration-100">
                      <div className="flex items-center gap-1.5 text-red-400 font-semibold text-xs">
                        <GoAlert className="w-4 h-4 shrink-0 text-red-400" />
                        <span>Blown Open Circuit (ชิ้นส่วนเสียหายถาวร)</span>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">
                        {selectedComp.kind === 'led'
                          ? 'LED ไม่มีตัวต้านทานจำกัดกระแส ความร้อนสะสมจากกระแสเกิน Max Current ทำลายรอยต่อสารกึ่งตัวนำจนขาดเป็นวงจรเปิดถาวร'
                          : selectedComp.kind === 'capacitor'
                          ? 'ตัวเก็บประจุเสียหายถาวร (Breakdown Failure) จากแรงดันเกินพิกัด หรือต่ออิเล็กทรอไลต์กลับขั้วเป็นเวลานานจนไดอิเล็กทริกทะลุ'
                          : selectedComp.kind === 'resistor'
                          ? 'ตัวต้านทานเกิดความร้อนสะสมเกินพิกัด 0.25 W อย่างต่อเนื่องจนขดลวด/ฟิล์มต้านทานไหม้ขาด'
                          : 'อุปกรณ์ได้รับความเสียหายทางกายภาพอย่างถาวร กลายเป็นวงจรเปิด ไม่นำกระแสไฟฟ้า'}
                      </p>
                      <div className="text-[10px] text-zinc-400 font-mono pt-1 border-t border-red-900/40">
                        วิธีแก้ไข: กด Reset MCU เพื่อเปลี่ยนอุปกรณ์และเริ่มการจำลองใหม่
                      </div>
                    </div>
                  )}

                  {/* Active Electrical Limit Faults with Educational Explanations */}
                  {compFaults.map((f, idx) => (
                    <div key={idx} className="bg-amber-950/25 border border-amber-500/40 rounded-xl p-2.5 space-y-1.5 animate-in fade-in duration-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                          <GoAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            {f.fault_type === 'ShortCircuit'
                              ? 'ลัดวงจร (Short Circuit)'
                              : f.fault_type === 'Overcurrent'
                              ? 'กระแสเกิน (Overcurrent)'
                              : 'ต่อกลับขั้ว (Reverse Polarity)'}
                          </span>
                        </span>
                        <Badge variant="outline" className="border-amber-600/40 text-amber-300 font-mono text-[10px] whitespace-nowrap shrink-0 [word-break:keep-all]">
                          Pin&nbsp;{f.pin_name}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-zinc-200 leading-relaxed font-mono">
                        {f.description}
                      </p>
                      <div className="text-[10px] text-amber-200/90 leading-relaxed pt-1 border-t border-amber-900/30">
                        {selectedComp.kind === 'led' && f.fault_type === 'Overcurrent' && (
                          <span>คำอธิบายฟิสิกส์: LED ไม่มีตัวต้านทานจำกัดกระแส (Current-Limiting Resistor) เมื่อแรงดันสูงกว่า Vf เล็กน้อย กระแสจะพุ่งสูงแบบเอกซ์โพเนนเชียลตามสมการ Shockley ทำให้เกิดความเสียหาย</span>
                        )}
                        {selectedComp.kind === 'capacitor' && f.fault_type === 'ReversePolarity' && (
                          <span>คำอธิบายฟิสิกส์: ตัวเก็บประจุอิเล็กทรอไลต์ต่อกลับขั้ว ชั้นฉนวนออกไซด์ Al₂O₃ จะสลายตัวเมื่อมีแรงดันย้อนกลับ ทำให้กระแสรั่วไหลพุ่งสูงอย่างรวดเร็วและระเบิด</span>
                        )}
                        {selectedComp.kind === 'capacitor' && f.fault_type === 'Overcurrent' && (
                          <span>คำอธิบายฟิสิกส์: แรงดันตกคร่อมสูงเกินพิกัดฉนวนไดอิเล็กทริก (Dielectric Breakdown)</span>
                        )}
                        {selectedComp.kind === 'arduino_uno' && f.fault_type === 'ShortCircuit' && (
                          <span>คำอธิบายฟิสิกส์: รางไฟ 5V ลัดวงจรลง GND โดยตรง กระแสพุ่งเกิน 500mA ฟิวส์รีเซ็ตได้ (PTC Polyfuse) ทำงานและตัดไฟเพื่อความปลอดภัย</span>
                        )}
                        {selectedComp.kind === 'arduino_uno' && f.fault_type === 'Overcurrent' && (
                          <span>คำอธิบายฟิสิกส์: ขา GPIO จ่าย/ดึงกระแสเกิน Absolute Maximum Rating (40mA ต่อขา หรือ 200mA รวม) เสี่ยงต่อความเสียหายของทรานซิสเตอร์ภายในชิป</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Section 1: Identity */}
            <div className="pb-3">
              <button
                type="button"
                onClick={() => toggleSection('identity')}
                className="w-full py-1 flex items-center justify-between text-zinc-400 hover:text-zinc-200 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
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
                <div className="mt-2 bg-[#1c1c20] border border-zinc-800/60 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-xs">Instance ID</span>
                    <span className="font-mono text-zinc-100 font-semibold">{selectedComp.id}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800/40">
                    <span className="text-zinc-400 text-xs">Class</span>
                    <span className="font-mono text-zinc-200 capitalize">
                      {selectedComp.kind.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Transform */}
            <div className="py-2">
              <button
                type="button"
                onClick={() => toggleSection('transform')}
                className="w-full py-1 flex items-center justify-between text-zinc-400 hover:text-zinc-200 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
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
                <div className="mt-2 bg-[#1c1c20] border border-zinc-800/60 rounded-xl p-3 space-y-3 text-xs">
                  {/* Position */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-xs">Position</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1.5 bg-[#141416] border border-zinc-800 rounded-lg px-2 h-7 focus-within:border-zinc-600 transition-colors">
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
                      <div className="flex items-center gap-1.5 bg-[#141416] border border-zinc-800 rounded-lg px-2 h-7 focus-within:border-zinc-600 transition-colors">
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
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800/40">
                    <span className="text-zinc-400 text-xs">Orientation</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title="Rotate 90° Clockwise"
                        onClick={() =>
                          onUpdateComponent(selectedComp.id, {
                            rotation: (((selectedComp.rotation || 0) + 90) % 360),
                          })
                        }
                        className="h-6 px-2.5 flex items-center gap-1 bg-[#141416] hover:bg-[#222226] border border-zinc-800 rounded-full text-zinc-300 transition-colors cursor-pointer"
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
                        className={`h-6 px-2.5 flex items-center gap-1 rounded-full border text-[11px] transition-colors cursor-pointer ${
                          selectedComp.flipped
                            ? 'bg-zinc-200 border-white text-zinc-950 font-semibold shadow-xs'
                            : 'bg-[#141416] hover:bg-[#222226] border-zinc-800 text-zinc-400'
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
            <div className="py-2">
              <button
                type="button"
                onClick={() => toggleSection('specs')}
                className="w-full py-1 flex items-center justify-between text-zinc-400 hover:text-zinc-200 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
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
                <div className="mt-2 bg-[#1c1c20] border border-zinc-800/60 rounded-xl p-3 space-y-3 text-xs">
                  {/* Potentiometer */}
                  {selectedComp.kind === 'potentiometer' && (() => {
                    const rawVal = selectedComp.props?.value;
                    const parsed = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal));
                    const wiperVal = isNaN(parsed) ? 0.5 : parsed > 1.0 ? 0.5 : Math.max(0, Math.min(1, parsed));
                    const totalTrackOhms = typeof selectedComp.props?.ohms === 'number' && selectedComp.props.ohms > 0
                      ? selectedComp.props.ohms
                      : 10000;
                    const percent = Math.round(wiperVal * 100);
                    const r12 = wiperVal * totalTrackOhms;
                    const r23 = (1.0 - wiperVal) * totalTrackOhms;

                    const formatR = (ohms: number) => {
                      if (ohms >= 1000) return `${(ohms / 1000).toFixed(1)}\u00A0kΩ`;
                      return `${Math.round(ohms)}\u00A0Ω`;
                    };

                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-xs">Wiper Ratio</span>
                          <Badge
                            variant="outline"
                            className="font-mono text-[11px] h-5 px-2 border-zinc-700 text-zinc-200 tabular-nums whitespace-nowrap [word-break:keep-all] shrink-0"
                          >
                            {percent}%&nbsp;({formatR(r12)}&nbsp;/&nbsp;{formatR(r23)})
                          </Badge>
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
                                props: { ...(selectedComp.props || {}), value: val },
                              });
                            }}
                            className="w-full accent-white h-1.5 bg-[#121215] rounded-full cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] font-mono text-zinc-500 tabular-nums">
                            <span>0% (0&nbsp;Ω)</span>
                            <span>R1-2: {formatR(r12)}</span>
                            <span>100% ({formatR(totalTrackOhms)})</span>
                          </div>
                        </div>

                        {/* Flat Preset Pills */}
                        <div className="grid grid-cols-5 gap-1 text-[10px] font-mono pt-1">
                          {[
                            { ratio: 0, label: '0%' },
                            { ratio: 0.25, label: '25%' },
                            { ratio: 0.5, label: '50%' },
                            { ratio: 0.75, label: '75%' },
                            { ratio: 1.0, label: '100%' },
                          ].map(({ ratio, label }) => (
                            <button
                              key={ratio}
                              type="button"
                              onClick={() =>
                                onUpdateComponent(selectedComp.id, {
                                  props: { ...(selectedComp.props || {}), value: ratio },
                                })
                              }
                              className={`h-5.5 rounded-full border transition-colors cursor-pointer flex items-center justify-center tabular-nums ${
                                Math.abs(wiperVal - ratio) < 0.05
                                  ? 'bg-white border-white text-zinc-950 font-semibold shadow-xs'
                                  : 'bg-[#141416] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/40">
                          <span className="text-zinc-400 text-xs">Total Track</span>
                          <span className="font-mono text-zinc-300 tabular-nums whitespace-nowrap [word-break:keep-all] shrink-0">
                            {formatR(totalTrackOhms)} (Linear B)
                          </span>
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
                            isInspectorButtonPressed || Boolean(selectedComp.props?.pressed)
                              ? 'bg-amber-950/40 text-amber-300 font-semibold'
                              : 'bg-zinc-800/60 text-zinc-400'
                          }`}
                        >
                          {isInspectorButtonPressed || Boolean(selectedComp.props?.pressed)
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
                            props: { ...(selectedComp.props || {}), pressed: true },
                          });
                        }}
                        onMouseUp={() => {
                          setIsInspectorButtonPressed(false);
                          onButtonPress?.(selectedComp.id, false);
                          onUpdateComponent(selectedComp.id, {
                            props: { ...(selectedComp.props || {}), pressed: false },
                          });
                        }}
                        onMouseLeave={() => {
                          if (isInspectorButtonPressed) {
                            setIsInspectorButtonPressed(false);
                            onButtonPress?.(selectedComp.id, false);
                            onUpdateComponent(selectedComp.id, {
                              props: { ...(selectedComp.props || {}), pressed: false },
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
                    const currentOhms = typeof selectedComp.props?.ohms === 'number' ? selectedComp.props.ohms : (parseInt(selectedComp.props?.ohms, 10) || 220);
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
                                  props: { ...(selectedComp.props || {}), ohms },
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
                                  props: { ...(selectedComp.props || {}), ohms: preset },
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

                  {/* Capacitor */}
                  {selectedComp.kind === 'capacitor' && (() => {
                    const cap = typeof selectedComp.props?.capacitance === 'number' ? selectedComp.props.capacitance : 10e-6;
                    const isPolarized = Boolean(selectedComp.props?.polarized);
                    const rating = typeof selectedComp.props?.voltageRating === 'number' ? selectedComp.props.voltageRating : (isPolarized ? 25 : 50);

                    const formatCapVal = (c: number): string => {
                      if (c >= 1e-3) return `${(c * 1e3).toFixed(0)}mF`;
                      if (c >= 1e-6) return `${(c * 1e6).toFixed(0)}µF`;
                      if (c >= 1e-9) return `${(c * 1e9).toFixed(0)}nF`;
                      return `${(c * 1e12).toFixed(0)}pF`;
                    };

                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Capacitance</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-zinc-200">{formatCapVal(cap)}</span>
                          </div>
                        </div>

                        {/* Presets */}
                        <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono pt-0.5">
                          <span className="text-zinc-500 mr-0.5">Presets:</span>
                          {[
                            { label: '100nF', val: 100e-9, pol: false },
                            { label: '1µF', val: 1e-6, pol: false },
                            { label: '10µF', val: 10e-6, pol: true },
                            { label: '100µF', val: 100e-6, pol: true },
                            { label: '470µF', val: 470e-6, pol: true },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() =>
                                onUpdateComponent(selectedComp.id, {
                                  props: {
                                    ...(selectedComp.props || {}),
                                    capacitance: preset.val,
                                    polarized: preset.pol,
                                  },
                                })
                              }
                              className={`px-1.5 py-0.5 rounded border transition-colors ${
                                Math.abs(cap - preset.val) < 1e-12
                                  ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                                  : 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        {/* Polarity Type */}
                        <div className="flex items-center justify-between py-1">
                          <span className="text-zinc-500">Type</span>
                          <div className="flex items-center gap-1 bg-[#121215] border border-zinc-800 rounded-full p-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateComponent(selectedComp.id, {
                                  props: { ...(selectedComp.props || {}), polarized: false, voltageRating: 50 },
                                })
                              }
                              className={`h-5 px-2 rounded-full text-[10px] transition-colors cursor-pointer ${
                                !isPolarized
                                  ? 'bg-white text-zinc-950 font-semibold shadow-xs'
                                  : 'text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              Ceramic
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateComponent(selectedComp.id, {
                                  props: { ...(selectedComp.props || {}), polarized: true, voltageRating: 25 },
                                })
                              }
                              className={`h-5 px-2 rounded-full text-[10px] transition-colors cursor-pointer ${
                                isPolarized
                                  ? 'bg-white text-zinc-950 font-semibold shadow-xs'
                                  : 'text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              Electrolytic (+/-)
                            </button>
                          </div>
                        </div>

                        {/* Voltage Rating */}
                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-zinc-500">Max Rating</span>
                          <span className="font-mono text-zinc-300">{rating}&nbsp;V</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* LED */}
                  {selectedComp.kind === 'led' && (() => {
                    const ledColor = selectedComp.props?.color || '#ef4444';
                    const ledColorCfg = getLedColorConfig(ledColor);
                    const currentVf = typeof selectedComp.props?.vf === 'number' ? selectedComp.props.vf : ledColorCfg.vf;

                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Color</span>
                          <div className="flex items-center gap-1.5">
                            {LED_PRESET_COLORS.map((p) => {
                              const isSelected = ledColor.toLowerCase() === p.hex.toLowerCase() || ledColor.toLowerCase() === p.name.toLowerCase();
                              return (
                                <button
                                  key={p.name}
                                  type="button"
                                  title={`${p.name} (Vf: ${p.vf}\u00A0V, max ${p.maxVf}\u00A0V)`}
                                  onClick={() =>
                                    onUpdateComponent(selectedComp.id, {
                                      props: {
                                        ...(selectedComp.props || {}),
                                        color: p.hex,
                                        vf: p.vf, // Synchronize Vf to default of newly selected color
                                      },
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

                        {/* Interactive Forward Drop (Vf) strictly bound to semiconductor bandgap limits */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-zinc-500">Forward Drop (Vf)</span>
                              <div className="text-[10px] text-zinc-500 font-mono">
                                Bandgap limit: {ledColorCfg.minVf.toFixed(1)}–{ledColorCfg.maxVf.toFixed(1)}&nbsp;V
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={ledColorCfg.minVf}
                                max={ledColorCfg.maxVf}
                                step="0.05"
                                value={currentVf}
                                onChange={(e) => {
                                  const parsed = parseFloat(e.target.value);
                                  const safe = isNaN(parsed) ? ledColorCfg.vf : parsed;
                                  const clamped = Math.max(ledColorCfg.minVf, Math.min(ledColorCfg.maxVf, safe));
                                  onUpdateComponent(selectedComp.id, {
                                    props: { ...(selectedComp.props || {}), vf: clamped },
                                  });
                                }}
                                className="w-16 h-6 px-1.5 bg-[#18181b] border border-[#27272a] rounded text-right font-mono text-xs text-zinc-100 focus:border-zinc-500 outline-none"
                              />
                              <span className="text-zinc-400 font-mono text-[11px] whitespace-nowrap [word-break:keep-all]">&nbsp;V</span>
                            </div>
                          </div>

                          {/* Quick Vf Presets strictly filtered by semiconductor physics (eliminating invalid 3.2V on Red) */}
                          <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                            <span className="text-zinc-500 mr-0.5">Presets:</span>
                            {ledColorCfg.presets.map((presetVf) => (
                              <button
                                key={presetVf}
                                type="button"
                                onClick={() =>
                                  onUpdateComponent(selectedComp.id, {
                                    props: { ...(selectedComp.props || {}), vf: presetVf },
                                  })
                                }
                                className={`px-1.5 py-0.5 rounded border transition-colors whitespace-nowrap [word-break:keep-all] ${
                                  Math.abs(currentVf - presetVf) < 0.01
                                    ? 'bg-zinc-800 border-zinc-500 text-white font-medium'
                                    : 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                {presetVf.toFixed(1)}&nbsp;V
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-zinc-500">Max Current</span>
                          <span className="font-mono text-zinc-300 tabular-nums whitespace-nowrap [word-break:keep-all]">20&nbsp;mA</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Text Label Controls */}
                  {selectedComp.kind === 'text_label' && (
                    <div className="space-y-3">
                      {/* Text Input */}
                      <div className="space-y-1">
                        <span className="text-zinc-500">Label Text</span>
                        <input
                          type="text"
                          value={selectedComp.props?.text ?? 'Text Label'}
                          onChange={(e) =>
                            onUpdateComponent(selectedComp.id, {
                              props: { ...(selectedComp.props || {}), text: e.target.value },
                            })
                          }
                          className="w-full h-7 px-2 bg-[#18181b] border border-[#27272a] rounded text-xs text-zinc-100 focus:border-zinc-500 outline-none"
                        />
                      </div>

                      {/* Font Family */}
                      <div className="space-y-1">
                        <span className="text-zinc-500">Font Family</span>
                        <select
                          value={selectedComp.props?.fontFamily ?? 'Inter, sans-serif'}
                          onChange={(e) =>
                            onUpdateComponent(selectedComp.id, {
                              props: { ...(selectedComp.props || {}), fontFamily: e.target.value },
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
                            value={selectedComp.props?.fontSize ?? 16}
                            onChange={(e) =>
                              onUpdateComponent(selectedComp.id, {
                                props: {
                                  ...(selectedComp.props || {}),
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
                                props: { ...(selectedComp.props || {}), bold: !selectedComp.props?.bold },
                              })
                            }
                            className={`w-6 h-6 rounded border font-bold text-xs transition-colors ${
                              selectedComp.props?.bold
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
                                props: { ...(selectedComp.props || {}), italic: !selectedComp.props?.italic },
                              })
                            }
                            className={`w-6 h-6 rounded border italic text-xs transition-colors ${
                              selectedComp.props?.italic
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
                                props: { ...(selectedComp.props || {}), underline: !selectedComp.props?.underline },
                              })
                            }
                            className={`w-6 h-6 rounded border underline text-xs transition-colors ${
                              selectedComp.props?.underline
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
                                  props: { ...(selectedComp.props || {}), color: c },
                                })
                              }
                              className={`w-5 h-5 rounded-full border transition-transform hover:scale-115 ${
                                (selectedComp.props?.color || '#f4f4f5') === c
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
                            value={selectedComp.props?.comPort || selectedComp.props?.port || 'COM1'}
                            onChange={(e) =>
                              onUpdateComponent(selectedComp.id, {
                                props: { ...(selectedComp.props || {}), comPort: e.target.value },
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
                  {selectedComp.kind === 'potentiometer' && (() => {
                    const rawV1 = pinVoltages?.[`${selectedComp.id}:1`];
                    const rawV2 = pinVoltages?.[`${selectedComp.id}:2`];
                    const rawV3 = pinVoltages?.[`${selectedComp.id}:3`];
                    const rawIComp = branchCurrents?.[selectedComp.id];
                    const v1 = smoothVal(`${selectedComp.id}:1`, rawV1);
                    const v2 = smoothVal(`${selectedComp.id}:2`, rawV2);
                    const v3 = smoothVal(`${selectedComp.id}:3`, rawV3);
                    const iComp = smoothVal(`${selectedComp.id}:i`, rawIComp, 0.0003);
                    const vDrop = Math.abs(v1 - v3);
                    const pPot = vDrop * Math.abs(iComp);
                    const val = typeof selectedComp.props?.value === 'number' ? selectedComp.props.value : 0.5;

                    return (
                      <>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Pin 1 (Terminal A):</span>
                          <span className="font-mono text-zinc-300 tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {typeof rawV1 === 'number' ? v1.toFixed(2) : '0.00'}&nbsp;V
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Pin 2 (Wiper W):</span>
                          <span className="font-mono text-zinc-100 font-semibold tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {typeof rawV2 === 'number' ? v2.toFixed(2) : '0.00'}&nbsp;V
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Pin 3 (Terminal B):</span>
                          <span className="font-mono text-zinc-300 tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {typeof rawV3 === 'number' ? v3.toFixed(2) : '0.00'}&nbsp;V
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5 pt-1 border-t border-zinc-800/40">
                          <span className="font-mono text-zinc-400">Wiper Position:</span>
                          <span className="font-mono text-zinc-200 tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {(val * 100).toFixed(1)}&nbsp;%
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Track Current (I):</span>
                          <span className="font-mono text-emerald-400 font-semibold tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {(Math.abs(iComp) * 1000).toFixed(1)}&nbsp;mA
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Power Dissipation (P):</span>
                          <span className="font-mono text-zinc-300 tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {formatPower(pPot)}
                          </span>
                        </div>
                      </>
                    );
                  })()}

                  {selectedComp.kind === 'pushbutton' && (() => {
                    const isPressed = isInspectorButtonPressed || Boolean(selectedComp.props?.pressed);
                    const rawV1 = pinVoltages?.[`${selectedComp.id}:1a`] ?? pinVoltages?.[`${selectedComp.id}:1`];
                    const rawV2 = pinVoltages?.[`${selectedComp.id}:2a`] ?? pinVoltages?.[`${selectedComp.id}:2`];
                    const v1 = smoothVal(`${selectedComp.id}:1a`, rawV1);
                    const v2 = smoothVal(`${selectedComp.id}:2a`, rawV2);

                    return (
                      <>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Pin 1a / 1b:</span>
                          <span className="font-mono text-zinc-300 tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {typeof rawV1 === 'number' ? v1.toFixed(2) : '0.00'}&nbsp;V
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Pin 2a / 2b:</span>
                          <span className="font-mono text-zinc-100 font-semibold tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {typeof rawV2 === 'number' ? v2.toFixed(2) : (isPressed ? '0.00' : '5.00')}&nbsp;V
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5 pt-1 border-t border-zinc-800/40">
                          <span className="font-mono text-zinc-400">Contact State:</span>
                          <span className={`font-mono font-semibold tabular-nums whitespace-nowrap [word-break:keep-all] ${isPressed ? 'text-emerald-400' : 'text-zinc-400'}`}>
                            {isPressed ? 'CLOSED (≤\u00A00.05\u00A0Ω)' : 'OPEN (≥\u00A0100\u00A0MΩ)'}
                          </span>
                        </div>
                      </>
                    );
                  })()}

                  {selectedComp.kind === 'led' && (() => {
                    const isLit = litLeds?.has(selectedComp.id);
                    const b = isLit ? (ledBrightness?.[selectedComp.id] ?? 1.0) : 0;
                    const rawVa = pinVoltages?.[`${selectedComp.id}:anode`] ?? pinVoltages?.[`${selectedComp.id}:1`];
                    const rawVc = pinVoltages?.[`${selectedComp.id}:cathode`] ?? pinVoltages?.[`${selectedComp.id}:2`];
                    const va = smoothVal(`${selectedComp.id}:va`, rawVa);
                    const vc = smoothVal(`${selectedComp.id}:vc`, rawVc);
                    const vd = Math.max(0, va - vc);
                    const rawI = branchCurrents?.[selectedComp.id];
                    const iComp = smoothVal(`${selectedComp.id}:i`, rawI, 0.0003);
                    const currentA = typeof rawI === 'number' ? Math.abs(rawI) : (isLit ? (b * 0.015) : 0.0);
                    const iMa = currentA * 1000;
                    const pWatts = vd * currentA;

                    return (
                      <>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Emission State:</span>
                          <span className={`font-mono font-semibold tabular-nums whitespace-nowrap [word-break:keep-all] ${isLit ? 'text-emerald-400' : 'text-zinc-500'}`}>
                            {isLit ? `ON (${Math.round(b * 100)}%)` : 'OFF'}
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Anode (+) Potential:</span>
                          <span className="font-mono text-zinc-300 tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {typeof rawVa === 'number' ? va.toFixed(2) : '0.00'}&nbsp;V
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Cathode (–) Potential:</span>
                          <span className="font-mono text-zinc-300 tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {typeof rawVc === 'number' ? vc.toFixed(2) : '0.00'}&nbsp;V
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5 pt-1 border-t border-zinc-800/40">
                          <span className="font-mono text-zinc-400">Voltage Drop (Vd):</span>
                          <span className="font-mono text-zinc-100 font-semibold tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {vd.toFixed(2)}&nbsp;V
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Forward Current (I):</span>
                          <span className={`font-mono font-semibold tabular-nums whitespace-nowrap [word-break:keep-all] ${iMa > 30.0 ? 'text-red-400' : iMa > 20.0 ? 'text-amber-400' : isLit ? 'text-emerald-400' : 'text-zinc-400'}`}>
                            {iMa.toFixed(1)}&nbsp;mA
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Power Dissipation (P = V*I):</span>
                          <span className="font-mono text-zinc-300 tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {formatPower(pWatts)}
                          </span>
                        </div>
                      </>
                    );
                  })()}

                  {selectedComp.kind === 'resistor' && (() => {
                    const ohms = typeof selectedComp.props?.ohms === 'number' ? selectedComp.props.ohms : 220;
                    const rawV1 = pinVoltages?.[`${selectedComp.id}:1`];
                    const rawV2 = pinVoltages?.[`${selectedComp.id}:2`];
                    const v1 = smoothVal(`${selectedComp.id}:1`, rawV1);
                    const v2 = smoothVal(`${selectedComp.id}:2`, rawV2);
                    const deltaV = Math.abs(v1 - v2);
                    const rawI = branchCurrents?.[selectedComp.id];
                    const iComp = smoothVal(`${selectedComp.id}:i`, rawI, 0.0003);
                    const currentA = typeof rawI === 'number' ? Math.abs(rawI) : (deltaV / ohms);
                    const currentMa = currentA * 1000;
                    const pWatts = deltaV * currentA;
                    const isOverpower = pWatts > 0.25;

                    return (
                      <>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Resistance (R):</span>
                          <span className="font-mono text-zinc-200 tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {ohms}&nbsp;Ω
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Lead 1 Potential:</span>
                          <span className="font-mono text-zinc-300 tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {typeof rawV1 === 'number' ? v1.toFixed(2) : '0.00'}&nbsp;V
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Lead 2 Potential:</span>
                          <span className="font-mono text-zinc-300 tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {typeof rawV2 === 'number' ? v2.toFixed(2) : '0.00'}&nbsp;V
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5 pt-1 border-t border-zinc-800/40">
                          <span className="font-mono text-zinc-400">Voltage Drop (ΔV):</span>
                          <span className="font-mono text-zinc-100 font-semibold tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {deltaV.toFixed(2)}&nbsp;V
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Branch Current (I):</span>
                          <span className="font-mono text-emerald-400 font-semibold tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {currentMa.toFixed(1)}&nbsp;mA
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Power Dissipation (P = V*I):</span>
                          <span className={`font-mono font-semibold tabular-nums whitespace-nowrap [word-break:keep-all] ${isOverpower ? 'text-red-400' : 'text-zinc-200'}`}>
                            {formatPower(pWatts)}
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Rated Power:</span>
                          <span className="font-mono text-zinc-400 tabular-nums whitespace-nowrap [word-break:keep-all]">
                            0.25&nbsp;W (250&nbsp;mW)
                          </span>
                        </div>
                      </>
                    );
                  })()}

                  {selectedComp.kind === 'capacitor' && (() => {
                    const rawV1 = pinVoltages?.[`${selectedComp.id}:1`];
                    const rawV2 = pinVoltages?.[`${selectedComp.id}:2`];
                    const rawI = branchCurrents?.[selectedComp.id];
                    const v1 = smoothVal(`${selectedComp.id}:1`, rawV1);
                    const v2 = smoothVal(`${selectedComp.id}:2`, rawV2);
                    const vc = v1 - v2;
                    const absVc = Math.abs(vc);
                    const iComp = smoothVal(`${selectedComp.id}:i`, rawI, 0.0003);
                    const cap = typeof selectedComp.props?.capacitance === 'number' ? selectedComp.props.capacitance : 10e-6;
                    const isPolarized = Boolean(selectedComp.props?.polarized);
                    const rating = typeof selectedComp.props?.voltageRating === 'number' ? selectedComp.props.voltageRating : (isPolarized ? 25 : 50);

                    // Physics Metrics:
                    // Stored Charge Q = C * |V|
                    const qCoulombs = cap * absVc;
                    // Stored Energy E = 0.5 * C * V^2
                    const energyJoules = 0.5 * cap * vc * vc;
                    // Power Dissipation P = |V * I|
                    const pWatts = absVc * Math.abs(iComp);
                    // Circuit Time Constant tau = Req * C
                    const tauInfo = calculateCapacitorTimeConstant(selectedComp, components, wires);

                    return (
                      <>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Pin 1 ({isPolarized ? 'Anode +' : 'Lead 1'}):</span>
                          <span className="font-mono text-zinc-300 tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {typeof rawV1 === 'number' ? v1.toFixed(2) : '0.00'}&nbsp;V
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Pin 2 ({isPolarized ? 'Cathode -' : 'Lead 2'}):</span>
                          <span className="font-mono text-zinc-300 tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {typeof rawV2 === 'number' ? v2.toFixed(2) : '0.00'}&nbsp;V
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5 pt-1 border-t border-zinc-800/40">
                          <span className="font-mono text-zinc-400">Capacitor Voltage (Vc):</span>
                          <span className="font-mono text-zinc-100 font-semibold tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {vc.toFixed(2)}&nbsp;V
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Capacitor Current (Ic):</span>
                          <span className="font-mono text-emerald-400 font-semibold tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {(Math.abs(iComp) * 1000).toFixed(1)}&nbsp;mA
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Power Dissipation (P = V*I):</span>
                          <span className="font-mono text-zinc-300 tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {formatPower(pWatts)}
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5 pt-1 border-t border-zinc-800/40">
                          <span className="font-mono text-zinc-400">Stored Charge (Q = C·V):</span>
                          <span className="font-mono text-zinc-100 font-semibold tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {formatStoredCharge(qCoulombs)}
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Stored Energy (E = ½C·V²):</span>
                          <span className="font-mono text-zinc-100 font-semibold tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {formatStoredEnergy(energyJoules)}
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-mono text-zinc-400">Time Constant (τ = R_eq·C):</span>
                          <span className="font-mono text-cyan-400 font-semibold tabular-nums whitespace-nowrap [word-break:keep-all]">
                            {tauInfo.tau !== null ? formatTimeConstant(tauInfo.tau) : 'Open Circuit (τ → ∞)'}
                          </span>
                        </div>
                        {tauInfo.sourceDescription && (
                          <div className="flex justify-between py-0.5 text-[11px] text-zinc-500">
                            <span className="font-mono">R_eq Path:</span>
                            <span className="font-mono text-zinc-400 tabular-nums whitespace-nowrap [word-break:keep-all]">{tauInfo.sourceDescription}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-0.5 text-[11px] text-zinc-500">
                          <span className="font-mono">Voltage Rating:</span>
                          <span className="font-mono text-zinc-400 tabular-nums whitespace-nowrap [word-break:keep-all]">{rating}&nbsp;V</span>
                        </div>
                      </>
                    );
                  })()}

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
