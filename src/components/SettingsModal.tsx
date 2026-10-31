import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Code2,
  Palette,
  Cpu,
  Terminal,
  Wrench,
  Keyboard,
  Check,
  Save,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

export type SettingsTab = 'general' | 'appearance' | 'engine' | 'hardware' | 'toolchain' | 'shortcuts';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // General settings
  editorFontSize: number;
  setEditorFontSize: (size: number) => void;
  editorMinimap: boolean;
  setEditorMinimap: (enabled: boolean) => void;
  editorLineNumbers: boolean;
  setEditorLineNumbers: (enabled: boolean) => void;
  editorWordWrap: boolean;
  setEditorWordWrap: (enabled: boolean) => void;
  autoSaveOnRun: boolean;
  setAutoSaveOnRun: (enabled: boolean) => void;
  autoScrollSerial: boolean;
  setAutoScrollSerial: (enabled: boolean) => void;
  // Appearance settings
  canvasGridVisible: boolean;
  setCanvasGridVisible: (visible: boolean) => void;
  wireRoutingMode: 'curve' | 'ortho';
  setWireRoutingMode: (mode: 'curve' | 'ortho') => void;
  // Project / Hardware
  baudRate: number;
  setBaudRate: (baud: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  editorFontSize,
  setEditorFontSize,
  editorMinimap,
  setEditorMinimap,
  editorLineNumbers,
  setEditorLineNumbers,
  editorWordWrap,
  setEditorWordWrap,
  autoSaveOnRun,
  setAutoSaveOnRun,
  autoScrollSerial,
  setAutoScrollSerial,
  canvasGridVisible,
  setCanvasGridVisible,
  wireRoutingMode,
  setWireRoutingMode,
  baudRate,
  setBaudRate,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [searchQuery, setSearchQuery] = useState('');

  // 0-Latency Dragging via Direct DOM Transform
  const modalBoxRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });

  useEffect(() => {
    if (isOpen) {
      posRef.current = { x: 0, y: 0 };
      if (modalBoxRef.current) {
        modalBoxRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select')) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: posRef.current.x,
      startY: posRef.current.y,
    };

    const header = e.currentTarget as HTMLElement;
    header.setPointerCapture(e.pointerId);

    const onPointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - dragStartRef.current.mouseX;
      const dy = ev.clientY - dragStartRef.current.mouseY;
      posRef.current = {
        x: dragStartRef.current.startX + dx,
        y: dragStartRef.current.startY + dy,
      };
      if (modalBoxRef.current) {
        modalBoxRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0px)`;
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      isDraggingRef.current = false;
      try {
        header.releasePointerCapture(ev.pointerId);
      } catch {}
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const SIDEBAR_ITEMS: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'general', label: 'Editor & General', icon: Code2 },
    { id: 'appearance', label: 'Theme & Canvas', icon: Palette },
    { id: 'engine', label: 'Simulation & MNA', icon: Cpu },
    { id: 'hardware', label: 'MCU & Serial UART', icon: Terminal },
    { id: 'toolchain', label: 'Toolchain & CLI', icon: Wrench },
    { id: 'shortcuts', label: 'Keybindings', icon: Keyboard },
  ];

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center select-none bg-black/60 backdrop-blur-xs">
      <div
        ref={modalBoxRef}
        className="pointer-events-auto w-[820px] h-[580px] max-w-[94vw] max-h-[92vh] bg-[#141416] border border-[#242428] rounded-2xl shadow-2xl flex flex-col overflow-hidden outline-none will-change-transform"
        style={{ transform: 'translate3d(0px, 0px, 0px)' }}
      >
        {/* Draggable Header */}
        <div
          onPointerDown={handlePointerDown}
          className="h-11 px-4 bg-[#18181b] border-b border-[#222226] flex items-center justify-between cursor-move select-none shrink-0"
        >
          <div className="flex items-center gap-2.5 text-zinc-100 font-semibold text-xs tracking-tight">
            <span>Settings</span>
            <span className="text-[10px] text-zinc-500 font-mono font-normal">| Preferences</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative w-44">
              <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter settings..."
                className="h-7 pl-7 pr-2 bg-[#121215] border-zinc-800 text-zinc-200 text-xs rounded-full focus-visible:border-zinc-500"
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Left Flat Sidebar + Right Content Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation Menu (Flat Items - Anti-Card-Nesting) */}
          <div className="w-48 bg-[#121215] border-r border-[#222226] p-2 space-y-0.5 shrink-0 overflow-y-auto scrollbar-none">
            <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Categories
            </div>
            {SIDEBAR_ITEMS.map((item) => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors text-left cursor-pointer ${
                    isActive
                      ? 'bg-[#26262a] text-white shadow-xs font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  <IconComp className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-zinc-200' : 'text-zinc-500'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Main Content Panel */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin bg-[#141416]">
            {/* 1. GENERAL / EDITOR TAB */}
            {activeTab === 'general' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-zinc-400" />
                    Code Editor Preferences
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Configure typography, minimap, line wrapping, and automatic file saving.
                  </p>
                </div>

                {/* Font Size Inset Box */}
                <div className="p-3 bg-[#1c1c20] border border-zinc-800/60 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Editor Font Size</div>
                    <div className="text-[11px] text-zinc-500">Font size in pixels for Monaco code editor.</div>
                  </div>
                  <div className="flex items-center gap-1 bg-[#121215] border border-zinc-800 rounded-full p-0.5">
                    {[12, 13, 14, 16].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setEditorFontSize(sz)}
                        className={`h-6 px-2.5 rounded-full text-xs font-mono transition-colors cursor-pointer ${
                          editorFontSize === sz
                            ? 'bg-white text-zinc-950 font-semibold'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {sz}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* Line Numbers Inset Box */}
                <div className="p-3 bg-[#1c1c20] border border-zinc-800/60 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Line Numbers</div>
                    <div className="text-[11px] text-zinc-500">Show line numbers in the editor left gutter.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditorLineNumbers(!editorLineNumbers)}
                    className={`h-6 px-3 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                      editorLineNumbers
                        ? 'bg-[#27272a] border-zinc-600 text-zinc-100'
                        : 'bg-[#121215] border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {editorLineNumbers ? <Check className="w-3 h-3 text-emerald-400" /> : null}
                    <span>{editorLineNumbers ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </div>

                {/* Word Wrap Inset Box */}
                <div className="p-3 bg-[#1c1c20] border border-zinc-800/60 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Word Wrap</div>
                    <div className="text-[11px] text-zinc-500">Wrap long lines to fit within editor width.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditorWordWrap(!editorWordWrap)}
                    className={`h-6 px-3 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                      editorWordWrap
                        ? 'bg-[#27272a] border-zinc-600 text-zinc-100'
                        : 'bg-[#121215] border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {editorWordWrap ? <Check className="w-3 h-3 text-emerald-400" /> : null}
                    <span>{editorWordWrap ? 'On' : 'Off'}</span>
                  </button>
                </div>

                {/* Auto Save on Run Inset Box */}
                <div className="p-3 bg-[#1c1c20] border border-zinc-800/60 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Auto Save on Compile / Run</div>
                    <div className="text-[11px] text-zinc-500">Automatically save sketch files when executing simulation.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoSaveOnRun(!autoSaveOnRun)}
                    className={`h-6 px-3 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                      autoSaveOnRun
                        ? 'bg-[#27272a] border-zinc-600 text-zinc-100'
                        : 'bg-[#121215] border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {autoSaveOnRun ? <Check className="w-3 h-3 text-emerald-400" /> : null}
                    <span>{autoSaveOnRun ? 'Always' : 'Manual'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. APPEARANCE & CANVAS TAB */}
            {activeTab === 'appearance' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-zinc-400" />
                    Canvas & Theme Styling
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Breadboard grid alignment, wire routing curves, and dark visual depth.
                  </p>
                </div>

                {/* Dot Grid Inset Box */}
                <div className="p-3 bg-[#1c1c20] border border-zinc-800/60 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Infinite Dot Grid</div>
                    <div className="text-[11px] text-zinc-500">Subtle dot-matrix guide on the circuit canvas.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCanvasGridVisible(!canvasGridVisible)}
                    className={`h-6 px-3 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                      canvasGridVisible
                        ? 'bg-[#27272a] border-zinc-600 text-zinc-100'
                        : 'bg-[#121215] border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {canvasGridVisible ? <Check className="w-3 h-3 text-emerald-400" /> : null}
                    <span>{canvasGridVisible ? 'Visible' : 'Hidden'}</span>
                  </button>
                </div>

                {/* Wire Routing Mode Inset Box */}
                <div className="p-3 bg-[#1c1c20] border border-zinc-800/60 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Default Wire Routing Mode</div>
                    <div className="text-[11px] text-zinc-500">Natural curved Bezier arcs vs 90° orthogonal jumpers.</div>
                  </div>
                  <div className="flex items-center gap-1 bg-[#121215] border border-zinc-800 rounded-full p-0.5">
                    <button
                      type="button"
                      onClick={() => setWireRoutingMode('curve')}
                      className={`h-6 px-3 rounded-full text-xs transition-colors cursor-pointer ${
                        wireRoutingMode === 'curve'
                          ? 'bg-white text-zinc-950 font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Curved
                    </button>
                    <button
                      type="button"
                      onClick={() => setWireRoutingMode('ortho')}
                      className={`h-6 px-3 rounded-full text-xs transition-colors cursor-pointer ${
                        wireRoutingMode === 'ortho'
                          ? 'bg-white text-zinc-950 font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      90° Ortho
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. SIMULATION & MNA ENGINE TAB */}
            {activeTab === 'engine' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-zinc-400" />
                    Physics Simulation Engine (MNA)
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Modified Nodal Analysis solver with cycle-accurate timing.
                  </p>
                </div>

                <div className="p-3 bg-[#1c1c20] border border-zinc-800/60 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-200">Circuit Matrix Solver</span>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] font-mono whitespace-nowrap">
                      100% Genuine MNA
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Uses Modified Nodal Analysis with conductance matrix G and LU decomposition.
                    Accurately models Ohm's law, Kirchhoff's laws (KCL/KVL), and diode forward curves.
                  </p>
                </div>

                <div className="p-3 bg-[#1c1c20] border border-zinc-800/60 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Execution Frequency</div>
                    <div className="text-[11px] text-zinc-500">Hardware clock rate for ATmega328P emulator.</div>
                  </div>
                  <span className="font-mono text-xs text-zinc-200 bg-[#121215] px-2.5 py-1 rounded-full border border-zinc-800 whitespace-nowrap">
                    16&nbsp;MHz Core Clock
                  </span>
                </div>
              </div>
            )}

            {/* 4. MCU & SERIAL UART TAB */}
            {activeTab === 'hardware' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-zinc-400" />
                    MCU Hardware & Serial UART
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Serial baud rates, pin mapping, and hardware USART emulation.
                  </p>
                </div>

                <div className="p-3 bg-[#1c1c20] border border-zinc-800/60 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Default UART Baud Rate</div>
                    <div className="text-[11px] text-zinc-500">Communication speed for Serial.begin() hardware USART.</div>
                  </div>
                  <select
                    value={baudRate}
                    onChange={(e) => setBaudRate(Number(e.target.value))}
                    className="h-7 px-3 bg-[#121215] border border-zinc-800 rounded-full text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500 cursor-pointer"
                  >
                    {[9600, 19200, 38400, 57600, 115200].map((b) => (
                      <option key={b} value={b}>
                        {b} baud
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-[#1c1c20] border border-zinc-800/60 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Terminal Auto-Scroll</div>
                    <div className="text-[11px] text-zinc-500">Keep serial monitor pinned to newest incoming data.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoScrollSerial(!autoScrollSerial)}
                    className={`h-6 px-3 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                      autoScrollSerial
                        ? 'bg-[#27272a] border-zinc-600 text-zinc-100'
                        : 'bg-[#121215] border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {autoScrollSerial ? <Check className="w-3 h-3 text-emerald-400" /> : null}
                    <span>{autoScrollSerial ? 'Follow' : 'Locked'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 5. TOOLCHAIN & CLI TAB */}
            {activeTab === 'toolchain' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-zinc-400" />
                    Arduino CLI Toolchain
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Local compiler toolchain for compiling real C++ sketches to AVR binaries.
                  </p>
                </div>

                <div className="p-3 bg-[#1c1c20] border border-zinc-800/60 rounded-xl space-y-1.5">
                  <div className="text-xs font-medium text-zinc-200">Binary Toolchain Location</div>
                  <div className="font-mono text-[11px] text-zinc-400 bg-[#121215] p-2 rounded-lg border border-zinc-800 truncate select-all">
                    %LOCALAPPDATA%\MicroRustSim\tools\arduino-cli.exe
                  </div>
                </div>

                <div className="p-3 bg-[#1c1c20] border border-zinc-800/60 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Board Definition</div>
                    <div className="text-[11px] text-zinc-500">Target FQBN passed to compiler.</div>
                  </div>
                  <span className="font-mono text-xs text-zinc-300 bg-[#121215] px-2.5 py-1 rounded-full border border-zinc-800">
                    arduino:avr:uno
                  </span>
                </div>
              </div>
            )}

            {/* 6. KEYBINDINGS TAB */}
            {activeTab === 'shortcuts' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-zinc-400" />
                    Keyboard Shortcuts & Hotkeys
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Essential keybindings for high-speed hardware simulation.
                  </p>
                </div>

                <div className="rounded-xl bg-[#1c1c20] p-1.5 border border-zinc-800/60 divide-y divide-zinc-800/60">
                  {[
                    { key: 'F5', desc: 'Run / Pause Simulation' },
                    { key: 'Ctrl + S', desc: 'Save Project & Sketch' },
                    { key: 'Ctrl + K', desc: 'Open Command Palette' },
                    { key: 'R', desc: 'Rotate Selected Component (90°)' },
                    { key: 'F', desc: 'Flip Selected Component (Horizontal)' },
                    { key: 'Del / Backspace', desc: 'Delete Selected Component or Wire' },
                    { key: 'Escape', desc: 'Cancel Wire Placement / Deselect' },
                  ].map((s) => (
                    <div key={s.key} className="px-3 py-2 flex items-center justify-between text-xs">
                      <span className="text-zinc-300 font-medium">{s.desc}</span>
                      <kbd className="font-mono text-[10px] bg-[#121215] border border-zinc-700/80 px-2 py-0.5 rounded text-zinc-200 shadow-xs">
                        {s.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-11 px-4 bg-[#18181b] border-t border-[#222226] flex items-center justify-end shrink-0">
          <Button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs px-4 h-8 transition-colors shadow-sm"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
