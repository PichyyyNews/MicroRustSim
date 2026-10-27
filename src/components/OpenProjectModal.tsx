import React, { useState, useRef, useEffect } from 'react';
import {
  GoX,
  GoClock,
} from 'react-icons/go';
import {
  FolderOpen,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { RecentProject } from '../types';

export interface OpenProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: (path: string) => void;
  onBrowseFolder: () => Promise<string | null>;
  recentProjects: RecentProject[];
}

export const OpenProjectModal: React.FC<OpenProjectModalProps> = ({
  isOpen,
  onClose,
  onOpen,
  onBrowseFolder,
  recentProjects,
}) => {
  const [projectPathInput, setProjectPathInput] = useState('');

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

  const handleBrowse = async () => {
    const selected = await onBrowseFolder();
    if (selected) {
      setProjectPathInput(selected);
      onOpen(selected);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (projectPathInput.trim()) {
      onOpen(projectPathInput.trim());
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        ref={modalBoxRef}
        onClick={(e) => e.stopPropagation()}
        className="w-[500px] max-w-[92vw] bg-[#141417] border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden outline-none ring-0 will-change-transform"
        style={{ transform: 'translate3d(0px, 0px, 0px)' }}
      >
        {/* Draggable Header */}
        <div
          onPointerDown={handlePointerDown}
          className="h-10 px-4 bg-[#18181b] border-b border-zinc-800 flex items-center justify-between cursor-move select-none"
        >
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-xs tracking-wide">
            <FolderOpen className="w-4 h-4 text-zinc-300" />
            <span>Open Project Folder</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Close"
          >
            <GoX className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          <div>
            <label className="text-[11px] font-medium text-zinc-300 block mb-1">
              Select or Type Working Directory
            </label>
            <div className="flex gap-1.5">
              <Input
                value={projectPathInput}
                onChange={(e) => setProjectPathInput(e.target.value)}
                placeholder="e.g. C:/MicroRustSim/Projects/Traffic_Light"
                className="bg-[#121215] border-zinc-800 text-zinc-100 font-mono text-xs flex-1 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-zinc-500 rounded-md"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBrowse}
                className="border-zinc-800 bg-[#18181b] hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs shrink-0 px-3 h-8 flex items-center gap-1.5 rounded-md"
                title="Browse folder using Windows File Explorer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                <span>Browse...</span>
              </Button>
            </div>
          </div>

          {recentProjects.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                <GoClock className="w-3 h-3 text-zinc-500" />
                <span>Recent Projects</span>
              </div>
              <div className="bg-[#121215] border border-zinc-800 rounded-lg max-h-40 overflow-y-auto divide-y divide-zinc-800/60 scrollbar-thin">
                {recentProjects.map((rec) => (
                  <div
                    key={rec.path}
                    onClick={() => {
                      setProjectPathInput(rec.path);
                      onOpen(rec.path);
                    }}
                    className="px-3 py-2 hover:bg-zinc-800/50 cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <span className="font-medium text-zinc-200 text-xs group-hover:text-white truncate">
                      {rec.name}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 truncate max-w-[220px]">
                      {rec.path}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-zinc-800 bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-xs rounded-md"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs px-3.5 shadow-none transition-colors rounded-md"
            >
              Open Project
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
