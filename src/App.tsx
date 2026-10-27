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
  GoCheck,
  GoZoomIn,
  GoZoomOut,
  GoCpu,
} from 'react-icons/go';
import { MousePointer, Move, Cable, ChevronDown, Check } from 'lucide-react';

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
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

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
  { hex: '#ef4444', name: 'Red', role: '5V / VCC' },
  { hex: '#f97316', name: 'Orange', role: '3.3V / Reset' },
  { hex: '#eab308', name: 'Yellow', role: 'Digital / I2C' },
  { hex: '#22c55e', name: 'Green', role: 'Signal' },
  { hex: '#06b6d4', name: 'Cyan', role: 'PWM' },
  { hex: '#3b82f6', name: 'Blue', role: 'Analog / Clock' },
  { hex: '#a855f7', name: 'Purple', role: 'SPI / Bus' },
  { hex: '#ec4899', name: 'Pink', role: 'Aux / Alert' },
  { hex: '#ffffff', name: 'White', role: 'Misc' },
  { hex: '#71717a', name: 'Gray', role: 'Shield' },
  { hex: '#18181b', name: 'Black', role: 'GND' },
  { hex: '#78350f', name: 'Brown', role: 'Reference' },
];

const setupMonacoTheme = (monaco: any) => {
  monaco.editor.defineTheme('microrustsim-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '71717a', fontStyle: 'italic' },
      { token: 'keyword', foreground: '10b981' },
      { token: 'keyword.control', foreground: '10b981' },
      { token: 'type', foreground: '38bdf8' },
      { token: 'type.identifier', foreground: '38bdf8' },
      { token: 'number', foreground: 'fb923c' },
      { token: 'string', foreground: 'fcd34d' },
      { token: 'delimiter', foreground: 'a1a1aa' },
      { token: 'operator', foreground: 'a1a1aa' },
      { token: 'identifier', foreground: 'f4f4f5' },
    ],
    colors: {
      'editor.background': '#121215',
      'editor.foreground': '#f4f4f5',
      'editorGutter.background': '#121215',
      'editorLineNumber.foreground': '#52525b',
      'editorLineNumber.activeForeground': '#f4f4f5',
      'editorCursor.foreground': '#10b981',
      'editor.lineHighlightBackground': '#18181b80',
      'editor.lineHighlightBorder': '#00000000',
      'editor.selectionBackground': '#27272a',
      'editor.inactiveSelectionBackground': '#1e1e24',
      'editorIndentGuide.background': '#222226',
      'editorIndentGuide.activeBackground': '#3f3f46',
      'editorWidget.background': '#18181b',
      'editorWidget.border': '#27272a',
      'editorSuggestWidget.background': '#18181b',
      'editorSuggestWidget.border': '#27272a',
      'editorSuggestWidget.foreground': '#f4f4f5',
      'editorSuggestWidget.selectedBackground': '#27272a',
      'input.background': '#121215',
      'input.border': '#27272a',
      'input.foreground': '#f4f4f5',
      'scrollbarSlider.background': '#27272a40',
      'scrollbarSlider.hoverBackground': '#27272a80',
      'scrollbarSlider.activeBackground': '#3f3f46',
    },
  });
  monaco.editor.setTheme('microrustsim-dark');
};

