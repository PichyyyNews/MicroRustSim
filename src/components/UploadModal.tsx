import React, { useState, useEffect, useRef } from 'react';
import { GoX, GoZap, GoCpu, GoFileCode } from 'react-icons/go';
import { CircuitComponent, ProjectFileEntry } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  components: CircuitComponent[];
  files: ProjectFileEntry[];
  currentSketchCode: string;
  isCompiling: boolean;
  onUpload: (targetBoardId: string, comPort: string, fileName: string) => Promise<boolean>;
  onUpdateBoardPort: (boardId: string, comPort: string, linkedFile?: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  components,
  files,
  currentSketchCode,
  isCompiling,
  onUpload,
  onUpdateBoardPort,
}) => {
  const unoBoards = components.filter((c) => c.kind === 'arduino_uno');

  const [selectedBoardId, setSelectedBoardId] = useState<string>(
    unoBoards[0]?.id || ''
  );
  const [comPort, setComPort] = useState<string>('COM1');
  const [selectedFile, setSelectedFile] = useState<string>('sketch.ino');

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
    if (unoBoards.length > 0) {
      const currentBoard = unoBoards.find((b) => b.id === selectedBoardId) || unoBoards[0];
      setSelectedBoardId(currentBoard.id);
      setComPort(currentBoard.props?.comPort || currentBoard.props?.port || 'COM1');
      if (currentBoard.props?.linkedFile) {
        setSelectedFile(currentBoard.props.linkedFile);
      }
    }
  }, [isOpen, components]);

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

  const handleBoardChange = (boardId: string) => {
    setSelectedBoardId(boardId);
    const board = unoBoards.find((b) => b.id === boardId);
    if (board) {
      setComPort(board.props?.comPort || board.props?.port || 'COM1');
      if (board.props?.linkedFile) {
        setSelectedFile(board.props.linkedFile);
      }
    }
  };

  const handlePortChange = (newPort: string) => {
    setComPort(newPort);
    if (selectedBoardId) {
      onUpdateBoardPort(selectedBoardId, newPort, selectedFile);
    }
  };

  const handleFileChange = (newFile: string) => {
    setSelectedFile(newFile);
    if (selectedBoardId) {
      onUpdateBoardPort(selectedBoardId, comPort, newFile);
    }
  };

  const handleFlash = async () => {
    if (!selectedBoardId) return;
    const success = await onUpload(selectedBoardId, comPort, selectedFile);
    if (success) {
      onClose();
    }
  };

  // Filter sketch files (.ino, .cpp, .c)
  const codeFiles = files.filter(
    (f) => !f.is_dir && (f.name.endsWith('.ino') || f.name.endsWith('.cpp') || f.name.endsWith('.c'))
  );
  if (codeFiles.length === 0) {
    codeFiles.push({
      name: 'sketch.ino',
      path: 'sketch.ino',
      relative_path: 'sketch.ino',
      is_dir: false,
      size: currentSketchCode.length,
    });
  }

  // Safe early return placed after all hooks
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center select-none bg-black/60 backdrop-blur-xs">
      <div
        ref={modalBoxRef}
        className="pointer-events-auto w-[460px] max-w-[94vw] bg-[#141416] border border-[#242428] rounded-2xl shadow-2xl flex flex-col overflow-hidden outline-none will-change-transform text-zinc-200"
        style={{ transform: 'translate3d(0px, 0px, 0px)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Draggable Header (Matches SettingsModal standard - Clean Text Only) */}
        <div
          onPointerDown={handlePointerDown}
          className="h-11 px-4 bg-[#18181b] border-b border-[#222226] flex items-center justify-between cursor-move select-none shrink-0"
        >
          <div className="flex items-center gap-2.5 text-zinc-100 font-semibold text-xs tracking-tight">
            <span>Upload & Flash Target</span>
            <span className="text-[10px] text-zinc-500 font-mono font-normal">| MCU & Port</span>
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
        <div className="p-4 space-y-3.5 text-xs bg-[#141416]">
          {unoBoards.length === 0 ? (
            <div className="p-6 bg-[#1c1c20] border border-zinc-800 rounded-xl text-zinc-400 text-center">
              No Arduino Uno boards found on the canvas. Add a board first to flash firmware.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Target Board */}
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium text-xs flex items-center gap-1.5">
                  <GoCpu className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Target Board</span>
                </label>
                <select
                  value={selectedBoardId}
                  onChange={(e) => handleBoardChange(e.target.value)}
                  className="w-full bg-[#1c1c20] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:border-zinc-500 outline-none cursor-pointer"
                >
                  {unoBoards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id} ({b.props?.comPort || b.props?.port || 'COM1'}) — Arduino Uno R3 (ATmega328P)
                    </option>
                  ))}
                </select>
              </div>

              {/* COM Port */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-zinc-400 font-medium text-xs">Assigned Port</label>
                  <span className="text-[10px] text-zinc-500 font-mono">Inspectable via Inspector</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={comPort}
                    onChange={(e) => handlePortChange(e.target.value)}
                    placeholder="e.g. COM1"
                    className="flex-1 bg-[#1c1c20] border border-zinc-800 rounded-xl px-3 py-1.5 font-mono text-zinc-200 focus:border-zinc-500 outline-none"
                  />
                  <div className="flex items-center gap-1">
                    {['COM1', 'COM2', 'COM3'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handlePortChange(p)}
                        className={`h-7 px-2.5 rounded-full text-xs font-mono transition-colors cursor-pointer ${
                          comPort === p
                            ? 'bg-white text-zinc-950 font-semibold shadow-xs'
                            : 'bg-[#1c1c20] border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Source Sketch File */}
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium text-xs flex items-center gap-1.5">
                  <GoFileCode className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Source Code Sketch</span>
                </label>
                <select
                  value={selectedFile}
                  onChange={(e) => handleFileChange(e.target.value)}
                  className="w-full bg-[#1c1c20] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:border-zinc-500 outline-none font-mono cursor-pointer"
                >
                  {codeFiles.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name} {f.name === 'sketch.ino' ? '(Active Editor)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Info summary Ledger (Level 2 Inset Box) */}
              <div className="p-3 bg-[#1c1c20] border border-zinc-800/80 rounded-xl text-xs text-zinc-400 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Architecture:</span>
                  <Badge variant="outline" className="font-mono text-[10px] h-5 border-zinc-700 text-zinc-200 whitespace-nowrap [word-break:keep-all]">
                    AVR ATmega328P @ 16&nbsp;MHz
                  </Badge>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-zinc-800/50">
                  <span className="text-zinc-400">Flash Action:</span>
                  <span className="font-mono text-zinc-200 text-[11px]">
                    Compile {selectedFile} → {comPort}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (Matches SettingsModal standard) */}
        <div className="h-12 px-4 bg-[#18181b] border-t border-[#222226] flex items-center justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-full h-7 text-xs px-3 border-zinc-700 bg-transparent text-zinc-300 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={isCompiling || unoBoards.length === 0}
            onClick={handleFlash}
            className="rounded-full h-7 text-xs px-4 bg-white text-zinc-950 hover:bg-zinc-200 font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isCompiling ? (
              <>
                <div className="w-3 h-3 border-2 border-zinc-600 border-t-zinc-950 rounded-full animate-spin" />
                <span>Flashing...</span>
              </>
            ) : (
              <>
                <GoZap className="w-3.5 h-3.5" />
                <span>Flash to {comPort}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
