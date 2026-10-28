import React, { useState, useRef, useEffect } from 'react';
import { Command } from 'lucide-react';

export const CanvasShortcutsHelp: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const ShortcutRow = ({ label, shortcut }: { label: string; shortcut: string }) => (
    <div className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-zinc-800/40 text-[11px]">
      <span className="text-zinc-400">{label}</span>
      <kbd className="px-1.5 py-0.2 bg-[#1e1e24] border border-zinc-700/80 rounded font-mono text-[10px] text-zinc-200 font-medium">
        {shortcut}
      </kbd>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="absolute top-3 right-3 z-30 select-none"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Help Trigger Button (? icon) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-6 h-6 rounded-md bg-[#18181b]/70 hover:bg-[#222226] border border-zinc-800/80 text-zinc-500 hover:text-zinc-200 text-xs font-mono flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs shadow-sm"
        title="Canvas & Controls Cheat Sheet"
        aria-label="Keyboard shortcuts"
      >
        <span className="font-semibold text-[11px]">?</span>
      </button>

      {/* Shortcuts Cheat Sheet Popover Card */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-72 max-h-[80vh] overflow-y-auto bg-[#141417] border border-zinc-800 rounded-lg shadow-2xl p-3 space-y-3 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 text-xs"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <div className="flex items-center gap-1.5 text-zinc-200 font-semibold text-xs">
              <Command className="w-3.5 h-3.5 text-zinc-400" />
              <span>Canvas Controls & Shortcuts</span>
            </div>
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
              Help
            </span>
          </div>

          {/* Section 1: Navigation & Canvas */}
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-0.5 mb-0.5">
              Navigation & Mouse
            </div>
            <ShortcutRow label="Pan Canvas" shortcut="Middle Click + Drag" />
            <ShortcutRow label="Alternative Pan" shortcut="Space + Drag" />
            <ShortcutRow label="Zoom In / Out" shortcut="Ctrl + Wheel / Pinch" />
            <ShortcutRow label="Context Menu" shortcut="Right Click" />
          </div>

          {/* Section 2: Selection & Editing */}
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-0.5 mb-0.5">
              Selection & Components
            </div>
            <ShortcutRow label="Rubber-Band Multi-Select" shortcut="Left-Click Drag" />
            <ShortcutRow label="Add/Toggle Selection" shortcut="Shift + Click" />
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
            <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-0.5 mb-0.5">
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
            <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-0.5 mb-0.5">
              Project & Firmware
            </div>
            <ShortcutRow label="Save Project" shortcut="Ctrl + S" />
            <ShortcutRow label="Open Folder" shortcut="Ctrl + O" />
            <ShortcutRow label="Compile & Upload" shortcut="⚡ Button / Ctrl+B" />
          </div>
        </div>
      )}
    </div>
  );
};
