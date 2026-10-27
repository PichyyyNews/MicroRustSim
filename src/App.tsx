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
  GoFileDirectory,
  GoClock,
  GoSidebarCollapse,
  GoCheck,
  GoZoomIn,
  GoZoomOut,
  GoCpu,
  GoX,
} from 'react-icons/go';
import {
  MousePointer,
  Move,
  Cable,
  ChevronDown,
  Check,
  Eraser,
  RotateCw,
  FlipHorizontal,
  CornerDownRight,
  Spline,
  SlidersHorizontal,
  FolderOpen,
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
import { LogicWaveform } from './components/LogicWaveform';
import { FileExplorer } from './components/FileExplorer';
import { PropertyInspector } from './components/PropertyInspector';
import {
  CircuitComponent,
  CircuitWire,
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
  // --- Menubar Active Menu (File, View, Window) ---
  const [activeMenu, setActiveMenu] = useState<'file' | 'view' | 'window' | null>(null);
  const menubarRef = useRef<HTMLDivElement>(null);

  // --- Active Tool Mode (Select, Move, Wire) & Word-style Color Popup ---
  const [activeTool, setActiveTool] = useState<'select' | 'move' | 'wire' | 'eraser'>('select');
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
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('My_Arduino_Lab');
  const [newProjectParentPath, setNewProjectParentPath] = useState('');
  const [showOpenProjectModal, setShowOpenProjectModal] = useState(false);
  const [openProjectPathInput, setOpenProjectPathInput] = useState('');

  // --- Draggable Modal Position States ---
  const [createModalPos, setCreateModalPos] = useState({ x: 0, y: 0 });
  const isDraggingCreateModal = useRef(false);
  const createModalDragStart = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });

  const [openModalPos, setOpenModalPos] = useState({ x: 0, y: 0 });
  const isDraggingOpenModal = useRef(false);
  const openModalDragStart = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });

  const handleCreateModalMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;
    isDraggingCreateModal.current = true;
    createModalDragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: createModalPos.x,
      startY: createModalPos.y,
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingCreateModal.current) return;
      const dx = ev.clientX - createModalDragStart.current.mouseX;
      const dy = ev.clientY - createModalDragStart.current.mouseY;
      setCreateModalPos({
        x: createModalDragStart.current.startX + dx,
        y: createModalDragStart.current.startY + dy,
      });
    };

    const onMouseUp = () => {
      isDraggingCreateModal.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleOpenModalMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;
    isDraggingOpenModal.current = true;
    openModalDragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: openModalPos.x,
      startY: openModalPos.y,
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingOpenModal.current) return;
      const dx = ev.clientX - openModalDragStart.current.mouseX;
      const dy = ev.clientY - openModalDragStart.current.mouseY;
      setOpenModalPos({
        x: openModalDragStart.current.startX + dx,
        y: openModalDragStart.current.startY + dy,
      });
    };

    const onMouseUp = () => {
      isDraggingOpenModal.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  useEffect(() => {
    if (showNewProjectModal) {
      setCreateModalPos({ x: 0, y: 0 });
    }
  }, [showNewProjectModal]);

  useEffect(() => {
    if (showOpenProjectModal) {
      setOpenModalPos({ x: 0, y: 0 });
    }
  }, [showOpenProjectModal]);

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
  const [serialLogs, setSerialLogs] = useState<string>(
    '[System] MicroRustSim Core Online.\n[System] ATmega328P Cycle-Accurate 16 MHz Engine Ready.\n'
  );
  const [buildLogs, setBuildLogs] = useState<string>('Ready to compile sketches with avr-gcc.\n');
  const [serialInput, setSerialInput] = useState('');
  const [baudRate, setBaudRate] = useState(9600);
  const [logicHistory, setLogicHistory] = useState<[number, number][]>([]);
  const [currentWireColor, setCurrentWireColor] = useState('#22c55e');
  const serialContainerRef = useRef<HTMLDivElement>(null);

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

  // --- Wires on Canvas ---
  const [wires, setWires] = useState<CircuitWire[]>([
    { id: 'w1', fromComp: 'uno1', fromPin: '13', toComp: 'led1', toPin: 'anode', color: '#22c55e' },
    { id: 'w2', fromComp: 'led1', fromPin: 'cathode', toComp: 'r1', toPin: '1', color: '#eab308' },
    { id: 'w3', fromComp: 'r1', fromPin: '2', toComp: 'uno1', toPin: 'GND', color: '#18181b' },
  ]);

  // --- Selected Component / Active Wire Creation ---
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
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
          for (const w of newWires) {
            syncWireToRust(w);
          }
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

  const handleCreateProject = useCallback(
    async (parentPath: string, name: string) => {
      const diag = JSON.stringify(exportWokwiDiagram(components, wires), null, 2);
      const res = await tauriInvoke<ProjectData>('create_project_dir', {
        parentPath: parentPath || '.',
        name,
        sketch: sketchCode,
        diagram: diag,
      });
      if (res) {
        setProjectName(res.name);
        setProjectPath(res.path);
        setSketchCode(res.sketch_code);
        setProjectFiles(res.files);
        setOpenTabs([
          { path: 'sketch.ino', name: 'sketch.ino' },
          { path: 'config.h', name: 'config.h' },
        ]);
        setActiveTabPath('sketch.ino');
        setActiveFile('sketch.ino');
        setFileContents({
          'sketch.ino': res.sketch_code,
          'diagram.json': res.diagram_json,
          'project.json': res.metadata_json,
        });
        setIsDirty(false);
        setStatusMessage(`Project created: ${res.name}`);
        setShowNewProjectModal(false);
        loadRecentProjects();
      }
    },
    [components, wires, sketchCode, exportWokwiDiagram, loadRecentProjects]
  );

  const handleOpenProject = useCallback(
    async (dirPath: string) => {
      const res = await tauriInvoke<ProjectData>('open_project_dir', { path: dirPath });
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
      }
    },
    [importWokwiDiagram, loadRecentProjects]
  );

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
      await tauriInvoke('create_project_dir_entry', {
        dirPath: projectPath,
        relativePath: fileName,
        isDir: !!isDir,
      });
      await handleRefreshFiles();
      if (!isDir) {
        handleOpenFileTab(fileName);
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
        const offset = ARDUINO_PINS[pinName];
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

        if (pinName.startsWith('top_plus_')) {
          const col = parseInt(pinName.replace('top_plus_', ''), 10) || 1;
          local = { x: X0 + (col - 1) * dx, y: 26 };
        } else if (pinName.startsWith('top_minus_')) {
          const col = parseInt(pinName.replace('top_minus_', ''), 10) || 1;
          local = { x: X0 + (col - 1) * dx, y: 39 };
        } else if (pinName.startsWith('bot_plus_')) {
          const col = parseInt(pinName.replace('bot_plus_', ''), 10) || 1;
          local = { x: X0 + (col - 1) * dx, y: 201 };
        } else if (pinName.startsWith('bot_minus_')) {
          const col = parseInt(pinName.replace('bot_minus_', ''), 10) || 1;
          local = { x: X0 + (col - 1) * dx, y: 223 };
        } else {
          const parts = pinName.split('_');
          if (parts.length === 2 && rowY[parts[0]]) {
            const row = parts[0];
            const col = parseInt(parts[1], 10) || 1;
            local = { x: X0 + (col - 1) * dx, y: rowY[row] };
          }
        }
      } else if (comp.kind === 'led') {
        w = 50;
        h = 70;
        if (pinName === 'anode') local = { x: 19, y: 60 };
        else if (pinName === 'cathode') local = { x: 31, y: 56 };
      } else if (comp.kind === 'resistor') {
        w = 64;
        h = 20;
        if (pinName === '1') local = { x: 4, y: 10 };
        else if (pinName === '2') local = { x: 60, y: 10 };
      } else if (comp.kind === 'pushbutton') {
        w = 48;
        h = 48;
        if (pinName === '1a' || pinName === '1') local = { x: 2, y: 2 };
        else if (pinName === '1b') local = { x: 46, y: 2 };
        else if (pinName === '2a' || pinName === '2') local = { x: 2, y: 46 };
        else if (pinName === '2b') local = { x: 46, y: 46 };
      } else if (comp.kind === 'potentiometer') {
        w = 52;
        h = 80;
        if (pinName === '1' || pinName === 'VCC') local = { x: 22, y: 76 };
        else if (pinName === '2' || pinName === 'SIG') local = { x: 32, y: 76 };
        else if (pinName === '3' || pinName === 'GND') local = { x: 42, y: 76 };
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

    const loop = async () => {
      if (cancelled) return;

      if (isRunningRef.current && !isSteppingRef.current) {
        isSteppingRef.current = true;
        try {
          const res = await tauriInvoke<{
            pin13: boolean;
            lit_leds: string[];
            serial_output: string | null;
            millis: number;
          }>('step_simulation', { cycles: 266666 });

          if (!cancelled && res) {
            setPin13State(res.pin13);
            setLitLeds(new Set(res.lit_leds));
            if (res.serial_output) {
              setSerialLogs((prev) => (prev + res.serial_output!).slice(-65536));
            }
            setLogicHistory((prev) => {
              const next = [...prev, [res.millis, res.pin13 ? 5.0 : 0.0] as [number, number]];
              return next.slice(-250);
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
    };
  }, []);

  // --- Auto-scroll Serial Monitor on New Output ---
  useEffect(() => {
    const el = serialContainerRef.current;
    if (bottomTab === 'serial' && showTerminal && el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [serialLogs, bottomTab, showTerminal]);

  // --- Compile & Upload ---
  const handleCompile = async (): Promise<boolean> => {
    setIsCompiling(true);
    setStatusMessage('Compiling sketch with arduino-cli...');
    setBottomTab('build');
    setShowTerminal(true);

    try {
      const res = await tauriInvoke<{ success: boolean; output: string; hex: string | null }>(
        'compile_and_upload',
        { sketch: sketchCode }
      );

      if (res) {
        setBuildLogs(res.output);
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

      // 3. Circuit Component Dragging
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
  }, [zoom, syncWireToRust]);

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
  }, [wires, selectedCompId]);

  const handleRotateSelected = useCallback(() => {
    if (!selectedCompId) return;
    setComponents((prev) =>
      prev.map((c) => {
        if (c.id !== selectedCompId) return c;
        const nextRot = ((c.rotation || 0) + 90) % 360;
        return { ...c, rotation: nextRot };
      })
    );
  }, [selectedCompId]);

  const handleFlipSelected = useCallback(() => {
    if (!selectedCompId) return;
    setComponents((prev) =>
      prev.map((c) => {
        if (c.id !== selectedCompId) return c;
        return { ...c, flipped: !c.flipped };
      })
    );
  }, [selectedCompId]);

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

      if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select');
      } else if (e.key === 'm' || e.key === 'M') {
        setActiveTool('move');
      } else if (e.key === 'w' || e.key === 'W') {
        setActiveTool('wire');
      } else if (e.key === 'e' || e.key === 'E') {
        setActiveTool('eraser');
      } else if (e.key === 'r' || e.key === 'R') {
        handleRotateSelected();
      } else if (e.key === 'f' || e.key === 'F') {
        handleFlipSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedWireId) {
          handleDeleteWire(selectedWireId);
        } else if (selectedCompId) {
          handleDeleteComponent(selectedCompId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedCompId,
    selectedWireId,
    handleRotateSelected,
    handleFlipSelected,
    handleDeleteComponent,
    handleDeleteWire,
    handleSaveProject,
    handleOpenNativeFolder,
  ]);

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
      // Left click on empty canvas deselects component/wire or clears wire draft
      if (activeTool === 'select' || activeTool === 'move') {
        setSelectedCompId(null);
        setSelectedWireId(null);
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
          routingMode: wireRoutingMode,
          waypoints: [],
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
                  className="absolute top-full left-0 mt-1 w-60 bg-[#18181b] border border-[#27272a] shadow-2xl rounded-lg py-1 text-xs z-50 select-none animate-in fade-in duration-75"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-1 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                    Left Column
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

                  <div className="h-px bg-[#27272a] my-1" />
                  <div className="px-3 py-1 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                    Center & Right Columns
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      toggleTerminal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-200 hover:bg-zinc-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <GoTerminal className="text-zinc-400" /> Terminal & Logs (Center Bottom)
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

              {/* Quick Action: Upload */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      disabled={isCompiling}
                      onClick={() => handleCompile()}
                      className="h-7 w-7 text-zinc-400 hover:text-zinc-200 hover:bg-[#27272a] rounded flex items-center justify-center transition-colors disabled:opacity-40"
                    >
                      {isCompiling ? (
                        <div className="w-3 h-3 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
                      ) : (
                        <GoZap className="text-sm" />
                      )}
                    </button>
                  }
                />
                <TooltipContent className="text-xs">Compile & Flash to ATmega328P</TooltipContent>
              </Tooltip>

              {/* Quick Action: Reset */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => {
                        setIsRunning(false);
                        tauriInvoke('reset_simulation');
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
                      disabled={!selectedCompId}
                      onClick={handleRotateSelected}
                      className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                        selectedCompId
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
                      disabled={!selectedCompId}
                      onClick={handleFlipSelected}
                      className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                        selectedCompId
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

          {/* Right Status & Save */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveProject}
              title={isDirty ? 'Unsaved changes • Click to save (Ctrl+S)' : 'All changes saved (Ctrl+S)'}
              className={`h-6 px-2 flex items-center gap-1.5 rounded text-[11px] font-mono border transition-colors ${
                isDirty
                  ? 'border-amber-700/60 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40'
                  : 'border-zinc-800 bg-[#18181b] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isDirty ? 'bg-amber-400 animate-pulse' : 'bg-zinc-600'}`} />
              <span>{isDirty ? 'Unsaved' : 'Saved'}</span>
            </button>

            <span className="text-xs text-zinc-400 font-mono truncate max-w-[140px]" title={projectPath || projectName}>
              {projectName}
            </span>

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
                                  className={`group h-full px-2.5 flex items-center gap-1.5 cursor-pointer border-t-2 text-[11px] font-mono transition-colors ${
                                    isActive
                                      ? 'bg-[#18181b] text-white border-zinc-200 font-medium'
                                      : 'text-zinc-400 border-transparent hover:bg-zinc-900/60 hover:text-zinc-300'
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
                            onMount={(_editor, monaco) => {
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
                        onMouseDown: (e: React.MouseEvent) => handleComponentMouseDown(c.id, e),
                        onClick: (e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (activeTool === 'eraser') {
                            handleDeleteComponent(c.id);
                          } else {
                            setSelectedCompId(c.id);
                            setSelectedWireId(null);
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
                              color={(c.props.color as any) || 'red'}
                              isLit={litLeds.has(c.id)}
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
                  </div>

                  {/* Wire Dragging Floating Hint */}
                  {wireDraftStart && (
                    <div className="absolute top-3 left-3 bg-[#18181b]/90 border border-zinc-700 px-2.5 py-1 rounded text-[11px] text-zinc-300 shadow-md">
                      Routing wire from <span className="font-mono text-zinc-100 font-semibold">{wireDraftStart.pinName}</span>. Click target pin to connect.
                    </div>
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
                                      onClick={() => setSerialLogs('')}
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
                                  onClick={() => toggleTerminal()}
                                  title="Collapse Terminal"
                                  className="h-5 w-5 text-zinc-500 hover:text-zinc-200"
                                >
                                  <GoSidebarCollapse className="-rotate-90" />
                                </Button>
                              </div>
                            </div>

                            {/* Tab Content: Serial Monitor */}
                            <TabsContent value="serial" className="flex-1 min-h-0 overflow-hidden p-2 font-mono text-xs text-zinc-400 m-0 flex flex-col">
                              <div
                                ref={serialContainerRef}
                                className="flex-1 min-h-0 overflow-y-auto pr-2 select-text font-mono text-xs text-zinc-300"
                              >
                                <pre className="whitespace-pre-wrap leading-relaxed font-mono text-xs text-zinc-300 m-0">
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

                          {/* Component Inspector */}
                          {selectedCompId && (
                            <div className="pt-2 border-t border-[#222226]">
                              <span className="text-[10px] font-mono text-zinc-400 block mb-1">
                                Selected: {selectedCompId}
                              </span>
                            </div>
                          )}
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
                      <PropertyInspector
                        selectedCompId={selectedCompId}
                        selectedWireId={selectedWireId}
                        components={components}
                        wires={wires}
                        onUpdateComponent={handleUpdateComponent}
                        onUpdateWire={handleUpdateWire}
                        onDeleteComponent={handleDeleteComponent}
                        onDeleteWire={handleDeleteWire}
                        onClose={() => toggleInspector()}
                      />
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
            <span>{statusMessage}</span>
            {projectPath && (
              <span className="text-zinc-600 font-mono text-[9px]">• {projectPath}</span>
            )}
          </span>
          <span>ATmega328P @ 16 MHz • Pure Rust + Tauri v2</span>
        </div>

        {/* Modal Dialog: Create New Project */}
        <Dialog open={showNewProjectModal} onOpenChange={setShowNewProjectModal}>
          <DialogContent
            style={{
              transform: `translate(calc(-50% + ${createModalPos.x}px), calc(-50% + ${createModalPos.y}px))`,
            }}
            className="bg-[#18181b] border border-zinc-800 text-zinc-200 max-w-md shadow-2xl p-0 overflow-hidden"
          >
            <div
              onMouseDown={handleCreateModalMouseDown}
              className="px-4 py-3 border-b border-zinc-800 bg-[#141417] cursor-move select-none flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <GoPlus className="text-zinc-200 w-4 h-4" />
                <span className="text-sm font-semibold text-white">Create New Project</span>
              </div>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  Project Name
                </label>
                <Input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Traffic_Light_Lab"
                  className="bg-[#121215] border-zinc-800 text-zinc-100 font-mono text-xs focus-visible:ring-zinc-600"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  Destination Directory
                </label>
                <div className="flex gap-1.5">
                  <Input
                    value={newProjectParentPath}
                    onChange={(e) => setNewProjectParentPath(e.target.value)}
                    placeholder="e.g. C:/Projects (or click Browse)"
                    className="bg-[#121215] border-zinc-800 text-zinc-100 font-mono text-xs flex-1 focus-visible:ring-zinc-600"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const selected = await tauriInvoke<string | null>('select_folder_dialog');
                      if (selected) setNewProjectParentPath(selected);
                    }}
                    className="border-zinc-800 bg-[#141417] hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs shrink-0 px-2.5 h-8 flex items-center gap-1.5"
                    title="Browse folder with Windows Explorer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Browse...</span>
                  </Button>
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Location: <span className="text-zinc-300 font-mono">{newProjectParentPath ? `${newProjectParentPath}/${newProjectName}` : `./${newProjectName}`}</span>
                </span>
              </div>
            </div>

            <DialogFooter className="px-4 py-3 bg-[#141417] border-t border-zinc-800 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewProjectModal(false)}
                className="border-zinc-800 bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (newProjectName.trim()) {
                    handleCreateProject(newProjectParentPath.trim() || '.', newProjectName.trim());
                  }
                }}
                className="bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs px-3 shadow-none transition-colors"
              >
                Create Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Dialog: Open Project Directory */}
        <Dialog open={showOpenProjectModal} onOpenChange={setShowOpenProjectModal}>
          <DialogContent
            style={{
              transform: `translate(calc(-50% + ${openModalPos.x}px), calc(-50% + ${openModalPos.y}px))`,
            }}
            className="bg-[#18181b] border border-zinc-800 text-zinc-200 max-w-md shadow-2xl p-0 overflow-hidden"
          >
            <div
              onMouseDown={handleOpenModalMouseDown}
              className="px-4 py-3 border-b border-zinc-800 bg-[#141417] cursor-move select-none flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="text-zinc-200 w-4 h-4" />
                <span className="text-sm font-semibold text-white">Open Project Folder</span>
              </div>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  Project Directory Path
                </label>
                <div className="flex gap-1.5">
                  <Input
                    value={openProjectPathInput}
                    onChange={(e) => setOpenProjectPathInput(e.target.value)}
                    placeholder="e.g. C:/MicroRustSim/Projects/Traffic_Light_Lab"
                    className="bg-[#121215] border-zinc-800 text-zinc-100 font-mono text-xs flex-1 focus-visible:ring-zinc-600"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const selected = await tauriInvoke<string | null>('select_folder_dialog');
                      if (selected) setOpenProjectPathInput(selected);
                    }}
                    className="border-zinc-800 bg-[#141417] hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs shrink-0 px-2.5 h-8 flex items-center gap-1.5"
                    title="Browse folder with Windows Explorer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Browse...</span>
                  </Button>
                </div>
              </div>

              {recentProjects.length > 0 && (
                <div>
                  <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                    Recent Projects
                  </label>
                  <div className="bg-[#121215] border border-zinc-800/80 rounded max-h-36 overflow-y-auto divide-y divide-zinc-800/50">
                    {recentProjects.map((rec) => (
                      <div
                        key={rec.path}
                        onClick={() => {
                          setOpenProjectPathInput(rec.path);
                          handleOpenProject(rec.path);
                        }}
                        className="px-2.5 py-1.5 hover:bg-zinc-800/60 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <span className="font-medium text-zinc-200">{rec.name}</span>
                        <span className="font-mono text-[10px] text-zinc-500 truncate max-w-[200px]">
                          {rec.path}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="px-4 py-3 bg-[#141417] border-t border-zinc-800 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOpenProjectModal(false)}
                className="border-zinc-800 bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (openProjectPathInput.trim()) {
                    handleOpenProject(openProjectPathInput.trim());
                  }
                }}
                className="bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs px-3 shadow-none transition-colors"
              >
                Open Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  );
}
