import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  GoSearch,
  GoPlay,
  GoZap,
  GoSync,
  GoPackage,
  GoPlus,
  GoGear,
  GoCode,
  GoTerminal,
  GoGraph,
  GoFile,
  GoFileDirectory,
  GoX,
} from 'react-icons/go';
import {
  Sliders,
  FolderOpen,
  Pause,
} from 'lucide-react';

export interface CommandItem {
  id: string;
  title: string;
  category: 'Simulation' | 'Components' | 'View' | 'Project' | 'Preferences';
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  run: () => void;
}

export interface CommandPaletteSearchProps {
  onRunToggle: () => void;
  isRunning: boolean;
  onCompile: () => void;
  isCompiling: boolean;
  onReset: () => void;
  onAddComponent: (type: 'uno' | 'bb' | 'led' | 'resistor' | 'btn' | 'pot') => void;
  onOpenSettings: () => void;
  onToggleEditor: () => void;
  onToggleExplorer?: () => void;
  onTogglePalette?: () => void;
  onSwitchTab?: (tab: 'serial' | 'waveform' | 'build') => void;
  onSaveProject: () => void;
  onNewProject: () => void;
  onOpenFolder: () => void;
  onSelectTool?: (tool: 'select' | 'move' | 'wire' | 'eraser') => void;
}