export default function App() {
  // --- Menubar Active Menu (File, View, Window) ---
  const [activeMenu, setActiveMenu] = useState<'file' | 'view' | 'window' | null>(null);
  const menubarRef = useRef<HTMLDivElement>(null);

  // --- Active Tool Mode (Select, Move, Wire) & Word-style Color Popup ---
  const [activeTool, setActiveTool] = useState<'select' | 'move' | 'wire'>('select');
  const [showWireColorMenu, setShowWireColorMenu] = useState(false);
  const [customColorInput, setCustomColorInput] = useState('#22C55E');
  const wireMenuRef = useRef<HTMLDivElement>(null);
  const draggedCompRef = useRef<{
    id: string;
    startMouseX: number;
    startMouseY: number;
    startCompX: number;
    startCompY: number;
  } | null>(null);

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
    '[System] MicroRustSim Core Online.\n',
    '[System] ATmega328P Cycle-Accurate 16 MHz Engine Ready.\n',
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
    { id: 'w3', fromComp: 'r1', fromPin: '2', toComp: 'uno1', toPin: 'GND', color: '#18181b' },
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
      setBuildLogs('[Preview] Compiled Arduino Uno sketch successfully.\n');
      setIsRunning(true);
    }
  };

  // --- Window Dragging Listener for Smooth Component Movement ---
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (draggedCompRef.current) {
        const dx = (e.clientX - draggedCompRef.current.startMouseX) / zoom;
        const dy = (e.clientY - draggedCompRef.current.startMouseY) / zoom;
        const compId = draggedCompRef.current.id;
        const newX = Math.round(draggedCompRef.current.startCompX + dx);
        const newY = Math.round(draggedCompRef.current.startCompY + dy);
        setComponents((prev) =>
          prev.map((item) => (item.id === compId ? { ...item, x: newX, y: newY } : item))
        );
      }
    };

    const handleWindowMouseUp = () => {
      if (draggedCompRef.current) {
        draggedCompRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [zoom]);

  // --- Keyboard Shortcuts (V: Select, M: Move, W: Wire, Delete: Delete Component) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('.monaco-editor'))
      ) {
        return;
      }

      if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select');
      } else if (e.key === 'm' || e.key === 'M') {
        setActiveTool('move');
      } else if (e.key === 'w' || e.key === 'W') {
        setActiveTool('wire');
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCompId) {
        setComponents((prev) => prev.filter((c) => c.id !== selectedCompId));
        setWires((prev) =>
          prev.filter((w) => w.fromComp !== selectedCompId && w.toComp !== selectedCompId)
        );
        setSelectedCompId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCompId]);

  // --- Close Menubar Dropdown when Clicking Outside ---
  useEffect(() => {
    const handleMenubarClickOutside = (e: MouseEvent) => {
      if (menubarRef.current && !menubarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    if (activeMenu) {
      document.addEventListener('mousedown', handleMenubarClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleMenubarClickOutside);
  }, [activeMenu]);

  // --- Close Wire Color Menu when Clicking Outside ---
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wireMenuRef.current && !wireMenuRef.current.contains(e.target as Node)) {
        setShowWireColorMenu(false);
      }
    };
    if (showWireColorMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showWireColorMenu]);

  // --- Component Click & Drag Handler ---
  const handleComponentMouseDown = (compId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only primary mouse button
    e.stopPropagation();

    setSelectedCompId(compId);

    if (activeTool === 'move') {
      const comp = components.find((c) => c.id === compId);
      if (comp) {
        draggedCompRef.current = {
          id: compId,
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          startCompX: comp.x,
          startCompY: comp.y,
        };
      }
    }
  };

  // --- Canvas Mouse Handlers (Pan & Wire Drawing) ---
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2) {
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    } else if (e.button === 0) {
      // Left click on empty canvas deselects component or clears wire draft
      if (activeTool === 'select') {
        setSelectedCompId(null);
      } else if (activeTool === 'wire') {
        setWireDraftStart(null);
      }
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
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(3.0, Math.max(0.3, z * factor)));
  };

  // --- Pin Click to Start / Finish Wire ---
  const handlePinMouseDown = (compId: string, pinName: string) => {
    if (!wireDraftStart) {
      setWireDraftStart({ compId, pinName });
      setActiveTool('wire');
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
    <TooltipProvider delay={150}>
      <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden select-none font-sans dark">
        
        {/* 1. Top Window Titlebar (Menubar + Wide Drag Area + Window Controls) */}
        <header className="h-7 bg-[#0e0e11] border-b border-[#222226] pl-2 pr-0 flex items-center justify-between select-none z-50 shrink-0 cursor-default">
          {/* Left Menubar */}
          <div
            ref={menubarRef}
            className="flex items-center gap-0.5"
            data-tauri-drag-region="false"
          >
            <span className="font-semibold text-xs text-zinc-300 tracking-tight pl-1 pr-2 select-none">
              MicroRustSim
            </span>

            {/* Menubar: File */}
            <div className="relative">
              <button
                type="button"
                data-tauri-drag-region="false"
                onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
                onMouseEnter={() => {
                  if (activeMenu) setActiveMenu('file');
                }}
                className={`text-xs h-5 px-2 rounded transition-colors ${
                  activeMenu === 'file'
                    ? 'bg-[#1f1f23] text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#1f1f23]'
                }`}
              >
                File
              </button>

              {activeMenu === 'file' && (
                <div
                  className="absolute top-full left-0 mt-1 w-48 bg-[#18181b] border border-[#27272a] shadow-2xl rounded-lg py-1 text-xs z-50 select-none animate-in fade-in duration-75"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSketchCode(DEFAULT_BLINK_CODE);
                      setStatusMessage('New Project Created');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <GoPlus className="text-zinc-400" /> New Project
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusMessage('Project Saved to SQLite');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <GoFile className="text-zinc-400" /> Save Project
                  </button>
                  <div className="h-px bg-[#27272a] my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(sketchCode);
                      setStatusMessage('Code copied to clipboard');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    Copy Sketch Code
                  </button>
                </div>
              )}
            </div>

            {/* Menubar: View */}
            <div className="relative">
              <button
                type="button"
                data-tauri-drag-region="false"
                onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
                onMouseEnter={() => {
                  if (activeMenu) setActiveMenu('view');
                }}
                className={`text-xs h-5 px-2 rounded transition-colors ${
                  activeMenu === 'view'
                    ? 'bg-[#1f1f23] text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#1f1f23]'
                }`}
              >
                View
              </button>

              {activeMenu === 'view' && (
                <div
                  className="absolute top-full left-0 mt-1 w-56 bg-[#18181b] border border-[#27272a] shadow-2xl rounded-lg py-1 text-xs z-50 select-none animate-in fade-in duration-75"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditor(!showEditor);
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <GoCode className="text-zinc-400" /> Code Editor
                    </span>
                    {showEditor && <GoCheck className="text-emerald-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPalette(!showPalette);
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <GoPackage className="text-zinc-400" /> Component Palette
                    </span>
                    {showPalette && <GoCheck className="text-emerald-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDrawer(!showDrawer);
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <GoTerminal className="text-zinc-400" /> Bottom Console
                    </span>
                    {showDrawer && <GoCheck className="text-emerald-400" />}
                  </button>

                  <div className="h-px bg-[#27272a] my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setShowDrawer(true);
                      setBottomTab('waveform');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <GoGraph className="text-zinc-400" /> Switch to Logic Waveform
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDrawer(true);
                      setBottomTab('serial');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <GoTerminal className="text-zinc-400" /> Switch to Serial Monitor
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDrawer(true);
                      setBottomTab('build');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <GoGear className="text-zinc-400" /> Switch to Build Output
                  </button>

                  <div className="h-px bg-[#27272a] my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1.0);
                      setPan({ x: 80, y: 50 });
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    Reset Zoom & Center (100%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom((z) => Math.min(3.0, z * 1.15));
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <GoZoomIn className="text-zinc-400" /> Zoom In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom((z) => Math.max(0.3, z * 0.85));
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <GoZoomOut className="text-zinc-400" /> Zoom Out
                  </button>
                </div>
              )}
            </div>

            {/* Menubar: Window */}
            <div className="relative">
              <button
                type="button"
                data-tauri-drag-region="false"
                onClick={() => setActiveMenu(activeMenu === 'window' ? null : 'window')}
                onMouseEnter={() => {
                  if (activeMenu) setActiveMenu('window');
                }}
                className={`text-xs h-5 px-2 rounded transition-colors ${
                  activeMenu === 'window'
                    ? 'bg-[#1f1f23] text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#1f1f23]'
                }`}
              >
                Window
              </button>

              {activeMenu === 'window' && (
                <div
                  className="absolute top-full left-0 mt-1 w-52 bg-[#18181b] border border-[#27272a] shadow-2xl rounded-lg py-1 text-xs z-50 select-none animate-in fade-in duration-75"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      tauriInvoke('minimize_window');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    Minimize
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      tauriInvoke('toggle_maximize_window');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    Maximize / Restore
                  </button>
                  <div className="h-px bg-[#27272a] my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      tauriInvoke('close_window');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-red-400 hover:bg-zinc-800 text-left transition-colors"
                  >
                    Close Window
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Center Drag Region (Allows moving window effortlessly in normal/minimal mode) */}
          <div
            data-tauri-drag-region
            onMouseDown={(e) => {
              if (e.buttons === 1) tauriInvoke('start_drag_window');
            }}
            onDoubleClick={() => tauriInvoke('toggle_maximize_window')}
            className="flex-1 h-full flex items-center justify-center text-[11px] font-mono text-zinc-500 cursor-default select-none"
          >
            {projectName} — MicroRustSim
          </div>

          {/* Right Window Controls (—, □, ✕) */}
          <div
            className="flex items-center h-full border-l border-[#222226] pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => tauriInvoke('minimize_window')}
              className="h-full w-10 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-[#1f1f23] transition-colors"
              title="Minimize"
            >
              <svg width="10" height="1" viewBox="0 0 10 1">
                <rect width="10" height="1" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => tauriInvoke('toggle_maximize_window')}
              className="h-full w-10 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-[#1f1f23] transition-colors"
              title="Maximize / Restore"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="0.5" y="0.5" width="9" height="9" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => tauriInvoke('close_window')}
              className="h-full w-11 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#e81123] transition-colors"
              title="Close"
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        {/* 2. Secondary Action Toolbar (Dedicated Row, Larger Buttons, Premium Run Color) */}
        <div className="relative h-10 bg-[#121215] border-b border-[#222226] px-3 flex items-center justify-between select-none z-40 shrink-0">
          <div className="flex items-center gap-2">
            
            {/* Run / Pause (Solid, Vibrant Emerald / Amber - High Quality) */}
            {isRunning ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon"
                      onClick={() => {
                        setIsRunning(false);
                        tauriInvoke('pause_simulation');
                      }}
                      className="h-8 w-8 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-md shadow-md border-0 flex items-center justify-center transition-colors"
                    >
                      <PauseIcon className="text-sm" />
                    </Button>
                  }
                />
                <TooltipContent className="text-xs">Pause Simulation</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon"
                      onClick={() => {
                        setIsRunning(true);
                        tauriInvoke('start_simulation');
                      }}
                      className="h-8 w-8 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-md shadow-md shadow-emerald-950/40 border-0 flex items-center justify-center transition-colors"
                    >
                      <GoPlay className="text-base ml-0.5" />
                    </Button>
                  }
                />
                <TooltipContent className="text-xs">Run Simulation (16 MHz)</TooltipContent>
              </Tooltip>
            )}

            {/* Quick Action: Upload */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCompile}
                    className="h-8 w-8 bg-[#18181b] hover:bg-[#27272a] text-zinc-200 border-zinc-700/60 rounded-md flex items-center justify-center"
                  >
                    <GoZap className="text-base text-zinc-300" />
                  </Button>
                }
              />
              <TooltipContent className="text-xs">Compile & Flash to ATmega328P</TooltipContent>
            </Tooltip>

            {/* Quick Action: Reset */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setIsRunning(false);
                      tauriInvoke('reset_simulation');
                      setSerialLogs([]);
                    }}
                    className="h-8 w-8 bg-[#18181b] hover:bg-[#27272a] text-zinc-400 hover:text-zinc-200 border-zinc-700/60 rounded-md flex items-center justify-center"
                  >
                    <GoSync className="text-base" />
                  </Button>
                }
              />
              <TooltipContent className="text-xs">Reset MCU Clock</TooltipContent>
            </Tooltip>

            {/* Minimal Grey Separator between Run/Upload Controls and Mouse Tools */}
            <div className="w-[1px] h-5 bg-zinc-600/70 mx-2.5 self-center shrink-0" />

            {/* Tool Selection Group: Select (V), Move (M), Wire (W) - Borderless Flat Design */}
            <div className="flex items-center gap-1">
              {/* 1. Select Tool */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => setActiveTool('select')}
                      className={`h-7 px-2.5 flex items-center gap-1.5 text-xs rounded transition-colors ${
                        activeTool === 'select'
                          ? 'bg-[#27272a] text-zinc-100 font-medium'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f1f23]'
                      }`}
                    >
                      <MousePointer className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Select</span>
                    </button>
                  }
                />
                <TooltipContent className="text-xs">Select Tool (V) • Click component to select</TooltipContent>
              </Tooltip>

              {/* 2. Move Tool */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => setActiveTool('move')}
                      className={`h-7 px-2.5 flex items-center gap-1.5 text-xs rounded transition-colors ${
                        activeTool === 'move'
                          ? 'bg-[#27272a] text-zinc-100 font-medium'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f1f23]'
                      }`}
                    >
                      <Move className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Move</span>
                    </button>
                  }
                />
                <TooltipContent className="text-xs">Move Tool (M) • Drag components to reposition</TooltipContent>
              </Tooltip>

              {/* 3. Wire Tool Split Button + Word-Style Floating Color Popup (Zero Borders) */}
              <div className="relative flex items-center" ref={wireMenuRef}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={() => setActiveTool('wire')}
                        className={`h-7 pl-2.5 pr-1.5 flex items-center gap-1.5 text-xs rounded-l transition-colors ${
                          activeTool === 'wire'
                            ? 'bg-[#27272a] text-zinc-100 font-medium'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f1f23]'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <Cable className="w-3.5 h-3.5" />
                          <span
                            className="w-3.5 h-[2px] rounded-full mt-0.5 shadow-sm"
                            style={{ backgroundColor: currentWireColor }}
                          />
                        </div>
                        <span className="text-[11px]">Wire</span>
                      </button>
                    }
                  />
                  <TooltipContent className="text-xs">Wire Tool (W) • Connect pins with wires</TooltipContent>
                </Tooltip>

                {/* Dropdown Chevron for Word-style Floating Color Popup (Zero Border) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowWireColorMenu((prev) => !prev);
                  }}
                  className={`h-7 px-1.5 flex items-center justify-center rounded-r transition-colors ${
                    activeTool === 'wire' || showWireColorMenu
                      ? 'bg-[#27272a] text-zinc-100 hover:bg-[#333338]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f1f23]'
                  }`}
                  title="Choose Wire Color"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>

                {/* Floating Word-Style Color Picker Popover */}
                {showWireColorMenu && (
                  <div
                    className="absolute top-full left-0 mt-1 w-64 p-3 bg-[#18181b] border border-[#27272a] shadow-2xl rounded-lg text-xs z-50 animate-in fade-in zoom-in-95 duration-100 select-none"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
                      <span className="font-semibold text-xs text-zinc-200">Wire Color</span>
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-zinc-700 shadow-sm"
                        style={{ backgroundColor: currentWireColor }}
                      />
                    </div>

                    <div className="py-2.5">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block mb-2">
                        Electronic Color Codes
                      </span>
                      <div className="grid grid-cols-6 gap-1.5">
                        {WIRE_COLORS.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            title={`${c.name} (${c.role})`}
                            onClick={() => {
                              setCurrentWireColor(c.hex);
                              setCustomColorInput(c.hex);
                              setActiveTool('wire');
                              setShowWireColorMenu(false);
                            }}
                            className={`relative w-8 h-7 rounded flex items-center justify-center transition-all ${
                              currentWireColor === c.hex
                                ? 'ring-2 ring-white ring-offset-2 ring-offset-[#18181b] scale-105'
                                : 'hover:scale-105 border border-zinc-700/60'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          >
                            {currentWireColor === c.hex && (
                              <Check
                                className={`w-3.5 h-3.5 ${
                                  c.hex === '#ffffff' || c.hex === '#eab308' || c.hex === '#22c55e'
                                    ? 'text-zinc-900'
                                    : 'text-white'
                                } stroke-[3]`}
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="text-[10px] text-zinc-400 font-mono flex items-center justify-between px-2 py-1 bg-[#121215] rounded border border-zinc-800 mb-2">
                      <span>Active:</span>
                      <span className="text-zinc-200 font-medium">
                        {WIRE_COLORS.find((w) => w.hex.toLowerCase() === currentWireColor.toLowerCase())?.name || 'Custom'} (
                        {WIRE_COLORS.find((w) => w.hex.toLowerCase() === currentWireColor.toLowerCase())?.role || 'Custom'})
                      </span>
                    </div>

                    {/* Dark-Themed Custom Hex Color Input (Never opens white native dialog) */}
                    <div className="pt-2 border-t border-[#27272a] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded border border-zinc-700 shrink-0 shadow-sm"
                          style={{
                            backgroundColor: /^#([0-9A-Fa-f]{3}){1,2}$/.test(customColorInput)
                              ? customColorInput
                              : currentWireColor,
                          }}
                        />
                        <input
                          type="text"
                          value={customColorInput}
                          onChange={(e) => setCustomColorInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(customColorInput)) {
                                setCurrentWireColor(customColorInput);
                                setActiveTool('wire');
                                setShowWireColorMenu(false);
                              }
                            }
                          }}
                          placeholder="#HEX"
                          maxLength={7}
                          className="h-6 w-20 px-1.5 bg-[#09090b] border border-zinc-800 focus:border-zinc-500 rounded text-zinc-200 font-mono text-[11px] focus:outline-none uppercase"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(customColorInput)) {
                            setCurrentWireColor(customColorInput);
                            setActiveTool('wire');
                            setShowWireColorMenu(false);
                          }
                        }}
                        className="h-6 px-2.5 bg-[#27272a] hover:bg-[#3f3f46] text-zinc-200 rounded text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Set
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Status */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 font-mono">{projectName}</span>
            <Badge
              variant="outline"
              className={`font-mono text-xs gap-1.5 h-6 px-2.5 border-zinc-800 ${
                isRunning
                  ? 'border-emerald-600/50 text-emerald-400 bg-emerald-950/30'
                  : 'text-zinc-500 bg-[#18181b]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                }`}
              />
              {isRunning ? '16 MHz' : 'PAUSED'}
            </Badge>
          </div>
        </div>

        {/* 2. Main Resizable Workspace (Left Editor, Center Canvas, Right Palette, Bottom Terminal) */}
        <ResizablePanelGroup orientation="vertical" className="flex-1 overflow-hidden">
          
          {/* Top Resizable Section: Editor + Canvas + Component Palette */}
          <ResizablePanel id="workspace-top" defaultSize="72%" minSize="30%">
            <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
              
              {/* Left Sidebar: Monaco Code Editor */}
              {showEditor && (
                <>
                  <ResizablePanel id="editor-panel" defaultSize="26%" minSize="15%" maxSize="55%">
                    <aside className="h-full flex flex-col bg-[#121215] border-r border-[#222226] overflow-hidden">
                      <div className="h-7 px-3 border-b border-[#222226] flex items-center justify-between text-xs text-zinc-400 bg-[#121215] shrink-0">
                        <span className="font-medium text-zinc-300 flex items-center gap-1.5 text-xs">
                          <GoFile className="text-zinc-500" /> sketch.ino
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setShowEditor(false)}
                          title="Collapse Editor"
                          className="h-5 w-5 text-zinc-500 hover:text-zinc-200"
                        >
                          <GoSidebarCollapse />
                        </Button>
                      </div>
                      <div className="flex-1 overflow-hidden bg-[#121215]">
                        <Editor
                          height="100%"
                          defaultLanguage="cpp"
                          theme="microrustsim-dark"
                          beforeMount={setupMonacoTheme}
                          onMount={(_editor, monaco) => {
                            monaco.editor.setTheme('microrustsim-dark');
                          }}
                          value={sketchCode}
                          onChange={(val) => setSketchCode(val || '')}
                          loading={
                            <div className="h-full w-full bg-[#121215] flex items-center justify-center text-xs text-zinc-500">
                              Loading editor...
                            </div>
                          }
                          options={{
                            minimap: { enabled: false },
                            fontSize: 13,
                            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            padding: { top: 8 },
                            cursorBlinking: 'smooth',
                            smoothScrolling: true,
                            renderLineHighlight: 'line',
                          }}
                        />
                      </div>
                    </aside>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                </>
              )}

              {/* Center Canvas: Interactive Breadboard & Circuit Simulator */}
              <ResizablePanel id="canvas-panel" minSize="30%">
                <main
                  className={`h-full w-full relative overflow-hidden canvas-grid bg-[#09090b] ${
                    activeTool === 'wire' ? 'cursor-crosshair' : 'cursor-default'
                  }`}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onWheel={handleCanvasWheel}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {/* Viewport Transform Container */}
                  <div
                    className="absolute inset-0 pointer-events-none origin-top-left"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    }}
                  >
                    {/* Wires Layer */}
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

                    {/* Circuit Components */}
                    {components.map((c) => {
                      const isSelected = selectedCompId === c.id;
                      const outlineClass = isSelected
                        ? 'outline outline-1 outline-white/85 ring-1 ring-white/40 shadow-sm shadow-white/5 rounded'
                        : activeTool === 'select'
                        ? 'hover:outline hover:outline-1 hover:outline-white/30 rounded'
                        : '';

                      const cursorClass =
                        activeTool === 'move'
                          ? 'cursor-grab active:cursor-grabbing'
                          : activeTool === 'wire'
                          ? 'cursor-crosshair'
                          : 'cursor-pointer';

                      const wrapperProps = {
                        key: c.id,
                        className: `pointer-events-auto transition-[outline,ring] duration-75 ${outlineClass} ${cursorClass}`,
                        style: {
                          position: 'absolute' as const,
                          left: c.x,
                          top: c.y,
                          width: 'fit-content',
                          height: 'fit-content',
                        },
                        onMouseDown: (e: React.MouseEvent) => handleComponentMouseDown(c.id, e),
                        onClick: (e: React.MouseEvent) => {
                          e.stopPropagation();
                          setSelectedCompId(c.id);
                        },
                      };

                      if (c.kind === 'arduino_uno') {
                        return (
                          <div {...wrapperProps}>
                            <ArduinoUno
                              pin13Lit={pin13State}
                              onPinMouseDown={(pin: string, e: React.MouseEvent) => {
                                e.stopPropagation();
                                handlePinMouseDown(c.id, pin);
                              }}
                            />
                          </div>
                        );
                      }

                      if (c.kind === 'breadboard') {
                        return (
                          <div {...wrapperProps}>
                            <Breadboard
                              onPinMouseDown={(pin: string, e: React.MouseEvent) => {
                                e.stopPropagation();
                                handlePinMouseDown(c.id, pin);
                              }}
                            />
                          </div>
                        );
                      }

                      if (c.kind === 'led') {
                        return (
                          <div {...wrapperProps}>
                            <Led
                              id={c.id}
                              color={(c.props.color as any) || 'red'}
                              isLit={litLeds.has(c.id) || (c.id === 'led1' && pin13State)}
                              onPinMouseDown={(pin: string, e: React.MouseEvent) => {
                                e.stopPropagation();
                                handlePinMouseDown(c.id, pin);
                              }}
                            />
                          </div>
                        );
                      }

                      if (c.kind === 'resistor') {
                        return (
                          <div {...wrapperProps}>
                            <Resistor
                              ohms={c.props.ohms || 220}
                              onPinMouseDown={(pin: string, e: React.MouseEvent) => {
                                e.stopPropagation();
                                handlePinMouseDown(c.id, pin);
                              }}
                            />
                          </div>
                        );
                      }

                      if (c.kind === 'pushbutton') {
                        return (
                          <div {...wrapperProps}>
                            <Pushbutton
                              id={c.id}
                              isInteractive={activeTool !== 'move'}
                              onPinMouseDown={(pin: string, e: React.MouseEvent) => {
                                e.stopPropagation();
                                handlePinMouseDown(c.id, pin);
                              }}
                              onPressChange={(pressed: boolean) => {
                                tauriInvoke('press_button', { id: c.id, pressed });
                              }}
                            />
                          </div>
                        );
                      }

                      if (c.kind === 'potentiometer') {
                        return (
                          <div {...wrapperProps}>
                            <Potentiometer
                              id={c.id}
                              value={c.props.value ?? 0.5}
                              isInteractive={activeTool !== 'move'}
                              onValueChange={(val: number) => {
                                setComponents((prev) =>
                                  prev.map((item) =>
                                    item.id === c.id ? { ...item, props: { ...item.props, value: val } } : item
                                  )
                                );
                                tauriInvoke('set_potentiometer', { id: c.id, value: val });
                              }}
                              onPinMouseDown={(pin: string, e: React.MouseEvent) => {
                                e.stopPropagation();
                                handlePinMouseDown(c.id, pin);
                              }}
                            />
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>

                  {/* Wire Dragging Floating Hint */}
                  {wireDraftStart && (
                    <div className="absolute top-3 left-3 bg-[#18181b]/90 border border-zinc-700 px-2.5 py-1 rounded text-[11px] text-zinc-300 shadow-md">
                      Routing wire from <span className="font-mono text-emerald-400">{wireDraftStart.pinName}</span>. Click target pin to connect.
                    </div>
                  )}
                </main>
              </ResizablePanel>

              {/* Right Sidebar: Component Library Palette */}
              {showPalette && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel id="palette-panel" defaultSize="22%" minSize="14%" maxSize="40%">
                    <aside className="h-full flex flex-col bg-[#121215] border-l border-[#222226] overflow-hidden">
                      <div className="h-7 px-3 border-b border-[#222226] flex items-center justify-between text-xs text-zinc-400 bg-[#121215] shrink-0">
                        <span className="font-medium text-zinc-300 flex items-center gap-1.5 text-xs">
                          <GoPackage className="text-zinc-500" /> Components
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setShowPalette(false)}
                          title="Collapse Palette"
                          className="h-5 w-5 text-zinc-500 hover:text-zinc-200"
                        >
                          <GoSidebarCollapse className="rotate-180" />
                        </Button>
                      </div>

                      <ScrollArea className="flex-1 p-2 text-xs">
                        <div className="space-y-3">
                          {/* Core Processing (No Emoji) */}
                          <Collapsible defaultOpen>
                            <CollapsibleTrigger className="flex items-center justify-between w-full py-1 px-1.5 rounded hover:bg-[#1a1a1e] font-medium text-zinc-200 text-xs">
                              <span className="flex items-center gap-1.5">
                                <GoCpu className="text-zinc-400" /> Core Processing
                              </span>
                              <span className="text-zinc-500 text-[10px]">▼</span>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-1 pl-1 space-y-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const id = `uno_${components.length + 1}`;
                                  setComponents((prev) => [
                                    ...prev,
                                    { id, kind: 'arduino_uno', x: 100, y: 100, props: {} },
                                  ]);
                                }}
                                className="w-full justify-start text-xs h-7 gap-1.5 border-zinc-800 bg-[#18181b] hover:bg-[#222226] text-zinc-200"
                              >
                                <GoPlus className="text-zinc-400" />
                                <span>Arduino Uno R3</span>
                              </Button>
                            </CollapsibleContent>
                          </Collapsible>

                          {/* Prototyping (No Emoji) */}
                          <Collapsible defaultOpen>
                            <CollapsibleTrigger className="flex items-center justify-between w-full py-1 px-1.5 rounded hover:bg-[#1a1a1e] font-medium text-zinc-200 text-xs">
                              <span>Prototyping</span>
                              <span className="text-zinc-500 text-[10px]">▼</span>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-1 pl-1 space-y-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const id = `bb_${components.length + 1}`;
                                  setComponents((prev) => [
                                    ...prev,
                                    { id, kind: 'breadboard', x: 300, y: 100, props: {} },
                                  ]);
                                }}
                                className="w-full justify-start text-xs h-7 gap-1.5 border-zinc-800 bg-[#18181b] hover:bg-[#222226] text-zinc-200"
                              >
                                <GoPlus className="text-zinc-400" />
                                <span>Half Breadboard</span>
                              </Button>
                            </CollapsibleContent>
                          </Collapsible>

                          {/* Outputs (No Emoji) */}
                          <Collapsible defaultOpen>
                            <CollapsibleTrigger className="flex items-center justify-between w-full py-1 px-1.5 rounded hover:bg-[#1a1a1e] font-medium text-zinc-200 text-xs">
                              <span>Outputs</span>
                              <span className="text-zinc-500 text-[10px]">▼</span>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-1 pl-1 grid grid-cols-3 gap-1">
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
                                  className="capitalize text-[11px] h-6 px-1 border-zinc-800 bg-[#18181b] hover:bg-[#222226] text-zinc-300"
                                >
                                  {col}
                                </Button>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>

                          {/* Passives (No Emoji) */}
                          <Collapsible defaultOpen>
                            <CollapsibleTrigger className="flex items-center justify-between w-full py-1 px-1.5 rounded hover:bg-[#1a1a1e] font-medium text-zinc-200 text-xs">
                              <span>Passives</span>
                              <span className="text-zinc-500 text-[10px]">▼</span>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-1 pl-1 space-y-1">
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
                                  className="w-full justify-start text-xs h-7 border-zinc-800 bg-[#18181b] hover:bg-[#222226] text-zinc-300"
                                >
                                  Resistor ({ohms >= 1000 ? `${ohms / 1000}kΩ` : `${ohms}Ω`})
                                </Button>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>

                          {/* Interactive Inputs (No Emoji) */}
                          <Collapsible defaultOpen>
                            <CollapsibleTrigger className="flex items-center justify-between w-full py-1 px-1.5 rounded hover:bg-[#1a1a1e] font-medium text-zinc-200 text-xs">
                              <span>Inputs</span>
                              <span className="text-zinc-500 text-[10px]">▼</span>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-1 pl-1 space-y-1">
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
                                className="w-full justify-start text-xs h-7 border-zinc-800 bg-[#18181b] hover:bg-[#222226] text-zinc-300"
                              >
                                Pushbutton
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
                                className="w-full justify-start text-xs h-7 border-zinc-800 bg-[#18181b] hover:bg-[#222226] text-zinc-300"
                              >
                                Potentiometer (ADC)
                              </Button>
                            </CollapsibleContent>
                          </Collapsible>

                          {/* Component Inspector & Deletion */}
                          {selectedCompId && (
                            <div className="pt-2 border-t border-[#222226]">
                              <span className="text-[10px] font-mono text-zinc-400 block mb-1">
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
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          {/* Bottom Resizable Section: Serial Monitor, Logic Waveform & Build Output */}
          {showDrawer && (
            <>
              <ResizableHandle withHandle orientation="horizontal" />
              <ResizablePanel id="bottom-panel" defaultSize="28%" minSize="12%" maxSize="65%">
                <footer className="h-full flex flex-col bg-[#121215] border-t border-[#222226] overflow-hidden">
                  <Tabs
                    value={bottomTab}
                    onValueChange={(val) => setBottomTab(val as any)}
                    className="flex-1 flex flex-col h-full"
                  >
                    {/* Tabs Bar */}
                    <div className="h-7 px-2 border-b border-[#222226] flex items-center justify-between bg-[#121215] shrink-0">
                      <TabsList variant="line" className="h-7 gap-2 bg-transparent p-0">
                        <TabsTrigger value="serial" className="text-xs h-7 gap-1.5 text-zinc-400 data-[state=active]:text-zinc-100">
                          <GoTerminal className="text-xs" /> Serial Monitor
                        </TabsTrigger>
                        <TabsTrigger value="waveform" className="text-xs h-7 gap-1.5 text-zinc-400 data-[state=active]:text-zinc-100">
                          <GoGraph className="text-xs" /> Logic Waveform
                        </TabsTrigger>
                        <TabsTrigger value="build" className="text-xs h-7 gap-1.5 text-zinc-400 data-[state=active]:text-zinc-100">
                          <GoGear className="text-xs" /> Build Output
                        </TabsTrigger>
                      </TabsList>

                      {/* Tab Specific Action Controls */}
                      <div className="flex items-center gap-1.5">
                        {bottomTab === 'serial' && (
                          <>
                            <select
                              value={baudRate}
                              onChange={(e) => setBaudRate(Number(e.target.value))}
                              className="bg-[#18181b] border border-zinc-800 text-[11px] text-zinc-300 rounded px-1.5 py-0.5"
                            >
                              <option value={9600}>9600 baud</option>
                              <option value={115200}>115200 baud</option>
                            </select>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setSerialLogs([])}
                              title="Clear Serial Console"
                              className="h-5 w-5 text-zinc-500 hover:text-zinc-200"
                            >
                              <GoTrash />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setShowDrawer(false)}
                          title="Collapse Panel"
                          className="h-5 w-5 text-zinc-500 hover:text-zinc-200"
                        >
                          <GoSidebarCollapse className="-rotate-90" />
                        </Button>
                      </div>
                    </div>

                    {/* Tab Content: Serial Monitor */}
                    <TabsContent value="serial" className="flex-1 overflow-hidden p-2 font-mono text-xs text-zinc-400 m-0">
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
                        <div className="flex items-center gap-2 pt-1.5 border-t border-[#222226] mt-1 shrink-0">
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
                            className="flex-1 h-6 text-xs bg-[#18181b] border-zinc-800 text-zinc-200"
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
                            className="h-6 px-2.5 text-xs bg-zinc-200 text-zinc-900 hover:bg-zinc-100 font-medium"
                          >
                            Send
                          </Button>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Tab Content: High-DPI Crisp Waveform */}
                    <TabsContent value="waveform" className="flex-1 overflow-hidden p-1 m-0">
                      <LogicWaveform history={logicHistory} />
                    </TabsContent>

                    {/* Tab Content: Build Output */}
                    <TabsContent value="build" className="flex-1 overflow-hidden p-2 font-mono text-xs text-zinc-400 m-0">
                      <ScrollArea className="h-full">
                        <div className="whitespace-pre-wrap leading-relaxed">{buildLogs}</div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </footer>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {/* 3. Status Bar */}
        <div className="h-5 bg-[#121215] border-t border-[#222226] px-3 flex items-center justify-between text-[10px] text-zinc-500 shrink-0">
          <span>{statusMessage}</span>
          <span>ATmega328P @ 16 MHz • Pure Rust + Tauri v2</span>
        </div>

      </div>
    </TooltipProvider>
  );
}
