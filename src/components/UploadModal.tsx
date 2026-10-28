import React, { useState, useEffect } from 'react';
import { GoX, GoZap, GoCpu, GoFileCode } from 'react-icons/go';
import { CircuitComponent, ProjectFileEntry } from '../types';

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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div className="w-[420px] bg-[#121215] border border-[#27272a] rounded-xl shadow-2xl p-5 text-zinc-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[#27272a] flex items-center justify-center text-amber-400">
              <GoZap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Upload & Flash Target</h2>
              <p className="text-[11px] text-zinc-400">Target MCU Board & Port Configuration</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] transition-colors"
          >
            <GoX className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-4 text-xs">
          {unoBoards.length === 0 ? (
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 text-center">
              No Arduino Uno boards found on the canvas. Add a board first to flash firmware.
            </div>
          ) : (
            <>
              {/* Target Board */}
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium flex items-center gap-1.5">
                  <GoCpu className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Target Board</span>
                </label>
                <select
                  value={selectedBoardId}
                  onChange={(e) => handleBoardChange(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded px-2.5 py-1.5 text-zinc-200 focus:border-zinc-500 outline-none"
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
                <label className="text-zinc-400 font-medium flex items-center justify-between">
                  <span>Assigned Port</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Inspectable via Inspector</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={comPort}
                    onChange={(e) => handlePortChange(e.target.value)}
                    placeholder="e.g. COM1"
                    className="flex-1 bg-[#18181b] border border-[#27272a] rounded px-2.5 py-1.5 font-mono text-zinc-200 focus:border-zinc-500 outline-none"
                  />
                  {['COM1', 'COM2', 'COM3'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePortChange(p)}
                      className={`px-2 py-1 rounded text-xs border font-mono transition-colors ${
                        comPort === p
                          ? 'bg-zinc-800 border-zinc-500 text-white'
                          : 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source Sketch File */}
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-medium flex items-center gap-1.5">
                  <GoFileCode className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Source Code Sketch</span>
                </label>
                <select
                  value={selectedFile}
                  onChange={(e) => handleFileChange(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded px-2.5 py-1.5 text-zinc-200 focus:border-zinc-500 outline-none font-mono"
                >
                  {codeFiles.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name} {f.name === 'sketch.ino' ? '(Active Editor)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Info summary */}
              <div className="p-2.5 bg-[#18181b] border border-[#222226] rounded text-[11px] text-zinc-400 space-y-1">
                <div className="flex justify-between">
                  <span>Architecture:</span>
                  <span className="font-mono text-zinc-300">AVR ATmega328P @ 16 MHz</span>
                </div>
                <div className="flex justify-between">
                  <span>Flash Action:</span>
                  <span className="font-mono text-zinc-300">
                    Compile {selectedFile} → {comPort}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#27272a]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#27272a] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isCompiling || unoBoards.length === 0}
            onClick={handleFlash}
            className="px-4 py-1.5 rounded text-xs font-medium bg-zinc-200 text-zinc-900 hover:bg-white flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {isCompiling ? (
              <>
                <div className="w-3 h-3 border-2 border-zinc-600 border-t-zinc-900 rounded-full animate-spin" />
                <span>Flashing...</span>
              </>
            ) : (
              <>
                <GoZap className="w-3.5 h-3.5" />
                <span>Flash to {comPort}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