export const CommandPaletteSearch: React.FC<CommandPaletteSearchProps> = ({
  onRunToggle,
  isRunning,
  onCompile,
  isCompiling,
  onReset,
  onAddComponent,
  onOpenSettings,
  onToggleEditor,
  onToggleExplorer,
  onTogglePalette,
  onSwitchTab,
  onSaveProject,
  onNewProject,
  onOpenFolder,
  onSelectTool,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const ALL_COMMANDS: CommandItem[] = useMemo(
    () => [
      {
        id: 'run-sim',
        title: isRunning ? 'Pause Simulation' : 'Run Simulation @ 16 MHz',
        category: 'Simulation',
        keywords: ['run', 'simulation', 'play', 'start', 'pause', 'resume'],
        icon: isRunning ? Pause : GoPlay,
        shortcut: 'F5',
        run: onRunToggle,
      },
      {
        id: 'compile-sketch',
        title: isCompiling ? 'Compiling sketch...' : 'Compile & Flash to ATmega328P',
        category: 'Simulation',
        keywords: ['compile', 'flash', 'build', 'arduino-cli', 'upload', 'run'],
        icon: GoZap,
        shortcut: 'Ctrl+B',
        run: onCompile,
      },
      {
        id: 'reset-mcu',
        title: 'Reset Hardware ATmega328P',
        category: 'Simulation',
        keywords: ['reset', 'mcu', 'hardware', 'restart', 'reboot'],
        icon: GoSync,
        shortcut: 'Ctrl+R',
        run: onReset,
      },
      {
        id: 'add-uno',
        title: 'Add Component: Arduino Uno R3',
        category: 'Components',
        keywords: ['add', 'component', 'arduino', 'uno', 'mcu', 'board'],
        icon: GoPlus,
        run: () => onAddComponent('uno'),
      },
      {
        id: 'add-breadboard',
        title: 'Add Component: Half Breadboard (30 Rows)',
        category: 'Components',
        keywords: ['add', 'component', 'breadboard', 'bb', 'proto'],
        icon: GoPlus,
        run: () => onAddComponent('bb'),
      },
      {
        id: 'add-led',
        title: 'Add Component: Red LED (Forward 2.0V)',
        category: 'Components',
        keywords: ['add', 'component', 'led', 'light', 'diode', 'red'],
        icon: GoPlus,
        run: () => onAddComponent('led'),
      },
      {
        id: 'add-resistor',
        title: 'Add Component: Resistor (220Ω)',
        category: 'Components',
        keywords: ['add', 'component', 'resistor', 'ohm', 'resistance'],
        icon: GoPlus,
        run: () => onAddComponent('resistor'),
      },
      {
        id: 'add-button',
        title: 'Add Component: Tactile Pushbutton',
        category: 'Components',
        keywords: ['add', 'component', 'button', 'pushbutton', 'tactile', 'switch'],
        icon: GoPlus,
        run: () => onAddComponent('btn'),
      },
      {
        id: 'add-pot',
        title: 'Add Component: Rotary Potentiometer (ADC)',
        category: 'Components',
        keywords: ['add', 'component', 'pot', 'potentiometer', 'knob', 'analog', 'wiper'],
        icon: GoPlus,
        run: () => onAddComponent('pot'),
      },
      {
        id: 'open-settings',
        title: 'Preferences: Open Settings (VS Code Style)',
        category: 'Preferences',
        keywords: ['settings', 'preferences', 'config', 'theme', 'options', 'font'],
        icon: GoGear,
        shortcut: 'Ctrl+,',
        run: onOpenSettings,
      },
      {
        id: 'save-project',
        title: 'Project: Save Current Sketch & Circuit',
        category: 'Project',
        keywords: ['save', 'project', 'sketch', 'disk'],
        icon: GoFile,
        shortcut: 'Ctrl+S',
        run: onSaveProject,
      },
      {
        id: 'new-project',
        title: 'Project: Create New Project...',
        category: 'Project',
        keywords: ['new', 'project', 'create', 'template'],
        icon: GoFileDirectory,
        run: onNewProject,
      },
      {
        id: 'open-folder',
        title: 'Project: Open Folder...',
        category: 'Project',
        keywords: ['open', 'folder', 'directory', 'project'],
        icon: FolderOpen,
        shortcut: 'Ctrl+O',
        run: onOpenFolder,
      },
      {
        id: 'toggle-editor',
        title: 'View: Toggle Code Editor (Left Top)',
        category: 'View',
        keywords: ['toggle', 'editor', 'code', 'monaco', 'sketch'],
        icon: GoCode,
        run: onToggleEditor,
      },
      {
        id: 'toggle-explorer',
        title: 'View: Toggle File Explorer (Left Bottom)',
        category: 'View',
        keywords: ['toggle', 'explorer', 'files', 'tree'],
        icon: GoFileDirectory,
        run: () => onToggleExplorer?.(),
      },
      {
        id: 'toggle-palette',
        title: 'View: Toggle Component Palette (Right)',
        category: 'View',
        keywords: ['toggle', 'palette', 'components', 'library', 'sidebar'],
        icon: GoPackage,
        run: () => onTogglePalette?.(),
      },
      {
        id: 'tab-waveform',
        title: 'View: Switch to Logic Waveform Oscilloscope',
        category: 'View',
        keywords: ['waveform', 'oscilloscope', 'logic', 'analog', 'graph'],
        icon: GoGraph,
        run: () => onSwitchTab?.('waveform'),
      },
      {
        id: 'tab-serial',
        title: 'View: Switch to Serial Monitor (UART)',
        category: 'View',
        keywords: ['serial', 'monitor', 'terminal', 'uart', 'logs'],
        icon: GoTerminal,
        run: () => onSwitchTab?.('serial'),
      },
    ],
    [
      isRunning,
      isCompiling,
      onRunToggle,
      onCompile,
      onReset,
      onAddComponent,
      onOpenSettings,
      onSaveProject,
      onNewProject,
      onOpenFolder,
      onToggleEditor,
      onToggleExplorer,
      onTogglePalette,
      onSwitchTab,
    ]
  );

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_COMMANDS;
    return ALL_COMMANDS.filter((cmd) => {
      if (cmd.title.toLowerCase().includes(q)) return true;
      if (cmd.category.toLowerCase().includes(q)) return true;
      return cmd.keywords.some((k) => k.toLowerCase().includes(q));
    });
  }, [ALL_COMMANDS, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Global Ctrl+K shortcut to focus command bar
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const targetCmd = filteredCommands[selectedIndex];
      if (targetCmd) {
        targetCmd.run();
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleExecute = (cmd: CommandItem) => {
    cmd.run();
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative select-none">
      {/* VS Code Style Command Input Bar */}
      <div
        className={`w-64 sm:w-72 h-7 bg-[#161619] hover:bg-[#1a1a1e] border rounded-md flex items-center px-2 gap-2 text-xs transition-all ${
          isOpen
            ? 'border-zinc-500 bg-[#18181b] shadow-sm ring-1 ring-zinc-600/30'
            : 'border-zinc-800/90 text-zinc-400'
        }`}
      >
        <span className="font-mono text-zinc-500 font-semibold text-xs shrink-0 select-none">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Run command or search (e.g. run)..."
          className="flex-1 bg-transparent border-none outline-none text-zinc-200 placeholder:text-zinc-600 font-mono text-[11px]"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="p-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <GoX className="w-3 h-3" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-block text-[9px] font-mono px-1 py-0.5 rounded bg-zinc-800/80 text-zinc-500 border border-zinc-700/60 shrink-0">
            Ctrl+K
          </kbd>
        )}
      </div>

      {/* VS Code Command Palette Dropdown Popup */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-84 sm:w-96 bg-[#16161a] border border-zinc-700/80 rounded-lg shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-100">
          <div className="px-3 py-1.5 bg-[#121215] border-b border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
            <span>{filteredCommands.length} commands available</span>
            <span>Use ↑ ↓ to navigate, Enter to run</span>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-zinc-800/40 scrollbar-thin py-1">
            {filteredCommands.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500 font-mono">
                No matching commands found for "{query}"
              </div>
            ) : (
              filteredCommands.map((cmd, idx) => {
                const IconComp = cmd.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={cmd.id}
                    onClick={() => handleExecute(cmd)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`px-3 py-1.5 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                      isSelected
                        ? 'bg-zinc-800/90 text-zinc-100'
                        : 'text-zinc-300 hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <IconComp
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-white' : 'text-zinc-400'
                        }`}
                      />
                      <div className="truncate">
                        <span className="font-medium text-[11px] block truncate">
                          {cmd.title}
                        </span>
                        <span className="text-[9px] text-zinc-500 font-mono">
                          {cmd.category}
                        </span>
                      </div>
                    </div>

                    {cmd.shortcut && (
                      <kbd className="text-[9px] font-mono px-1 py-0.5 rounded bg-[#121215] border border-zinc-700/60 text-zinc-400 shrink-0 ml-2">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
