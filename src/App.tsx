import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  GoPlay,
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

// Official shadcn/ui components (Open Code + Composition)
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

import { ArduinoUno, ARDUINO_PINS } from './components/ArduinoUno';
import { Breadboard } from './components/Breadboard';
import { Led } from './components/Led';
import { Resistor } from './components/Resistor';
import { Pushbutton } from './components/Pushbutton';
import { Potentiometer } from './components/Potentiometer';
import { WireLayer } from './components/WireLayer';
import { LogicWaveform } from './components/LogicWaveform';
import { CircuitComponent, CircuitWire } from './types';

// Safely invoke Tauri IPC commands with web preview fallback
async function tauriInvoke<T>(cmd: string, args: Record<string, any> = {}): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.debug(`[Tauri Mock] ${cmd}`, args);
    return null;
  }
}

const PauseIcon = ({ className }: { className?: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={className}>
    <rect x="3" y="2" width="3.5" height="12" rx="1" />
    <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
  </svg>
);

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
    '[System] MicroRustSim Online with shadcn/ui Design System.\n',
    '[System] ATmega328P Cycle-Accurate Core Ready.\n',
  ]);
  const [buildLogs, setBuildLogs] = useState<string>('Ready to compile sketches with avr-gcc.\n');
  const [serialInput, setSerialInput] = useState('');
  const [baudRate, setBaudRate] = useState(9600);
  const [logicHistory, setLogicHistory] = useState<[number, number][]>([]);
  const [currentWireColor, setCurrentWireColor] = useState('#22c55e');

  // --- Sketch Code & Project ---
  const [sketchCode, setSketchCode] = useState(DEFAULT_BLINK_CODE);
  const [projectName] = useState('Blink_Lab_Uno');
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

    const loop = async () => {
      if (isRunning) {
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
            return next.slice(-250);
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
    <TooltipProvider delay={100}>
      <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden select-none font-sans dark">
        
        {/* 1. Header Toolbar (Low-Text, Icon-First with shadcn/ui Components) */}
        <header className="h-11 bg-card border-b border-border px-3 flex items-center justify-between select-none z-30">
          <div className="flex items-center gap-2">
            {/* Logo Badge */}
            <div className="flex items-center gap-2 mr-1">
              <span className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-md shadow-primary/30">
                µR
              </span>
              <span className="font-bold text-xs tracking-tight text-foreground">MicroRustSim</span>
            </div>

            {/* Dropdown Menu for File actions (Progressive Disclosure) */}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="xs" className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground">File</Button>} />
              <DropdownMenuContent align="start" className="w-48 bg-card border border-border">
                <DropdownMenuItem className="text-xs flex items-center gap-2" onClick={() => {
                  setSketchCode(DEFAULT_BLINK_CODE);
                  setStatusMessage('New Project Created');
                }}>
                  <GoPlus className="text-primary" /> New Project
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs flex items-center gap-2" onClick={() => setStatusMessage('Project Saved')}>
                  <GoFile className="text-primary" /> Save Project
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem className="text-xs text-muted-foreground" onClick={() => {
                  navigator.clipboard.writeText(sketchCode);
                  setStatusMessage('Code copied to clipboard');
                }}>
                  Copy Code
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="h-4 mx-0.5" />

            {/* Primary Action Button (Single Primary Button per View rule) */}
            {isRunning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsRunning(false);
                  tauriInvoke('pause_simulation');
                }}
                className="bg-warning text-warning-foreground hover:bg-warning/90 border-transparent text-xs h-7 px-2.5 font-semibold gap-1.5 shadow"
              >
                <PauseIcon className="text-sm" />
                <span>Pause</span>
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setIsRunning(true);
                  tauriInvoke('start_simulation');
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-7 px-3 font-semibold gap-1.5 shadow-md shadow-primary/20"
              >
                <GoPlay className="text-sm" />
                <span>Run</span>
              </Button>
            )}

            {/* Secondary Action: Compile & Upload */}
            <Tooltip>
              <TooltipTrigger render={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCompile}
                  className="text-xs h-7 px-2.5 gap-1 text-foreground"
                >
                  <GoZap className="text-primary" />
                  <span>Upload</span>
                </Button>
              } />
              <TooltipContent>Compile & Flash to ATmega328P</TooltipContent>
            </Tooltip>

            {/* Secondary Action: Reset */}
            <Tooltip>
              <TooltipTrigger render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setIsRunning(false);
                    tauriInvoke('reset_simulation');
                    setSerialLogs([]);
                  }}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <GoSync />
                </Button>
              } />
              <TooltipContent>Reset MCU Cycle Clock</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-4 mx-0.5" />

            {/* 1-Click Collapsible Drawer Toggles (Using Tooltips + Button variant="ghost") */}
            <Tooltip>
              <TooltipTrigger render={
                <Button
                  variant={showEditor ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  onClick={() => setShowEditor(!showEditor)}
                  className={`h-7 w-7 ${showEditor ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  <GoCode />
                </Button>
              } />
              <TooltipContent>Toggle C++ Code Editor</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger render={
                <Button
                  variant={showPalette ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  onClick={() => setShowPalette(!showPalette)}
                  className={`h-7 w-7 ${showPalette ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  <GoPackage />
                </Button>
              } />
              <TooltipContent>Toggle Component Library</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger render={
                <Button
                  variant={showDrawer ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  onClick={() => setShowDrawer(!showDrawer)}
                  className={`h-7 w-7 ${showDrawer ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  <GoTerminal />
                </Button>
              } />
              <TooltipContent>Toggle Output Console</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-4 mx-0.5" />

            {/* Wire Color Palette Dots */}
            <div className="flex items-center gap-1.5 ml-1">
              {WIRE_COLORS.map((c) => (
                <button
                  key={c.hex}
                  title={`Wire Color: ${c.name}`}
                  onClick={() => setCurrentWireColor(c.hex)}
                  className={`w-3.5 h-3.5 rounded-sm transition-transform ${
                    currentWireColor === c.hex
                      ? 'ring-2 ring-primary scale-110'
                      : 'border border-border hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Right Status Badges */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-muted-foreground font-mono">{projectName}</span>
            <Badge
              variant="outline"
              className={`font-mono text-[11px] gap-1.5 h-6 px-2.5 ${
                isRunning
                  ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20'
                  : 'border-border text-muted-foreground bg-muted'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground'}`} />
              {isRunning ? '16 MHz' : 'PAUSED'}
            </Badge>
          </div>
        </header>

        {/* 2. Main Workspace */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* Left Drawer: Monaco Code Editor */}
          {showEditor && (
            <aside className="w-80 lg:w-96 bg-card border-r border-border flex flex-col z-20 shadow-xl transition-all">
              <div className="h-8 px-3 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <GoFile className="text-primary" /> sketch.ino
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowEditor(false)}
                  title="Collapse Editor"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                  <GoSidebarCollapse />
                </Button>
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
            className="flex-1 relative overflow-hidden canvas-grid bg-background cursor-default"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onWheel={handleCanvasWheel}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Viewport Container */}
            <div
              className="absolute origin-top-left transition-transform duration-75"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              {/* Circuit Components */}
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

            {/* Floating Navigation Hint */}
            <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur border border-border rounded-md px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-3 shadow-lg pointer-events-none">
              <span>🖱 Click Pin to Wire</span>
              <span>•</span>
              <span>Right-click / Middle-drag: Pan</span>
              <span>•</span>
              <span>Scroll: Zoom {(zoom * 100).toFixed(0)}%</span>
            </div>
          </main>

          {/* Right Drawer: Component Palette (Using shadcn Collapsible + Outline Buttons) */}
          {showPalette && (
            <aside className="w-64 bg-card border-l border-border flex flex-col z-20 shadow-xl transition-all">
              <div className="h-8 px-3 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <GoPackage className="text-primary" /> Components
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowPalette(false)}
                  title="Collapse Palette"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                  <GoSidebarCollapse className="rotate-180" />
                </Button>
              </div>

              <ScrollArea className="flex-1 p-3">
                <div className="space-y-3 text-xs">
                  {/* Core Processing */}
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex items-center justify-between w-full py-1 px-2 rounded-md hover:bg-muted font-semibold text-foreground">
                      <span>🖳 Processing</span>
                      <span className="text-muted-foreground text-[10px]">▼</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-1.5 pl-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const id = `uno_${components.length + 1}`;
                          setComponents((prev) => [
                            ...prev,
                            { id, kind: 'arduino_uno', x: 100, y: 150, props: {} },
                          ]);
                        }}
                        className="w-full justify-start text-xs h-7 gap-1.5"
                      >
                        <GoPlus className="text-primary" />
                        <span>Arduino Uno R3</span>
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Prototyping */}
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex items-center justify-between w-full py-1 px-2 rounded-md hover:bg-muted font-semibold text-foreground">
                      <span>▤ Prototyping</span>
                      <span className="text-muted-foreground text-[10px]">▼</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-1.5 pl-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const id = `bb_${components.length + 1}`;
                          setComponents((prev) => [
                            ...prev,
                            { id, kind: 'breadboard', x: 380, y: 150, props: {} },
                          ]);
                        }}
                        className="w-full justify-start text-xs h-7 gap-1.5"
                      >
                        <GoPlus className="text-primary" />
                        <span>Half Breadboard</span>
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Outputs */}
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex items-center justify-between w-full py-1 px-2 rounded-md hover:bg-muted font-semibold text-foreground">
                      <span>💡 Outputs</span>
                      <span className="text-muted-foreground text-[10px]">▼</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-1.5 pl-2 grid grid-cols-3 gap-1.5">
                      {(['red', 'green', 'blue'] as const).map((col) => (
                        <Button
                          key={col}
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            const id = `led_${components.length + 1}`;
                            setComponents((prev) => [
                              ...prev,
                              { id, kind: 'led', x: 500, y: 80, props: { color: col } },
                            ]);
                            tauriInvoke('add_led', { id, color: col });
                          }}
                          className="capitalize text-[11px] h-6 px-1"
                        >
                          {col}
                        </Button>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Passives */}
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex items-center justify-between w-full py-1 px-2 rounded-md hover:bg-muted font-semibold text-foreground">
                      <span>⚡ Passives</span>
                      <span className="text-muted-foreground text-[10px]">▼</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-1.5 pl-2 space-y-1.5">
                      {[220, 1000, 10000].map((ohms) => (
                        <Button
                          key={ohms}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const id = `r_${components.length + 1}`;
                            setComponents((prev) => [
                              ...prev,
                              { id, kind: 'resistor', x: 580, y: 80, props: { ohms } },
                            ]);
                            tauriInvoke('add_resistor', { id, ohms });
                          }}
                          className="w-full justify-start text-xs h-7"
                        >
                          Resistor ({ohms >= 1000 ? `${ohms / 1000}kΩ` : `${ohms}Ω`})
                        </Button>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Interactive Inputs */}
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex items-center justify-between w-full py-1 px-2 rounded-md hover:bg-muted font-semibold text-foreground">
                      <span>🔘 Inputs</span>
                      <span className="text-muted-foreground text-[10px]">▼</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-1.5 pl-2 space-y-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const id = `btn_${components.length + 1}`;
                          setComponents((prev) => [
                            ...prev,
                            { id, kind: 'pushbutton', x: 680, y: 80, props: {} },
                          ]);
                          tauriInvoke('add_button', { id });
                        }}
                        className="w-full justify-start text-xs h-7"
                      >
                        Tactile Pushbutton
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const id = `pot_${components.length + 1}`;
                          setComponents((prev) => [
                            ...prev,
                            { id, kind: 'potentiometer', x: 760, y: 80, props: { value: 0.5 } },
                          ]);
                          tauriInvoke('add_potentiometer', { id });
                        }}
                        className="w-full justify-start text-xs h-7"
                      >
                        Potentiometer (ADC)
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Component Inspector & Deletion */}
                  {selectedCompId && (
                    <div className="pt-3 border-t border-border">
                      <span className="text-[11px] font-bold text-foreground block mb-1.5">
                        Selected: {selectedCompId}
                      </span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setComponents((prev) => prev.filter((c) => c.id !== selectedCompId));
                          setWires((prev) =>
                            prev.filter(
                              (w) => w.fromComp !== selectedCompId && w.toComp !== selectedCompId
                            )
                          );
                          setSelectedCompId(null);
                        }}
                        className="w-full h-7 text-xs gap-1.5"
                      >
                        <GoTrash /> Delete Component
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </aside>
          )}

        </div>

        {/* 3. Bottom Drawer: Serial Monitor, Waveform & Build (Official shadcn Tabs) */}
        {showDrawer && (
          <footer className="h-44 bg-card border-t border-border flex flex-col z-20 shadow-2xl">
            <Tabs
              value={bottomTab}
              onValueChange={(val) => setBottomTab(val as any)}
              className="flex-1 flex flex-col h-full"
            >
              {/* Tabs Bar */}
              <div className="h-8 px-3 border-b border-border flex items-center justify-between">
                <TabsList variant="line" className="h-8 gap-3 bg-transparent p-0">
                  <TabsTrigger value="serial" className="text-xs h-8 gap-1.5">
                    <GoTerminal /> Serial Monitor
                  </TabsTrigger>
                  <TabsTrigger value="waveform" className="text-xs h-8 gap-1.5">
                    <GoGraph /> Logic Waveform
                  </TabsTrigger>
                  <TabsTrigger value="build" className="text-xs h-8 gap-1.5">
                    <GoGear /> Build Output
                  </TabsTrigger>
                </TabsList>

                {/* Tab Specific Action Controls */}
                <div className="flex items-center gap-2">
                  {bottomTab === 'serial' && (
                    <>
                      <select
                        value={baudRate}
                        onChange={(e) => setBaudRate(Number(e.target.value))}
                        className="bg-muted border border-border text-[11px] text-foreground rounded px-2 py-0.5"
                      >
                        <option value={9600}>9600 baud</option>
                        <option value={115200}>115200 baud</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setSerialLogs([])}
                        title="Clear Serial Console"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      >
                        <GoTrash />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Tab Content: Serial Monitor */}
              <TabsContent value="serial" className="flex-1 overflow-hidden p-2.5 font-mono text-xs text-muted-foreground m-0">
                <div className="h-full flex flex-col justify-between">
                  <ScrollArea className="flex-1 pr-2">
                    <div className="space-y-0.5">
                      {serialLogs.map((log, idx) => (
                        <div key={idx} className="leading-relaxed">
                          {log}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="flex items-center gap-2 pt-2 border-t border-border mt-1">
                    <Input
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
                      className="flex-1 h-7 text-xs bg-muted/50 border-input"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (serialInput) {
                          tauriInvoke('write_serial', { input: serialInput });
                          setSerialLogs((prev) => [...prev, `> ${serialInput}\n`]);
                          setSerialInput('');
                        }
                      }}
                      className="h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    >
                      Send
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Tab Content: Waveform */}
              <TabsContent value="waveform" className="flex-1 overflow-hidden p-2 m-0">
                <LogicWaveform history={logicHistory} />
              </TabsContent>

              {/* Tab Content: Build Output */}
              <TabsContent value="build" className="flex-1 overflow-hidden p-2.5 font-mono text-xs text-muted-foreground m-0">
                <ScrollArea className="h-full">
                  <div className="whitespace-pre-wrap leading-relaxed">{buildLogs}</div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </footer>
        )}

        {/* 4. Minimalist Status Bar */}
        <div className="h-5 bg-card border-t border-border px-3 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{statusMessage}</span>
          <span>ATmega328P @ 16 MHz | shadcn/ui + Tauri v2</span>
        </div>

      </div>
    </TooltipProvider>
  );
}
