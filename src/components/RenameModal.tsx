import React, { useState, useEffect, useRef } from 'react';
import { GoX } from 'react-icons/go';
import { Button } from './ui/button';

interface RenameModalProps {
  isOpen: boolean;
  currentName: string;
  componentId: string;
  onSave: (newName: string) => void;
  onClose: () => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  currentName,
  componentId,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  // 0-Latency Dragging via Direct DOM Transform (Matches SettingsModal standard)
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
      setName(currentName);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, currentName]);

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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      onSave(trimmed);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center select-none bg-black/60 backdrop-blur-xs">
      <div
        ref={modalBoxRef}
        className="pointer-events-auto w-[380px] max-w-[94vw] bg-[#141416] border border-[#242428] rounded-2xl shadow-2xl flex flex-col overflow-hidden outline-none will-change-transform text-zinc-200"
        style={{ transform: 'translate3d(0px, 0px, 0px)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Draggable Header (Clean Text Only) */}
        <div
          onPointerDown={handlePointerDown}
          className="h-11 px-4 bg-[#18181b] border-b border-[#222226] flex items-center justify-between cursor-move select-none shrink-0"
        >
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-xs tracking-tight">
            <span>Rename Component</span>
            <span className="text-[10px] text-zinc-500 font-mono font-normal">| {componentId}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close"
          >
            <GoX className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs bg-[#141416]">
          <div className="space-y-1.5">
            <label className="text-zinc-400 font-medium text-xs">New Name / Label</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-8 px-3 bg-[#1c1c20] border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:border-zinc-500 outline-none"
              placeholder="e.g. Status LED"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222226]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-full h-7 text-xs px-3 border-zinc-700 bg-transparent text-zinc-300 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={!name.trim()}
              className="rounded-full h-7 text-xs px-4 bg-white text-zinc-950 hover:bg-zinc-200 font-semibold shadow-xs cursor-pointer disabled:opacity-40"
            >
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
