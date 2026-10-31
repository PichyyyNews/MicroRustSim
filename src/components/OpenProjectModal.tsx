import React, { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  Clock,
  AlertCircle,
  X,
  FileCode2,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { RecentProject } from '../types';

export interface OpenProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: (path: string) => Promise<void> | void;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);

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
      setErrorMessage(null);
      setIsOpening(false);
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
    try {
      const selected = await onBrowseFolder();
      if (selected) {
        setProjectPathInput(selected);
        setErrorMessage(null);
        setIsOpening(true);
        await onOpen(selected);
      }
    } catch (err: any) {
      const rawMsg = typeof err === 'string' ? err : err?.message || String(err);
      setErrorMessage(`ไม่สามารถเปิดไดเรกทอรี: ${rawMsg}`);
    } finally {
      setIsOpening(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const path = projectPathInput.trim();
    if (!path) {
      setErrorMessage('กรุณาระบุที่อยู่ของโฟลเดอร์โปรเจกต์');
      return;
    }

    setErrorMessage(null);
    setIsOpening(true);
    try {
      await onOpen(path);
    } catch (err: any) {
      const rawMsg = typeof err === 'string' ? err : err?.message || String(err);
      setErrorMessage(`ไม่พบโฟลเดอร์โปรเจกต์: ${rawMsg}`);
    } finally {
      setIsOpening(false);
    }
  };

  const handleSelectRecent = async (path: string) => {
    setProjectPathInput(path);
    setErrorMessage(null);
    setIsOpening(true);
    try {
      await onOpen(path);
    } catch (err: any) {
      const rawMsg = typeof err === 'string' ? err : err?.message || String(err);
      setErrorMessage(`ไม่พบโฟลเดอร์โปรเจกต์: ${rawMsg}`);
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        ref={modalBoxRef}
        onClick={(e) => e.stopPropagation()}
        className="w-[500px] max-w-[94vw] bg-[#141416] border border-[#242428] rounded-2xl shadow-2xl flex flex-col overflow-hidden outline-none will-change-transform"
        style={{ transform: 'translate3d(0px, 0px, 0px)' }}
      >
        {/* Draggable Header */}
        <div
          onPointerDown={handlePointerDown}
          className="h-11 px-4 bg-[#18181b] border-b border-[#222226] flex items-center justify-between cursor-move select-none"
        >
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-xs tracking-tight">
            <FolderOpen className="w-4 h-4 text-zinc-300" />
            <span>Open Project Folder</span>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          <div>
            <label className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1.5 tracking-wider">
              Working Directory
            </label>
            <div className="flex gap-2">
              <Input
                value={projectPathInput}
                onChange={(e) => {
                  setProjectPathInput(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="e.g. C:/MicroRustSim/Projects/Traffic_Light"
                className={`bg-[#121215] text-zinc-100 font-mono text-xs flex-1 rounded-xl h-8 transition-colors ${
                  errorMessage
                    ? 'border-red-500/70 focus-visible:border-red-500'
                    : 'border-zinc-800 focus-visible:border-zinc-500'
                }`}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleBrowse}
                className="rounded-full border-zinc-700/80 bg-[#18181b] hover:bg-zinc-800 text-zinc-200 text-xs shrink-0 px-3.5 h-8 flex items-center gap-1.5"
                title="Browse folder using Windows File Explorer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                <span>Browse...</span>
              </Button>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl flex items-start gap-2.5 text-xs animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-red-200 leading-relaxed">
                <span className="font-semibold text-red-300 text-[11px] block">ไม่สามารถเปิดโปรเจกต์ได้</span>
                <span className="text-[11px] text-red-200/90 mt-0.5 block select-text font-sans">{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-red-200 p-0.5 rounded-full hover:bg-red-900/40 transition-colors shrink-0"
                title="ปิดการแจ้งเตือน"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Recent Projects Section */}
          {recentProjects.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                <Clock className="w-3 h-3 text-zinc-500" />
                <span>Recent Projects</span>
              </div>
              <div className="rounded-xl bg-[#1c1c20] p-1.5 border border-zinc-800/60 max-h-44 overflow-y-auto space-y-0.5 scrollbar-thin">
                {recentProjects.map((rec) => (
                  <div
                    key={rec.path}
                    onClick={() => handleSelectRecent(rec.path)}
                    className="px-3 py-2 rounded-lg hover:bg-[#26262a] cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
                      <FileCode2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 group-hover:text-white" />
                      <span className="font-medium text-zinc-200 text-xs group-hover:text-white truncate">
                        {rec.name}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 truncate max-w-[200px] shrink-0">
                      {rec.path}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isOpening}
              className="rounded-full border-zinc-700/80 bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-xs h-8 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isOpening}
              className="rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs px-4 h-8 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              {isOpening ? (
                <>
                  <div className="w-3 h-3 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  <span>Opening...</span>
                </>
              ) : (
                <span>Open Project</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
