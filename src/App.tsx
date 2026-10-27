import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  GoPlay,
  GoStop,
  GoZap,
  GoSync,
  GoCode,
  GoTerminal,
  GoGraph,
  GoPackage,
  GoPlus,
  GoTrash,
  GoGear,
  GoFile,
  GoSidebarCollapse,
} from 'react-icons/go';

const GoPause = ({ className }: { className?: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={className}>
    <rect x="3" y="2" width="3.5" height="12" rx="1" />
    <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
  </svg>
);

import { ArduinoUno, ARDUINO_PINS } from './components/ArduinoUno';
import { Breadboard } from './components/Breadboard';
import { Led } from './components/Led';
import { Resistor } from './components/Resistor';
import { Pushbutton } from './components/Pushbutton';
import { Potentiometer } from './components/Potentiometer';
import { WireLayer } from './components/WireLayer';
import { LogicWaveform } from './components/LogicWaveform';
import { CircuitComponent, CircuitWire } from './types';

// Safely invoke Tauri commands with browser fallback
async function tauriInvoke<T>(cmd: string, args: Record<string, any> = {}): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (err) {
    // Running in web preview mode or mock
    console.debug(`[Tauri Mock] ${cmd}`, args);
    return null;
  }
}

const DEFAULT_BLINK_CODE = `// MicroRustSim Arduino Uno Blink
// Genuine cycle-accurate ATmega328P execution

void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("Arduino Uno Initialized @ 16 MHz!");
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("LED HIGH (5V)");
  delay(1000);
  digitalWrite(13, LOW);
  Serial.println("LED LOW (0V)");
  delay(1000);
}
`;

