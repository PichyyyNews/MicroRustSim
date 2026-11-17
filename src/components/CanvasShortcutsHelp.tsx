import React, { useState, useRef, useEffect } from 'react';
import { Command, X } from 'lucide-react';

export const CanvasShortcutsHelp: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const ShortcutRow = ({ label, shortcut }: { label: string; shortcut: string }) => (
    <div className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-zinc-800/40 text-[11px] transition-colors">
      <span className="text-zinc-400">{label}</span>
      <kbd className="px-1.5 py-0.5 bg-[#1e1e24] border border-zinc-700/80 rounded font-mono text-[10px] text-zinc-200 font-medium whitespace-nowrap shadow-xs">
        {shortcut}
      </kbd>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="absolute top-3 right-3 z-30 select-none"
    >
      {/* Help Trigger Button (? icon) - Click to Pin / Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-7 h-7 rounded-full border text-xs font-mono flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs shadow-sm ${
          isOpen
            ? 'bg-zinc-700 text-white border-zinc-500 shadow-md'
            : 'bg-[#18181b]/80 hover:bg-[#222226] border-zinc-800/90 text-zinc-400 hover:text-zinc-200'
        }`}
        title="Canvas Shortcuts & Controls (Click to open cheat sheet)"
        aria-label="Keyboard shortcuts"
      >
        <span className="font-semibold text-xs">?</span>
      </button>

      {/* Shortcuts Cheat Sheet Popover Card */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 max-h-[min(540px,78vh)] overflow-y-auto scrollbar-thin bg-[#141417] border border-[#242428] rounded-xl shadow-2xl p-3.5 space-y-3.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 text-xs"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Card Header with Close Button */}
          <div className="flex items-center justify-between border-b border-[#242428] pb-2.5">
            <div className="flex items-center gap-1.5 text-zinc-200 font-semibold text-xs">
              <Command className="w-3.5 h-3.5 text-zinc-400" />
              <span>Canvas Controls & Shortcuts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                Esc to close
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Section 1: Navigation & Canvas */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1 mb-1">
              Navigation & Mouse
            </div>
            <ShortcutRow label="Pan Canvas" shortcut="Middle Click + Drag" />
            <ShortcutRow label="Alternative Pan" shortcut="Space + Drag" />
            <ShortcutRow label="Zoom In / Out" shortcut="Ctrl + Wheel / Pinch" />
            <ShortcutRow label="Context Menu" shortcut="Right Click" />
          </div>

          {/* Section 2: Selection & Editing */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1 mb-1">
              Selection & Components
            </div>
            <ShortcutRow label="Rubber-Band Multi-Select" shortcut="Left-Click Drag" />
            <ShortcutRow label="Add/Toggle Selection" shortcut="Shift + Click" />
            <ShortcutRow label="Undo (Canvas)" shortcut="Ctrl + Z" />
            <ShortcutRow label="Redo (Canvas)" shortcut="Ctrl + Y / Ctrl+Shift+Z" />
            <ShortcutRow label="Copy Component(s)" shortcut="Ctrl + C" />
            <ShortcutRow label="Cut Component(s)" shortcut="Ctrl + X" />
            <ShortcutRow label="Paste Component(s)" shortcut="Ctrl + V" />
            <ShortcutRow label="Duplicate Component" shortcut="Ctrl + D" />
            <ShortcutRow label="Rotate (+90°)" shortcut="R" />
            <ShortcutRow label="Flip Horizontal" shortcut="F" />
            <ShortcutRow label="Rename Component" shortcut="F2" />
            <ShortcutRow label="Delete Selected" shortcut="Del / Backspace" />
          </div>

          {/* Section 3: Toolbar Tools */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1 mb-1">
              Toolbar Tools
            </div>
            <ShortcutRow label="Select Tool" shortcut="V" />
            <ShortcutRow label="Move Tool" shortcut="M" />
            <ShortcutRow label="Wire Tool" shortcut="W" />
            <ShortcutRow label="Eraser Tool" shortcut="E" />
            <ShortcutRow label="Text Label Tool" shortcut="T" />
            <ShortcutRow label="Command Palette" shortcut="Ctrl + K" />
          </div>

          {/* Section 4: Project & Build */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1 mb-1">
              Project & Firmware
            </div>
            <ShortcutRow label="Save Project" shortcut="Ctrl + S" />
            <ShortcutRow label="Open Folder" shortcut="Ctrl + O" />
            <ShortcutRow label="Library Manager" shortcut="Ctrl + Shift + I" />
            <ShortcutRow label="Compile & Upload" shortcut="⚡ Button / Ctrl+B" />
          </div>
        </div>
      )}
    </div>
  );
};
