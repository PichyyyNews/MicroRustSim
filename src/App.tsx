import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  GoFileDirectory,
  GoClock,
  GoSidebarCollapse,
  GoCheck,
  GoZoomIn,
  GoZoomOut,
  GoCpu,
  GoX,
  GoCopy,
} from 'react-icons/go';
import {
  MousePointer,
  Move,
  Cable,
  ChevronDown,
  Check,
  Eraser,
  RotateCw,
  RotateCcw,
  Scissors,
  Clipboard,
  Search,
  Replace,
  FlipHorizontal,
  CornerDownRight,
  Spline,
  SlidersHorizontal,
  FolderOpen,
  Type,
} from 'lucide-react';

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

import { ArduinoUno, ARDUINO_PINS } from './components/ArduinoUno';
import { Breadboard } from './components/Breadboard';
import { Led } from './components/Led';
import { Resistor } from './components/Resistor';
import { Pushbutton } from './components/Pushbutton';
import { Potentiometer } from './components/Potentiometer';
import { WireLayer, getOrthoVertices, updateOrthoSegment } from './components/WireLayer';
import { LogicWaveform, WaveformChannel } from './components/LogicWaveform';
import { FaultOverlay } from './components/FaultOverlay';
import { FileExplorer } from './components/FileExplorer';
import { PropertyInspector } from './components/PropertyInspector';
import { CreateProjectModal, ProjectTemplate } from './components/CreateProjectModal';
import { OpenProjectModal } from './components/OpenProjectModal';
import { SettingsModal } from './components/SettingsModal';
import { CommandPaletteSearch } from './components/CommandPaletteSearch';
import { CanvasShortcutsHelp } from './components/CanvasShortcutsHelp';
import { UnsavedChangesModal } from './components/UnsavedChangesModal';
import { TextLabel } from './components/TextLabel';
import { CanvasContextMenu } from './components/CanvasContextMenu';
import { UploadModal } from './components/UploadModal';
import { RenameModal } from './components/RenameModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  CircuitComponent,
  CircuitWire,
  CircuitFault,
  StepResult,
  ComponentKind,
  ProjectFileEntry,
  ProjectData,
  RecentProject,
  WorkspaceLayout,
  OpenTab,
} from './types';

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

async function tauriInvokeStrict<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (err: any) {
    if (typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window) && !('__TAURI__' in window)) {
      console.warn(`[Tauri Mock Preview] Simulated ${cmd}`, args);
      if (cmd === 'create_project_dir') {
        const name = args.name || 'Project';
        if (name.toLowerCase() === 'exists' || name.toLowerCase() === 'duplicate') {
          throw new Error(`Directory already exists: ./${name}`);
        }
        return {
          name,
          path: `./${name}`,
          sketch_code: args.sketch || '',
          diagram_json: args.diagram || '',
          metadata_json: '{}',
          files: [
            { name: 'sketch.ino', path: `./${name}/sketch.ino`, relative_path: 'sketch.ino', is_dir: false },
            { name: 'config.h', path: `./${name}/config.h`, relative_path: 'config.h', is_dir: false },
          ],
        } as unknown as T;
      }
    }
    throw err;
  }
}

