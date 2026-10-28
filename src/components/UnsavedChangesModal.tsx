import React, { useEffect } from 'react';
import { GoAlert, GoFile, GoTrash, GoX } from 'react-icons/go';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in-0 duration-150">
      <div className="w-full max-w-md bg-[#121215] border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col text-zinc-100">
        {/* Header */}
        <div className="h-11 px-4 border-b border-[#222226] flex items-center justify-between bg-[#16161a]">
          <div className="flex items-center gap-2 text-amber-400 font-medium text-xs">
            <GoAlert className="w-4 h-4" />
            <span>Unsaved Changes</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Cancel (Escape)"
          >
            <GoX className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <p className="text-sm font-medium text-zinc-100">
            Do you want to save the changes you made to{' '}
            <span className="font-semibold text-white underline decoration-amber-500/50 underline-offset-4">
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
        <div className="px-5 py-3.5 bg-[#141418] border-t border-[#222226] flex items-center justify-end gap-2 text-xs">
          {/* Cancel */}
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="h-8 px-3 rounded-md bg-[#1e1e24] hover:bg-[#27272e] text-zinc-300 hover:text-white border border-zinc-700 font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          {/* Discard / Don't Save */}
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="h-8 px-3 rounded-md bg-rose-950/30 hover:bg-rose-950/70 text-rose-300 hover:text-rose-200 border border-rose-900/60 font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <GoTrash className="w-3.5 h-3.5" />
            <span>Discard</span>
          </button>

          {/* Save & Exit */}
          <button
            type="button"
            onClick={() => onSave()}
            disabled={isSaving}
            className="h-8 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
          >
            {isSaving ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : null}
            <span>Save & Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
