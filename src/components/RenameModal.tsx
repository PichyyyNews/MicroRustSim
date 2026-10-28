import React, { useState, useEffect, useRef } from 'react';
import { GoPencil, GoX } from 'react-icons/go';

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

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, currentName]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div className="w-[360px] bg-[#121215] border border-[#27272a] rounded-xl shadow-2xl p-4 text-zinc-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#27272a] flex items-center justify-center text-zinc-300">
              <GoPencil className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-100">Rename Component</h3>
              <p className="text-[10px] text-zinc-500 font-mono">{componentId}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#27272a] transition-colors"
          >
            <GoX className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pt-3 space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] text-zinc-400 font-medium">New Name / Label</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-8 px-2.5 bg-[#18181b] border border-[#27272a] rounded text-xs text-zinc-100 focus:border-zinc-500 outline-none"
              placeholder="e.g. Status LED"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27272a]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#27272a] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-3.5 py-1.5 rounded text-xs font-medium bg-zinc-200 text-zinc-900 hover:bg-white transition-colors disabled:opacity-40 cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