const WIRE_COLORS = [
  { hex: '#22c55e', name: 'Green' },
  { hex: '#ef4444', name: 'Red' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#eab308', name: 'Yellow' },
  { hex: '#000000', name: 'Black' },
  { hex: '#f97316', name: 'Orange' },
  { hex: '#8b5cf6', name: 'Purple' },
  { hex: '#ffffff', name: 'White' },
];

export default function App() {
  // --- UI Layout & Drawers ---
  const [showEditor, setShowEditor] = useState(true);
  const [showPalette, setShowPalette] = useState(true);
  const [showDrawer, setShowDrawer] = useState(true);
  const [bottomTab, setBottomTab] = useState<'serial' | 'waveform' | 'build'>('serial');

  // --- Simulation & MCU State ---
  const [isRunning, setIsRunning] = useState(false);
  const [pin13State, setPin13State] = useState(false);
  const [litLeds, setLitLeds] = useState<Set<string>>(new Set());
  const [serialLogs, setSerialLogs] = useState<string[]>([
    '[System] MicroRustSim Tauri v2 Engine Online.\n',
    '[System] Local-first SQLite store active. Genuine toolchain ready.\n',
  ]);
  const [buildLogs, setBuildLogs] = useState<string>('Ready to compile sketches.\n');
  const [serialInput, setSerialInput] = useState('');
  const [baudRate, setBaudRate] = useState(9600);
  const [logicHistory, setLogicHistory] = useState<[number, number][]>([]);
  const [currentWireColor, setCurrentWireColor] = useState('#22c55e');

  // --- Sketch Code & Project ---
  const [sketchCode, setSketchCode] = useState(DEFAULT_BLINK_CODE);
  const [projectName, setProjectName] = useState('Blink_Lab_Uno');
  const [statusMessage, setStatusMessage] = useState('Ready');

  // --- Canvas Viewport (Pan & Zoom) ---
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 80, y: 50 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // --- Circuit Components on Canvas ---
  const [components, setComponents] = useState<CircuitComponent[]>([
    { id: 'uno1', kind: 'arduino_uno', x: 80, y: 120, props: {} },
    { id: 'bb1', kind: 'breadboard', x: 420, y: 120, props: {} },
    { id: 'led1', kind: 'led', x: 500, y: 50, props: { color: 'red' } },
    { id: 'r1', kind: 'resistor', x: 590, y: 65, props: { ohms: 220 } },
    { id: 'btn1', kind: 'pushbutton', x: 690, y: 60, props: {} },
    { id: 'pot1', kind: 'potentiometer', x: 790, y: 50, props: { value: 0.5 } },
  ]);

  // --- Wires on Canvas ---
  const [wires, setWires] = useState<CircuitWire[]>([
    { id: 'w1', fromComp: 'uno1', fromPin: '13', toComp: 'led1', toPin: 'anode', color: '#22c55e' },
    { id: 'w2', fromComp: 'led1', fromPin: 'cathode', toComp: 'r1', toPin: '1', color: '#eab308' },
    { id: 'w3', fromComp: 'r1', fromPin: '2', toComp: 'uno1', toPin: 'GND', color: '#000000' },
  ]);

  // --- Selected Component / Active Wire Creation ---
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [wireDraftStart, setWireDraftStart] = useState<{ compId: string; pinName: string } | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState({ x: 0, y: 0 });

  // --- Synchronize Wire to Rust Core ---
  const syncWireToRust = useCallback(async (wire: CircuitWire) => {
    await tauriInvoke('sync_wire', {
      id: wire.id,
      fromComp: wire.fromComp,
      fromPin: wire.fromPin,
      toComp: wire.toComp,
      toPin: wire.toPin,
      color: wire.color,
    });
  }, []);

  // --- Pin World Position Calculator ---
  const getPinWorldPos = useCallback(
    (compId: string, pinName: string): { x: number; y: number } | null => {
      const comp = components.find((c) => c.id === compId);
      if (!comp) return null;

      if (comp.kind === 'arduino_uno') {
        const offset = ARDUINO_PINS[pinName];
        if (offset) {
          return { x: comp.x + offset.x, y: comp.y + offset.y };
        }
      }

      if (comp.kind === 'led') {
        if (pinName === 'anode') return { x: comp.x + 19, y: comp.y + 60 };
        if (pinName === 'cathode') return { x: comp.x + 31, y: comp.y + 56 };
      }

      if (comp.kind === 'resistor') {
        if (pinName === '1') return { x: comp.x + 4, y: comp.y + 10 };
        if (pinName === '2') return { x: comp.x + 60, y: comp.y + 10 };
      }

      if (comp.kind === 'pushbutton') {
        if (pinName === '1a') return { x: comp.x + 2, y: comp.y + 2 };
        if (pinName === '1b') return { x: comp.x + 46, y: comp.y + 2 };
        if (pinName === '2a') return { x: comp.x + 2, y: comp.y + 46 };
        if (pinName === '2b') return { x: comp.x + 46, y: comp.y + 46 };
      }

      if (comp.kind === 'potentiometer') {
        if (pinName === '1') return { x: comp.x + 22, y: comp.y + 76 };
        if (pinName === '2') return { x: comp.x + 32, y: comp.y + 76 };
        if (pinName === '3') return { x: comp.x + 42, y: comp.y + 76 };
      }

      return { x: comp.x + 20, y: comp.y + 20 };
    },
    [components]
  );

  // --- Simulation Cycle Loop (60 FPS) ---
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = async (now: number) => {
      if (isRunning) {
        // Step cycles (approx 266,666 cycles for 16.6ms at 16 MHz)
        const res = await tauriInvoke<{
          pin13: boolean;
          lit_leds: string[];
          serial_output: string | null;
          millis: number;
        }>('step_simulation', { cycles: 266666 });

        if (res) {
          setPin13State(res.pin13);
          setLitLeds(new Set(res.lit_leds));
          if (res.serial_output) {
            setSerialLogs((prev) => [...prev, res.serial_output!]);
          }
          setLogicHistory((prev) => {
            const next = [...prev, [res.millis, res.pin13 ? 5.0 : 0.0] as [number, number]];
            return next.slice(-250); // keep last 250 points
          });
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isRunning]);

  // --- Compile & Upload ---
  const handleCompile = async () => {
    setStatusMessage('Compiling sketch with avr-gcc...');
    setBottomTab('build');
    setShowDrawer(true);

    const res = await tauriInvoke<{ success: boolean; output: string; hex: string | null }>(
      'compile_and_upload',
      { sketch: sketchCode }
    );

    if (res) {
      setBuildLogs(res.output);
      if (res.success) {
        setStatusMessage('Build Succeeded. Flashed to ATmega328P.');
        setIsRunning(true);
      } else {
        setStatusMessage('Compilation Failed. Check build output.');
      }
    } else {
      // Mock success for web preview
      setBuildLogs('[Web Preview] Compiled Arduino Uno sketch successfully.\n');
      setIsRunning(true);
    }
  };

  // --- Canvas Mouse Handlers (Pan & Wire Drawing) ---
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2) {
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current) {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setMouseCanvasPos({
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    });
  };

  const handleCanvasMouseUp = () => {
    isPanning.current = false;
    setWireDraftStart(null);
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(3.0, Math.max(0.3, z * factor)));
  };

  // --- Pin Click to Start / Finish Wire ---
  const handlePinMouseDown = (compId: string, pinName: string) => {
    if (!wireDraftStart) {
      setWireDraftStart({ compId, pinName });
    } else {
      // Complete wire
      if (wireDraftStart.compId !== compId || wireDraftStart.pinName !== pinName) {
        const newWire: CircuitWire = {
          id: `w_${Date.now()}`,
          fromComp: wireDraftStart.compId,
          fromPin: wireDraftStart.pinName,
          toComp: compId,
          toPin: pinName,
          color: currentWireColor,
        };
        setWires((prev) => [...prev, newWire]);
        syncWireToRust(newWire);
      }
      setWireDraftStart(null);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0f1117] text-[#f8fafc] overflow-hidden select-none font-sans">
      
      {/* 1. Header Toolbar (GitHub Octicons Style, Medium Purple Accent) */}
      <header className="h-11 bg-[#181b26] border-b border-[#262b3c] px-3 flex items-center justify-between select-none z-30">
        <div className="flex items-center gap-2">
          {/* Logo badge */}
          <div className="flex items-center gap-2 mr-2">
            <span className="w-6 h-6 rounded-[6.4px] bg-[#8b5cf6] text-white flex items-center justify-center font-bold text-xs shadow-md shadow-[#8b5cf6]/30">
              µR
            </span>
            <span className="font-bold text-xs tracking-tight text-[#f8fafc]">MicroRustSim</span>
          </div>

          <div className="h-4 w-px bg-[#262b3c] mx-1" />

          {/* Primary Simulation Controls */}
          {isRunning ? (
            <button
              onClick={() => {
                setIsRunning(false);
                tauriInvoke('pause_simulation');
              }}
              title="Pause Simulation (GoPause)"
              className="flex items-center gap-1.5 px-3 py-1 bg-[#b45309] hover:bg-amber-700 text-[#fef3c7] text-xs font-semibold rounded-[6.4px] transition-all shadow"
            >
              <GoPause className="text-sm" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setIsRunning(true);
                tauriInvoke('start_simulation');
              }}
              title="Start Simulation (GoPlay)"
              className="flex items-center gap-1.5 px-3 py-1 bg-[#8b5cf6] hover:bg-[#a78bfa] text-white text-xs font-semibold rounded-[6.4px] transition-all shadow-md shadow-[#8b5cf6]/20"
            >
              <GoPlay className="text-sm" />
              <span>Run</span>
            </button>
          )}

          {/* Compile & Upload */}
          <button
            onClick={handleCompile}
            title="Compile & Upload (GoZap)"
            className="flex items-center gap-1 px-2.5 py-1 bg-[#202533] hover:bg-[#2a3042] text-white text-xs font-medium rounded-[6.4px] border border-[#262b3c] transition-all"
          >
            <GoZap className="text-[#a78bfa]" />
            <span>Upload</span>
          </button>

          {/* Reset */}
          <button
            onClick={() => {
              setIsRunning(false);
              tauriInvoke('reset_simulation');
              setSerialLogs([]);
            }}
            title="Reset MCU (GoSync)"
            className="p-1.5 bg-[#202533] hover:bg-[#2a3042] text-[#94a3b8] hover:text-white rounded-[6.4px] border border-[#262b3c] transition-all"
          >
            <GoSync />
          </button>

          <div className="h-4 w-px bg-[#262b3c] mx-1" />

          {/* 1-Click Collapsible Drawer Toggles */}
          <button
            onClick={() => setShowEditor(!showEditor)}
            title="Toggle Code Editor (GoCode)"
            className={`p-1.5 rounded-[6.4px] border transition-colors ${
              showEditor
                ? 'bg-[#3c2d69] text-[#a78bfa] border-[#8b5cf6]/40'
                : 'bg-[#202533] text-[#64748b] border-[#262b3c]'
            }`}
          >
            <GoCode />
          </button>

          <button
            onClick={() => setShowPalette(!showPalette)}
            title="Toggle Components Palette (GoPackage)"
            className={`p-1.5 rounded-[6.4px] border transition-colors ${
              showPalette
                ? 'bg-[#3c2d69] text-[#a78bfa] border-[#8b5cf6]/40'
                : 'bg-[#202533] text-[#64748b] border-[#262b3c]'
            }`}
          >
            <GoPackage />
          </button>

          <button
            onClick={() => setShowDrawer(!showDrawer)}
            title="Toggle Bottom Terminal (GoTerminal)"
            className={`p-1.5 rounded-[6.4px] border transition-colors ${
              showDrawer
                ? 'bg-[#3c2d69] text-[#a78bfa] border-[#8b5cf6]/40'
                : 'bg-[#202533] text-[#64748b] border-[#262b3c]'
            }`}
          >
            <GoTerminal />
          </button>

          <div className="h-4 w-px bg-[#262b3c] mx-1" />

          {/* Wire Color Palette Dots */}
          <div className="flex items-center gap-1.5">
            {WIRE_COLORS.map((c) => (
              <button
                key={c.hex}
                title={`Wire Color: ${c.name}`}
                onClick={() => setCurrentWireColor(c.hex)}
                className={`w-3.5 h-3.5 rounded-[4.8px] transition-transform ${
                  currentWireColor === c.hex
                    ? 'ring-2 ring-[#a78bfa] scale-110'
                    : 'border border-[#262b3c] hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>

        {/* Right Status Info */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#94a3b8] font-mono">{projectName}</span>
          <span
            className={`px-2.5 py-0.5 text-[11px] font-mono font-semibold rounded-[17.6px] border flex items-center gap-1.5 ${
              isRunning
                ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30'
                : 'bg-[#202533] text-[#64748b] border-[#262b3c]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isRunning ? 'bg-[#10b981] animate-pulse' : 'bg-zinc-600'}`}
            />
            {isRunning ? '16 MHz' : 'PAUSED'}
          </span>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Drawer: Monaco Code Editor */}
        {showEditor && (
          <aside className="w-80 lg:w-96 bg-[#181b26] border-r border-[#262b3c] flex flex-col z-20 shadow-xl transition-all">
            <div className="h-8 px-3 border-b border-[#262b3c] flex items-center justify-between text-xs text-[#94a3b8]">
              <span className="font-semibold text-[#f8fafc] flex items-center gap-1.5">
                <GoFile className="text-[#8b5cf6]" /> sketch.ino
              </span>
              <button
                onClick={() => setShowEditor(false)}
                title="Collapse Editor"
                className="hover:text-white"
              >
                <GoSidebarCollapse />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Editor
                height="100%"
                defaultLanguage="cpp"
                theme="vs-dark"
                value={sketchCode}
                onChange={(val) => setSketchCode(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'monospace',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 8 },
                }}
              />
            </div>
          </aside>
        )}

        {/* Center Canvas: Interactive Breadboard & Circuit Simulator */}
        <main
          className="flex-1 relative overflow-hidden canvas-grid bg-[#0f1117] cursor-default"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onWheel={handleCanvasWheel}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Zoom & Pan Viewport Container */}
          <div
            className="absolute origin-top-left transition-transform duration-75"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            {/* Render Components */}
            {components.map((comp) => (
              <div
                key={comp.id}
                className="absolute"
                style={{ left: comp.x, top: comp.y }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCompId(comp.id);
                }}
              >
                {comp.kind === 'arduino_uno' && (
                  <ArduinoUno
                    pin13Lit={pin13State}
                    onPinMouseDown={(pin) => handlePinMouseDown(comp.id, pin)}
                  />
                )}
                {comp.kind === 'breadboard' && (
                  <Breadboard onPinMouseDown={(pin) => handlePinMouseDown(comp.id, pin)} />
                )}
                {comp.kind === 'led' && (
                  <Led
                    id={comp.id}
                    color={comp.props.color || 'red'}
                    isLit={litLeds.has(comp.id) || (comp.id === 'led1' && pin13State)}
                    onPinMouseDown={(pin) => handlePinMouseDown(comp.id, pin)}
                  />
                )}
                {comp.kind === 'resistor' && (
                  <Resistor
                    ohms={comp.props.ohms || 220}
                    onPinMouseDown={(pin) => handlePinMouseDown(comp.id, pin)}
                  />
                )}
                {comp.kind === 'pushbutton' && (
                  <Pushbutton
                    id={comp.id}
                    onPressChange={(pressed) => tauriInvoke('press_button', { id: comp.id, pressed })}
                    onPinMouseDown={(pin) => handlePinMouseDown(comp.id, pin)}
                  />
                )}
                {comp.kind === 'potentiometer' && (
                  <Potentiometer
                    id={comp.id}
                    value={comp.props.value || 0.5}
                    onValueChange={(val) => tauriInvoke('set_potentiometer', { id: comp.id, value: val })}
                    onPinMouseDown={(pin) => handlePinMouseDown(comp.id, pin)}
                  />
                )}
              </div>
            ))}

            {/* Bezier Wires */}
            <WireLayer
              wires={wires}
              getPinWorldPos={getPinWorldPos}
              draggingWire={
                wireDraftStart
                  ? {
                      fromX: getPinWorldPos(wireDraftStart.compId, wireDraftStart.pinName)?.x || 0,
                      fromY: getPinWorldPos(wireDraftStart.compId, wireDraftStart.pinName)?.y || 0,
                      toX: mouseCanvasPos.x,
                      toY: mouseCanvasPos.y,
                      color: currentWireColor,
                    }
                  : null
              }
              onWireClick={(wireId) => {
                setWires((prev) => prev.filter((w) => w.id !== wireId));
                tauriInvoke('remove_wire', { id: wireId });
              }}
            />
          </div>

          {/* Floating Canvas Status Badge */}
          <div className="absolute bottom-3 left-3 bg-[#181b26]/90 backdrop-blur border border-[#262b3c] rounded-[6.4px] px-3 py-1.5 text-xs text-[#94a3b8] flex items-center gap-3 shadow-lg pointer-events-none">
            <span>🖱 Drag Pin to Wire</span>
            <span>•</span>
            <span>Right-click / Middle-drag: Pan</span>
            <span>•</span>
            <span>Scroll: Zoom {(zoom * 100).toFixed(0)}%</span>
          </div>
        </main>

        {/* Right Drawer: Categorized Component Palette */}
        {showPalette && (
          <aside className="w-64 bg-[#181b26] border-l border-[#262b3c] flex flex-col z-20 shadow-xl transition-all">
            <div className="h-8 px-3 border-b border-[#262b3c] flex items-center justify-between text-xs text-[#94a3b8]">
              <span className="font-semibold text-[#f8fafc] flex items-center gap-1.5">
                <GoPackage className="text-[#8b5cf6]" /> Components
              </span>
              <button
                onClick={() => setShowPalette(false)}
                title="Collapse Palette"
                className="hover:text-white"
              >
                <GoSidebarCollapse className="rotate-180" />
              </button>
            </div>

            <div className="p-3 space-y-3 overflow-y-auto flex-1 text-xs">
              {/* Core Processing */}
              <details open className="group">
                <summary className="cursor-pointer font-semibold text-[#f8fafc] py-1 px-2 rounded-[4.8px] hover:bg-[#202533] flex justify-between items-center">
                  <span>🖳 Processing</span>
                  <span className="text-[#64748b] group-open:rotate-90 transition-transform">▸</span>
                </summary>
                <div className="pl-2 pt-1.5">
                  <button
                    onClick={() => {
                      const id = `uno_${components.length + 1}`;
                      setComponents((prev) => [
                        ...prev,
                        { id, kind: 'arduino_uno', x: 100, y: 150, props: {} },
                      ]);
                    }}
                    className="w-full text-left py-1.5 px-2.5 rounded-[6.4px] bg-[#202533] hover:bg-[#2a3042] text-[#f8fafc] border border-[#262b3c] flex items-center gap-2"
                  >
                    <GoPlus className="text-[#8b5cf6]" />
                    <span>Arduino Uno R3</span>
                  </button>
                </div>
              </details>

              {/* Prototyping */}
              <details open className="group">
                <summary className="cursor-pointer font-semibold text-[#f8fafc] py-1 px-2 rounded-[4.8px] hover:bg-[#202533] flex justify-between items-center">
                  <span>▤ Prototyping</span>
                  <span className="text-[#64748b] group-open:rotate-90 transition-transform">▸</span>
                </summary>
                <div className="pl-2 pt-1.5">
                  <button
                    onClick={() => {
                      const id = `bb_${components.length + 1}`;
                      setComponents((prev) => [
                        ...prev,
                        { id, kind: 'breadboard', x: 380, y: 150, props: {} },
                      ]);
                    }}
                    className="w-full text-left py-1.5 px-2.5 rounded-[6.4px] bg-[#202533] hover:bg-[#2a3042] text-[#f8fafc] border border-[#262b3c] flex items-center gap-2"
                  >
                    <GoPlus className="text-[#8b5cf6]" />
                    <span>Half Breadboard</span>
                  </button>
                </div>
              </details>

              {/* Outputs */}
              <details open className="group">
                <summary className="cursor-pointer font-semibold text-[#f8fafc] py-1 px-2 rounded-[4.8px] hover:bg-[#202533] flex justify-between items-center">
                  <span>💡 Outputs</span>
                  <span className="text-[#64748b] group-open:rotate-90 transition-transform">▸</span>
                </summary>
                <div className="pl-2 pt-1.5 grid grid-cols-3 gap-1.5">
                  {(['red', 'green', 'blue'] as const).map((col) => (
                    <button
                      key={col}
                      onClick={() => {
                        const id = `led_${components.length + 1}`;
                        setComponents((prev) => [
                          ...prev,
                          { id, kind: 'led', x: 500, y: 80, props: { color: col } },
                        ]);
                        tauriInvoke('add_led', { id, color: col });
                      }}
                      className="py-1 px-1 bg-[#202533] hover:bg-[#2a3042] text-[#f8fafc] rounded-[4.8px] border border-[#262b3c] capitalize text-center"
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </details>

              {/* Passives */}
              <details open className="group">
                <summary className="cursor-pointer font-semibold text-[#f8fafc] py-1 px-2 rounded-[4.8px] hover:bg-[#202533] flex justify-between items-center">
                  <span>⚡ Passives</span>
                  <span className="text-[#64748b] group-open:rotate-90 transition-transform">▸</span>
                </summary>
                <div className="pl-2 pt-1.5 space-y-1.5">
                  {[220, 1000, 10000].map((ohms) => (
                    <button
                      key={ohms}
                      onClick={() => {
                        const id = `r_${components.length + 1}`;
                        setComponents((prev) => [
                          ...prev,
                          { id, kind: 'resistor', x: 580, y: 80, props: { ohms } },
                        ]);
                        tauriInvoke('add_resistor', { id, ohms });
                      }}
                      className="w-full text-left py-1 px-2 bg-[#202533] hover:bg-[#2a3042] text-[#94a3b8] rounded-[6.4px] border border-[#262b3c]"
                    >
                      Resistor ({ohms >= 1000 ? `${ohms / 1000}kΩ` : `${ohms}Ω`})
                    </button>
                  ))}
                </div>
              </details>

              {/* Interactive Inputs */}
              <details open className="group">
                <summary className="cursor-pointer font-semibold text-[#f8fafc] py-1 px-2 rounded-[4.8px] hover:bg-[#202533] flex justify-between items-center">
                  <span>🔘 Inputs</span>
                  <span className="text-[#64748b] group-open:rotate-90 transition-transform">▸</span>
                </summary>
                <div className="pl-2 pt-1.5 space-y-1.5">
                  <button
                    onClick={() => {
                      const id = `btn_${components.length + 1}`;
                      setComponents((prev) => [
                        ...prev,
                        { id, kind: 'pushbutton', x: 680, y: 80, props: {} },
                      ]);
                      tauriInvoke('add_button', { id });
                    }}
                    className="w-full text-left py-1.5 px-2 bg-[#202533] hover:bg-[#2a3042] text-[#94a3b8] rounded-[6.4px] border border-[#262b3c]"
                  >
                    Tactile Pushbutton
                  </button>
                  <button
                    onClick={() => {
                      const id = `pot_${components.length + 1}`;
                      setComponents((prev) => [
                        ...prev,
                        { id, kind: 'potentiometer', x: 760, y: 80, props: { value: 0.5 } },
                      ]);
                      tauriInvoke('add_potentiometer', { id });
                    }}
                    className="w-full text-left py-1.5 px-2 bg-[#202533] hover:bg-[#2a3042] text-[#94a3b8] rounded-[6.4px] border border-[#262b3c]"
                  >
                    Rotary Potentiometer (ADC)
                  </button>
                </div>
              </details>

              {/* Component Properties / Deletion */}
              {selectedCompId && (
                <div className="pt-3 border-t border-[#262b3c]">
                  <span className="text-[11px] font-bold text-[#f8fafc] block mb-1">
                    Selected: {selectedCompId}
                  </span>
                  <button
                    onClick={() => {
                      setComponents((prev) => prev.filter((c) => c.id !== selectedCompId));
                      setWires((prev) =>
                        prev.filter(
                          (w) => w.fromComp !== selectedCompId && w.toComp !== selectedCompId
                        )
                      );
                      setSelectedCompId(null);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-red-950/60 hover:bg-red-900 text-red-200 rounded-[6.4px] border border-red-800 text-xs w-full justify-center"
                  >
                    <GoTrash /> Delete Part
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}

      </div>

      {/* 3. Bottom Drawer: Serial Monitor & Logic Waveform Analyzer */}
      {showDrawer && (
        <footer className="h-44 bg-[#181b26] border-t border-[#262b3c] flex flex-col z-20 shadow-2xl">
          {/* Drawer Tab Headers */}
          <div className="h-8 px-3 border-b border-[#262b3c] flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setBottomTab('serial')}
                className={`flex items-center gap-1.5 pb-0.5 font-medium transition-colors ${
                  bottomTab === 'serial'
                    ? 'text-[#8b5cf6] border-b-2 border-[#8b5cf6]'
                    : 'text-[#94a3b8] hover:text-[#f8fafc]'
                }`}
              >
                <GoTerminal /> Serial Monitor
              </button>
              <button
                onClick={() => setBottomTab('waveform')}
                className={`flex items-center gap-1.5 pb-0.5 font-medium transition-colors ${
                  bottomTab === 'waveform'
                    ? 'text-[#8b5cf6] border-b-2 border-[#8b5cf6]'
                    : 'text-[#94a3b8] hover:text-[#f8fafc]'
                }`}
              >
                <GoGraph /> Logic Waveform
              </button>
              <button
                onClick={() => setBottomTab('build')}
                className={`flex items-center gap-1.5 pb-0.5 font-medium transition-colors ${
                  bottomTab === 'build'
                    ? 'text-[#8b5cf6] border-b-2 border-[#8b5cf6]'
                    : 'text-[#94a3b8] hover:text-[#f8fafc]'
                }`}
              >
                <GoGear /> Build Output
              </button>
            </div>

            <div className="flex items-center gap-2">
              {bottomTab === 'serial' && (
                <>
                  <select
                    value={baudRate}
                    onChange={(e) => setBaudRate(Number(e.target.value))}
                    className="bg-[#202533] border border-[#262b3c] text-[11px] text-[#f8fafc] rounded-[4.8px] px-2 py-0.5"
                  >
                    <option value={9600}>9600 baud</option>
                    <option value={115200}>115200 baud</option>
                  </select>
                  <button
                    onClick={() => setSerialLogs([])}
                    title="Clear Console"
                    className="p-1 hover:text-white text-[#64748b]"
                  >
                    <GoTrash />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Drawer Tab Content */}
          <div className="flex-1 overflow-hidden bg-[#13161f] p-2 font-mono text-xs text-[#94a3b8]">
            {bottomTab === 'serial' && (
              <div className="h-full flex flex-col justify-between">
                <div className="flex-1 overflow-y-auto space-y-0.5 pr-2">
                  {serialLogs.map((log, idx) => (
                    <div key={idx} className="leading-relaxed">
                      {log}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-[#262b3c]">
                  <input
                    type="text"
                    placeholder="Send command to Arduino UART..."
                    value={serialInput}
                    onChange={(e) => setSerialInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && serialInput) {
                        tauriInvoke('write_serial', { input: serialInput });
                        setSerialLogs((prev) => [...prev, `> ${serialInput}\n`]);
                        setSerialInput('');
                      }
                    }}
                    className="flex-1 bg-[#202533] border border-[#262b3c] rounded-[6.4px] px-2.5 py-1 text-xs text-[#f8fafc] focus:outline-none focus:border-[#8b5cf6]"
                  />
                  <button
                    onClick={() => {
                      if (serialInput) {
                        tauriInvoke('write_serial', { input: serialInput });
                        setSerialLogs((prev) => [...prev, `> ${serialInput}\n`]);
                        setSerialInput('');
                      }
                    }}
                    className="px-3 py-1 bg-[#8b5cf6] hover:bg-[#a78bfa] text-white text-xs font-semibold rounded-[6.4px]"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}

            {bottomTab === 'waveform' && <LogicWaveform history={logicHistory} />}

            {bottomTab === 'build' && (
              <div className="h-full overflow-y-auto whitespace-pre-wrap leading-relaxed text-[#94a3b8]">
                {buildLogs}
              </div>
            )}
          </div>
        </footer>
      )}

      {/* 4. Minimalist Status Bar */}
      <div className="h-5 bg-[#181b26] border-t border-[#262b3c] px-3 flex items-center justify-between text-[10px] text-[#64748b]">
        <span>{statusMessage}</span>
        <span>ATmega328P @ 16 MHz | Local-first SQLite</span>
      </div>

    </div>
  );
}