function stripAnsi(text: string): string {
  return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

const PauseIcon = ({ className }: { className?: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={className}>
    <rect x="3" y="2" width="3.5" height="12" rx="1" />
    <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
  </svg>
);

function getComponentBoundingSize(kind: ComponentKind): { w: number; h: number } {
  switch (kind) {
    case 'arduino_uno':
      return { w: 320, h: 220 };
    case 'breadboard':
      return { w: 320, h: 140 };
    case 'led':
      return { w: 60, h: 60 };
    case 'resistor':
      return { w: 60, h: 30 };
    case 'pushbutton':
      return { w: 52, h: 52 };
    case 'potentiometer':
      return { w: 60, h: 60 };
    case 'text_label':
      return { w: 120, h: 40 };
    default:
      return { w: 60, h: 60 };
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
    rules: [],
    colors: {
      'editor.background': '#121215',
      'editorGutter.background': '#121215',
      'editorLineNumber.foreground': '#52525b',
      'editorLineNumber.activeForeground': '#c6c6c6',
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
      'scrollbarSlider.background': '#27272a40',
      'scrollbarSlider.hoverBackground': '#27272a80',
      'scrollbarSlider.activeBackground': '#3f3f46',
    },
  });
  monaco.editor.setTheme('microrustsim-dark');
};

export default function App() {
  // --- Menubar Active Menu (File, Edit, View & Window, Settings, About) ---
  const [activeMenu, setActiveMenu] = useState<'file' | 'edit' | 'view' | 'settings' | 'about' | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState(13);
  const [editorMinimap, setEditorMinimap] = useState(false);
  const [editorLineNumbers, setEditorLineNumbers] = useState(true);
  const [editorWordWrap, setEditorWordWrap] = useState(false);
  const [autoSaveOnRun, setAutoSaveOnRun] = useState(true);
  const [autoScrollSerial, setAutoScrollSerial] = useState(true);
  const [canvasGridVisible, setCanvasGridVisible] = useState(true);
  const [clipboardComponent, setClipboardComponent] = useState<CircuitComponent | null>(null);
  const [clipboardComponents, setClipboardComponents] = useState<CircuitComponent[]>([]);
  const [selectedCompIds, setSelectedCompIds] = useState<Set<string>>(new Set());
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const selectionBoxRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    rectLeft: number;
    rectTop: number;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'single' | 'group' | 'canvas';
    compId?: string;
  } | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [renameModalComp, setRenameModalComp] = useState<{ id: string; name: string } | null>(null);
  const clipboardCompRef = useRef<CircuitComponent | null>(null);
  const clipboardComponentsRef = useRef<CircuitComponent[]>([]);
  const editorRef = useRef<any>(null);
  const [canvasHoverInfo, setCanvasHoverInfo] = useState<string>('');
  const menubarRef = useRef<HTMLDivElement>(null);

  // --- Active Tool Mode (Select, Move, Wire, Eraser, Text) & Word-style Color Popup ---
  const [activeTool, setActiveTool] = useState<'select' | 'move' | 'wire' | 'eraser' | 'text'>('select');
  const [wireRoutingMode, setWireRoutingMode] = useState<'curve' | 'ortho'>('curve');
  const draggedWaypointRef = useRef<{
    wireId: string;
    index: number;
    startMouseX: number;
    startMouseY: number;
    startWpX: number;
    startWpY: number;
  } | null>(null);
  const draggedSegmentRef = useRef<{
    wireId: string;
    segIndex: number;
    orientation: 'horizontal' | 'vertical';
    startMouseX: number;
    startMouseY: number;
    startVertices: { x: number; y: number }[];
  } | null>(null);
  const [showWireColorMenu, setShowWireColorMenu] = useState(false);
  const [customColorInput, setCustomColorInput] = useState('#22C55E');
  const wireMenuRef = useRef<HTMLDivElement>(null);
  const draggedMultiCompRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    positions: { id: string; x: number; y: number }[];
  } | null>(null);
  const draggedCompRef = useRef<{
    id: string;
    startMouseX: number;
    startMouseY: number;
    startCompX: number;
    startCompY: number;
  } | null>(null);

  // --- UI Layout & Drawers (Persisted to SQLite) ---
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [layoutConfig, setLayoutConfig] = useState<WorkspaceLayout>({
    leftColumnSize: 26,
    centerColumnSize: 52,
    rightColumnSize: 22,
    leftEditorSplit: 55,
    leftExplorerSplit: 45,
    centerCanvasSplit: 70,
    centerTerminalSplit: 30,
    rightPaletteSplit: 45,
    rightInspectorSplit: 55,
  });

  const [showEditor, setShowEditor] = useState(true);
  const [showPalette, setShowPalette] = useState(true);
  const [showExplorer, setShowExplorer] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [bottomTab, setBottomTab] = useState<'serial' | 'waveform' | 'build'>('serial');

  // --- Initial Loading Splash Screen State ---
  const [isAppLoading, setIsAppLoading] = useState(true);

  useEffect(() => {
    // Graceful brief splash delay to allow SQLite layout & last project to settle smoothly
    const t = setTimeout(() => {
      setIsAppLoading(false);
    }, 700);
    return () => clearTimeout(t);
  }, []);

  // Load layout preferences from SQLite on app startup
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await tauriInvoke<string | null>('get_user_setting', { key: 'workspace_layout' });
        if (saved && mounted) {
          const parsed = JSON.parse(saved) as WorkspaceLayout;
          if (parsed) {
            if (typeof parsed.showEditor === 'boolean') setShowEditor(parsed.showEditor);
            if (typeof parsed.showExplorer === 'boolean') setShowExplorer(parsed.showExplorer);
            if (typeof parsed.showTerminal === 'boolean') setShowTerminal(parsed.showTerminal);
            if (typeof parsed.showPalette === 'boolean') setShowPalette(parsed.showPalette);
            if (typeof parsed.showInspector === 'boolean') setShowInspector(parsed.showInspector);
            setLayoutConfig((prev) => ({ ...prev, ...parsed }));
          }
        }
      } catch (err) {
        console.warn('Failed to load layout from SQLite:', err);
      } finally {
        if (mounted) setLayoutLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Save layout preferences to SQLite (debounced 350ms to prevent SQLite locking on fast dragging)
  const saveLayoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const persistLayout = useCallback((updates: Partial<WorkspaceLayout>) => {
    setLayoutConfig((prev) => {
      const next = { ...prev, ...updates };
      if (saveLayoutTimerRef.current) {
        clearTimeout(saveLayoutTimerRef.current);
      }
      saveLayoutTimerRef.current = setTimeout(async () => {
        try {
          await tauriInvoke('save_user_setting', {
            key: 'workspace_layout',
            value: JSON.stringify(next),
          });
        } catch (err) {
          console.warn('Failed to save layout to SQLite:', err);
        }
      }, 350);
      return next;
    });
  }, []);

  const toggleEditor = () => {
    const next = !showEditor;
    setShowEditor(next);
    persistLayout({ showEditor: next });
  };
  const togglePalette = () => {
    const next = !showPalette;
    setShowPalette(next);
    persistLayout({ showPalette: next });
  };
  const toggleExplorer = () => {
    const next = !showExplorer;
    setShowExplorer(next);
    persistLayout({ showExplorer: next });
  };
  const toggleTerminal = () => {
    const next = !showTerminal;
    setShowTerminal(next);
    persistLayout({ showTerminal: next });
  };
  const toggleInspector = () => {
    const next = !showInspector;
    setShowInspector(next);
    persistLayout({ showInspector: next });
  };

  const handleResetLayoutToDefault = () => {
    const defaultLayout: WorkspaceLayout = {
      leftColumnSize: 26,
      centerColumnSize: 52,
      rightColumnSize: 22,
      leftEditorSplit: 55,
      leftExplorerSplit: 45,
      centerCanvasSplit: 70,
      centerTerminalSplit: 30,
      rightPaletteSplit: 45,
      rightInspectorSplit: 55,
      showEditor: true,
      showExplorer: true,
      showTerminal: true,
      showPalette: true,
      showInspector: true,
    };
    setShowEditor(true);
    setShowExplorer(true);
    setShowTerminal(true);
    setShowPalette(true);
    setShowInspector(true);
    setLayoutConfig(defaultLayout);
    // Force re-mount of panels so default sizes take effect immediately
    setLayoutLoaded(false);
    setTimeout(() => setLayoutLoaded(true), 20);
    // Persist default layout to SQLite
    tauriInvoke('save_user_setting', {
      key: 'workspace_layout',
      value: JSON.stringify(defaultLayout),
    }).catch((err) => console.warn('Failed to reset layout in SQLite:', err));
    setStatusMessage('Workspace layout reset to defaults.');
  };

  // --- Project Management & On-Disk Storage ---
  const [projectName, setProjectName] = useState('Blink_Lab_Uno');
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFileEntry[]>([
    { name: 'sketch.ino', path: 'sketch.ino', relative_path: 'sketch.ino', is_dir: false, size: DEFAULT_BLINK_CODE.length },
    { name: 'diagram.json', path: 'diagram.json', relative_path: 'diagram.json', is_dir: false, size: 520 },
    { name: 'project.json', path: 'project.json', relative_path: 'project.json', is_dir: false, size: 180 },
  ]);
  const [activeFile, setActiveFile] = useState('sketch.ino');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedCloseModal, setShowUnsavedCloseModal] = useState(false);
  const [isSavingOnClose, setIsSavingOnClose] = useState(false);
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('My_Arduino_Lab');
  const [newProjectParentPath, setNewProjectParentPath] = useState('');
  const [showOpenProjectModal, setShowOpenProjectModal] = useState(false);
  const [openProjectPathInput, setOpenProjectPathInput] = useState('');

  // --- Multi-Tab Code Editor State (VS Code Style) ---
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([
    { path: 'sketch.ino', name: 'sketch.ino' },
    { path: 'config.h', name: 'config.h' },
  ]);
  const [activeTabPath, setActiveTabPath] = useState<string>('sketch.ino');
  const [fileContents, setFileContents] = useState<Record<string, string>>({
    'sketch.ino': DEFAULT_BLINK_CODE,
    'config.h':
      '#pragma once\n\n// Hardware Pin Definitions\n#define LED_PIN 13\n#define BUTTON_PIN 2\n#define POT_PIN A0\n\n// UART Baud Configuration\n#define SYSTEM_BAUD 9600\n',
  });

  // --- Simulation & MCU State ---
  const [isRunning, setIsRunning] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [lastCompiledCode, setLastCompiledCode] = useState<string | null>(null);
  const [pin13State, setPin13State] = useState(false);
  const [litLeds, setLitLeds] = useState<Set<string>>(new Set());
  const [ledBrightness, setLedBrightness] = useState<Record<string, number>>({});
  const [serialLogs, setSerialLogs] = useState<string>(
    '[System] MicroRustSim Core Online.\n[System] ATmega328P Cycle-Accurate 16 MHz Engine Ready.\n'
  );
  const [buildLogs, setBuildLogs] = useState<string>('Ready to compile sketches with avr-gcc.\n');
  const [serialInput, setSerialInput] = useState('');
  const [baudRate, setBaudRate] = useState(9600);
  const [copiedTerminal, setCopiedTerminal] = useState(false);
  const [logicHistory, setLogicHistory] = useState<[number, number][]>([]);
  const [pin2History, setPin2History] = useState<[number, number][]>([]);
  const [pinA0History, setPinA0History] = useState<[number, number][]>([]);
  const [circuitFaults, setCircuitFaults] = useState<CircuitFault[]>([]);
  const [currentWireColor, setCurrentWireColor] = useState('#22c55e');
  const serialContainerRef = useRef<HTMLDivElement>(null);

  const handleCopyTerminalLogs = useCallback(() => {
    const text = bottomTab === 'serial' ? serialLogs : buildLogs;
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedTerminal(true);
      setStatusMessage('Terminal logs copied to clipboard');
      setTimeout(() => setCopiedTerminal(false), 2000);
    }
  }, [bottomTab, serialLogs, buildLogs]);

  // --- Sketch Code & Project ---
  const [sketchCode, setSketchCode] = useState(DEFAULT_BLINK_CODE);
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

  const componentsRef = useRef<CircuitComponent[]>(components);
  useEffect(() => {
    componentsRef.current = components;
  }, [components]);

  // --- Wires on Canvas ---
  const [wires, setWires] = useState<CircuitWire[]>([
    { id: 'w1', fromComp: 'uno1', fromPin: '13', toComp: 'led1', toPin: 'anode', color: '#22c55e' },
    { id: 'w2', fromComp: 'led1', fromPin: 'cathode', toComp: 'r1', toPin: '1', color: '#eab308' },
    { id: 'w3', fromComp: 'r1', fromPin: '2', toComp: 'uno1', toPin: 'GND', color: '#18181b' },
    { id: 'w4', fromComp: 'uno1', fromPin: '2', toComp: 'btn1', toPin: '1a', color: '#f59e0b' },
    { id: 'w5', fromComp: 'btn1', fromPin: '2a', toComp: 'uno1', toPin: 'GND.1', color: '#18181b' },
    { id: 'w6', fromComp: 'uno1', fromPin: '5V', toComp: 'pot1', toPin: '1', color: '#ef4444' },
    { id: 'w7', fromComp: 'pot1', fromPin: '2', toComp: 'uno1', toPin: 'A0', color: '#3b82f6' },
    { id: 'w8', fromComp: 'pot1', fromPin: '3', toComp: 'uno1', toPin: 'GND.2', color: '#18181b' },
  ]);

  // --- Selected Component / Active Wire Creation ---
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [wireDraftStart, setWireDraftStart] = useState<{ compId: string; pinName: string } | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState({ x: 0, y: 0 });

  const waveformChannels = useMemo<WaveformChannel[]>(() => [
    {
      id: 'ch_pin13',
      label: 'Pin 13 (LED)',
      color: '#10b981', // Emerald
      unit: 'V',
      maxVal: 5.0,
      history: logicHistory,
      isDigital: false,
    },
    {
      id: 'ch_pin2',
      label: 'Pin 2 (Button)',
      color: '#f59e0b', // Amber
      unit: 'V',
      maxVal: 5.0,
      history: pin2History,
      isDigital: false,
    },
    {
      id: 'ch_pina0',
      label: 'Pin A0 (Pot Wiper)',
      color: '#3b82f6', // Blue
      unit: 'V',
      maxVal: 5.0,
      history: pinA0History,
      isDigital: false,
    },
  ], [logicHistory, pin2History, pinA0History]);

  const handleClearWaveform = useCallback(() => {
    setLogicHistory([]);
    setPin2History([]);
    setPinA0History([]);
  }, []);

  // Initial circuit sync to Rust simulation engine so components (btn, pot, led, r) and wires are immediately active
  useEffect(() => {
    tauriInvoke('sync_circuit', {
      components: components.map((c) => ({ id: c.id, kind: c.kind, props: c.props || {} })),
      wires: wires.map((w) => ({
        id: w.id,
        from_comp: w.fromComp,
        from_pin: w.fromPin,
        to_comp: w.toComp,
        to_pin: w.toPin,
        color: w.color,
      })),
    });
  }, []);

  // Tauri & Browser window close interception with Unsaved Changes check
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async (event) => {
          if (isDirtyRef.current) {
            event.preventDefault();
            setShowUnsavedCloseModal(true);
          }
        });
      } catch (err) {
        console.debug('Tauri window close listener not active (browser or mock):', err);
      }
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const isSpacePressed = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !e.repeat &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        isSpacePressed.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressed.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

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

  // --- Load Recent Projects on App Mount ---
  const loadRecentProjects = useCallback(async () => {
    const res = await tauriInvoke<RecentProject[]>('list_recent_projects');
    if (res) setRecentProjects(res);
  }, []);

  useEffect(() => {
    loadRecentProjects();
  }, [loadRecentProjects]);

  // --- Export Wokwi Diagram Schema ---
  const exportWokwiDiagram = useCallback(
    (comps: CircuitComponent[], wList: CircuitWire[]) => ({
      version: 1,
      author: 'MicroRustSim User',
      editor: 'microrustsim',
      parts: comps.map((c) => ({
        type: c.kind === 'arduino_uno' ? 'wokwi-arduino-uno' : `wokwi-${c.kind}`,
        id: c.id,
        top: c.y,
        left: c.x,
        attrs: {
          ...c.props,
          rotation: c.rotation || 0,
          flipped: c.flipped || false,
        },
      })),
      connections: wList.map((w) => [
        `${w.fromComp}:${w.fromPin}`,
        `${w.toComp}:${w.toPin}`,
        w.color,
        w.waypoints && w.waypoints.length > 0 ? w.waypoints.map((wp) => [wp.x, wp.y]) : [],
      ]),
    }),
    []
  );

  // --- Import Wokwi Diagram Schema ---
  const importWokwiDiagram = useCallback(
    (diagramJson: string) => {
      try {
        const parsed = JSON.parse(diagramJson);
        if (parsed.parts && Array.isArray(parsed.parts)) {
          const newComps: CircuitComponent[] = parsed.parts.map((p: any) => {
            let kind: ComponentKind = 'resistor';
            if (p.type?.includes('uno')) kind = 'arduino_uno';
            else if (p.type?.includes('breadboard')) kind = 'breadboard';
            else if (p.type?.includes('led')) kind = 'led';
            else if (p.type?.includes('resistor')) kind = 'resistor';
            else if (p.type?.includes('pushbutton') || p.type?.includes('btn')) kind = 'pushbutton';
            else if (p.type?.includes('potentiometer') || p.type?.includes('pot')) kind = 'potentiometer';

            const { rotation, flipped, ...restProps } = p.attrs || {};
            return {
              id: p.id,
              kind,
              x: p.left || 100,
              y: p.top || 100,
              rotation: rotation || 0,
              flipped: flipped || false,
              props: restProps,
            };
          });

          const newWires: CircuitWire[] = (parsed.connections || []).map((conn: any, idx: number) => {
            const from = (conn[0] || '').split(':');
            const to = (conn[1] || '').split(':');
            const color = conn[2] || '#22c55e';
            const waypoints = (conn[3] || []).map((pt: any) => ({
              x: Array.isArray(pt) ? pt[0] : pt.x || 0,
              y: Array.isArray(pt) ? pt[1] : pt.y || 0,
            }));
            return {
              id: `w_imported_${idx}`,
              fromComp: from[0] || 'uno1',
              fromPin: from[1] || '13',
              toComp: to[0] || 'led1',
              toPin: to[1] || 'anode',
              color,
              waypoints,
            };
          });

          setComponents(newComps);
          setWires(newWires);

          // Synchronize all components and wires to backend physical simulation engine
          tauriInvoke('sync_circuit', {
            components: newComps.map((c) => ({ id: c.id, kind: c.kind, props: c.props || {} })),
            wires: newWires.map((w) => ({
              id: w.id,
              from_comp: w.fromComp,
              from_pin: w.fromPin,
              to_comp: w.toComp,
              to_pin: w.toPin,
              color: w.color,
            })),
          });
        }
      } catch (e) {
        console.error('Failed to import diagram.json:', e);
      }
    },
    [syncWireToRust]
  );

  // --- Project Management Functions ---
  const handleOpenFileTab = useCallback(async (filePath: string) => {
    let relPath = filePath;
    if (projectPath && filePath.startsWith(projectPath)) {
      relPath = filePath.slice(projectPath.length).replace(/^[/\\]+/, '');
    }
    const fileName = relPath.split('/').pop() || relPath;
    setActiveFile(relPath);
    setActiveTabPath(relPath);
    setShowEditor(true);

    setOpenTabs((prev) => {
      if (prev.some((t) => t.path === relPath || t.name === fileName)) {
        return prev.map((t) => (t.name === fileName ? { ...t, path: relPath } : t));
      }
      return [...prev, { path: relPath, name: fileName }];
    });

    if (fileContents[relPath] === undefined) {
      if (projectPath) {
        const full = filePath.startsWith(projectPath) ? filePath : `${projectPath}/${relPath}`;
        try {
          const content = await tauriInvoke<string>('read_project_file', { path: full });
          if (content !== null && content !== undefined) {
            setFileContents((prev) => ({ ...prev, [relPath]: content }));
          }
        } catch (e) {
          console.warn('Failed to read file:', e);
        }
      }
    }
  }, [fileContents, projectPath]);

  const handleCloseTab = useCallback((tabPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOpenTabs((prev) => {
      const remaining = prev.filter((t) => t.path !== tabPath);
      if (remaining.length === 0) {
        const fallback = [{ path: 'sketch.ino', name: 'sketch.ino' }];
        setActiveTabPath('sketch.ino');
        setActiveFile('sketch.ino');
        return fallback;
      }
      if (activeTabPath === tabPath) {
        const nextActive = remaining[remaining.length - 1];
        setActiveTabPath(nextActive.path);
        setActiveFile(nextActive.path);
      }
      return remaining;
    });
  }, [activeTabPath]);

  const handleEditorContentChange = useCallback((val: string | undefined) => {
    const nextVal = val || '';
    setFileContents((prev) => ({ ...prev, [activeTabPath]: nextVal }));
    if (activeTabPath === 'sketch.ino' || activeTabPath.endsWith('/sketch.ino')) {
      setSketchCode(nextVal);
    }
    setIsDirty(true);
    setOpenTabs((prev) =>
      prev.map((t) => (t.path === activeTabPath ? { ...t, isDirty: true } : t))
    );
  }, [activeTabPath]);

  const handleSaveProject = useCallback(async () => {
    if (!projectPath) {
      await tauriInvoke('save_project_db', { name: projectName, sketch: sketchCode });
      setIsDirty(false);
      setStatusMessage(`Saved ${projectName} to SQLite`);
      return;
    }

    // Save all active/buffered files to disk
    for (const [relPath, content] of Object.entries(fileContents)) {
      const full = relPath.startsWith(projectPath) ? relPath : `${projectPath}/${relPath}`;
      await tauriInvoke('write_project_file', { path: full, content });
    }

    const diag = JSON.stringify(exportWokwiDiagram(components, wires), null, 2);
    const meta = JSON.stringify(
      {
        name: projectName,
        board: 'arduino:avr:uno',
        mcu: 'atmega328p',
        baud_rate: baudRate,
        updated_at: new Date().toISOString(),
      },
      null,
      2
    );

    await tauriInvoke('save_project_to_disk', {
      path: projectPath,
      sketch: fileContents['sketch.ino'] || sketchCode,
      diagram: diag,
      meta,
    });

    setIsDirty(false);
    setOpenTabs((prev) => prev.map((t) => ({ ...t, isDirty: false })));
    setStatusMessage(`Saved ${projectName}`);
    const tree = await tauriInvoke<ProjectFileEntry[]>('read_dir_tree', { path: projectPath });
    if (tree) setProjectFiles(tree);
  }, [projectPath, projectName, sketchCode, fileContents, components, wires, baudRate, exportWokwiDiagram]);

  // Window Close Handlers (Prompting Save / Discard / Cancel on Unsaved Changes)
  const handleRequestClose = useCallback(() => {
    if (isDirtyRef.current) {
      setShowUnsavedCloseModal(true);
    } else {
      tauriInvoke('close_window');
    }
  }, []);

  const handleCloseSave = useCallback(async () => {
    setIsSavingOnClose(true);
    try {
      await handleSaveProject();
      setIsSavingOnClose(false);
      setShowUnsavedCloseModal(false);
      await tauriInvoke('close_window');
    } catch (err) {
      setIsSavingOnClose(false);
      console.error('Save failed on close:', err);
    }
  }, [handleSaveProject]);

  const handleCloseDiscard = useCallback(async () => {
    setIsDirty(false);
    setShowUnsavedCloseModal(false);
    await tauriInvoke('close_window');
  }, []);

  const handleCloseCancel = useCallback(() => {
    setShowUnsavedCloseModal(false);
  }, []);

  const handleCreateProject = useCallback(
    async (parentPath: string, name: string, template?: ProjectTemplate) => {
      const diag = template
        ? JSON.stringify(template.diagram, null, 2)
        : JSON.stringify(exportWokwiDiagram(components, wires), null, 2);
      const sketch = template ? template.sketch : sketchCode;
      const config = template ? template.config : undefined;

      try {
        const res = await tauriInvokeStrict<ProjectData>('create_project_dir', {
          parentPath: parentPath || '.',
          name,
          sketch,
          diagram: diag,
          config,
        });
        if (res) {
          setProjectName(res.name);
          setProjectPath(res.path);
          setSketchCode(res.sketch_code);
          setProjectFiles(res.files);
          if (res.diagram_json) {
            importWokwiDiagram(res.diagram_json);
          }
          setOpenTabs([
            { path: 'sketch.ino', name: 'sketch.ino' },
            { path: 'config.h', name: 'config.h' },
          ]);
          setActiveTabPath('sketch.ino');
          setActiveFile('sketch.ino');
          setFileContents({
            'sketch.ino': res.sketch_code,
            'config.h': config || '#pragma once\n\n#define LED_PIN 13\n#define SYSTEM_BAUD 9600\n',
            'diagram.json': res.diagram_json,
            'project.json': res.metadata_json,
          });
          setIsDirty(false);
          setStatusMessage(`Project created: ${res.name}`);
          setShowNewProjectModal(false);
          loadRecentProjects();
          tauriInvoke('save_user_setting', {
            key: 'last_opened_project_path',
            value: res.path,
          }).catch((err) => console.warn('Failed to remember last project:', err));
        }
      } catch (err: any) {
        const msg = typeof err === 'string' ? err : err?.message || 'Failed to create project';
        setStatusMessage(`Error creating project: ${msg}`);
        throw err;
      }
    },
    [components, wires, sketchCode, exportWokwiDiagram, importWokwiDiagram, loadRecentProjects]
  );

  const handleBrowseNativeFolder = useCallback(async (): Promise<string | null> => {
    try {
      const selected = await tauriInvoke<string | null>('select_folder_dialog');
      return selected;
    } catch (err) {
      console.error('Failed to select folder:', err);
      return null;
    }
  }, []);

  const handleOpenProject = useCallback(
    async (dirPath: string) => {
      try {
        const res = await tauriInvokeStrict<ProjectData>('open_project_dir', { path: dirPath });
        if (res) {
          setProjectName(res.name);
          setProjectPath(res.path);
          setSketchCode(res.sketch_code);
          if (res.diagram_json) {
            importWokwiDiagram(res.diagram_json);
          }
          setProjectFiles(res.files);

          const initialTabs: OpenTab[] = [
            { path: 'sketch.ino', name: 'sketch.ino' },
          ];
          const newContents: Record<string, string> = {
            'sketch.ino': res.sketch_code,
            'diagram.json': res.diagram_json,
            'project.json': res.metadata_json,
          };

          const configEntry = res.files.find((f) => f.name === 'config.h');
          if (configEntry) {
            initialTabs.push({ path: configEntry.relative_path, name: configEntry.name });
          }

          setOpenTabs(initialTabs);
          setActiveTabPath('sketch.ino');
          setActiveFile('sketch.ino');
          setFileContents(newContents);
          setIsDirty(false);
          setStatusMessage(`Opened: ${res.name}`);
          setShowOpenProjectModal(false);
          loadRecentProjects();

          tauriInvoke('save_user_setting', {
            key: 'last_opened_project_path',
            value: res.path,
          }).catch((err) => console.warn('Failed to remember last project:', err));
        }
      } catch (err: any) {
        const msg = typeof err === 'string' ? err : err?.message || 'Failed to open project';
        console.warn('Failed to open project at path:', dirPath, err);
        setStatusMessage(`Error opening project: ${msg}`);
        throw err;
      }
    },
    [importWokwiDiagram, loadRecentProjects]
  );

  // --- Auto-Restore Last Opened Project on Startup ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const lastPath = await tauriInvoke<string | null>('get_user_setting', {
          key: 'last_opened_project_path',
        });
        if (lastPath && mounted) {
          await handleOpenProject(lastPath);
        }
      } catch (err) {
        console.warn('Failed to auto-restore last opened project:', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [handleOpenProject]);

  const handleOpenNativeFolder = useCallback(async () => {
    try {
      const selected = await tauriInvoke<string | null>('select_folder_dialog');
      if (selected) {
        await handleOpenProject(selected);
      }
    } catch (err) {
      console.error('Failed to open native folder dialog:', err);
    }
  }, [handleOpenProject]);

  const handleRefreshFiles = useCallback(async () => {
    if (projectPath) {
      const tree = await tauriInvoke<ProjectFileEntry[]>('read_dir_tree', { path: projectPath });
      if (tree) setProjectFiles(tree);
    }
  }, [projectPath]);

  const handleCreateFile = useCallback(
    async (fileName: string, isDir?: boolean) => {
      if (!projectPath) return;
      try {
        await tauriInvokeStrict('create_project_dir_entry', {
          dirPath: projectPath,
          relativePath: fileName,
          isDir: !!isDir,
        });
        await handleRefreshFiles();
        if (!isDir) {
          handleOpenFileTab(fileName);
        }
        setStatusMessage(`Created ${isDir ? 'folder' : 'file'}: ${fileName}`);
      } catch (err: any) {
        const msg = typeof err === 'string' ? err : err?.message || 'Failed to create file/folder';
        setStatusMessage(`Error creating ${isDir ? 'folder' : 'file'}: ${msg}`);
      }
    },
    [projectPath, handleRefreshFiles, handleOpenFileTab]
  );

  const handleDeleteFile = useCallback(
    async (filePath: string) => {
      const full = projectPath && !filePath.startsWith(projectPath) ? `${projectPath}/${filePath}` : filePath;
      await tauriInvoke('delete_project_file', { path: full });
      handleRefreshFiles();
    },
    [projectPath, handleRefreshFiles]
  );

  // --- Parametric Property Updates ---
  const handleUpdateComponent = useCallback((id: string, updates: Partial<CircuitComponent>) => {
    setComponents((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...updates };
        if (updates.props) {
          next.props = { ...c.props, ...updates.props };
        }
        return next;
      })
    );
    setIsDirty(true);

    if (updates.props?.ohms !== undefined) {
      tauriInvoke('add_resistor', { id, ohms: updates.props.ohms });
    }
    if (updates.props?.color !== undefined) {
      tauriInvoke('add_led', { id, color: updates.props.color });
    }
    if (updates.props?.value !== undefined) {
      tauriInvoke('set_potentiometer', { id, value: updates.props.value });
    }
  }, []);

  const handleUpdateWire = useCallback(
    (id: string, updates: Partial<CircuitWire>) => {
      setWires((prev) =>
        prev.map((w) => {
          if (w.id !== id) return w;
          const updated = { ...w, ...updates };
          syncWireToRust(updated);
          return updated;
        })
      );
      setIsDirty(true);
    },
    [syncWireToRust]
  );

  // --- Wire Actions: Delete, Color, Routing Mode ---
  const handleDeleteWire = useCallback((wireId: string) => {
    setWires((prev) => prev.filter((w) => w.id !== wireId));
    tauriInvoke('remove_wire', { id: wireId });
    setSelectedWireId((curr) => (curr === wireId ? null : curr));
  }, []);

  const handleToggleRoutingMode = useCallback(() => {
    if (selectedWireId) {
      setWires((prev) =>
        prev.map((w) => {
          if (w.id !== selectedWireId) return w;
          const currentMode = w.routingMode || wireRoutingMode;
          const nextMode: 'curve' | 'ortho' = currentMode === 'curve' ? 'ortho' : 'curve';
          const updated: CircuitWire = { ...w, routingMode: nextMode };
          syncWireToRust(updated);
          return updated;
        })
      );
    } else {
      setWireRoutingMode((m) => (m === 'curve' ? 'ortho' : 'curve'));
    }
  }, [selectedWireId, wireRoutingMode, syncWireToRust]);

  const handleApplyWireColor = useCallback(
    (color: string) => {
      setCurrentWireColor(color);
      setCustomColorInput(color);
      setActiveTool('wire');
      if (selectedWireId) {
        setWires((prev) =>
          prev.map((w) => {
            if (w.id !== selectedWireId) return w;
            const updated: CircuitWire = { ...w, color };
            syncWireToRust(updated);
            return updated;
          })
        );
      }
      setShowWireColorMenu(false);
    },
    [selectedWireId, syncWireToRust]
  );

  const selectedWire = wires.find((w) => w.id === selectedWireId);
  const activeRoutingDisplay: 'curve' | 'ortho' = selectedWire
    ? (selectedWire.routingMode || wireRoutingMode)
    : wireRoutingMode;

  // --- Pin World Position Calculator with Rotation & Flip ---
  const getPinWorldPos = useCallback(
    (compId: string, pinName: string): { x: number; y: number } | null => {
      const comp = components.find((c) => c.id === compId);
      if (!comp) return null;

      let local: { x: number; y: number } | null = null;
      let w = 40;
      let h = 40;

      if (comp.kind === 'arduino_uno') {
        w = 285.2;
        h = 209;
        // Direct lookup or alias resolution
        let offset = ARDUINO_PINS[pinName];
        if (!offset) {
          const upper = pinName.toUpperCase();
          offset = ARDUINO_PINS[upper];
          if (!offset) {
            const clean = upper.replace(/[._-]/g, '');
            if (clean === 'GND' || clean === 'GND3') offset = ARDUINO_PINS['GND'];
            else if (clean === 'GND1') offset = ARDUINO_PINS['GND_1'];
            else if (clean === 'GND2') offset = ARDUINO_PINS['GND_2'];
            else if (clean === '33V' || clean === '3V3') offset = ARDUINO_PINS['3.3V'];
            else if (clean === 'RST') offset = ARDUINO_PINS['RESET'];
            else if (clean.startsWith('D') && ARDUINO_PINS[clean.slice(1)]) offset = ARDUINO_PINS[clean.slice(1)];
          }
        }
        if (offset) local = offset;
      } else if (comp.kind === 'breadboard') {
        w = 540;
        h = 240;
        const X0 = 38;
        const dx = 16;
        const rowY: Record<string, number> = {
          a: 72,
          b: 82,
          c: 92,
          d: 102,
          e: 112,
          f: 134,
          g: 144,
          h: 154,
          i: 164,
          j: 174,
        };

        const pLower = pinName.toLowerCase();
        if (pLower.includes('top') && (pLower.includes('plus') || pLower.includes('+'))) {
          const m = pLower.match(/\d+/);
          const col = m ? parseInt(m[0], 10) : 1;
          local = { x: X0 + (col - 1) * dx, y: 26 };
        } else if (pLower.includes('top') && (pLower.includes('minus') || pLower.includes('-'))) {
          const m = pLower.match(/\d+/);
          const col = m ? parseInt(m[0], 10) : 1;
          local = { x: X0 + (col - 1) * dx, y: 39 };
        } else if ((pLower.includes('bot') || pLower.includes('bottom')) && (pLower.includes('plus') || pLower.includes('+'))) {
          const m = pLower.match(/\d+/);
          const col = m ? parseInt(m[0], 10) : 1;
          local = { x: X0 + (col - 1) * dx, y: 201 };
        } else if ((pLower.includes('bot') || pLower.includes('bottom')) && (pLower.includes('minus') || pLower.includes('-'))) {
          const m = pLower.match(/\d+/);
          const col = m ? parseInt(m[0], 10) : 1;
          local = { x: X0 + (col - 1) * dx, y: 223 };
        } else if (pLower.startsWith('tp.') || pLower.startsWith('tp_') || pLower.startsWith('t+.')) {
          const col = parseInt(pLower.replace(/[^0-9]/g, ''), 10) || 1;
          local = { x: X0 + (col - 1) * dx, y: 26 };
        } else if (pLower.startsWith('tm.') || pLower.startsWith('tm_') || pLower.startsWith('t-.')) {
          const col = parseInt(pLower.replace(/[^0-9]/g, ''), 10) || 1;
          local = { x: X0 + (col - 1) * dx, y: 39 };
        } else if (pLower.startsWith('bp.') || pLower.startsWith('bp_') || pLower.startsWith('b+.')) {
          const col = parseInt(pLower.replace(/[^0-9]/g, ''), 10) || 1;
          local = { x: X0 + (col - 1) * dx, y: 201 };
        } else if (pLower.startsWith('bm.') || pLower.startsWith('bm_') || pLower.startsWith('b-.')) {
          const col = parseInt(pLower.replace(/[^0-9]/g, ''), 10) || 1;
          local = { x: X0 + (col - 1) * dx, y: 223 };
        } else {
          // Check for row pin like 'a_15', 'a15', '15.a', '15a', 'a.15'
          const m1 = pLower.match(/^([a-j])[._-]?(\d+)$/);
          const m2 = pLower.match(/^(\d+)[._-]?([a-j])$/);
          if (m1) {
            const row = m1[1];
            const col = parseInt(m1[2], 10) || 1;
            local = { x: X0 + (col - 1) * dx, y: rowY[row] };
          } else if (m2) {
            const row = m2[2];
            const col = parseInt(m2[1], 10) || 1;
            local = { x: X0 + (col - 1) * dx, y: rowY[row] };
          }
        }
      } else if (comp.kind === 'led') {
        w = 48;
        h = 64;
        const normPin = pinName.toLowerCase();
        if (normPin.startsWith('a') || normPin === '+' || normPin === '1' || normPin.includes('anode')) {
          local = { x: 17, y: 56 };
        } else {
          local = { x: 31, y: 52 };
        }
      } else if (comp.kind === 'resistor') {
        w = 80;
        h = 20;
        const normPin = pinName.toLowerCase();
        if (normPin === '1' || normPin.includes('l') || normPin.startsWith('pin1') || normPin === 'a') {
          local = { x: 4, y: 10 };
        } else {
          local = { x: 76, y: 10 };
        }
      } else if (comp.kind === 'pushbutton') {
        w = 52;
        h = 52;
        const normPin = pinName.toLowerCase();
        if (normPin === '1a' || normPin === '1.l' || normPin === '1_l' || normPin === '1' || normPin === 'tl') {
          local = { x: 0, y: 0 };
        } else if (normPin === '1b' || normPin === '1.r' || normPin === '1_r' || normPin === 'tr') {
          local = { x: 52, y: 0 };
        } else if (normPin === '2a' || normPin === '2.l' || normPin === '2_l' || normPin === '2' || normPin === 'bl') {
          local = { x: 0, y: 52 };
        } else if (normPin === '2b' || normPin === '2.r' || normPin === '2_r' || normPin === 'br') {
          local = { x: 52, y: 52 };
        } else {
          local = { x: 0, y: 0 };
        }
      } else if (comp.kind === 'potentiometer') {
        w = 56;
        h = 64;
        const normPin = pinName.toUpperCase();
        if (normPin === '1' || normPin === 'GND' || normPin.includes('GND')) {
          local = { x: 16, y: 64 };
        } else if (normPin === '2' || normPin === 'SIG' || normPin === 'WIPER' || normPin.includes('SIG')) {
          local = { x: 28, y: 64 };
        } else if (normPin === '3' || normPin === 'VCC' || normPin === '5V' || normPin.includes('VCC')) {
          local = { x: 40, y: 64 };
        } else {
          local = { x: 28, y: 64 };
        }
      }

      if (!local) local = { x: 20, y: 20 };

      // Rotate and flip around center
      const cx = w / 2;
      const cy = h / 2;
      let dx = local.x - cx;
      let dy = local.y - cy;
      if (comp.flipped) dx = -dx;

      const rot = comp.rotation || 0;
      if (rot !== 0) {
        const rad = (rot * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;
        dx = rx;
        dy = ry;
      }

      return {
        x: Math.round(comp.x + cx + dx),
        y: Math.round(comp.y + cy + dy),
      };
    },
    [components]
  );

  // --- Simulation Cycle Loop (60 FPS, Strict Single-Flight Concurrency) ---
  const isRunningRef = useRef(isRunning);
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const isSteppingRef = useRef(false);

  useEffect(() => {
    let animId: number;
    let cancelled = false;
    let lastTime = performance.now();
    let steppingStartTime = 0;

    const resetTiming = () => {
      lastTime = performance.now();
      isSteppingRef.current = false;
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        resetTiming();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', resetTiming);

    const loop = async () => {
      if (cancelled) return;

      // If window is minimized or hidden, skip heavy IPC stepping
      if (document.hidden) {
        lastTime = performance.now();
        animId = requestAnimationFrame(loop);
        return;
      }

      // Watchdog: If an IPC call got delayed or hung during window dragging on Windows
      if (isSteppingRef.current && performance.now() - steppingStartTime > 150) {
        isSteppingRef.current = false;
      }

      if (!isSteppingRef.current) {
        isSteppingRef.current = true;
        steppingStartTime = performance.now();
        try {
          const now = performance.now();
          const elapsedSec = (now - lastTime) / 1000;
          lastTime = now;

          // Target 16,000,000 cycles / sec for exact 1:1 real-time match with 16 MHz ATmega328P
          // Clamp elapsed time between 0.005s and 0.035s to prevent any stuttering or time jumps
          const clampedElapsed = Math.min(0.035, Math.max(0.005, elapsedSec));
          const cycles = isRunningRef.current
            ? Math.round(clampedElapsed * 16_000_000)
            : 0;

          const res = await tauriInvoke<StepResult>('step_simulation', { cycles });

          if (!cancelled && res) {
            setPin13State(res.pin13);
            setLitLeds(new Set(res.lit_leds));
            setLedBrightness(res.led_brightness || {});
            setCircuitFaults(res.faults || []);
            if (res.serial_output) {
              setSerialLogs((prev) => (prev + res.serial_output!).slice(-65536));
            }

            const t = isRunningRef.current ? res.millis : now;
            const v13 = res.mcu_pin_voltages?.['13'] ?? (res.pin13 ? 5.0 : 0.0);
            const v2 = res.mcu_pin_voltages?.['2'] ?? (res.pin_voltages?.['btn1:1a'] ?? 5.0);
            const vA0 = res.mcu_pin_voltages?.['A0'] ?? res.pin_voltages?.['pot1:2'] ?? 0.0;

            setLogicHistory((prev) => {
              const next = [...prev, [t, v13] as [number, number]];
              return next.slice(-300);
            });
            setPin2History((prev) => {
              const next = [...prev, [t, v2] as [number, number]];
              return next.slice(-300);
            });
            setPinA0History((prev) => {
              const next = [...prev, [t, vA0] as [number, number]];
              return next.slice(-300);
            });
          }
        } catch (err) {
          console.error('step_simulation error:', err);
        } finally {
          isSteppingRef.current = false;
        }
      }

      if (!cancelled) {
        animId = requestAnimationFrame(loop);
      }
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', resetTiming);
    };
  }, []);

  // --- Auto-scroll Serial Monitor on New Output ---
  useEffect(() => {
    const el = serialContainerRef.current;
    if (autoScrollSerial && bottomTab === 'serial' && showTerminal && el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [serialLogs, bottomTab, showTerminal, autoScrollSerial]);

  // --- Compile & Upload ---
  const handleCompile = async (): Promise<boolean> => {
    if (autoSaveOnRun && isDirty) {
      handleSaveProject();
    }
    setIsCompiling(true);
    setStatusMessage('Compiling sketch with arduino-cli...');
    setBottomTab('build');
    setShowTerminal(true);

    try {
      const res = await tauriInvoke<{ success: boolean; output: string; hex: string | null }>(
        'compile_and_upload',
        {
          sketch: sketchCode,
          files: fileContents,
        }
      );

      if (res) {
        setBuildLogs(stripAnsi(res.output));
        if (res.success) {
          setLastCompiledCode(sketchCode);
          setStatusMessage('Build Succeeded. Running @ 16 MHz.');
          setSerialLogs((prev) => `${prev.trimEnd()}\n--- Upload Succeeded & Running ---\n`);
          setBottomTab('serial');
          setIsRunning(true);
          await tauriInvoke('start_simulation');
          return true;
        } else {
          setStatusMessage('Compilation Failed. Check build output.');
          setBottomTab('build');
          setIsRunning(false);
          return false;
        }
      } else {
        setBuildLogs('[Preview] Compiled Arduino Uno sketch successfully.\n');
        setLastCompiledCode(sketchCode);
        setStatusMessage('Running in preview mode.');
        setBottomTab('serial');
        setIsRunning(true);
        return true;
      }
    } catch (err: any) {
      setBuildLogs(`Error invoking compiler: ${err?.message || err}\n`);
      setStatusMessage('Compilation Error');
      setBottomTab('build');
      setIsRunning(false);
      return false;
    } finally {
      setIsCompiling(false);
    }
  };

  // --- Run / Pause Toggle ---
  const handleRunToggle = async () => {
    if (isRunning) {
      setIsRunning(false);
      await tauriInvoke('pause_simulation');
      setStatusMessage('Simulation Paused');
    } else {
      if (sketchCode !== lastCompiledCode) {
        await handleCompile();
      } else {
        setIsRunning(true);
        await tauriInvoke('start_simulation');
        setBottomTab('serial');
        setShowTerminal(true);
        setStatusMessage('Simulation Running @ 16 MHz');
      }
    }
  };

  // Keep latest refs to prevent stale closures during mouse dragging
  const getPinWorldPosRef = useRef(getPinWorldPos);
  useEffect(() => {
    getPinWorldPosRef.current = getPinWorldPos;
  }, [getPinWorldPos]);

  const wiresRef = useRef(wires);
  useEffect(() => {
    wiresRef.current = wires;
  }, [wires]);

  // --- Window Dragging Listener for Smooth Component Movement ---
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      // 1. Canva-style Line Segment Dragging
      if (draggedSegmentRef.current) {
        const { wireId, segIndex, orientation, startMouseX, startMouseY, startVertices } =
          draggedSegmentRef.current;
        const dx = (e.clientX - startMouseX) / zoom;
        const dy = (e.clientY - startMouseY) / zoom;

        const currentWires = wiresRef.current;
        const wire = currentWires.find((w) => w.id === wireId);
        if (!wire) return;
        const p1 = getPinWorldPosRef.current(wire.fromComp, wire.fromPin);
        const p2 = getPinWorldPosRef.current(wire.toComp, wire.toPin);
        if (!p1 || !p2) return;

        const updated = updateOrthoSegment(
          startVertices,
          segIndex,
          orientation,
          dx,
          dy,
          p1,
          p2
        );

        const newWaypoints = updated.slice(1, -1);
        setWires((prev) =>
          prev.map((w) => {
            if (w.id !== wireId) return w;
            return { ...w, waypoints: newWaypoints };
          })
        );
        return;
      }

      // 2. Corner Vertex Dragging
      if (draggedWaypointRef.current) {
        const dx = (e.clientX - draggedWaypointRef.current.startMouseX) / zoom;
        const dy = (e.clientY - draggedWaypointRef.current.startMouseY) / zoom;
        const { wireId, index, startWpX, startWpY } = draggedWaypointRef.current;
        const newX = Math.round(startWpX + dx);
        const newY = Math.round(startWpY + dy);
        setWires((prev) =>
          prev.map((w) => {
            if (w.id !== wireId) return w;
            const nextWp = [...(w.waypoints || [])];
            nextWp[index] = { x: newX, y: newY };
            return { ...w, waypoints: nextWp };
          })
        );
        return;
      }

      // 3. Circuit Component Dragging (Multi & Single)
      if (draggedMultiCompRef.current) {
        const rawDx = e.clientX - draggedMultiCompRef.current.startMouseX;
        const rawDy = e.clientY - draggedMultiCompRef.current.startMouseY;
        const dx = rawDx / zoom;
        const dy = rawDy / zoom;

        setComponents((prev) =>
          prev.map((item) => {
            const init = draggedMultiCompRef.current!.positions.find((p) => p.id === item.id);
            if (init) {
              return { ...item, x: Math.round(init.x + dx), y: Math.round(init.y + dy) };
            }
            return item;
          })
        );
        setIsDirty(true);
      } else if (draggedCompRef.current) {
        const rawDx = e.clientX - draggedCompRef.current.startMouseX;
        const rawDy = e.clientY - draggedCompRef.current.startMouseY;

        // Auto-switch from 'select' to 'move' if user drags more than 3px
        if (Math.hypot(rawDx, rawDy) > 3) {
          setActiveTool((current) => (current === 'select' ? 'move' : current));
        }

        const dx = rawDx / zoom;
        const dy = rawDy / zoom;
        const compId = draggedCompRef.current.id;
        const newX = Math.round(draggedCompRef.current.startCompX + dx);
        const newY = Math.round(draggedCompRef.current.startCompY + dy);
        setComponents((prev) =>
          prev.map((item) => (item.id === compId ? { ...item, x: newX, y: newY } : item))
        );
        setIsDirty(true);
        return;
      }

      // 4. Rubber-Band Multi-Selection Dragging
      if (selectionBoxRef.current) {
        const box = selectionBoxRef.current;
        box.currentX = e.clientX;
        box.currentY = e.clientY;
        setSelectionBox({
          startX: box.startX,
          startY: box.startY,
          currentX: box.currentX,
          currentY: box.currentY,
        });

        const sX = Math.min(box.startX, box.currentX);
        const sY = Math.min(box.startY, box.currentY);
        const eX = Math.max(box.startX, box.currentX);
        const eY = Math.max(box.startY, box.currentY);

        const wX1 = (sX - box.rectLeft - pan.x) / zoom;
        const wY1 = (sY - box.rectTop - pan.y) / zoom;
        const wX2 = (eX - box.rectLeft - pan.x) / zoom;
        const wY2 = (eY - box.rectTop - pan.y) / zoom;

        // If dragged more than 4px, calculate intersection
        if (Math.hypot(box.currentX - box.startX, box.currentY - box.startY) > 4) {
          const matching = new Set<string>();
          for (const comp of componentsRef.current) {
            const dims = getComponentBoundingSize(comp.kind);
            const cx1 = comp.x;
            const cy1 = comp.y;
            const cx2 = comp.x + dims.w;
            const cy2 = comp.y + dims.h;

            if (cx1 < wX2 && cx2 > wX1 && cy1 < wY2 && cy2 > wY1) {
              matching.add(comp.id);
            }
          }
          setSelectedCompIds(matching);
          if (matching.size === 1) {
            setSelectedCompId(Array.from(matching)[0]);
          } else {
            setSelectedCompId(null);
          }
        }
        return;
      }
    };

    const handleWindowMouseUp = () => {
      if (draggedSegmentRef.current) {
        const wireId = draggedSegmentRef.current.wireId;
        draggedSegmentRef.current = null;
        const wire = wiresRef.current.find((w) => w.id === wireId);
        if (wire) {
          syncWireToRust(wire);
        }
      }
      if (draggedWaypointRef.current) {
        const wireId = draggedWaypointRef.current.wireId;
        draggedWaypointRef.current = null;
        const wire = wiresRef.current.find((w) => w.id === wireId);
        if (wire) {
          syncWireToRust(wire);
        }
      }
      if (draggedMultiCompRef.current) {
        draggedMultiCompRef.current = null;
      }
      if (draggedCompRef.current) {
        draggedCompRef.current = null;
      }
      if (selectionBoxRef.current) {
        const box = selectionBoxRef.current;
        const dist = Math.hypot(box.currentX - box.startX, box.currentY - box.startY);
        selectionBoxRef.current = null;
        setSelectionBox(null);
        if (dist < 4) {
          setSelectedCompId(null);
          setSelectedCompIds(new Set());
          setSelectedWireId(null);
        }
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [zoom, pan, syncWireToRust]);

  // --- Component Management & Transform Handlers ---
  const handleDeleteComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
    const attachedWires = wires.filter((w) => w.fromComp === id || w.toComp === id);
    for (const w of attachedWires) {
      tauriInvoke('remove_wire', { id: w.id });
    }
    setWires((prev) => prev.filter((w) => w.fromComp !== id && w.toComp !== id));
    if (selectedCompId === id) {
      setSelectedCompId(null);
    }
    setSelectedCompIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [wires, selectedCompId]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedCompIds.size > 0) {
      const ids = new Set(selectedCompIds);
      setComponents((prev) => prev.filter((c) => !ids.has(c.id)));
      const attachedWires = wires.filter((w) => ids.has(w.fromComp) || ids.has(w.toComp));
      for (const w of attachedWires) {
        tauriInvoke('remove_wire', { id: w.id });
      }
      setWires((prev) => prev.filter((w) => !ids.has(w.fromComp) && !ids.has(w.toComp)));
      setSelectedCompIds(new Set());
      setSelectedCompId(null);
      setIsDirty(true);
      setStatusMessage(`Deleted ${ids.size} component(s)`);
      return;
    }
    if (selectedCompId) {
      handleDeleteComponent(selectedCompId);
    }
  }, [selectedCompIds, selectedCompId, wires, handleDeleteComponent]);

  const handleRotateSelected = useCallback(() => {
    if (selectedCompIds.size > 0) {
      setComponents((prev) =>
        prev.map((c) =>
          selectedCompIds.has(c.id)
            ? { ...c, rotation: (((c.rotation || 0) + 90) % 360) }
            : c
        )
      );
      setIsDirty(true);
      return;
    }
    if (!selectedCompId) return;
    setComponents((prev) =>
      prev.map((c) => {
        if (c.id !== selectedCompId) return c;
        const nextRot = ((c.rotation || 0) + 90) % 360;
        return { ...c, rotation: nextRot };
      })
    );
    setIsDirty(true);
  }, [selectedCompId, selectedCompIds]);

  const handleFlipSelected = useCallback(() => {
    if (selectedCompIds.size > 0) {
      setComponents((prev) =>
        prev.map((c) =>
          selectedCompIds.has(c.id) ? { ...c, flipped: !c.flipped } : c
        )
      );
      setIsDirty(true);
      return;
    }
    if (!selectedCompId) return;
    setComponents((prev) =>
      prev.map((c) => {
        if (c.id !== selectedCompId) return c;
        return { ...c, flipped: !c.flipped };
      })
    );
    setIsDirty(true);
  }, [selectedCompId, selectedCompIds]);

  // --- Component Copy & Paste Helpers ---
  const handleCopyComponent = useCallback((comp: CircuitComponent) => {
    if (!comp) return;
    const cloned: CircuitComponent = {
      ...comp,
      props: { ...(comp.props || {}) },
    };
    setClipboardComponent(cloned);
    setClipboardComponents([cloned]);
    clipboardCompRef.current = cloned;
    clipboardComponentsRef.current = [cloned];
    setStatusMessage(`Copied ${comp.kind} (${comp.id}) to clipboard`);
  }, []);

  const handleCopySelectedGroup = useCallback(() => {
    if (selectedCompIds.size === 0) return;
    const comps = components.filter((c) => selectedCompIds.has(c.id));
    if (comps.length === 1) {
      handleCopyComponent(comps[0]);
    } else if (comps.length > 1) {
      const cloned = comps.map((c) => ({
        ...c,
        props: { ...(c.props || {}) },
      }));
      setClipboardComponents(cloned);
      setClipboardComponent(cloned[0]);
      clipboardCompRef.current = cloned[0];
      clipboardComponentsRef.current = cloned;
      setStatusMessage(`Copied ${comps.length} components to clipboard`);
    }
  }, [selectedCompIds, components, handleCopyComponent]);

  const handlePasteComponent = useCallback(() => {
    const sanitizeForPaste = (source: CircuitComponent, offset: { x: number; y: number }): CircuitComponent => {
      const baseKind = source.kind || 'resistor';
      const prefix =
        baseKind === 'arduino_uno'
          ? 'uno'
          : baseKind === 'breadboard'
          ? 'bb'
          : baseKind === 'led'
          ? 'led'
          : baseKind === 'resistor'
          ? 'r'
          : baseKind === 'pushbutton'
          ? 'btn'
          : baseKind === 'potentiometer'
          ? 'pot'
          : 'label';
      const newId = `${prefix}_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6)}`;
      const rawProps = source.props ? { ...source.props } : {};
      const sanitizedProps: Record<string, any> = { ...rawProps };

      if (baseKind === 'led') {
        sanitizedProps.color = sanitizedProps.color || '#ef4444';
        sanitizedProps.vf = typeof sanitizedProps.vf === 'number' ? sanitizedProps.vf : 2.0;
      } else if (baseKind === 'resistor') {
        sanitizedProps.ohms = typeof sanitizedProps.ohms === 'number' ? sanitizedProps.ohms : (parseInt(sanitizedProps.ohms, 10) || 220);
      } else if (baseKind === 'pushbutton') {
        sanitizedProps.pressed = false;
      } else if (baseKind === 'potentiometer') {
        sanitizedProps.value = typeof sanitizedProps.value === 'number' ? Math.max(0, Math.min(1, sanitizedProps.value)) : 0.5;
      } else if (baseKind === 'text_label') {
        sanitizedProps.text = sanitizedProps.text || 'Label';
        sanitizedProps.fontFamily = sanitizedProps.fontFamily || 'Inter, sans-serif';
        sanitizedProps.fontSize = typeof sanitizedProps.fontSize === 'number' ? sanitizedProps.fontSize : 16;
        sanitizedProps.color = sanitizedProps.color || '#f4f4f5';
        sanitizedProps.bold = Boolean(sanitizedProps.bold);
        sanitizedProps.italic = Boolean(sanitizedProps.italic);
        sanitizedProps.underline = Boolean(sanitizedProps.underline);
      } else if (baseKind === 'arduino_uno') {
        sanitizedProps.comPort = sanitizedProps.comPort || sanitizedProps.port || 'COM1';
        sanitizedProps.port = sanitizedProps.comPort;
      }

      const posX = typeof source.x === 'number' && !isNaN(source.x) ? source.x : 100;
      const posY = typeof source.y === 'number' && !isNaN(source.y) ? source.y : 100;

      return {
        ...source,
        id: newId,
        kind: baseKind,
        x: posX + offset.x,
        y: posY + offset.y,
        rotation: source.rotation || 0,
        flipped: Boolean(source.flipped),
        props: sanitizedProps,
      };
    };

    const multi = clipboardComponentsRef.current.length > 1
      ? clipboardComponentsRef.current
      : clipboardComponents.length > 1
      ? clipboardComponents
      : null;

    if (multi && multi.length > 1) {
      const newComps: CircuitComponent[] = [];
      const newIds = new Set<string>();

      for (const comp of multi) {
        const newComp = sanitizeForPaste(comp, { x: 40, y: 40 });
        newComps.push(newComp);
        newIds.add(newComp.id);
      }

      setComponents((prev) => [...prev, ...newComps]);
      setSelectedCompIds(newIds);
      setSelectedCompId(null);
      setSelectedWireId(null);
      setIsDirty(true);
      setStatusMessage(`Pasted ${newComps.length} components`);

      // Sync to backend engine
      for (const comp of newComps) {
        if (comp.kind === 'led') {
          tauriInvoke('add_led', { id: comp.id, color: comp.props?.color || '#ef4444' });
        } else if (comp.kind === 'resistor') {
          tauriInvoke('add_resistor', { id: comp.id, ohms: comp.props?.ohms || 220 });
        } else if (comp.kind === 'pushbutton') {
          tauriInvoke('add_button', { id: comp.id });
        } else if (comp.kind === 'potentiometer') {
          tauriInvoke('add_potentiometer', { id: comp.id });
        }
      }
      return;
    }

    const single = clipboardCompRef.current || clipboardComponent;
    if (!single) return;

    const newComp = sanitizeForPaste(single, { x: 40, y: 40 });

    setComponents((prev) => [...prev, newComp]);
    setSelectedCompId(newComp.id);
    setSelectedCompIds(new Set([newComp.id]));
    setSelectedWireId(null);
    setIsDirty(true);
    setStatusMessage(`Pasted ${newComp.kind} (${newComp.id})`);

    // Sync to backend engine
    if (newComp.kind === 'led') {
      tauriInvoke('add_led', { id: newComp.id, color: newComp.props?.color || '#ef4444' });
    } else if (newComp.kind === 'resistor') {
      tauriInvoke('add_resistor', { id: newComp.id, ohms: newComp.props?.ohms || 220 });
    } else if (newComp.kind === 'pushbutton') {
      tauriInvoke('add_button', { id: newComp.id });
    } else if (newComp.kind === 'potentiometer') {
      tauriInvoke('add_potentiometer', { id: newComp.id });
    }
  }, [clipboardComponents, clipboardComponent]);

  const handleAddComponentByType = useCallback(
    (type: 'uno' | 'bb' | 'led' | 'resistor' | 'btn' | 'pot') => {
      if (type === 'uno') {
        const id = `uno_${components.length + 1}`;
        setComponents((prev) => [...prev, { id, kind: 'arduino_uno', x: 100, y: 100, props: {} }]);
        setSelectedCompId(id);
        setSelectedWireId(null);
        setStatusMessage('Added Arduino Uno');
      } else if (type === 'bb') {
        const id = `bb_${components.length + 1}`;
        setComponents((prev) => [...prev, { id, kind: 'breadboard', x: 300, y: 100, props: {} }]);
        setSelectedCompId(id);
        setSelectedWireId(null);
        setStatusMessage('Added Breadboard');
      } else if (type === 'led') {
        const id = `led_${components.length + 1}`;
        setComponents((prev) => [...prev, { id, kind: 'led', x: 500, y: 80, props: { color: '#ef4444', vf: 2.0 } }]);
        tauriInvoke('add_led', { id, color: '#ef4444' });
        setSelectedCompId(id);
        setSelectedWireId(null);
        setStatusMessage('Added Red LED');
      } else if (type === 'resistor') {
        const id = `r_${components.length + 1}`;
        setComponents((prev) => [...prev, { id, kind: 'resistor', x: 580, y: 80, props: { ohms: 220 } }]);
        tauriInvoke('add_resistor', { id, ohms: 220 });
        setSelectedCompId(id);
        setSelectedWireId(null);
        setStatusMessage('Added Resistor (220Ω)');
      } else if (type === 'btn') {
        const id = `btn_${components.length + 1}`;
        setComponents((prev) => [...prev, { id, kind: 'pushbutton', x: 680, y: 80, props: {} }]);
        tauriInvoke('add_button', { id });
        setSelectedCompId(id);
        setSelectedWireId(null);
        setStatusMessage('Added Pushbutton');
      } else if (type === 'pot') {
        const id = `pot_${components.length + 1}`;
        setComponents((prev) => [...prev, { id, kind: 'potentiometer', x: 760, y: 80, props: { value: 0.5 } }]);
        tauriInvoke('add_potentiometer', { id });
        setSelectedCompId(id);
        setSelectedWireId(null);
        setStatusMessage('Added Potentiometer');
      }
      setIsDirty(true);
    },
    [components.length]
  );

  // --- Canva-Style Segment & Waypoint Drag Handlers ---
  const handleStartDragSegment = useCallback(
    (
      wireId: string,
      segIndex: number,
      orientation: 'horizontal' | 'vertical',
      e: React.MouseEvent
    ) => {
      e.stopPropagation();
      const wire = wires.find((w) => w.id === wireId);
      if (!wire) return;
      const p1 = getPinWorldPos(wire.fromComp, wire.fromPin);
      const p2 = getPinWorldPos(wire.toComp, wire.toPin);
      if (!p1 || !p2) return;

      const vertices = getOrthoVertices(p1, wire.waypoints, p2);

      draggedSegmentRef.current = {
        wireId,
        segIndex,
        orientation,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startVertices: vertices,
      };
    },
    [wires, getPinWorldPos]
  );

  const handleStartDragWaypoint = useCallback((wireId: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const wire = wires.find((w) => w.id === wireId);
    const wp = wire?.waypoints?.[index];
    if (!wp) return;
    draggedWaypointRef.current = {
      wireId,
      index,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startWpX: wp.x,
      startWpY: wp.y,
    };
  }, [wires]);

  const handleAddAndDragWaypoint = useCallback(
    (
      wireId: string,
      insertIndex: number,
      initialPoint: { x: number; y: number },
      e: React.MouseEvent
    ) => {
      e.stopPropagation();
      setWires((prev) =>
        prev.map((w) => {
          if (w.id !== wireId) return w;
          const nextWp = [...(w.waypoints || [])];
          nextWp.splice(insertIndex, 0, initialPoint);
          return { ...w, waypoints: nextWp };
        })
      );
      draggedWaypointRef.current = {
        wireId,
        index: insertIndex,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startWpX: initialPoint.x,
        startWpY: initialPoint.y,
      };
    },
    []
  );

  const handleDeleteWaypoint = useCallback((wireId: string, waypointIndex: number) => {
    setWires((prev) =>
      prev.map((w) => {
        if (w.id !== wireId) return w;
        const nextWp = [...(w.waypoints || [])];
        nextWp.splice(waypointIndex, 1);
        return { ...w, waypoints: nextWp };
      })
    );
  }, []);

  // --- Keyboard Shortcuts (V: Select, M: Move, W: Wire, E: Eraser, R: Rotate, F: Flip, Del: Delete) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSaveProject();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        handleOpenNativeFolder();
        return;
      }

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

      // Component Copy / Paste / Duplicate on Canvas
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        if (selectedCompIds.size > 1) {
          e.preventDefault();
          handleCopySelectedGroup();
          return;
        } else if (selectedCompId) {
          e.preventDefault();
          const comp = components.find((c) => c.id === selectedCompId);
          if (comp) handleCopyComponent(comp);
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
        if (selectedCompIds.size > 0 || selectedCompId) {
          e.preventDefault();
          handleEditCut();
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        if (clipboardComponent || clipboardComponents.length > 0) {
          e.preventDefault();
          handlePasteComponent();
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        if (selectedCompIds.size > 1) {
          e.preventDefault();
          handleCopySelectedGroup();
          setTimeout(() => handlePasteComponent(), 10);
          return;
        } else if (selectedCompId) {
          e.preventDefault();
          const comp = components.find((c) => c.id === selectedCompId);
          if (comp) {
            handleCopyComponent(comp);
            setTimeout(() => handlePasteComponent(), 10);
          }
          return;
        }
      }

      if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select');
      } else if (e.key === 'm' || e.key === 'M') {
        setActiveTool('move');
      } else if (e.key === 'w' || e.key === 'W') {
        setActiveTool('wire');
      } else if (e.key === 'e' || e.key === 'E') {
        setActiveTool('eraser');
      } else if (e.key === 't' || e.key === 'T') {
        setActiveTool('text');
      } else if (e.key === 'r' || e.key === 'R') {
        handleRotateSelected();
      } else if (e.key === 'f' || e.key === 'F') {
        handleFlipSelected();
      } else if (e.key === 'F2') {
        e.preventDefault();
        const targetId = selectedCompId || (selectedCompIds.size === 1 ? Array.from(selectedCompIds)[0] : null);
        if (targetId) {
          const comp = components.find((c) => c.id === targetId);
          if (comp) {
            setRenameModalComp({
              id: comp.id,
              name: comp.props?.name || comp.props?.text || comp.id,
            });
          }
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedWireId) {
          handleDeleteWire(selectedWireId);
        } else if (selectedCompIds.size > 0 || selectedCompId) {
          handleDeleteSelected();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedCompId,
    selectedCompIds,
    selectedWireId,
    components,
    clipboardComponent,
    clipboardComponents,
    handleCopyComponent,
    handleCopySelectedGroup,
    handlePasteComponent,
    handleRotateSelected,
    handleFlipSelected,
    handleDeleteComponent,
    handleDeleteSelected,
    handleDeleteWire,
    handleSaveProject,
    handleOpenNativeFolder,
  ]);

  // --- Edit Menu Actions (Undo, Redo, Cut, Copy, Paste, Find, Replace) ---
  const handleEditUndo = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.focus();
      editorRef.current.trigger('menu', 'undo', null);
      setStatusMessage('Undo');
    }
  }, []);

  const handleEditRedo = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.focus();
      editorRef.current.trigger('menu', 'redo', null);
      setStatusMessage('Redo');
    }
  }, []);

  const handleEditCut = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('cut');
      setStatusMessage('Cut to clipboard');
    } else if (selectedCompIds.size > 0) {
      handleCopySelectedGroup();
      handleDeleteSelected();
      setStatusMessage(`Cut ${selectedCompIds.size} component(s) to clipboard`);
    } else if (selectedCompId) {
      const comp = components.find((c) => c.id === selectedCompId);
      if (comp) handleCopyComponent(comp);
      handleDeleteComponent(selectedCompId);
      setStatusMessage('Component cut to clipboard');
    } else if (selectedWireId) {
      handleDeleteWire(selectedWireId);
      setStatusMessage('Wire deleted');
    }
  }, [selectedCompId, selectedCompIds, selectedWireId, components, handleCopyComponent, handleCopySelectedGroup, handleDeleteComponent, handleDeleteSelected, handleDeleteWire]);

  const handleEditCopy = useCallback(() => {
    if (selectedCompIds.size > 1) {
      handleCopySelectedGroup();
      return;
    }
    if (selectedCompId) {
      const comp = components.find((c) => c.id === selectedCompId);
      if (comp) {
        handleCopyComponent(comp);
        return;
      }
    }
    if (editorRef.current) {
      editorRef.current.focus();
      const selection = editorRef.current.getModel()?.getValueInRange(editorRef.current.getSelection());
      if (selection && selection.length > 0) {
        navigator.clipboard.writeText(selection);
        setStatusMessage('Selection copied to clipboard');
      } else {
        const full = editorRef.current.getValue();
        navigator.clipboard.writeText(full);
        setStatusMessage('Full file copied to clipboard');
      }
    } else {
      navigator.clipboard.writeText(sketchCode);
      setStatusMessage('Sketch code copied');
    }
  }, [selectedCompId, selectedCompIds, components, handleCopyComponent, handleCopySelectedGroup, sketchCode]);

  const handleEditPaste = useCallback(async () => {
    const activeEl = document.activeElement;
    const isEditorActive = activeEl?.closest('.monaco-editor');
    if (clipboardComponent && !isEditorActive) {
      handlePasteComponent();
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (editorRef.current && text) {
        editorRef.current.focus();
        editorRef.current.trigger('keyboard', 'type', { text });
        setStatusMessage('Pasted from clipboard');
      }
    } catch (err) {
      console.warn('Paste failed:', err);
    }
  }, [clipboardComponent, handlePasteComponent]);

  const handleEditFind = useCallback(() => {
    if (!showEditor) setShowEditor(true);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
        editorRef.current.getAction('actions.find')?.run();
      }
    }, 60);
    setStatusMessage('Find in editor');
  }, [showEditor]);

  const handleEditReplace = useCallback(() => {
    if (!showEditor) setShowEditor(true);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
        editorRef.current.getAction('editor.action.startFindReplaceAction')?.run();
      }
    }, 60);
    setStatusMessage('Find & Replace in editor');
  }, [showEditor]);

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
    (document.activeElement as HTMLElement)?.blur();
    e.stopPropagation();
    if (e.button !== 0) return; // Only primary mouse button for dragging

    // Check if part of existing multi-selection
    const isAlreadyInMulti = selectedCompIds.has(compId) && selectedCompIds.size > 1;

    if (!isAlreadyInMulti) {
      if (e.shiftKey) {
        const next = new Set(selectedCompIds);
        next.add(compId);
        setSelectedCompIds(next);
        setSelectedCompId(next.size === 1 ? compId : null);
      } else {
        setSelectedCompId(compId);
        setSelectedCompIds(new Set([compId]));
      }
    }

    if (activeTool === 'move' || activeTool === 'select') {
      if (isAlreadyInMulti) {
        draggedMultiCompRef.current = {
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          positions: components
            .filter((c) => selectedCompIds.has(c.id))
            .map((c) => ({ id: c.id, x: c.x, y: c.y })),
        };
      } else {
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
    }
  };

  const handleComponentContextMenu = (compId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (selectedCompIds.has(compId) && selectedCompIds.size > 1) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: 'group',
      });
    } else {
      setSelectedCompId(compId);
      setSelectedCompIds(new Set([compId]));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: 'single',
        compId,
      });
    }
  };

  // --- Canvas Context Menu Handler ---
  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'canvas',
    });
  };

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // --- Canvas Mouse Handlers (Pan & Wire Drawing) ---
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    (document.activeElement as HTMLElement)?.blur();
    (e.currentTarget as HTMLElement)?.focus?.();

    // 3. Canvas Panning moved strictly to Middle Mouse Button (button === 1), Space+Drag, or Move tool (Requirement 3)
    if (e.button === 1 || (isSpacePressed.current && e.button === 0) || (activeTool === 'move' && e.button === 0)) {
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    // Ignore right click on mousedown (handled strictly by onContextMenu event)
    if (e.button !== 0) {
      return;
    }

    // Left Click on Empty Canvas (button === 0)
    if (e.button === 0) {
      if (activeTool === 'text') {
        const rect = e.currentTarget.getBoundingClientRect();
        const worldX = Math.round((e.clientX - rect.left - pan.x) / zoom / 10) * 10;
        const worldY = Math.round((e.clientY - rect.top - pan.y) / zoom / 10) * 10;
        const newTextId = `label_${Date.now().toString().slice(-4)}`;
        const newTextComp: CircuitComponent = {
          id: newTextId,
          kind: 'text_label',
          x: worldX,
          y: worldY,
          props: {
            text: 'Label',
            fontFamily: 'Inter, sans-serif',
            fontSize: 16,
            color: '#f4f4f5',
            bold: false,
            italic: false,
            underline: false,
          },
        };
        setComponents((prev) => [...prev, newTextComp]);
        setSelectedCompId(newTextId);
        setSelectedCompIds(new Set([newTextId]));
        setActiveTool('select');
        setIsDirty(true);
        setStatusMessage('Added Text Label');
        return;
      }

      if (activeTool === 'select') {
        // Start rubber-band selection box (Requirement 2)
        const rect = e.currentTarget.getBoundingClientRect();
        selectionBoxRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY,
          rectLeft: rect.left,
          rectTop: rect.top,
        };
        setSelectionBox({
          startX: e.clientX,
          startY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY,
        });
        if (!e.shiftKey) {
          setSelectedCompId(null);
          setSelectedCompIds(new Set());
          setSelectedWireId(null);
        }
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

    // Update Rubber-Band Multi-Selection Box (Requirement 2)
    if (selectionBox) {
      setSelectionBox((prev) => (prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null));

      const sX = Math.min(selectionBox.startX, e.clientX);
      const sY = Math.min(selectionBox.startY, e.clientY);
      const eX = Math.max(selectionBox.startX, e.clientX);
      const eY = Math.max(selectionBox.startY, e.clientY);

      const wX1 = (sX - rect.left - pan.x) / zoom;
      const wY1 = (sY - rect.top - pan.y) / zoom;
      const wX2 = (eX - rect.left - pan.x) / zoom;
      const wY2 = (eY - rect.top - pan.y) / zoom;

      const matching = new Set<string>();
      for (const comp of components) {
        const dims = getComponentBoundingSize(comp.kind);
        const cx1 = comp.x;
        const cy1 = comp.y;
        const cx2 = comp.x + dims.w;
        const cy2 = comp.y + dims.h;

        if (cx1 < wX2 && cx2 > wX1 && cy1 < wY2 && cy2 > wY1) {
          matching.add(comp.id);
        }
      }

      setSelectedCompIds(matching);
      if (matching.size === 1) {
        setSelectedCompId(Array.from(matching)[0]);
      } else {
        setSelectedCompId(null);
      }
    }
  };

  const handleCanvasMouseUp = () => {
    isPanning.current = false;
    if (selectionBox) {
      setSelectionBox(null);
    }
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Touchpad pinch-to-zoom OR Ctrl + Mouse Wheel: zoom centered at mouse cursor
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Normalize wheel delta across physical notched mice, high-DPI mice, and laptop touchpads
      let delta = e.deltaY;
      if (e.deltaMode === 1) {
        delta *= 16;
      } else if (e.deltaMode === 2) {
        delta *= 40;
      }

      // Clamp delta per event to prevent jarring warp/jumps on notched scroll wheels
      const clampedDelta = Math.max(-25, Math.min(25, delta));
      const zoomFactor = Math.pow(0.997, clampedDelta);

      setZoom((prevZoom) => {
        const nextZoom = Math.min(3.5, Math.max(0.25, prevZoom * zoomFactor));
        // Keep the point under the cursor stationary
        setPan((prevPan) => ({
          x: mouseX - (mouseX - prevPan.x) * (nextZoom / prevZoom),
          y: mouseY - (mouseY - prevPan.y) * (nextZoom / prevZoom),
        }));
        return nextZoom;
      });
    } else {
      // Touchpad two-finger swipe (or mouse scroll wheel) = smooth PAN
      setPan((prevPan) => ({
        x: prevPan.x - e.deltaX,
        y: prevPan.y - e.deltaY,
      }));
    }
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
          routingMode: wireRoutingMode,
          waypoints: [],
        };
        setWires((prev) => [...prev, newWire]);
        syncWireToRust(newWire);
      }
      setWireDraftStart(null);
    }
  };

  const getComponentHoverInfo = (c: CircuitComponent): string => {
    switch (c.kind) {
      case 'arduino_uno':
        return `Arduino Uno R3 • ATmega328P @ 16 MHz • 5.0V Logic`;
      case 'breadboard':
        return `Half Breadboard • 30 Terminal Rows (A-J) • Dual Power Rails`;
      case 'potentiometer': {
        const val = typeof c.props?.value === 'number' ? c.props.value : 0.5;
        const v = (val * 5.0).toFixed(2);
        const adc = Math.round(val * 1023);
        return `Potentiometer (${c.id}) • Wiper: ${v}V (${adc} ADC / ${Math.round(val * 100)}%) • 10 kΩ`;
      }
      case 'pushbutton': {
        const state = c.props?.pressed ? 'CLOSED (0.0V GND Active)' : 'OPEN (5.0V Pull-up)';
        return `Pushbutton (${c.id}) • State: ${state}`;
      }
      case 'resistor': {
        const ohms = typeof c.props?.ohms === 'number' ? c.props.ohms : 220;
        const str = ohms >= 1000 ? `${ohms / 1000} kΩ` : `${ohms} Ω`;
        return `Resistor (${c.id}) • Resistance: ${str} • 0.25W 5%`;
      }
      case 'led': {
        const color = c.props?.color || 'red';
        const vf = typeof c.props?.vf === 'number' ? c.props.vf : 2.0;
        return `LED (${c.id}) • Color: ${color} • Forward Drop: ${vf}V`;
      }
      case 'text_label': {
        const text = c.props?.text || 'Label';
        return `Text Label (${c.id}) • "${text}"`;
      }
      default:
        return `${c.kind} (${c.id})`;
    }
  };

  const getWireHoverInfo = (w: CircuitWire): string => {
    return `Wire [${w.fromComp}:${w.fromPin} → ${w.toComp}:${w.toPin}] • Color: ${w.color || '#22c55e'} • Mode: ${w.routingMode || 'ortho'}`;
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
                  className="absolute top-full left-0 mt-1 w-56 bg-[#18181b] border border-[#27272a] shadow-2xl rounded-lg py-1 text-xs z-50 select-none animate-in fade-in duration-75"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewProjectModal(true);
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <GoPlus className="text-zinc-400" /> New Project...
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleOpenNativeFolder();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <GoFileDirectory className="text-zinc-400" /> Open Folder...
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+O</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowOpenProjectModal(true);
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <GoClock className="text-zinc-400" /> Browse Stored Projects...
                    </span>
                  </button>

                  {/* Open Recent Submenu */}
                  {recentProjects.length > 0 && (
                    <div className="py-0.5 border-t border-[#27272a] mt-1 pt-1">
                      <div className="px-3 py-1 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider flex items-center gap-1.5">
                        <GoClock className="w-3 h-3" /> Recent Projects
                      </div>
                      {recentProjects.slice(0, 4).map((rec) => (
                        <button
                          key={rec.path}
                          type="button"
                          onClick={() => {
                            handleOpenProject(rec.path);
                            setActiveMenu(null);
                          }}
                          className="w-full px-3 py-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 text-left truncate flex items-center justify-between group"
                        >
                          <span className="truncate">{rec.name}</span>
                          <span className="text-[10px] text-zinc-600 truncate max-w-[80px]">
                            {rec.path.split('/').pop()}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="h-px bg-[#27272a] my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      handleSaveProject();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <GoFile className="text-zinc-400" /> Save Project
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+S</span>
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

            {/* Menubar: Edit */}
            <div className="relative">
              <button
                type="button"
                data-tauri-drag-region="false"
                onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
                onMouseEnter={() => {
                  if (activeMenu) setActiveMenu('edit');
                }}
                className={`text-xs h-5 px-2 rounded transition-colors ${
                  activeMenu === 'edit'
                    ? 'bg-[#1f1f23] text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#1f1f23]'
                }`}
              >
                Edit
              </button>

              {activeMenu === 'edit' && (
                <div
                  className="absolute top-full left-0 mt-1 w-56 bg-[#18181b] border border-[#27272a] shadow-2xl rounded-lg py-1 text-xs z-50 select-none animate-in fade-in duration-75"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      handleEditUndo();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <RotateCcw className="w-3.5 h-3.5 text-zinc-400" /> Undo
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+Z</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleEditRedo();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <RotateCw className="w-3.5 h-3.5 text-zinc-400" /> Redo
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+Y</span>
                  </button>

                  <div className="h-px bg-[#27272a] my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      handleEditCut();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Scissors className="w-3.5 h-3.5 text-zinc-400" /> Cut
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+X</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleEditCopy();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <GoCopy className="w-3.5 h-3.5 text-zinc-400" /> Copy
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+C</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleEditPaste();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Clipboard className="w-3.5 h-3.5 text-zinc-400" /> Paste
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+V</span>
                  </button>

                  <div className="h-px bg-[#27272a] my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      handleEditFind();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-zinc-400" /> Find
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+F</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleEditReplace();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Replace className="w-3.5 h-3.5 text-zinc-400" /> Replace
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+H</span>
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
                  className="absolute top-full left-0 mt-1 w-64 bg-[#18181b] border border-[#27272a] shadow-2xl rounded-lg py-1 text-xs z-50 select-none animate-in fade-in duration-75"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-1 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                    Panels & Drawers
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      toggleEditor();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <GoCode className="text-zinc-400" /> Code Editor (Left Top)
                    </span>
                    {showEditor && <GoCheck className="text-zinc-200" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      toggleExplorer();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FolderOpen className="w-3.5 h-3.5 text-zinc-400" /> File Explorer (Left Bottom)
                    </span>
                    {showExplorer && <GoCheck className="text-zinc-200" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      toggleTerminal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <GoTerminal className="text-zinc-400" /> Terminal & Logs (Bottom)
                    </span>
                    {showTerminal && <GoCheck className="text-zinc-200" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      togglePalette();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <GoPackage className="text-zinc-400" /> Component Palette (Right Top)
                    </span>
                    {showPalette && <GoCheck className="text-zinc-200" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      toggleInspector();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" /> Property Inspector (Right Bottom)
                    </span>
                    {showInspector && <GoCheck className="text-zinc-200" />}
                  </button>

                  <div className="h-px bg-[#27272a] my-1" />
                  <div className="px-3 py-1 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                    Bottom Tabs & Oscilloscope
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTerminal(true);
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
                      setShowTerminal(true);
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
                      setShowTerminal(true);
                      setBottomTab('build');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <GoGear className="text-zinc-400" /> Switch to Build Output
                  </button>

                  <div className="h-px bg-[#27272a] my-1" />
                  <div className="px-3 py-1 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                    Canvas & Zoom
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleResetLayoutToDefault();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <GoSync className="text-zinc-400" /> Reset Layout to Default
                  </button>
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

                  <div className="h-px bg-[#27272a] my-1" />
                  <div className="px-3 py-1 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                    Window Controls
                  </div>

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
                  <button
                    type="button"
                    onClick={() => {
                      handleRequestClose();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-red-400 hover:bg-zinc-800 text-left transition-colors"
                  >
                    Close Window
                  </button>
                </div>
              )}
            </div>

            {/* Menubar: Settings */}
            <div className="relative">
              <button
                type="button"
                data-tauri-drag-region="false"
                onClick={() => {
                  setShowSettingsModal(true);
                  setActiveMenu(null);
                }}
                className="text-xs h-5 px-2 rounded transition-colors text-zinc-400 hover:text-zinc-100 hover:bg-[#1f1f23]"
              >
                Settings
              </button>
            </div>

            {/* Menubar: About */}
            <div className="relative">
              <button
                type="button"
                data-tauri-drag-region="false"
                onClick={() => {
                  setShowAboutModal(true);
                  setActiveMenu(null);
                }}
                className="text-xs h-5 px-2 rounded transition-colors text-zinc-400 hover:text-zinc-100 hover:bg-[#1f1f23]"
              >
                About
              </button>
            </div>
          </div>

          {/* Center Drag Region (Allows moving window effortlessly in normal/minimal mode) */}
          <div
            data-tauri-drag-region
            onMouseDown={(e) => {
              if (e.buttons === 1) tauriInvoke('start_drag_window');
            }}
            onDoubleClick={() => tauriInvoke('toggle_maximize_window')}
            className="flex-1 h-full flex items-center justify-center text-[11px] font-mono text-zinc-400 cursor-default select-none"
          >
            <span className="truncate max-w-[400px]">
              {projectName}{isDirty ? ' *' : ''} — MicroRustSim
            </span>
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
              onClick={handleRequestClose}
              className="h-full w-11 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#e81123] transition-colors"
              title="Close"
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        {/* 2. Secondary Action Toolbar (Clean, Flat, Low-Text, No Nested Boxes) */}
        <div className="relative h-10 bg-[#121215] border-b border-[#222226] px-3 flex items-center justify-between select-none z-40 shrink-0">
          {/* Left Toolbar: Flat Categorized Controls with Clean Dividers */}
          <div className="flex items-center gap-1.5">
            {/* Category 1: Execution & Hardware Control (Run/Flash/Reset) */}
            <div className="flex items-center gap-1">
              {/* Run / Pause */}
              {isRunning ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={handleRunToggle}
                        className="h-7 w-7 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded flex items-center justify-center transition-colors shadow-sm"
                      >
                        <PauseIcon className="text-xs" />
                      </button>
                    }
                  />
                  <TooltipContent className="text-xs">Pause Simulation</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        disabled={isCompiling}
                        onClick={handleRunToggle}
                        className="h-7 w-7 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded flex items-center justify-center transition-colors shadow-sm disabled:opacity-60"
                      >
                        {isCompiling ? (
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <GoPlay className="text-sm ml-0.5" />
                        )}
                      </button>
                    }
                  />
                  <TooltipContent className="text-xs">
                    {isCompiling
                      ? 'Compiling sketch...'
                      : sketchCode !== lastCompiledCode
                      ? 'Compile & Run Simulation'
                      : 'Run Simulation (16 MHz)'}
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Quick Action: Upload Split Button */}
              <div className="flex items-center">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        disabled={isCompiling}
                        onClick={() => handleCompile()}
                        className="h-7 px-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-[#27272a] rounded-l flex items-center justify-center transition-colors disabled:opacity-40"
                      >
                        {isCompiling ? (
                          <div className="w-3 h-3 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
                        ) : (
                          <GoZap className="text-sm" />
                        )}
                      </button>
                    }
                  />
                  <TooltipContent className="text-xs">Compile & Flash Sketch</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={() => setShowUploadModal(true)}
                        className="h-7 px-1 text-zinc-400 hover:text-zinc-200 hover:bg-[#27272a] rounded-r flex items-center justify-center transition-colors border-l border-[#27272a]/80"
                      >
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                    }
                  />
                  <TooltipContent className="text-xs">Upload Target (Select Board & COM Port)</TooltipContent>
                </Tooltip>
              </div>

              {/* Quick Action: Reset */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => {
                        setIsRunning(false);
                        tauriInvoke('reset_simulation');
                        setLitLeds(new Set());
                        setLedBrightness({});
                        setCircuitFaults([]);
                        setLogicHistory([]);
                        setPin2History([]);
                        setPinA0History([]);
                        setSerialLogs((prev) => `${prev}\n--- MCU Reset (Clock 0) ---\n`);
                        setStatusMessage('MCU Reset');
                      }}
                      className="h-7 w-7 text-zinc-400 hover:text-zinc-200 hover:bg-[#27272a] rounded flex items-center justify-center transition-colors"
                    >
                      <GoSync className="text-sm" />
                    </button>
                  }
                />
                <TooltipContent className="text-xs">Reset MCU Clock</TooltipContent>
              </Tooltip>
            </div>

            {/* Subtle Divider */}
            <div className="w-[1px] h-4 bg-zinc-800 shrink-0 mx-1.5" />

            {/* Category 2: Canvas Tools (Select, Move, Wire, Eraser) */}
            <div className="flex items-center gap-1">
              {/* 1. Select Tool */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => setActiveTool('select')}
                      className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                        activeTool === 'select'
                          ? 'bg-[#27272a] text-zinc-100'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a1e]'
                      }`}
                    >
                      <MousePointer className="w-3.5 h-3.5" />
                    </button>
                  }
                />
                <TooltipContent className="text-xs">Select Tool (V)</TooltipContent>
              </Tooltip>

              {/* 2. Move Tool */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => setActiveTool('move')}
                      className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                        activeTool === 'move'
                          ? 'bg-[#27272a] text-zinc-100'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a1e]'
                      }`}
                    >
                      <Move className="w-3.5 h-3.5" />
                    </button>
                  }
                />
                <TooltipContent className="text-xs">Move Tool (M)</TooltipContent>
              </Tooltip>

              {/* 3. Wire Tool Split Button */}
              <div className="relative flex items-center" ref={wireMenuRef}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={() => setActiveTool('wire')}
                        className={`h-7 px-1.5 flex flex-col items-center justify-center rounded-l transition-colors ${
                          activeTool === 'wire'
                            ? 'bg-[#27272a] text-zinc-100'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a1e]'
                        }`}
                      >
                        <Cable className="w-3.5 h-3.5" />
                        <span
                          className="w-3.5 h-[2px] rounded-full mt-0.5"
                          style={{
                            backgroundColor: selectedWire
                              ? selectedWire.color
                              : currentWireColor,
                          }}
                        />
                      </button>
                    }
                  />
                  <TooltipContent className="text-xs">Wire Tool (W)</TooltipContent>
                </Tooltip>

                {/* Dropdown Chevron for Wire Color Picker */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowWireColorMenu((prev) => !prev);
                  }}
                  className={`h-7 px-1 flex items-center justify-center rounded-r transition-colors ${
                    activeTool === 'wire' || showWireColorMenu
                      ? 'bg-[#27272a] text-zinc-100 hover:bg-[#333338]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a1e]'
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
                      <span className="font-semibold text-xs text-zinc-200">
                        {selectedWireId ? 'Selected Wire Color' : 'Default Wire Color'}
                      </span>
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-zinc-700 shadow-sm"
                        style={{
                          backgroundColor: selectedWire
                            ? selectedWire.color
                            : currentWireColor,
                        }}
                      />
                    </div>

                    <div className="py-2.5">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block mb-2">
                        Electronic Color Codes
                      </span>
                      <div className="grid grid-cols-6 gap-1.5">
                        {WIRE_COLORS.map((c) => {
                          const activeColor = selectedWire ? selectedWire.color : currentWireColor;
                          const isMatch = activeColor.toLowerCase() === c.hex.toLowerCase();
                          return (
                            <button
                              key={c.hex}
                              type="button"
                              title={`${c.name} (${c.role})`}
                              onClick={() => handleApplyWireColor(c.hex)}
                              className={`relative w-8 h-7 rounded flex items-center justify-center transition-all ${
                                isMatch
                                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[#18181b] scale-105'
                                  : 'hover:scale-105 border border-zinc-700/60'
                              }`}
                              style={{ backgroundColor: c.hex }}
                            >
                              {isMatch && (
                                <Check
                                  className={`w-3.5 h-3.5 ${
                                    c.hex === '#ffffff' || c.hex === '#eab308' || c.hex === '#22c55e'
                                      ? 'text-zinc-900'
                                      : 'text-white'
                                  } stroke-[3]`}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="text-[10px] text-zinc-400 font-mono flex items-center justify-between px-2 py-1 bg-[#121215] rounded border border-zinc-800 mb-2">
                      <span>Active:</span>
                      <span className="text-zinc-200 font-medium">
                        {WIRE_COLORS.find(
                          (w) =>
                            w.hex.toLowerCase() ===
                            (selectedWire ? selectedWire.color : currentWireColor).toLowerCase()
                        )?.name || 'Custom'}
                      </span>
                    </div>

                    {/* Dark-Themed Custom Hex Color Input */}
                    <div className="pt-2 border-t border-[#27272a] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded border border-zinc-700 shrink-0 shadow-sm"
                          style={{
                            backgroundColor: /^#([0-9A-Fa-f]{3}){1,2}$/.test(customColorInput)
                              ? customColorInput
                              : selectedWire
                              ? selectedWire.color
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
                                handleApplyWireColor(customColorInput);
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
                            handleApplyWireColor(customColorInput);
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

              {/* 4. Eraser Tool */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => setActiveTool('eraser')}
                      className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                        activeTool === 'eraser'
                          ? 'bg-rose-950/70 text-rose-300 border border-rose-800/80'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a1e]'
                      }`}
                    >
                      <Eraser className="w-3.5 h-3.5" />
                    </button>
                  }
                />
                <TooltipContent className="text-xs">Eraser Tool (E) • Click wire or component to delete</TooltipContent>
              </Tooltip>

              {/* 5. Text Label Tool */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => setActiveTool('text')}
                      className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                        activeTool === 'text'
                          ? 'bg-[#27272a] text-zinc-100'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a1e]'
                      }`}
                    >
                      <Type className="w-3.5 h-3.5" />
                    </button>
                  }
                />
                <TooltipContent className="text-xs">Text Label Tool (T) • Click canvas to place text</TooltipContent>
              </Tooltip>
            </div>

            {/* Subtle Divider */}
            <div className="w-[1px] h-4 bg-zinc-800 shrink-0 mx-1.5" />

            {/* Category 3: Component Transform (Rotate, Flip) */}
            <div className="flex items-center gap-1">
              {/* Rotate Selected Component */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      disabled={!selectedCompId && selectedCompIds.size === 0}
                      onClick={handleRotateSelected}
                      className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                        selectedCompId || selectedCompIds.size > 0
                          ? 'text-zinc-300 hover:text-white hover:bg-[#27272a]'
                          : 'text-zinc-600 cursor-not-allowed opacity-30'
                      }`}
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  }
                />
                <TooltipContent className="text-xs">Rotate Component 90° (R)</TooltipContent>
              </Tooltip>

              {/* Flip Selected Component */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      disabled={!selectedCompId && selectedCompIds.size === 0}
                      onClick={handleFlipSelected}
                      className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                        selectedCompId || selectedCompIds.size > 0
                          ? 'text-zinc-300 hover:text-white hover:bg-[#27272a]'
                          : 'text-zinc-600 cursor-not-allowed opacity-30'
                      }`}
                    >
                      <FlipHorizontal className="w-3.5 h-3.5" />
                    </button>
                  }
                />
                <TooltipContent className="text-xs">Flip Component Horizontal (F)</TooltipContent>
              </Tooltip>
            </div>

            {/* Subtle Divider */}
            <div className="w-[1px] h-4 bg-zinc-800 shrink-0 mx-1.5" />

            {/* Category 4: Wire Routing Mode (Curve vs Ortho Diagram) */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={handleToggleRoutingMode}
                    className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                      activeRoutingDisplay === 'ortho'
                        ? 'text-zinc-100 bg-[#27272a] border border-zinc-600'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a1e]'
                    }`}
                  >
                    {activeRoutingDisplay === 'ortho' ? (
                      <CornerDownRight className="w-3.5 h-3.5 text-zinc-200" />
                    ) : (
                      <Spline className="w-3.5 h-3.5" />
                    )}
                  </button>
                }
              />
              <TooltipContent className="text-xs">
                {selectedWireId
                  ? `Selected Wire Style • ${
                      activeRoutingDisplay === 'ortho'
                        ? 'Diagram 90° Right-Angles'
                        : 'Flexible Natural Curves'
                    } (Click to toggle)`
                  : `Wire Routing Mode • ${
                      activeRoutingDisplay === 'ortho'
                        ? 'Diagram 90° Right-Angles'
                        : 'Flexible Natural Curves'
                    } (Click to toggle)`}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Right Toolbar: VS Code-Style Command Search Bar directly above Components Palette */}
          <div className="flex items-center gap-2">
            <CommandPaletteSearch
              isRunning={isRunning}
              isCompiling={isCompiling}
              onRunToggle={handleRunToggle}
              onCompile={() => handleCompile()}
              onReset={() => {
                setIsRunning(false);
                tauriInvoke('reset_simulation');
                setLitLeds(new Set());
                setLedBrightness({});
                setCircuitFaults([]);
                setLogicHistory([]);
                setPin2History([]);
                setPinA0History([]);
                setSerialLogs((prev) => `${prev}\n--- MCU Reset (Clock 0) ---\n`);
                setStatusMessage('MCU Reset');
              }}
              onAddComponent={handleAddComponentByType}
              onToggleEditor={() => setShowEditor((prev) => !prev)}
              onToggleExplorer={() => setShowExplorer((prev) => !prev)}
              onTogglePalette={() => setShowPalette((prev) => !prev)}
              onSwitchTab={(tab) => setBottomTab(tab)}
              onOpenSettings={() => setShowSettingsModal(true)}
              onSaveProject={handleSaveProject}
              onOpenFolder={handleOpenNativeFolder}
              onNewProject={() => setShowNewProjectModal(true)}
              onSelectTool={(tool: 'select' | 'move' | 'wire' | 'eraser') => setActiveTool(tool)}
            />
          </div>
        </div>

        {/* 2. Main 3-Column Resizable Workspace (Left: Editor & Explorer, Center: Canvas & Terminal, Right: Palette & Property) */}
        <ResizablePanelGroup
          key={layoutLoaded ? 'layout-loaded' : 'layout-init'}
          orientation="horizontal"
          className="flex-1 overflow-hidden"
          onLayoutChanged={(layout) => {
            const updates: Partial<WorkspaceLayout> = {};
            if (layout['left-column-panel'] !== undefined) {
              updates.leftColumnSize = Math.round(layout['left-column-panel']);
            }
            if (layout['center-column-panel'] !== undefined) {
              updates.centerColumnSize = Math.round(layout['center-column-panel']);
            }
            if (layout['right-column-panel'] !== undefined) {
              updates.rightColumnSize = Math.round(layout['right-column-panel']);
            }
            persistLayout(updates);
          }}
        >
          
          {/* Left Column: Monaco Code Editor (Top) & File Explorer (Bottom) */}
          {(showEditor || showExplorer) && (
            <>
              <ResizablePanel
                id="left-column-panel"
                defaultSize={layoutConfig.leftColumnSize ?? 26}
                minSize="16%"
                maxSize="45%"
              >
                <ResizablePanelGroup
                  orientation="vertical"
                  className="h-full w-full"
                  onLayoutChanged={(layout) => {
                    const updates: Partial<WorkspaceLayout> = {};
                    if (layout['editor-panel'] !== undefined) {
                      updates.leftEditorSplit = Math.round(layout['editor-panel']);
                    }
                    if (layout['explorer-panel'] !== undefined) {
                      updates.leftExplorerSplit = Math.round(layout['explorer-panel']);
                    }
                    persistLayout(updates);
                  }}
                >
                  {showEditor && (
                    <ResizablePanel
                      id="editor-panel"
                      defaultSize={showExplorer ? (layoutConfig.leftEditorSplit ?? 55) : 100}
                      minSize="20%"
                    >
                      <aside className="h-full flex flex-col bg-[#121215] border-r border-[#222226] overflow-hidden">
                        {/* Multi-Tab Bar */}
                        <div className="h-7 px-1 border-b border-[#222226] flex items-center justify-between text-xs text-zinc-400 bg-[#121215] shrink-0 select-none overflow-x-auto">
                          <div className="flex items-center h-full gap-0.5 overflow-x-auto scrollbar-none">
                            {openTabs.map((tab) => {
                              const isActive = tab.path === activeTabPath;
                              return (
                                <div
                                  key={tab.path}
                                  onClick={() => {
                                    setActiveTabPath(tab.path);
                                    setActiveFile(tab.path);
                                  }}
                                  className={`group h-full px-2.5 flex items-center gap-1.5 cursor-pointer text-[11px] font-mono transition-colors ${
                                    isActive
                                      ? 'bg-[#18181b] text-zinc-100 font-medium'
                                      : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-300'
                                  }`}
                                >
                                  <GoFile className={`w-3 h-3 ${isActive ? 'text-zinc-200' : 'text-zinc-500'}`} />
                                  <span className="truncate max-w-[120px]">{tab.name}</span>
                                  {tab.isDirty && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 group-hover:hidden" />
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => handleCloseTab(tab.path, e)}
                                    className="ml-1 p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 opacity-60 group-hover:opacity-100 transition-opacity"
                                    title="Close Tab"
                                  >
                                    <GoX className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-1 px-1">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => toggleEditor()}
                              title="Collapse Editor"
                              className="h-5 w-5 text-zinc-500 hover:text-zinc-200"
                            >
                              <GoSidebarCollapse />
                            </Button>
                          </div>
                        </div>
                        <div className="flex-1 overflow-hidden bg-[#121215]">
                          <Editor
                            height="100%"
                            language={
                              activeTabPath.endsWith('.ino') ||
                              activeTabPath.endsWith('.cpp') ||
                              activeTabPath.endsWith('.h') ||
                              activeTabPath.endsWith('.c')
                                ? 'cpp'
                                : activeTabPath.endsWith('.json')
                                ? 'json'
                                : activeTabPath.endsWith('.md')
                                ? 'markdown'
                                : 'plaintext'
                            }
                            theme="microrustsim-dark"
                            beforeMount={setupMonacoTheme}
                            onMount={(editor, monaco) => {
                              editorRef.current = editor;
                              monaco.editor.setTheme('microrustsim-dark');
                            }}
                            value={fileContents[activeTabPath] ?? (activeTabPath === 'sketch.ino' ? sketchCode : '')}
                            onChange={handleEditorContentChange}
                            loading={
                              <div className="h-full w-full bg-[#121215] flex items-center justify-center text-xs text-zinc-500">
                                Loading editor...
                              </div>
                            }
                            options={{
                              minimap: { enabled: editorMinimap },
                              fontSize: editorFontSize,
                              fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
                              lineNumbers: editorLineNumbers ? 'on' : 'off',
                              wordWrap: editorWordWrap ? 'on' : 'off',
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
                  )}
                  {showEditor && showExplorer && <ResizableHandle withHandle orientation="horizontal" />}
                  {showExplorer && (
                    <ResizablePanel
                      id="explorer-panel"
                      defaultSize={showEditor ? (layoutConfig.leftExplorerSplit ?? 45) : 100}
                      minSize="20%"
                    >
                      <FileExplorer
                        projectName={projectName}
                        projectPath={projectPath}
                        files={projectFiles}
                        activeFile={activeFile}
                        onSelectFile={handleOpenFileTab}
                        onCreateFile={handleCreateFile}
                        onDeleteFile={handleDeleteFile}
                        onRefresh={handleRefreshFiles}
                        onOpenFolder={handleOpenNativeFolder}
                      />
                    </ResizablePanel>
                  )}
                </ResizablePanelGroup>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          {/* Center Column: Interactive Canvas (Top) & Terminal / Waveform (Bottom) */}
          <ResizablePanel
            id="center-column-panel"
            defaultSize={layoutConfig.centerColumnSize ?? 52}
            minSize="30%"
          >
            <ResizablePanelGroup
              orientation="vertical"
              className="h-full w-full"
              onLayoutChanged={(layout) => {
                const updates: Partial<WorkspaceLayout> = {};
                if (layout['canvas-panel'] !== undefined) {
                  updates.centerCanvasSplit = Math.round(layout['canvas-panel']);
                }
                if (layout['terminal-panel'] !== undefined) {
                  updates.centerTerminalSplit = Math.round(layout['terminal-panel']);
                }
                persistLayout(updates);
              }}
            >
              <ResizablePanel
                id="canvas-panel"
                defaultSize={showTerminal ? (layoutConfig.centerCanvasSplit ?? 70) : 100}
                minSize="25%"
              >
                <main
                  tabIndex={-1}
                  className={`h-full w-full relative overflow-hidden outline-none ${canvasGridVisible ? 'canvas-grid' : ''} bg-[#09090b] ${
                    activeTool === 'wire' ? 'cursor-crosshair' : 'cursor-default'
                  }`}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onWheel={handleCanvasWheel}
                  onContextMenu={handleCanvasContextMenu}
                >
                  {/* Viewport Transform Container */}
                  <div
                    className="absolute inset-0 pointer-events-none origin-top-left"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    }}
                  >
                    {/* Circuit Components */}
                    {components.map((c) => {
                      const isSelected = selectedCompId === c.id || selectedCompIds.has(c.id);
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

                      const eraserHoverClass = activeTool === 'eraser' ? 'hover:ring-2 hover:ring-rose-500 hover:opacity-85 cursor-pointer' : '';
                      const wrapperProps = {
                        key: c.id,
                        className: `pointer-events-auto transition-[outline,ring,transform] duration-75 ${outlineClass} ${cursorClass} ${eraserHoverClass}`,
                        style: {
                          position: 'absolute' as const,
                          left: c.x,
                          top: c.y,
                          width: 'fit-content',
                          height: 'fit-content',
                          transform: `rotate(${c.rotation || 0}deg) scaleX(${c.flipped ? -1 : 1})`,
                          transformOrigin: 'center center',
                        },
                        onMouseEnter: () => setCanvasHoverInfo(getComponentHoverInfo(c)),
                        onMouseLeave: () => setCanvasHoverInfo(''),
                        onMouseDown: (e: React.MouseEvent) => handleComponentMouseDown(c.id, e),
                        onContextMenu: (e: React.MouseEvent) => handleComponentContextMenu(c.id, e),
                        onClick: (e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (activeTool === 'eraser') {
                            handleDeleteComponent(c.id);
                          } else {
                            if (!e.shiftKey) {
                              setSelectedCompId(c.id);
                              setSelectedCompIds(new Set([c.id]));
                              setSelectedWireId(null);
                            }
                          }
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
                              color={(c.props?.color as any) || 'red'}
                              isLit={litLeds.has(c.id)}
                              brightness={ledBrightness[c.id]}
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
                              ohms={c.props?.ohms || 220}
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
                              pressed={Boolean(c.props?.pressed)}
                              isInteractive={activeTool !== 'eraser' && activeTool !== 'wire'}
                              onPinMouseDown={(pin: string, e: React.MouseEvent) => {
                                e.stopPropagation();
                                handlePinMouseDown(c.id, pin);
                              }}
                              onPressChange={(pressed: boolean) => {
                                setComponents((prev) =>
                                  prev.map((item) =>
                                    item.id === c.id ? { ...item, props: { ...(item.props || {}), pressed } } : item
                                  )
                                );
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
                              value={c.props?.value ?? 0.5}
                              isInteractive={activeTool !== 'move'}
                              onValueChange={(val: number) => {
                                setComponents((prev) =>
                                  prev.map((item) =>
                                    item.id === c.id ? { ...item, props: { ...(item.props || {}), value: val } } : item
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

                      if (c.kind === 'text_label') {
                        return (
                          <div {...wrapperProps}>
                            <TextLabel
                              id={c.id}
                              text={c.props?.text}
                              color={c.props?.color}
                              fontFamily={c.props?.fontFamily}
                              fontSize={c.props?.fontSize}
                              bold={c.props?.bold}
                              italic={c.props?.italic}
                              underline={c.props?.underline}
                              isSelected={isSelected}
                              onTextChange={(newText) => {
                                handleUpdateComponent(c.id, {
                                  props: { ...(c.props || {}), text: newText },
                                });
                              }}
                            />
                          </div>
                        );
                      }

                      return null;
                    })}

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
                      activeTool={activeTool}
                      globalRoutingMode={wireRoutingMode}
                      selectedWireId={selectedWireId}
                      onWireHover={(wireId) => {
                        if (!wireId) {
                          setCanvasHoverInfo('');
                        } else {
                          const w = wires.find((x) => x.id === wireId);
                          if (w) setCanvasHoverInfo(getWireHoverInfo(w));
                        }
                      }}
                      onWireClick={(wireId) => {
                        if (activeTool === 'eraser') {
                          handleDeleteWire(wireId);
                        } else {
                          setSelectedWireId(wireId);
                          setSelectedCompId(null);
                        }
                      }}
                      onStartDragSegment={handleStartDragSegment}
                      onStartDragWaypoint={handleStartDragWaypoint}
                      onAddAndDragWaypoint={handleAddAndDragWaypoint}
                      onDeleteWaypoint={handleDeleteWaypoint}
                    />

                    {/* Discrete Hardware Circuit Fault Indicators Overlay */}
                    <FaultOverlay
                      faults={circuitFaults}
                      getPinWorldPos={getPinWorldPos}
                      components={components}
                      onHoverFault={(desc) => setCanvasHoverInfo(desc)}
                    />
                  </div>

                  {/* Wire Dragging Floating Hint */}
                  {wireDraftStart && (
                    <div className="absolute top-3 left-3 bg-[#18181b]/90 border border-zinc-700 px-2.5 py-1 rounded text-[11px] text-zinc-300 shadow-md">
                      Routing wire from <span className="font-mono text-zinc-100 font-semibold">{wireDraftStart.pinName}</span>. Click target pin to connect.
                    </div>
                  )}

                  {/* Canvas Shortcut Help Badge (? in top-right) */}
                  <CanvasShortcutsHelp />

                  {/* Bottom-Left Canvas Debug Hover HUD (Single-line subtle readout) */}
                  <div className="absolute bottom-3 left-3 z-30 pointer-events-none select-none px-2.5 py-1 rounded bg-[#0c0d10]/85 border border-[#222226]/60 backdrop-blur-sm text-[11px] font-mono text-zinc-500 tracking-wide transition-opacity">
                    {canvasHoverInfo || `Canvas • (${Math.round(mouseCanvasPos.x)}, ${Math.round(mouseCanvasPos.y)}) • ${Math.round(zoom * 100)}%`}
                  </div>

                  {/* Rubber-band Multi-Selection Box */}
                  {selectionBox && (
                    <div
                      className="fixed border border-zinc-400 bg-zinc-500/15 pointer-events-none rounded-xs z-30"
                      style={{
                        left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
                        top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
                        width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
                        height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
                      }}
                    />
                  )}
                </main>
              </ResizablePanel>

              {showTerminal && (
                <>
                  <ResizableHandle withHandle orientation="horizontal" />
                  <ResizablePanel
                    id="terminal-panel"
                    defaultSize={layoutConfig.centerTerminalSplit ?? 30}
                    minSize="15%"
                    maxSize="65%"
                  >
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
                              <div className="flex items-center gap-1.5 pr-1">
                                {bottomTab === 'serial' && (
                                  <div className="relative flex items-center mr-1">
                                    <select
                                      value={baudRate}
                                      onChange={(e) => setBaudRate(Number(e.target.value))}
                                      className="appearance-none bg-[#18181b] hover:bg-[#202024] border border-[#27272a] hover:border-zinc-700 text-[11px] text-zinc-300 rounded px-2.5 py-0.5 pr-5 cursor-pointer outline-none transition-colors"
                                    >
                                      <option value={9600}>9600 baud</option>
                                      <option value={115200}>115200 baud</option>
                                    </select>
                                    <div className="absolute right-1.5 pointer-events-none text-zinc-500 text-[8px]">
                                      ▼
                                    </div>
                                  </div>
                                )}

                                {bottomTab === 'serial' && <div className="h-3.5 w-px bg-[#27272a] mx-0.5" />}

                                {/* Copy Terminal Logs */}
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={handleCopyTerminalLogs}
                                  title={copiedTerminal ? 'Copied to clipboard!' : 'Copy output logs'}
                                  className="h-5 w-5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors flex items-center justify-center"
                                >
                                  {copiedTerminal ? (
                                    <GoCheck className="w-3.5 h-3.5 text-zinc-200" />
                                  ) : (
                                    <GoCopy className="w-3.5 h-3.5 text-zinc-400" />
                                  )}
                                </Button>

                                {/* Clear Button */}
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => {
                                    if (bottomTab === 'serial') setSerialLogs('');
                                    else if (bottomTab === 'build') setBuildLogs('');
                                  }}
                                  title={bottomTab === 'serial' ? 'Clear Serial Logs' : 'Clear Build Output'}
                                  className="h-5 w-5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors flex items-center justify-center"
                                >
                                  <GoTrash className="w-3.5 h-3.5" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => toggleTerminal()}
                                  title="Collapse Terminal"
                                  className="h-5 w-5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors flex items-center justify-center"
                                >
                                  <GoSidebarCollapse className="-rotate-90 w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Tab Content: Serial Monitor */}
                            <TabsContent value="serial" className="flex-1 min-h-0 overflow-hidden p-2 font-mono text-xs select-text m-0 flex flex-col">
                              <div
                                ref={serialContainerRef}
                                className="flex-1 min-h-0 overflow-y-auto pr-2 select-text cursor-text font-mono text-xs text-zinc-300 selection:bg-zinc-700 selection:text-white"
                              >
                                <pre className="whitespace-pre-wrap leading-relaxed font-mono text-xs text-zinc-300 m-0 select-text cursor-text selection:bg-zinc-700 selection:text-white">
                                  {serialLogs}
                                </pre>
                              </div>
                              <div className="flex items-center gap-2 pt-1.5 border-t border-[#222226] mt-1 shrink-0">
                                <Input
                                  type="text"
                                  placeholder="Send command to Arduino UART..."
                                  value={serialInput}
                                  onChange={(e) => setSerialInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && serialInput) {
                                      tauriInvoke('write_serial', { input: serialInput });
                                      setSerialLogs((prev) => `${prev}> ${serialInput}\n`);
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
                                      setSerialLogs((prev) => `${prev}> ${serialInput}\n`);
                                      setSerialInput('');
                                    }
                                  }}
                                  className="h-6 px-2.5 text-xs bg-zinc-200 text-zinc-900 hover:bg-zinc-100 font-medium"
                                >
                                  Send
                                </Button>
                              </div>
                            </TabsContent>

                            {/* Tab Content: High-DPI Crisp Waveform */}
                            <TabsContent value="waveform" className="flex-1 overflow-hidden p-1 m-0">
                              <LogicWaveform
                                history={logicHistory}
                                channels={waveformChannels}
                                onClear={handleClearWaveform}
                              />
                            </TabsContent>

                            {/* Tab Content: Build Output */}
                            <TabsContent value="build" className="flex-1 min-h-0 overflow-hidden p-2 font-mono text-xs select-text m-0 flex flex-col">
                              <div className="flex-1 min-h-0 overflow-y-auto pr-2 select-text cursor-text font-mono text-xs text-zinc-300 selection:bg-zinc-700 selection:text-white">
                                <pre className="whitespace-pre-wrap leading-relaxed font-mono text-xs text-zinc-300 m-0 select-text cursor-text selection:bg-zinc-700 selection:text-white">
                                  {buildLogs}
                                </pre>
                              </div>
                            </TabsContent>
                          </Tabs>
                        </footer>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          {/* Right Column: Component Palette (Top) & Property Inspector (Bottom) */}
          {(showPalette || showInspector) && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel
                id="right-column-panel"
                defaultSize={layoutConfig.rightColumnSize ?? 22}
                minSize="15%"
                maxSize="45%"
              >
                <ResizablePanelGroup
                  orientation="vertical"
                  className="h-full w-full"
                  onLayoutChanged={(layout) => {
                    const updates: Partial<WorkspaceLayout> = {};
                    if (layout['palette-panel'] !== undefined) {
                      updates.rightPaletteSplit = Math.round(layout['palette-panel']);
                    }
                    if (layout['inspector-panel'] !== undefined) {
                      updates.rightInspectorSplit = Math.round(layout['inspector-panel']);
                    }
                    persistLayout(updates);
                  }}
                >
                  {showPalette && (
                    <ResizablePanel
                      id="palette-panel"
                      defaultSize={showInspector ? (layoutConfig.rightPaletteSplit ?? 45) : 100}
                      minSize="20%"
                    >
                      <aside className="h-full flex flex-col bg-[#121215] border-l border-[#222226] overflow-hidden">
                      <div className="h-7 px-3 border-b border-[#222226] flex items-center justify-between text-xs text-zinc-400 bg-[#121215] shrink-0">
                        <span className="font-medium text-zinc-300 flex items-center gap-1.5 text-xs">
                          <GoPackage className="text-zinc-500" /> Components
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => togglePalette()}
                          title="Collapse Palette"
                          className="h-5 w-5 text-zinc-500 hover:text-zinc-200"
                        >
                          <GoSidebarCollapse className="rotate-180" />
                        </Button>
                      </div>

                      <ScrollArea className="flex-1 p-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          {/* 1. Arduino Uno */}
                          <button
                            type="button"
                            onClick={() => {
                              const id = `uno_${components.length + 1}`;
                              setComponents((prev) => [
                                ...prev,
                                { id, kind: 'arduino_uno', x: 100, y: 100, props: {} },
                              ]);
                              setSelectedCompId(id);
                              setSelectedWireId(null);
                            }}
                            className="bg-[#141417] hover:bg-[#1a1a1f] border border-[#222226] hover:border-zinc-600 rounded-lg py-3 px-2 flex flex-col items-center justify-center gap-2 text-center transition-all group cursor-pointer active:scale-95"
                          >
                            <svg className="w-9 h-9 text-zinc-400 group-hover:text-white transition-colors" viewBox="0 0 64 64" fill="none" stroke="currentColor">
                              <rect x="12" y="8" width="40" height="48" rx="4" strokeWidth="2" fill="#18181b" />
                              <rect x="8" y="14" width="8" height="12" rx="1" fill="#27272a" strokeWidth="1.5" />
                              <rect x="8" y="38" width="10" height="10" rx="1" fill="#27272a" strokeWidth="1.5" />
                              <rect x="22" y="24" width="20" height="12" rx="2" fill="#09090b" strokeWidth="1.5" />
                              <line x1="48" y1="12" x2="48" y2="28" strokeWidth="2.5" strokeLinecap="round" stroke="#52525b" />
                              <line x1="48" y1="36" x2="48" y2="52" strokeWidth="2.5" strokeLinecap="round" stroke="#52525b" />
                            </svg>
                            <span className="font-medium text-xs text-zinc-300 group-hover:text-white transition-colors">
                              Arduino Uno
                            </span>
                          </button>

                          {/* 2. Breadboard */}
                          <button
                            type="button"
                            onClick={() => {
                              const id = `bb_${components.length + 1}`;
                              setComponents((prev) => [
                                ...prev,
                                { id, kind: 'breadboard', x: 300, y: 100, props: {} },
                              ]);
                              setSelectedCompId(id);
                              setSelectedWireId(null);
                            }}
                            className="bg-[#141417] hover:bg-[#1a1a1f] border border-[#222226] hover:border-zinc-600 rounded-lg py-3 px-2 flex flex-col items-center justify-center gap-2 text-center transition-all group cursor-pointer active:scale-95"
                          >
                            <svg className="w-9 h-9 text-zinc-400 group-hover:text-white transition-colors" viewBox="0 0 64 64" fill="none" stroke="currentColor">
                              <rect x="6" y="14" width="52" height="36" rx="3" strokeWidth="2" fill="#18181b" />
                              <line x1="12" y1="21" x2="52" y2="21" stroke="#52525b" strokeWidth="1" strokeDasharray="2 2" />
                              <line x1="12" y1="25" x2="52" y2="25" stroke="#3f3f46" strokeWidth="1" strokeDasharray="2 2" />
                              <line x1="12" y1="32" x2="52" y2="32" stroke="#71717a" strokeWidth="1.5" strokeDasharray="1 3" />
                              <line x1="12" y1="39" x2="52" y2="39" stroke="#3f3f46" strokeWidth="1" strokeDasharray="2 2" />
                              <line x1="12" y1="43" x2="52" y2="43" stroke="#52525b" strokeWidth="1" strokeDasharray="2 2" />
                            </svg>
                            <span className="font-medium text-xs text-zinc-300 group-hover:text-white transition-colors">
                              Breadboard
                            </span>
                          </button>

                          {/* 3. LED */}
                          <button
                            type="button"
                            onClick={() => {
                              const id = `led_${components.length + 1}`;
                              setComponents((prev) => [
                                ...prev,
                                { id, kind: 'led', x: 500, y: 80, props: { color: '#ef4444', vf: 2.0 } },
                              ]);
                              tauriInvoke('add_led', { id, color: '#ef4444' });
                              setSelectedCompId(id);
                              setSelectedWireId(null);
                            }}
                            className="bg-[#141417] hover:bg-[#1a1a1f] border border-[#222226] hover:border-zinc-600 rounded-lg py-3 px-2 flex flex-col items-center justify-center gap-2 text-center transition-all group cursor-pointer active:scale-95"
                          >
                            <svg className="w-9 h-9 text-zinc-400 group-hover:text-white transition-colors" viewBox="0 0 64 64" fill="none" stroke="currentColor">
                              <path d="M22 28 C22 18, 42 18, 42 28 L44 38 L20 38 Z" fill="#18181b" strokeWidth="2" />
                              <ellipse cx="32" cy="28" rx="8" ry="7" fill="#27272a" />
                              <line x1="26" y1="38" x2="26" y2="52" stroke="#52525b" strokeWidth="2" strokeLinecap="round" />
                              <line x1="38" y1="38" x2="38" y2="52" stroke="#52525b" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <span className="font-medium text-xs text-zinc-300 group-hover:text-white transition-colors">
                              LED
                            </span>
                          </button>

                          {/* 4. Resistor */}
                          <button
                            type="button"
                            onClick={() => {
                              const id = `r_${components.length + 1}`;
                              setComponents((prev) => [
                                ...prev,
                                { id, kind: 'resistor', x: 580, y: 80, props: { ohms: 220 } },
                              ]);
                              tauriInvoke('add_resistor', { id, ohms: 220 });
                              setSelectedCompId(id);
                              setSelectedWireId(null);
                            }}
                            className="bg-[#141417] hover:bg-[#1a1a1f] border border-[#222226] hover:border-zinc-600 rounded-lg py-3 px-2 flex flex-col items-center justify-center gap-2 text-center transition-all group cursor-pointer active:scale-95"
                          >
                            <svg className="w-9 h-9 text-zinc-400 group-hover:text-white transition-colors" viewBox="0 0 64 64" fill="none" stroke="currentColor">
                              <line x1="8" y1="32" x2="20" y2="32" stroke="#52525b" strokeWidth="2" strokeLinecap="round" />
                              <line x1="44" y1="32" x2="56" y2="32" stroke="#52525b" strokeWidth="2" strokeLinecap="round" />
                              <rect x="20" y="24" width="24" height="16" rx="4" fill="#18181b" strokeWidth="1.5" />
                              <line x1="26" y1="24" x2="26" y2="40" stroke="#71717a" strokeWidth="2" />
                              <line x1="31" y1="24" x2="31" y2="40" stroke="#71717a" strokeWidth="2" />
                              <line x1="36" y1="24" x2="36" y2="40" stroke="#71717a" strokeWidth="2" />
                            </svg>
                            <span className="font-medium text-xs text-zinc-300 group-hover:text-white transition-colors">
                              Resistor
                            </span>
                          </button>

                          {/* 5. Pushbutton */}
                          <button
                            type="button"
                            onClick={() => {
                              const id = `btn_${components.length + 1}`;
                              setComponents((prev) => [
                                ...prev,
                                { id, kind: 'pushbutton', x: 680, y: 80, props: {} },
                              ]);
                              tauriInvoke('add_button', { id });
                              setSelectedCompId(id);
                              setSelectedWireId(null);
                            }}
                            className="bg-[#141417] hover:bg-[#1a1a1f] border border-[#222226] hover:border-zinc-600 rounded-lg py-3 px-2 flex flex-col items-center justify-center gap-2 text-center transition-all group cursor-pointer active:scale-95"
                          >
                            <svg className="w-9 h-9 text-zinc-400 group-hover:text-white transition-colors" viewBox="0 0 64 64" fill="none" stroke="currentColor">
                              <rect x="18" y="18" width="28" height="28" rx="4" fill="#18181b" strokeWidth="2" />
                              <circle cx="32" cy="32" r="8" fill="#27272a" strokeWidth="1.5" />
                              <line x1="12" y1="22" x2="18" y2="22" strokeWidth="2" strokeLinecap="round" />
                              <line x1="12" y1="42" x2="18" y2="42" strokeWidth="2" strokeLinecap="round" />
                              <line x1="46" y1="22" x2="52" y2="22" strokeWidth="2" strokeLinecap="round" />
                              <line x1="46" y1="42" x2="52" y2="42" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <span className="font-medium text-xs text-zinc-300 group-hover:text-white transition-colors">
                              Pushbutton
                            </span>
                          </button>

                          {/* 6. Potentiometer */}
                          <button
                            type="button"
                            onClick={() => {
                              const id = `pot_${components.length + 1}`;
                              setComponents((prev) => [
                                ...prev,
                                { id, kind: 'potentiometer', x: 760, y: 80, props: { value: 0.5 } },
                              ]);
                              tauriInvoke('add_potentiometer', { id });
                              setSelectedCompId(id);
                              setSelectedWireId(null);
                            }}
                            className="bg-[#141417] hover:bg-[#1a1a1f] border border-[#222226] hover:border-zinc-600 rounded-lg py-3 px-2 flex flex-col items-center justify-center gap-2 text-center transition-all group cursor-pointer active:scale-95"
                          >
                            <svg className="w-9 h-9 text-zinc-400 group-hover:text-white transition-colors" viewBox="0 0 64 64" fill="none" stroke="currentColor">
                              <circle cx="32" cy="28" r="16" fill="#18181b" strokeWidth="2" />
                              <circle cx="32" cy="28" r="8" fill="#27272a" strokeWidth="1.5" />
                              <line x1="32" y1="20" x2="32" y2="28" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                              <line x1="24" y1="44" x2="24" y2="52" strokeWidth="2" strokeLinecap="round" />
                              <line x1="32" y1="44" x2="32" y2="52" strokeWidth="2" strokeLinecap="round" />
                              <line x1="40" y1="44" x2="40" y2="52" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <span className="font-medium text-xs text-zinc-300 group-hover:text-white transition-colors">
                              Potentiometer
                            </span>
                          </button>
                        </div>
                      </ScrollArea>
                    </aside>
                    </ResizablePanel>
                  )}
                  {showPalette && showInspector && <ResizableHandle withHandle orientation="horizontal" />}
                  {showInspector && (
                    <ResizablePanel
                      id="inspector-panel"
                      defaultSize={showPalette ? (layoutConfig.rightInspectorSplit ?? 55) : 100}
                      minSize="20%"
                    >
                      <ErrorBoundary fallbackTitle="Property Inspector Error">
                        <PropertyInspector
                          selectedCompId={selectedCompId}
                          selectedWireId={selectedWireId}
                          components={components}
                          wires={wires}
                          litLeds={litLeds}
                          ledBrightness={ledBrightness}
                          onUpdateComponent={handleUpdateComponent}
                          onUpdateWire={handleUpdateWire}
                          onDeleteComponent={handleDeleteComponent}
                          onDeleteWire={handleDeleteWire}
                          onButtonPress={(id, pressed) => {
                            tauriInvoke('press_button', { id, pressed });
                          }}
                          onClose={() => toggleInspector()}
                        />
                      </ErrorBoundary>
                    </ResizablePanel>
                  )}
                </ResizablePanelGroup>
              </ResizablePanel>
            </>
          )}

        </ResizablePanelGroup>

        {/* 3. Status Bar */}
        <div className="h-5 bg-[#121215] border-t border-[#222226] px-3 flex items-center justify-between text-[10px] text-zinc-500 shrink-0">
          <span className="flex items-center gap-2">
            {isCompiling && (
              <div className="flex items-center gap-1.5" title="Compiling firmware with arduino-cli...">
                <div className="w-12 h-1 bg-[#222226] rounded-full overflow-hidden flex items-center">
                  <div className="w-full h-full bg-emerald-400 rounded-full animate-pulse" />
                </div>
              </div>
            )}
            <span>{statusMessage}</span>
            {projectPath && (
              <span className="text-zinc-600 font-mono text-[9px]">• {projectPath}</span>
            )}
          </span>
          <span>ATmega328P @ 16 MHz • Pure Rust + Tauri v2</span>
        </div>

        {/* Modal Dialog: Create New Project with Starter Templates & 0-Delay Dragging */}
        <CreateProjectModal
          isOpen={showNewProjectModal}
          onClose={() => setShowNewProjectModal(false)}
          onCreate={handleCreateProject}
          onBrowseFolder={handleBrowseNativeFolder}
        />

        {/* Modal Dialog: Open Project Directory */}
        <OpenProjectModal
          isOpen={showOpenProjectModal}
          onClose={() => setShowOpenProjectModal(false)}
          onOpen={handleOpenProject}
          onBrowseFolder={handleBrowseNativeFolder}
          recentProjects={recentProjects}
        />

        {/* Modal Dialog: VS Code-style Settings & Preferences */}
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          editorFontSize={editorFontSize}
          setEditorFontSize={setEditorFontSize}
          editorMinimap={editorMinimap}
          setEditorMinimap={setEditorMinimap}
          editorLineNumbers={editorLineNumbers}
          setEditorLineNumbers={setEditorLineNumbers}
          editorWordWrap={editorWordWrap}
          setEditorWordWrap={setEditorWordWrap}
          autoSaveOnRun={autoSaveOnRun}
          setAutoSaveOnRun={setAutoSaveOnRun}
          autoScrollSerial={autoScrollSerial}
          setAutoScrollSerial={setAutoScrollSerial}
          canvasGridVisible={canvasGridVisible}
          setCanvasGridVisible={setCanvasGridVisible}
          wireRoutingMode={wireRoutingMode}
          setWireRoutingMode={setWireRoutingMode}
          baudRate={baudRate}
          setBaudRate={setBaudRate}
        />

        {/* Modal Dialog: Unsaved Changes Confirmation on Close (Save / Discard / Cancel) */}
        <UnsavedChangesModal
          isOpen={showUnsavedCloseModal}
          projectName={projectName}
          onSave={handleCloseSave}
          onDiscard={handleCloseDiscard}
          onCancel={handleCloseCancel}
          isSaving={isSavingOnClose}
        />

        {/* Canvas & Component Context Menu */}
        {contextMenu && (
          <CanvasContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            type={contextMenu.type}
            selectedCount={selectedCompIds.size}
            componentName={
              contextMenu.compId
                ? components.find((c) => c.id === contextMenu.compId)?.id
                : undefined
            }
            onClose={handleCloseContextMenu}
            onCopy={() => {
              if (contextMenu.type === 'group' && selectedCompIds.size > 1) {
                handleCopySelectedGroup();
              } else {
                const targetId = contextMenu.compId || selectedCompId;
                if (targetId) {
                  const comp = components.find((c) => c.id === targetId);
                  if (comp) handleCopyComponent(comp);
                }
              }
            }}
            onCut={() => {
              if (contextMenu.type === 'group' && selectedCompIds.size > 1) {
                handleCopySelectedGroup();
                handleDeleteSelected();
              } else {
                const targetId = contextMenu.compId || selectedCompId;
                if (targetId) {
                  const comp = components.find((c) => c.id === targetId);
                  if (comp) handleCopyComponent(comp);
                  handleDeleteComponent(targetId);
                  setStatusMessage(`Cut ${targetId} to clipboard`);
                }
              }
            }}
            onPaste={handlePasteComponent}
            onDelete={() => {
              if (contextMenu.type === 'group' && selectedCompIds.size > 1) {
                handleDeleteSelected();
              } else {
                const targetId = contextMenu.compId || selectedCompId;
                if (targetId) {
                  handleDeleteComponent(targetId);
                }
              }
            }}
            onRotate={() => {
              if (contextMenu.type === 'group' && selectedCompIds.size > 1) {
                handleRotateSelected();
              } else {
                const targetId = contextMenu.compId || selectedCompId;
                if (targetId) {
                  setComponents((prev) =>
                    prev.map((c) =>
                      c.id === targetId ? { ...c, rotation: ((c.rotation || 0) + 90) % 360 } : c
                    )
                  );
                  setIsDirty(true);
                  setStatusMessage(`Rotated ${targetId}`);
                }
              }
            }}
            onFlip={() => {
              if (contextMenu.type === 'group' && selectedCompIds.size > 1) {
                handleFlipSelected();
              } else {
                const targetId = contextMenu.compId || selectedCompId;
                if (targetId) {
                  setComponents((prev) =>
                    prev.map((c) => (c.id === targetId ? { ...c, flipped: !c.flipped } : c))
                  );
                  setIsDirty(true);
                  setStatusMessage(`Flipped ${targetId}`);
                }
              }
            }}
            onRename={() => {
              const targetId = contextMenu.compId || selectedCompId;
              if (targetId) {
                const comp = components.find((c) => c.id === targetId);
                if (comp) {
                  setRenameModalComp({
                    id: comp.id,
                    name: comp.props?.name || comp.props?.text || comp.id,
                  });
                }
              }
            }}
            onProperties={() => {
              const targetId = contextMenu.compId || selectedCompId;
              if (targetId) {
                setSelectedCompId(targetId);
                setSelectedCompIds(new Set([targetId]));
                setShowInspector(true);
              }
            }}
            onAddText={() => {
              const rect = document.querySelector('main')?.getBoundingClientRect();
              const left = rect?.left || 0;
              const top = rect?.top || 0;
              const clickX = contextMenu ? contextMenu.x : 200;
              const clickY = contextMenu ? contextMenu.y : 200;
              const worldX = Math.round((clickX - left - pan.x) / zoom / 10) * 10;
              const worldY = Math.round((clickY - top - pan.y) / zoom / 10) * 10;
              const newTextId = `label_${Date.now().toString().slice(-4)}`;
              const newTextComp: CircuitComponent = {
                id: newTextId,
                kind: 'text_label',
                x: worldX,
                y: worldY,
                props: {
                  text: 'Label',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 16,
                  color: '#f4f4f5',
                  bold: false,
                  italic: false,
                  underline: false,
                },
              };
              setComponents((prev) => [...prev, newTextComp]);
              setSelectedCompId(newTextId);
              setSelectedCompIds(new Set([newTextId]));
              setIsDirty(true);
              setStatusMessage('Added Text Label');
            }}
          />
        )}

        {/* Rename Component Modal */}
        <RenameModal
          isOpen={Boolean(renameModalComp)}
          currentName={renameModalComp?.name || ''}
          componentId={renameModalComp?.id || ''}
          onSave={(newName) => {
            if (renameModalComp) {
              handleUpdateComponent(renameModalComp.id, {
                props: {
                  ...components.find((c) => c.id === renameModalComp.id)?.props,
                  name: newName,
                  text: newName,
                },
              });
              setStatusMessage(`Renamed to "${newName}"`);
            }
          }}
          onClose={() => setRenameModalComp(null)}
        />

        {/* Upload Target Configuration Modal */}
        <UploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          components={components}
          files={projectFiles}
          currentSketchCode={sketchCode}
          isCompiling={isCompiling}
          onUpload={async (targetBoardId, comPort, fileName) => {
            let codeToFlash = sketchCode;
            if (fileName !== 'sketch.ino' && fileContents[fileName]) {
              codeToFlash = fileContents[fileName];
            }
            setStatusMessage(`Flashing ${fileName} to ${targetBoardId} (${comPort})...`);
            setSerialLogs((prev) => `${prev.trimEnd()}\n[Upload] Flashing ${fileName} to ${comPort} (${targetBoardId})...\n`);
            return await handleCompile();
          }}
          onUpdateBoardPort={(boardId, newPort, linkedFile) => {
            handleUpdateComponent(boardId, {
              props: {
                ...components.find((c) => c.id === boardId)?.props,
                comPort: newPort,
                port: newPort,
                ...(linkedFile ? { linkedFile } : {}),
              },
            });
          }}
        />

        {/* Modal Dialog: About MicroRustSim */}
        {showAboutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs animate-in fade-in duration-100">
            <div className="w-[360px] bg-[#121215] border border-[#27272a] rounded-lg shadow-2xl p-5 select-none text-zinc-300">
              <div className="flex items-center justify-between pb-3 border-b border-[#222226]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-[#1e1e24] border border-zinc-700 flex items-center justify-center p-1">
                    <img src="/logo.png" alt="MicroRustSim" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-zinc-100">MicroRustSim</h3>
                    <p className="text-[10px] text-zinc-500 font-mono">v0.2.3 • Cycle-Accurate Simulator</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAboutModal(false)}
                  className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-[#1a1a1e] transition-colors"
                >
                  <GoX className="w-4 h-4" />
                </button>
              </div>

              <div className="py-3.5 space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-[#1f1f23]">
                  <span className="text-zinc-500">Core Engine:</span>
                  <span className="font-mono text-zinc-200">ATmega328P @ 16.0 MHz</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1f1f23]">
                  <span className="text-zinc-500">Architecture:</span>
                  <span className="font-mono text-zinc-200">Rust (Native) + Tauri v2</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1f1f23]">
                  <span className="text-zinc-500">Frontend:</span>
                  <span className="font-mono text-zinc-200">React 19 + Tailwind v4</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1f1f23]">
                  <span className="text-zinc-500">Compiler:</span>
                  <span className="font-mono text-zinc-200">Arduino-CLI (Genuine GCC)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-500">Theme:</span>
                  <span className="font-mono text-zinc-200">Flat Monochrome Zinc Dark</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-[#222226]">
                <span className="text-[10px] text-zinc-600 font-mono">MIT License</span>
                <button
                  type="button"
                  onClick={() => setShowAboutModal(false)}
                  className="px-3 py-1 rounded bg-[#1e1e24] hover:bg-[#27272e] text-xs text-zinc-200 hover:text-white border border-zinc-700 font-medium transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Minimalist Theme Splash Screen (Clean Logo, No Clutter, Prevents White Screen) */}
        <div
          className={`fixed inset-0 z-[99999] bg-[#09090b] flex flex-col items-center justify-center select-none transition-opacity duration-300 pointer-events-none ${
            isAppLoading ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-[#121215] border border-[#222226] p-3 shadow-2xl flex items-center justify-center mb-4">
              <img
                src="/logo.png"
                alt="MicroRustSim"
                className="w-full h-full object-contain animate-pulse"
              />
            </div>
            <div className="text-zinc-200 font-semibold text-sm tracking-tight mb-1">
              MicroRustSim
            </div>
            <div className="text-[11px] font-mono text-zinc-500 mb-5">
              Cycle-Accurate ATmega328P Simulator
            </div>
            <div className="w-28 h-0.5 bg-[#222226] rounded-full overflow-hidden">
              <div className="w-full h-full bg-zinc-300 rounded-full animate-pulse" />
            </div>
          </div>
        </div>

      </div>
    </TooltipProvider>
  );
}
