import React, { useEffect, useRef } from 'react';
import {
  GoCopy,
  GoTrash,
  GoSync,
  GoGear,
  GoPencil,
} from 'react-icons/go';
import { Scissors, Clipboard, FlipHorizontal } from 'lucide-react';

export interface ContextMenuProps {
  x: number;
  y: number;
  type: 'single' | 'group' | 'canvas';
  selectedCount?: number;
  componentName?: string;
  onClose: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onRotate?: () => void;
  onFlip?: () => void;
  onRename?: () => void;
  onProperties?: () => void;
}

export const CanvasContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  type,
  selectedCount = 1,
  componentName,
  onClose,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onRotate,
  onFlip,
  onRename,
  onProperties,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust positioning to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - (type === 'group' ? 240 : 300));

  const MenuItem = ({
    icon: Icon,
    label,
    shortcut,
    onClick,
    danger = false,
  }: {
    icon: any;
    label: string;
    shortcut?: string;
    onClick?: () => void;
    danger?: boolean;
  }) => (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        onClose();
      }}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded transition-colors text-left ${
        danger
          ? 'text-red-400 hover:text-red-300 hover:bg-red-950/40'
          : 'text-zinc-200 hover:bg-[#27272a] hover:text-white'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 opacity-80" />
        <span>{label}</span>
      </div>
      {shortcut && <span className="text-[10px] text-zinc-500 font-mono">{shortcut}</span>}
    </button>
  );

  const Divider = () => <div className="h-px bg-[#27272a] my-1" />;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] bg-[#121215] border border-[#27272a] rounded-lg shadow-2xl p-1 font-sans text-zinc-200 select-none animate-in fade-in zoom-in-95 duration-100"
      style={{
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {type === 'single' && (
        <>
          {componentName && (
            <div className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-[#27272a]/80 mb-1">
              {componentName}
            </div>
          )}
          {onRename && <MenuItem icon={GoPencil} label="Edit / Rename" shortcut="F2" onClick={onRename} />}
          {onCopy && <MenuItem icon={GoCopy} label="Copy" shortcut="Ctrl+C" onClick={onCopy} />}
          {onCut && <MenuItem icon={Scissors} label="Cut" shortcut="Ctrl+X" onClick={onCut} />}
          {onPaste && <MenuItem icon={Clipboard} label="Paste" shortcut="Ctrl+V" onClick={onPaste} />}
          <Divider />
          {onRotate && <MenuItem icon={GoSync} label="Rotate 90°" shortcut="R" onClick={onRotate} />}
          {onFlip && <MenuItem icon={FlipHorizontal} label="Flip Horizontal" shortcut="F" onClick={onFlip} />}
          <Divider />
          {onDelete && <MenuItem icon={GoTrash} label="Delete" shortcut="Del" onClick={onDelete} danger />}
          {onProperties && (
            <>
              <Divider />
              <MenuItem icon={GoGear} label="Properties (Inspect)" onClick={onProperties} />
            </>
          )}
        </>
      )}

      {type === 'group' && (
        <>
          <div className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-[#27272a]/80 mb-1 flex items-center justify-between">
            <span>Group Selection</span>
            <span className="text-[10px] bg-[#27272a] px-1.5 py-0.2 rounded font-mono text-zinc-300">
              {selectedCount} items
            </span>
          </div>
          {onCopy && <MenuItem icon={GoCopy} label="Copy Group" shortcut="Ctrl+C" onClick={onCopy} />}
          {onCut && <MenuItem icon={Scissors} label="Cut Group" shortcut="Ctrl+X" onClick={onCut} />}
          {onPaste && <MenuItem icon={Clipboard} label="Paste" shortcut="Ctrl+V" onClick={onPaste} />}
          <Divider />
          {onRotate && <MenuItem icon={GoSync} label="Rotate Group 90°" shortcut="R" onClick={onRotate} />}
          {onFlip && <MenuItem icon={FlipHorizontal} label="Flip Group" shortcut="F" onClick={onFlip} />}
          <Divider />
          {onDelete && <MenuItem icon={GoTrash} label="Delete Group" shortcut="Del" onClick={onDelete} danger />}
        </>
      )}

      {type === 'canvas' && (
        <>
          <div className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-[#27272a]/80 mb-1">
            Canvas
          </div>
          {onPaste && <MenuItem icon={Clipboard} label="Paste" shortcut="Ctrl+V" onClick={onPaste} />}
        </>
      )}
    </div>
  );
};
