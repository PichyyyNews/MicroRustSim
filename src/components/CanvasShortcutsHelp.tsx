import React, { useState, useRef, useEffect } from 'react';
import { GoQuestion, GoX } from 'react-icons/go';
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
        title="Canvas & Editor Shortcuts"
        aria-label="Keyboard shortcuts"
      >
        <span className="font-semibold text-[11px]">?</span>
      </button>

      {/* Shortcuts Cheat Sheet Popover Card */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-64 bg-[#141417] border border-zinc-800 rounded-lg shadow-2xl p-3 space-y-2.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <div className="flex items-center gap-1.5 text-zinc-200 font-semibold text-xs">
              <Command className="w-3.5 h-3.5 text-zinc-400" />
              <span>Keyboard Shortcuts</span>
            </div>
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
              Controls
            </span>
          </div>

          {/* Section 1: Tools & Canvas */}
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-0.5 mb-1">
              Canvas & Tools
            </div>

            <div className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-zinc-800/40 text-[11px]">
              <span className="text-zinc-400">Select Tool</span>
              <kbd className="min-w-[20px] text-center px-1.5 py-0.5 bg-[#1e1e24] border border-zinc-700/80 rounded font-mono text-[10px] text-zinc-200 font-medium">V</kbd>
            </div>
            <div className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-zinc-800/40 text-[11px]">
              <span className="text-zinc-400">Move Tool</span>
              <kbd className="min-w-[20px] text-center px-1.5 py-0.5 bg-[#1e1e24] border border-zinc-700/80 rounded font-mono text-[10px] text-zinc-200 font-medium">M</kbd>
            </div>
            <div className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-zinc-800/40 text-[11px]">
              <span className="text-zinc-400">Wire Tool</span>
              <kbd className="min-w-[20px] text-center px-1.5 py-0.5 bg-[#1e1e24] border border-zinc-700/80 rounded font-mono text-[10px] text-zinc-200 font-medium">W</kbd>
            </div>
            <div className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-zinc-800/40 text-[11px]">
              <span className="text-zinc-400">Eraser Tool</span>
              <kbd className="min-w-[20px] text-center px-1.5 py-0.5 bg-[#1e1e24] border border-zinc-700/80 rounded font-mono text-[10px] text-zinc-200 font-medium">E</kbd>
            </div>
            <div className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-zinc-800/40 text-[11px]">
              <span className="text-zinc-400">Rotate Component</span>
              <kbd className="min-w-[20px] text-center px-1.5 py-0.5 bg-[#1e1e24] border border-zinc-700/80 rounded font-mono text-[10px] text-zinc-200 font-medium">R</kbd>
            </div>
            <div className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-zinc-800/40 text-[11px]">
              <span className="text-zinc-400">Flip Component</span>
              <kbd className="min-w-[20px] text-center px-1.5 py-0.5 bg-[#1e1e24] border border-zinc-700/80 rounded font-mono text-[10px] text-zinc-200 font-medium">F</kbd>
            </div>
            <div className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-zinc-800/40 text-[11px]">
              <span className="text-zinc-400">Delete Selected</span>
              <kbd className="px-1.5 py-0.5 bg-[#1e1e24] border border-zinc-700/80 rounded font-mono text-[10px] text-zinc-200 font-medium">Del / Backspace</kbd>
            </div>
            <div className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-zinc-800/40 text-[11px]">
              <span className="text-zinc-400">Pan Canvas</span>
              <span className="text-[10px] font-mono text-zinc-500">Space + Drag</span>
            </div>
            <div className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-zinc-800/40 text-[11px]">
              <span className="text-zinc-400">Zoom Canvas</span>
              <span className="text-[10px] font-mono text-zinc-500">Mouse Wheel</span>
            </div>
          </div>

          {/* Section 2: IDE & Project Hotkeys */}
          <div className="space-y-1 pt-1.5 border-t border-zinc-800/60">
            <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-0.5 mb-1">
              Project & Files
            </div>
            <div className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-zinc-800/40 text-[11px]">
              <span className="text-zinc-400">Save Project</span>
              <kbd className="px-1.5 py-0.5 bg-[#1e1e24] border border-zinc-700/80 rounded font-mono text-[10px] text-zinc-200 font-medium">Ctrl + S</kbd>
            </div>
            <div className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-zinc-800/40 text-[11px]">
              <span className="text-zinc-400">Open Folder</span>
              <kbd className="px-1.5 py-0.5 bg-[#1e1e24] border border-zinc-700/80 rounded font-mono text-[10px] text-zinc-200 font-medium">Ctrl + O</kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
