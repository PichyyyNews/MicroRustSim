import React, { useState, useRef, useEffect } from 'react';
import {
  GoX,
  GoGear,
  GoCpu,
  GoPackage,
  GoFileDirectory,
  GoCheck,
  GoSearch,
  GoTerminal,
  GoEye,
  GoSync,
} from 'react-icons/go';
import {
  Palette,
  Sliders,
  Type,
  Code2,
  Save,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

export type SettingsTab = 'general' | 'appearance' | 'project' | 'engine' | 'plugin';

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
    if (target.closest('button') || target.closest('input')) return;

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
    { id: 'general', label: 'General', icon: GoGear },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'project', label: 'Project', icon: GoFileDirectory },
    { id: 'engine', label: 'Engine', icon: GoCpu },
    { id: 'plugin', label: 'Plugin', icon: GoPackage },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        ref={modalBoxRef}
        onClick={(e) => e.stopPropagation()}
        className="w-[840px] h-[580px] max-w-[94vw] max-h-[92vh] bg-[#121215] border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden outline-none ring-0 will-change-transform"
        style={{ transform: 'translate3d(0px, 0px, 0px)' }}
      >
        {/* Draggable Header */}
        <div
          onPointerDown={handlePointerDown}
          className="h-11 px-4 bg-[#18181b] border-b border-zinc-800 flex items-center justify-between cursor-move select-none shrink-0"
        >
          <div className="flex items-center gap-2.5 text-zinc-100 font-semibold text-xs tracking-wide">
            <GoGear className="w-4 h-4 text-zinc-400" />
            <span>Settings</span>
            <span className="text-[11px] text-zinc-500 font-mono font-normal">| Preferences</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative w-48">
              <GoSearch className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search settings..."
                className="h-7 pl-8 pr-2 bg-[#121215] border-zinc-800 text-zinc-200 text-xs rounded-md focus-visible:border-zinc-500"
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Close"
            >
              <GoX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body with VS Code Layout (Sidebar + Content) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-48 bg-[#161619] border-r border-zinc-800 p-2 space-y-1 shrink-0 overflow-y-auto scrollbar-none">
            <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Preferences
            </div>
            {SIDEBAR_ITEMS.map((item) => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-2.5 transition-colors text-left ${
                    isActive
                      ? 'bg-zinc-800/90 text-zinc-100 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  <IconComp className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-200' : 'text-zinc-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Main Content Panel */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin bg-[#121215]">
            {/* 1. GENERAL TAB */}
            {activeTab === 'general' && (
              <div className="space-y-6 animate-in fade-in duration-100">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-zinc-400" />
                    Code Editor Configuration
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Controls code editor typography, line numbering, minimap, and formatting.
                  </p>
                </div>

                {/* Setting: Editor Font Size */}
                <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Font Size</div>
                    <div className="text-[11px] text-zinc-500">Controls the font size in pixels for Monaco code editor.</div>
                  </div>
                  <div className="flex items-center gap-1 bg-[#121215] border border-zinc-800 rounded-md p-0.5">
                    {[12, 13, 14, 16].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setEditorFontSize(sz)}
                        className={`h-6 px-2.5 rounded text-xs font-mono transition-colors ${
                          editorFontSize === sz
                            ? 'bg-zinc-700 text-zinc-100 font-semibold'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                        }`}
                      >
                        {sz}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* Setting: Line Numbers */}
                <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Line Numbers</div>
                    <div className="text-[11px] text-zinc-500">Display line numbers along the left gutter in sketch files.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditorLineNumbers(!editorLineNumbers)}
                    className={`h-6 px-3 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                      editorLineNumbers
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                        : 'bg-[#121215] border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {editorLineNumbers ? <GoCheck className="w-3.5 h-3.5 text-emerald-400" /> : null}
                    <span>{editorLineNumbers ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </div>

                {/* Setting: Word Wrap */}
                <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Word Wrap</div>
                    <div className="text-[11px] text-zinc-500">Wrap long lines to fit within the editor viewport without horizontal scrolling.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditorWordWrap(!editorWordWrap)}
                    className={`h-6 px-3 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                      editorWordWrap
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                        : 'bg-[#121215] border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {editorWordWrap ? <GoCheck className="w-3.5 h-3.5 text-emerald-400" /> : null}
                    <span>{editorWordWrap ? 'On' : 'Off'}</span>
                  </button>
                </div>

                {/* Setting: Minimap */}
                <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Editor Minimap</div>
                    <div className="text-[11px] text-zinc-500">Show code outline miniature overview scrollbar on the right.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditorMinimap(!editorMinimap)}
                    className={`h-6 px-3 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                      editorMinimap
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                        : 'bg-[#121215] border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {editorMinimap ? <GoCheck className="w-3.5 h-3.5 text-emerald-400" /> : null}
                    <span>{editorMinimap ? 'Show' : 'Hidden'}</span>
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Save className="w-4 h-4 text-zinc-400" />
                    Auto-Save & Simulation Sync
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Configure sketch file persistence and runtime synchronization.
                  </p>
                </div>

                {/* Setting: Auto Save on Run */}
                <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Auto Save on Compile / Run</div>
                    <div className="text-[11px] text-zinc-500">Automatically save sketch.ino and project files when executing simulation.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoSaveOnRun(!autoSaveOnRun)}
                    className={`h-6 px-3 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                      autoSaveOnRun
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                        : 'bg-[#121215] border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {autoSaveOnRun ? <GoCheck className="w-3.5 h-3.5 text-emerald-400" /> : null}
                    <span>{autoSaveOnRun ? 'Always' : 'Manual'}</span>
                  </button>
                </div>

                {/* Setting: Auto Scroll Serial */}
                <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Terminal Auto-Scroll</div>
                    <div className="text-[11px] text-zinc-500">Keep bottom serial console scrolled to latest incoming UART output.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoScrollSerial(!autoScrollSerial)}
                    className={`h-6 px-3 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                      autoScrollSerial
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                        : 'bg-[#121215] border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {autoScrollSerial ? <GoCheck className="w-3.5 h-3.5 text-emerald-400" /> : null}
                    <span>{autoScrollSerial ? 'Follow' : 'Locked'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <div className="space-y-6 animate-in fade-in duration-100">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-zinc-400" />
                    Visual Theme & Color Tokens
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Official MicroRustSim zinc monochrome design system (AGENTS.md).
                  </p>
                </div>

                {/* Theme Palette Card */}
                <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-zinc-200">Color Palette</div>
                      <div className="text-[11px] text-zinc-500">Distraction-free flat dark zinc monochrome styling.</div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      Zinc Monochrome Active
                    </span>
                  </div>

                  {/* Palette Swatches */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    <div className="p-2 rounded bg-[#09090b] border border-zinc-800 text-[10px]">
                      <div className="font-mono text-zinc-400">#09090b</div>
                      <div className="text-zinc-500 text-[9px]">Canvas Grid</div>
                    </div>
                    <div className="p-2 rounded bg-[#121215] border border-zinc-800 text-[10px]">
                      <div className="font-mono text-zinc-400">#121215</div>
                      <div className="text-zinc-500 text-[9px]">Surface Base</div>
                    </div>
                    <div className="p-2 rounded bg-[#18181b] border border-zinc-800 text-[10px]">
                      <div className="font-mono text-zinc-400">#18181b</div>
                      <div className="text-zinc-500 text-[9px]">Elevated Panel</div>
                    </div>
                    <div className="p-2 rounded bg-[#27272a] border border-zinc-800 text-[10px]">
                      <div className="font-mono text-zinc-400">#27272a</div>
                      <div className="text-zinc-500 text-[9px]">Hover / Border</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-zinc-400" />
                    Canvas & Breadboard Viewport
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Interactive workspace canvas styling and wiring behavior.
                  </p>
                </div>

                {/* Setting: Infinite Grid Dots */}
                <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Infinite Grid Pattern</div>
                    <div className="text-[11px] text-zinc-500">Render dot-matrix alignment grid on the breadboard canvas.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCanvasGridVisible(!canvasGridVisible)}
                    className={`h-6 px-3 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                      canvasGridVisible
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                        : 'bg-[#121215] border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {canvasGridVisible ? <GoCheck className="w-3.5 h-3.5 text-emerald-400" /> : null}
                    <span>{canvasGridVisible ? 'Visible' : 'Hidden'}</span>
                  </button>
                </div>

                {/* Setting: Wire Routing Mode */}
                <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Default Wire Routing Mode</div>
                    <div className="text-[11px] text-zinc-500">Choose between natural curved bezier arcs or 90-degree orthogonal jumpers.</div>
                  </div>
                  <div className="flex items-center gap-1 bg-[#121215] border border-zinc-800 rounded-md p-0.5">
                    <button
                      type="button"
                      onClick={() => setWireRoutingMode('curve')}
                      className={`h-6 px-2.5 rounded text-xs transition-colors ${
                        wireRoutingMode === 'curve'
                          ? 'bg-zinc-700 text-zinc-100 font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                      }`}
                    >
                      Curved (Bezier)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWireRoutingMode('ortho')}
                      className={`h-6 px-2.5 rounded text-xs transition-colors ${
                        wireRoutingMode === 'ortho'
                          ? 'bg-zinc-700 text-zinc-100 font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                      }`}
                    >
                      Orthogonal (90°)
                    </button>
                  </div>
                </div>

                {/* Wire Colors Palette Preview */}
                <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg space-y-2">
                  <div className="text-xs font-medium text-zinc-200">Standard Wire Colors</div>
                  <div className="text-[11px] text-zinc-500">Pre-calibrated high contrast electronic wire palette:</div>
                  <div className="flex items-center gap-2 pt-1">
                    {[
                      { hex: '#ef4444', label: 'VCC 5V' },
                      { hex: '#f97316', label: '3.3V' },
                      { hex: '#eab308', label: 'I2C' },
                      { hex: '#22c55e', label: 'Signal' },
                      { hex: '#3b82f6', label: 'SPI' },
                      { hex: '#a855f7', label: 'PWM' },
                      { hex: '#ffffff', label: 'White' },
                      { hex: '#18181b', label: 'GND' },
                    ].map((w) => (
                      <div key={w.hex} className="flex flex-col items-center gap-1" title={w.label}>
                        <div
                          className="w-5 h-5 rounded-full border border-zinc-700/80 shadow-xs"
                          style={{ backgroundColor: w.hex }}
                        />
                        <span className="text-[9px] text-zinc-500 font-mono">{w.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. PROJECT TAB */}
            {activeTab === 'project' && (
              <div className="space-y-6 animate-in fade-in duration-100">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <GoFileDirectory className="w-4 h-4 text-zinc-400" />
                    Project & Target Board Configuration
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Target hardware definitions and compilation defaults for the workspace.
                  </p>
                </div>

                <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Target Microcontroller</div>
                    <div className="text-[11px] text-zinc-500">Main computing architecture for sketch compilation.</div>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                    ATmega328P @ 16 MHz
                  </span>
                </div>

                <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Default UART Baud Rate</div>
                    <div className="text-[11px] text-zinc-500">Communication speed for Serial.begin() hardware USART.</div>
                  </div>
                  <select
                    value={baudRate}
                    onChange={(e) => setBaudRate(Number(e.target.value))}
                    className="h-7 px-2 bg-[#121215] border border-zinc-800 rounded text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500 cursor-pointer"
                  >
                    {[9600, 19200, 38400, 57600, 115200].map((b) => (
                      <option key={b} value={b}>
                        {b} baud
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Core Schematic Standard</div>
                    <div className="text-[11px] text-zinc-500">Format used for diagram.json component serialization.</div>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    Wokwi JSON v1
                  </span>
                </div>
              </div>
            )}

            {/* 4. ENGINE TAB */}
            {activeTab === 'engine' && (
              <div className="space-y-6 animate-in fade-in duration-100">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <GoCpu className="w-4 h-4 text-zinc-400" />
                    Physics Simulation Engine (MNA)
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Modified Nodal Analysis engine details and cycle-accurate execution properties.
                  </p>
                </div>

                <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-200">Circuit Solver Architecture</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                      100% Genuine MNA Solver
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Uses full Modified Nodal Analysis with conductance matrix G and LU decomposition.
                    Solves Ohm's law, Kirchhoff's current/voltage laws (KCL/KVL), and diode forward voltage curves at 60 FPS.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg">
                    <div className="text-xs font-medium text-zinc-300">Clock Timing Ratio</div>
                    <div className="text-sm font-mono text-zinc-100 font-semibold mt-1">1:1 Wall-Clock</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">delay(1000) = 1.000s real time</div>
                  </div>
                  <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg">
                    <div className="text-xs font-medium text-zinc-300">Fault Detection</div>
                    <div className="text-sm font-mono text-emerald-400 font-semibold mt-1">Hardware Protected</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Short circuit & GPIO overcurrent alerts</div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. PLUGIN TAB */}
            {activeTab === 'plugin' && (
              <div className="space-y-6 animate-in fade-in duration-100">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <GoPackage className="w-4 h-4 text-zinc-400" />
                    Installed Toolchains & Plugins
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Native backend toolchains powering firmware build and physics computation.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-zinc-200">avr-gcc / avr-objcopy</div>
                      <div className="text-[11px] text-zinc-500">Genuine GNU AVR Compiler for ATmega328P hex output.</div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      Installed & Active
                    </span>
                  </div>

                  <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-zinc-200">arduino-cli</div>
                      <div className="text-[11px] text-zinc-500">Arduino core compiler preprocessor and library resolver.</div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      Installed & Active
                    </span>
                  </div>

                  <div className="p-3 bg-[#18181b]/50 border border-zinc-800/80 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-zinc-200">sim_core (MNA Engine)</div>
                      <div className="text-[11px] text-zinc-500">High-performance Rust circuit solver crate.</div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                      Built-in v0.2.2
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-10 px-4 bg-[#18181b] border-t border-zinc-800 flex items-center justify-between text-xs shrink-0 select-none">
          <span className="text-[10px] text-zinc-500 font-mono">
            Settings auto-saved to local workspace configuration
          </span>
          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className="h-7 px-3 text-xs bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-md transition-colors"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
