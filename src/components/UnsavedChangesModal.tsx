import React, { useEffect, useRef } from 'react';
import { GoFile, GoTrash, GoX } from 'react-icons/go';
import { Button } from './ui/button';

export interface UnsavedChangesModalProps {
  isOpen: boolean;
  projectName: string;
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  projectName,
  onSave,
  onDiscard,
  onCancel,
  isSaving = false,
}) => {
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
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onSave]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

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

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center select-none bg-black/60 backdrop-blur-xs">
      <div
        ref={modalBoxRef}
        className="pointer-events-auto w-full max-w-md bg-[#141416] border border-[#242428] rounded-2xl shadow-2xl flex flex-col overflow-hidden outline-none will-change-transform text-zinc-100"
        style={{ transform: 'translate3d(0px, 0px, 0px)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Draggable Header (Clean Text Only) */}
        <div
          onPointerDown={handlePointerDown}
          className="h-11 px-4 bg-[#18181b] border-b border-[#222226] flex items-center justify-between cursor-move select-none shrink-0"
        >
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-xs tracking-tight">
            <span>Unsaved Changes</span>
            <span className="text-[10px] text-zinc-500 font-mono font-normal">| Project Warning</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Cancel (Escape)"
          >
            <GoX className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 bg-[#141416]">
          <p className="text-sm font-medium text-zinc-100">
            Do you want to save the changes you made to{' '}
            <span className="font-semibold text-white underline decoration-zinc-500 underline-offset-4">
              {projectName}
            </span>
            ?
          </p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Your recent circuit modifications, code edits, and component positions will be permanently lost if you close without saving.
          </p>
          <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1.5 pt-1">
            <GoFile className="w-3.5 h-3.5 text-zinc-400" />
            <span>Target: {projectName} (sketch.ino, circuit diagram)</span>
          </div>
        </div>

        {/* Footer Actions (Save / Discard / Cancel) */}
        <div className="h-12 px-4 bg-[#18181b] border-t border-[#222226] flex items-center justify-end gap-2 shrink-0">
          {/* Cancel */}
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-full h-7 text-xs px-3 border-zinc-700 bg-transparent text-zinc-300 hover:text-white"
          >
            Cancel
          </Button>

          {/* Discard / Don't Save */}
          <Button
            type="button"
            variant="outline"
            onClick={onDiscard}
            disabled={isSaving}
            className="rounded-full h-7 text-xs px-3 border-rose-900/60 bg-rose-950/30 hover:bg-rose-950/70 text-rose-300 hover:text-rose-200 font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <GoTrash className="w-3.5 h-3.5" />
            <span>Discard</span>
          </Button>

          {/* Save & Exit */}
          <Button
            type="button"
            variant="default"
            onClick={() => onSave()}
            disabled={isSaving}
            className="rounded-full h-7 text-xs px-4 bg-white text-zinc-950 hover:bg-zinc-200 font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {isSaving ? (
              <div className="w-3 h-3 border-2 border-zinc-600 border-t-zinc-900 rounded-full animate-spin" />
            ) : null}
            <span>Save & Close</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
